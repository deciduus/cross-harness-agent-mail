// Local file delivery only. Session identities label ownership; they are not authentication.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const EXIT = Object.freeze({ ok: 0, refused: 2, stopped: 3, busy: 4, unsupported: 5 });
const MUTATIONS = new Set(['send', 'claim', 'reply', 'done', 'offer', 'accept', 'recover', 'stop', 'resume']);
const OPERATOR_ACTIONS = new Set(['init', 'recover', 'stop', 'resume']);
const BYPASS_STOP = new Set(['stop', 'resume']);
const ROLES = new Set(['coordinator', 'executor', 'critic', 'operator']);
const KINDS = new Set(['request', 'review', 'result', 'ack', 'note']);
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/, /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*\S{12,}/i,
];
const protectedName = /^(?:\.git|\.agent-mail|\.codex|\.claude|\.ssh|\.aws|\.azure|\.gnupg|\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|agents\.md|claude\.md|config\.toml|settings(?:\.local)?\.json|hooks\.json)$|(?:\.env|\.pem|\.key|\.pfx|\.p12|\.sqlite(?:-.*)?|\.db)$|(?:secret|credential)|^id_(?:rsa|ed25519|ecdsa)/i;

class Refusal extends Error {
  constructor(message, code = EXIT.refused) { super(message); this.code = code; }
}
function requireThat(condition, message, code) { if (!condition) throw new Refusal(message, code); }
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = milliseconds => new Date(milliseconds).toISOString();
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(k => k !== 'now').map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function relativeName(value) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= 400, 'path must be nonempty and bounded');
  const name = value.replaceAll('\\', '/');
  requireThat(!name.startsWith('/') && !name.startsWith('~') && !name.includes(':') && !/[\x00-\x1f<>"|?*,]/.test(name), 'absolute, network, stream, wildcard or control path refused');
  const directory = name.endsWith('/');
  const parts = (directory ? name.slice(0, -1) : name).split('/');
  for (const part of parts) {
    requireThat(part && part !== '.' && part !== '..' && !/[. ]$/.test(part), 'unsafe path component');
    requireThat(!/^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\..*)?$/i.test(part), 'reserved path name');
    requireThat(!protectedName.test(part), 'protected path name');
  }
  return parts.join('/') + (directory ? '/' : '');
}
const within = (name, root) => root.endsWith('/') ? `${name.replace(/\/$/, '')}/`.toLowerCase().startsWith(root.toLowerCase()) : name.toLowerCase() === root.toLowerCase();
const overlaps = (left, right) => within(left, right) || within(right, left);
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function exists(name) { try { await fs.lstat(name); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }

export async function loadConfig(filename) {
  const config = JSON.parse(await fs.readFile(filename, 'utf8'));
  const directory = path.dirname(path.resolve(filename));
  config.projectRoot = path.resolve(directory, config.projectRoot);
  config.mailboxDir = path.resolve(directory, config.mailboxDir);
  return config;
}

export function createMailbox(rawConfig, { clock = Date.now } = {}) {
  requireThat(rawConfig?.version === 1, 'config version must be 1');
  requireThat(typeof rawConfig.projectRoot === 'string' && typeof rawConfig.mailboxDir === 'string', 'config needs projectRoot and mailboxDir');
  const config = structuredClone(rawConfig);
  config.projectRoot = path.resolve(config.projectRoot);
  config.mailboxDir = path.resolve(config.mailboxDir);
  requireThat(config.projectRoot !== config.mailboxDir, 'mailbox must be distinct from project root');
  requireThat(config.participants && typeof config.participants === 'object' && !Array.isArray(config.participants), 'participants must be a registry');
  for (const [id, participant] of Object.entries(config.participants)) {
    requireThat(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id), 'invalid participant identifier');
    requireThat(ROLES.has(participant.role) && ['codex', 'claude', 'other'].includes(participant.engine), 'invalid role or engine');
  }
  requireThat(config.participants[config.operator]?.role === 'operator', 'operator must name a configured operator participant');
  requireThat(Array.isArray(config.allowedScope) && config.allowedScope.length > 0, 'allowedScope must be nonempty');
  config.allowedScope = config.allowedScope.map(relativeName);
  config.limits = { maxLeaseSeconds: 3600, maxTtlSeconds: 86400, maxHops: 3, maxBodyBytes: 204800, maxRefBytes: 10485760, ...config.limits };
  for (const [name, upper] of Object.entries({ maxLeaseSeconds: 86400, maxTtlSeconds: 604800, maxHops: 3, maxBodyBytes: 1048576, maxRefBytes: 20971520 })) {
    requireThat(Number.isInteger(config.limits[name]) && config.limits[name] > 0 && config.limits[name] <= upper, `invalid bounded limit: ${name}`);
  }
  requireThat(!config.adapter || config.adapter.type === 'manual', 'only manual session adapter is supported', EXIT.unsupported);
  const stateFile = path.join(config.mailboxDir, 'state.json');
  const lockFile = path.join(config.mailboxDir, '.lock');
  const fresh = now => ({ version: 1, createdAt: iso(now), stopped: null, messages: {}, idempotency: {}, events: [] });
  const participant = actor => { requireThat(Object.hasOwn(config.participants, actor), 'unknown participant'); return config.participants[actor]; };
  function operator(actor) { requireThat(participant(actor).role === 'operator' && actor === config.operator, 'explicit configured operator action required'); }
  function sessionName(session) { requireThat(typeof session === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(session), 'unique session label required'); }
  function bodyText(body) {
    requireThat(typeof body === 'string' && body.trim().length > 0 && Buffer.byteLength(body, 'utf8') <= config.limits.maxBodyBytes, 'body must be nonempty and bounded');
    requireThat(!secretPatterns.some(pattern => pattern.test(body)), 'body resembles credential material');
    return body;
  }
  async function validatePath(value, { reference = false } = {}) {
    let name = relativeName(value);
    requireThat(config.allowedScope.some(root => within(name, root)), 'path is outside configured allowlist');
    const root = await fs.lstat(config.projectRoot);
    requireThat(root.isDirectory() && !root.isSymbolicLink(), 'project root must be a real directory');
    let cursor = config.projectRoot;
    const parts = name.replace(/\/$/, '').split('/');
    for (let index = 0; index < parts.length; index++) {
      cursor = path.join(cursor, parts[index]);
      try {
        const stat = await fs.lstat(cursor);
        requireThat(!stat.isSymbolicLink(), 'symbolic link or junction refused');
        if (index < parts.length - 1) requireThat(stat.isDirectory(), 'path parent is not a directory');
        if (index === parts.length - 1) {
          if (reference) requireThat(stat.isFile() && stat.size <= config.limits.maxRefBytes && !name.endsWith('/'), 'reference must be a bounded regular file');
          else if (stat.isDirectory() && !name.endsWith('/')) name += '/';
          else requireThat(!name.endsWith('/') || stat.isDirectory(), 'directory scope is not a directory');
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        requireThat(!reference, 'reference file missing');
        break;
      }
    }
    // An existing directory must not masquerade as an allowlisted exact file.
    requireThat(config.allowedScope.some(root => within(name, root)), 'directory is outside configured allowlist');
    return name;
  }
  async function scopePaths(values) {
    requireThat(Array.isArray(values) && values.length > 0 && values.length <= 64, 'nonempty bounded scope required');
    return [...new Set(await Promise.all(values.map(value => validatePath(value))))];
  }
  async function refs(values = []) {
    requireThat(Array.isArray(values) && values.length <= 64, 'bounded reference array required');
    return Promise.all(values.map(async value => {
      const name = await validatePath(value, { reference: true });
      return { path: name, sha256: hash(await fs.readFile(path.join(config.projectRoot, name))) };
    }));
  }
  async function diagnostics(message) {
    return Promise.all(message.refs.map(async ref => {
      try {
        const name = await validatePath(ref.path, { reference: true });
        return { ...ref, state: hash(await fs.readFile(path.join(config.projectRoot, name))) === ref.sha256 ? 'same' : 'changed' };
      } catch (error) {
        if (error instanceof Refusal) return { ...ref, state: 'unavailable', reason: error.message };
        throw error;
      }
    }));
  }
  function event(state, type, now, fields = {}) {
    const receipt = { sequence: state.events.length + 1, type, at: iso(now), ...fields };
    state.events.push(receipt);
    return receipt;
  }
  function expire(state, now) {
    for (const message of Object.values(state.messages)) {
      if (['new', 'claimed'].includes(message.status) && Date.parse(message.expiresAt) <= now) {
        message.status = 'dead'; message.deadReason = 'ttl-expired'; message.transfer = null;
        event(state, 'expired', now, { id: message.id, owner: message.owner });
      }
    }
  }
  function messageById(state, id) { requireThat(Object.hasOwn(state.messages, id), 'message not found'); return state.messages[id]; }
  function currentOwner(state, input, now) {
    participant(input.actor); sessionName(input.session);
    const message = messageById(state, input.id);
    requireThat(message.status === 'claimed' && message.claim, 'message is not active claimed work');
    requireThat(message.claim.actor === input.actor && message.claim.session === input.session && message.claim.token === input.token, 'claim belongs to another owner or session, or fencing token is invalid');
    requireThat(Date.parse(message.claim.leaseUntil) > now, 'lease expired; explicit operator recovery required');
    return message;
  }
  function leaseSeconds(value = config.limits.maxLeaseSeconds) {
    requireThat(Number.isInteger(value) && value > 0 && value <= config.limits.maxLeaseSeconds, 'lease must be within configured bound');
    return value;
  }
  function conflict(state, scope, ignoreId) {
    // TTL expiration stops work, but cannot prove its editor stopped. Retain custody until reconciliation.
    return Object.values(state.messages).find(message => message.id !== ignoreId && message.claim && ['claimed', 'dead'].includes(message.status) && message.kind === 'request' && message.scope.some(old => scope.some(next => overlaps(old, next))));
  }
  async function readState() {
    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    requireThat(state.version === 1 && state.messages && state.idempotency && Array.isArray(state.events), 'invalid state snapshot');
    return state;
  }
  async function writeState(state) {
    const temporary = path.join(config.mailboxDir, `state.${process.pid}.${randomUUID()}.part`);
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(state, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    // Exclusive .lock has already serialized writers. Rename here is commit, never a claim lock.
    let renamed = false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await fs.rename(temporary, stateFile); renamed = true; break; }
        catch (error) {
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt === 2) throw error;
          await sleep(25 * (attempt + 1));
        }
      }
      // POSIX directory fsync improves crash durability. Windows Node cannot fsync directories.
      if (process.platform !== 'win32') {
        const directory = await fs.open(config.mailboxDir, 'r');
        try { await directory.sync(); } finally { await directory.close(); }
      }
    } finally { if (!renamed) await fs.unlink(temporary).catch(() => {}); }
  }
  async function lock() {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const handle = await fs.open(lockFile, 'wx', 0o600);
        try { await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: iso(clock()) }) + '\n'); await handle.sync(); }
        catch (error) { await handle.close(); await fs.unlink(lockFile); throw error; }
        return async () => { await handle.close(); await fs.unlink(lockFile); };
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (attempt === 3) throw new Refusal('mailbox lock busy; stop after bounded retries; inspect possible crash-leftover lock manually', EXIT.busy);
        await sleep(15 * (attempt + 1));
      }
    }
  }
  async function addMessage(state, input, now, parent = null) {
    const from = input.from ?? input.actor;
    participant(from); participant(input.to);
    requireThat(from !== input.to, 'sender and recipient must differ');
    requireThat(KINDS.has(input.kind), 'invalid kind');
    const ttl = input.ttlSeconds ?? config.limits.maxTtlSeconds;
    requireThat(Number.isInteger(ttl) && ttl > 0 && ttl <= config.limits.maxTtlSeconds, 'ttl must be within configured bound');
    const scope = await scopePaths(input.scope ?? parent?.scope);
    const references = input.refs ? await refs(input.refs) : parent ? structuredClone(parent.refs) : [];
    const hops = config.participants[from].role === 'operator' ? 0 : (parent?.hops ?? 0) + 1;
    const routed = hops >= config.limits.maxHops && config.participants[input.to].role !== 'operator';
    const message = {
      id: randomUUID(), from, to: routed ? config.operator : input.to, requestedTo: input.to,
      kind: input.kind, expects: ['request', 'review'].includes(input.kind) ? 'result' : 'none',
      body: bodyText(input.body), scope, refs: references, thread: parent?.thread ?? null,
      replyTo: parent?.id ?? null, hops, createdAt: iso(now), expiresAt: iso(now + ttl * 1000),
      status: 'new', owner: routed ? config.operator : input.to, claim: null, transfer: null,
      resultId: null, deadReason: null,
    };
    message.thread ??= message.id;
    if (input.kind === 'result') {
      requireThat(['ok', 'partial', 'refused', 'needs-human'].includes(input.status), 'result requires valid outcome status');
      message.outcome = input.status;
    }
    state.messages[message.id] = message;
    const receipt = event(state, routed ? 'routed-to-operator' : 'delivered', now, { id: message.id, from, to: message.to, kind: message.kind });
    return { message: structuredClone(message), receipt };
  }
  async function mutate(state, command, input, now) {
    if (OPERATOR_ACTIONS.has(command)) operator(input.actor);
    if (command === 'stop') {
      const reason = bodyText(input.reason);
      state.stopped = { actor: input.actor, reason, at: iso(now) };
      return { stopped: state.stopped, receipt: event(state, 'stopped', now, { actor: input.actor, reason }) };
    }
    if (command === 'resume') {
      bodyText(input.reason); state.stopped = null;
      return { stopped: null, receipt: event(state, 'resumed', now, { actor: input.actor, reason: input.reason }) };
    }
    if (command === 'send') {
      requireThat(['request', 'review'].includes(input.kind), 'new deliveries must be request or review; use reply for receipts and results');
      let parent = null;
      if (input.replyTo) {
        parent = currentOwner(state, { ...input, actor: input.from, id: input.replyTo }, now);
        requireThat(parent.expects === 'result' && !parent.resultId, 'cannot extend a terminal or answered message');
      }
      return addMessage(state, input, now, parent);
    }
    if (command === 'claim') {
      const role = participant(input.actor).role; sessionName(input.session);
      const message = messageById(state, input.id);
      requireThat(message.to === input.actor, 'only addressed recipient may claim');
      requireThat(role !== 'critic' || message.kind !== 'request', 'critic participant cannot own write requests; deliver read-only review instead');
      requireThat(message.status === 'new', message.status === 'claimed' ? 'already claimed; expired lease requires explicit recovery' : 'message is terminal or expired');
      await scopePaths(message.scope);
      const refDiagnostics = await diagnostics(message);
      requireThat(!refDiagnostics.some(ref => ref.state === 'unavailable'), 'reference became unsafe or missing; inspect read diagnostics');
      const conflicting = message.kind === 'request' ? conflict(state, message.scope, message.id) : null;
      requireThat(!conflicting, `scope already owned by claim ${conflicting?.id ?? ''}`);
      message.status = 'claimed'; message.owner = input.actor;
      message.claim = { actor: input.actor, session: input.session, token: randomUUID(), claimedAt: iso(now), leaseUntil: iso(now + leaseSeconds(input.leaseSeconds) * 1000) };
      return { message: structuredClone(message), refDiagnostics, authorityNotice: 'Message routing grants no permission. Apply your own session rules and the user-authorized task scope.', receipt: event(state, 'claimed', now, { id: message.id, actor: input.actor, session: input.session }) };
    }
    if (command === 'reply') {
      const parent = currentOwner(state, input, now);
      requireThat(parent.expects === 'result' && !parent.resultId, 'cannot reply to a terminal or answered message');
      requireThat(['ack', 'note', 'result'].includes(input.kind), 'reply kind must be ack, note or result');
      const delivered = await addMessage(state, { ...input, from: input.actor, to: parent.from, scope: parent.scope }, now, parent);
      if (input.kind === 'result') parent.resultId = delivered.message.id;
      return delivered;
    }
    if (command === 'done') {
      const message = currentOwner(state, input, now);
      requireThat(message.expects === 'none' || message.resultId, 'ack or note is not a result; send result before done');
      message.status = 'done'; message.transfer = null;
      return { message: structuredClone(message), receipt: event(state, 'completed', now, { id: message.id, actor: input.actor, resultId: message.resultId }) };
    }
    if (command === 'offer') {
      const message = currentOwner(state, input, now);
      const reason = bodyText(input.reason);
      participant(input.to);
      requireThat(config.participants[input.to].role !== 'critic' || message.kind !== 'request', 'critic participant cannot receive write ownership; use read-only review');
      requireThat(input.to !== input.actor && !message.resultId && message.expects === 'result', 'cannot transfer to self or transfer answered/terminal work');
      requireThat(!message.transfer, 'ownership transfer already pending');
      const transfer = { id: randomUUID(), to: input.to, from: input.actor, session: input.session, offeredAt: iso(now), reason };
      message.transfer = transfer;
      return { transfer, receipt: event(state, 'ownership-offered', now, { id: message.id, offerId: transfer.id, from: input.actor, to: input.to, reason }) };
    }
    if (command === 'accept') {
      participant(input.actor); sessionName(input.session);
      const message = messageById(state, input.id);
      requireThat(message.status === 'claimed' && message.claim && Date.parse(message.claim.leaseUntil) > now, 'transfer requires active lease; explicit recovery required');
      requireThat(message.expects === 'result' && !message.resultId, 'cannot accept answered or terminal work');
      requireThat(message.transfer?.id === input.offerId && message.transfer.to === input.actor, 'transfer offer is absent or belongs to another recipient');
      await scopePaths(message.scope);
      const refDiagnostics = await diagnostics(message);
      requireThat(!refDiagnostics.some(ref => ref.state === 'unavailable'), 'reference became unsafe or missing; inspect read diagnostics');
      const conflicting = message.kind === 'request' ? conflict(state, message.scope, message.id) : null;
      requireThat(!conflicting, 'scope conflict while accepting transfer');
      const previousOwner = message.owner;
      message.owner = input.actor; message.to = input.actor; message.transfer = null;
      message.claim = { actor: input.actor, session: input.session, token: randomUUID(), claimedAt: iso(now), leaseUntil: iso(now + leaseSeconds(input.leaseSeconds) * 1000) };
      return { message: structuredClone(message), refDiagnostics, receipt: event(state, 'ownership-accepted', now, { id: message.id, from: previousOwner, to: input.actor, session: input.session }) };
    }
    if (command === 'recover') {
      const reason = bodyText(input.reason);
      const message = messageById(state, input.id);
      requireThat(message.claim && (message.status === 'claimed' || (message.status === 'dead' && message.deadReason === 'ttl-expired')), 'only a live or TTL-dead claim can be recovered');
      requireThat(Date.parse(message.claim.leaseUntil) <= now, 'lease remains active; wait for expiry or coordinate with owner');
      const previousClaim = message.claim;
      if (message.resultId) message.status = 'done';
      else if (message.status !== 'dead') message.status = 'new';
      message.claim = null;
      message.transfer = null;
      return { message: structuredClone(message), receipt: event(state, 'claim-recovered', now, { id: message.id, actor: input.actor, reason, disposition: message.status, previousOwner: previousClaim.actor, previousSession: previousClaim.session }) };
    }
    throw new Refusal('unknown command');
  }

  async function execute(command, input = {}) {
    try {
      requireThat(input && typeof input === 'object' && !Array.isArray(input), 'input must be a JSON object');
      if (command === 'capabilities') return { ok: true, code: 0, transport: 'local-file', adapter: 'manual', delivery: true, wake: false, stopSession: false, engines: ['codex', 'claude', 'other'], identity: 'self-declared labels, not authentication' };
      if (command === 'wake' || command === 'stop-session') throw new Refusal('manual adapter has no tested session wake or stop capability; no process was invoked', EXIT.unsupported);
      if (command === 'validate-path') return { ok: true, code: 0, path: await validatePath(input.path) };
      if (command === 'init') {
        operator(input.actor);
        await fs.mkdir(config.mailboxDir, { recursive: true, mode: 0o700 });
      }
      requireThat(await exists(config.mailboxDir), 'mailbox not initialized');
      const mailboxStat = await fs.lstat(config.mailboxDir);
      requireThat(mailboxStat.isDirectory() && !mailboxStat.isSymbolicLink(), 'mailbox directory must not be a link');
      if (['read', 'status', 'check'].includes(command)) {
        const state = await readState();
        if (command === 'check') {
          participant(input.actor);
          if (state.stopped) throw new Refusal('STOP is set; use read/status only until operator resumes', EXIT.stopped);
        }
        if (command === 'read') {
          const message = structuredClone(messageById(state, input.id));
          const effectiveStatus = ['new', 'claimed'].includes(message.status) && Date.parse(message.expiresAt) <= clock() ? 'dead' : message.status;
          return { ok: true, code: 0, message, effectiveStatus, refDiagnostics: await diagnostics(message) };
        }
        const now = clock();
        const messages = Object.values(state.messages).filter(message => command !== 'check' || message.to === input.actor || message.claim?.actor === input.actor).map(message => ({
          id: message.id, from: message.from, to: message.to, kind: message.kind, scope: message.scope,
          status: ['new', 'claimed'].includes(message.status) && Date.parse(message.expiresAt) <= now ? 'dead' : message.status,
          deadReason: Date.parse(message.expiresAt) <= now && ['new', 'claimed'].includes(message.status) ? 'ttl-expired' : message.deadReason,
          claim: message.claim && { actor: message.claim.actor, session: message.claim.session, leaseUntil: message.claim.leaseUntil, stale: Date.parse(message.claim.leaseUntil) <= now },
          resultId: message.resultId, transfer: message.transfer,
        }));
        const filenames = await fs.readdir(config.mailboxDir);
        return { ok: true, code: 0, stopped: state.stopped, messages, events: state.events, lockPresent: filenames.includes('.lock'), incompleteSnapshots: filenames.filter(name => name.endsWith('.part')) };
      }
      requireThat(command === 'init' || MUTATIONS.has(command), 'unknown command');
      const unlock = await lock();
      try {
        const now = clock();
        if (command === 'init') {
          if (await exists(stateFile)) return { ok: true, code: 0, initialized: false, existing: true };
          await writeState(fresh(now));
          return { ok: true, code: 0, initialized: true };
        }
        let state = await readState();
        // Idempotency is durable even for STOP/expired refusals; a changed request needs a new key.
        const identity = input.actor ?? input.from;
        participant(identity);
        requireThat(typeof input.idempotencyKey === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(input.idempotencyKey), 'bounded idempotencyKey required for mutation');
        const key = `${identity}:${input.idempotencyKey}`;
        const digest = hash(canonical({ command, input }));
        if (Object.hasOwn(state.idempotency, key)) {
          requireThat(state.idempotency[key].digest === digest, 'idempotency key reused for different payload');
          return { ...structuredClone(state.idempotency[key].result), replayed: true };
        }
        expire(state, now);
        // Validation can refuse after a handler has begun changing ownership. Publish its
        // candidate only on success; refusals preserve expiry bookkeeping and add one receipt.
        const candidate = structuredClone(state);
        let result;
        try {
          if (state.stopped && !BYPASS_STOP.has(command)) throw new Refusal('STOP is set; ordinary mutation blocked', EXIT.stopped);
          result = { ok: true, code: 0, ...await mutate(candidate, command, input, now) };
          state = candidate;
        } catch (error) {
          if (!(error instanceof Refusal)) throw error;
          result = { ok: false, code: error.code, error: error.message, receipt: event(state, 'refused', now, { command, actor: identity, code: error.code, reason: error.message }) };
        }
        state.idempotency[key] = { digest, result };
        await writeState(state);
        return result;
      } finally { await unlock(); }
    } catch (error) {
      return { ok: false, code: error instanceof Refusal ? error.code : EXIT.refused, error: error instanceof Refusal ? error.message : `local I/O failure (${error.code ?? error.name}); inspect local state before retrying` };
    }
  }
  return { execute, config: structuredClone(config) };
}
