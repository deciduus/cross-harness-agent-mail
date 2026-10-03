import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createMailbox, loadConfig } from '../mailbox.mjs';
import { runDemo } from '../demo.mjs';

const script = fileURLToPath(new URL('../mail.mjs', import.meta.url));
let sequence = 0;
const key = () => `test-${++sequence}`;
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'agent-mail-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectRoot = path.join(root, 'project');
  await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'tests'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'src', 'one.txt'), 'synthetic original\n');
  let now = Date.UTC(2030, 0, 1);
  const config = {
    version: 1, projectRoot, mailboxDir: path.join(root, 'mailbox'), allowedScope: ['src/', 'tests/'],
    operator: 'operator', adapter: { type: 'manual' },
    participants: { operator: { role: 'operator', engine: 'other' }, coordinator: { role: 'coordinator', engine: 'codex' }, worker: { role: 'executor', engine: 'claude' }, worker2: { role: 'executor', engine: 'codex' }, critic: { role: 'critic', engine: 'other' } },
    ...options,
  };
  const mailbox = createMailbox(config, { clock: () => now });
  assert.equal((await mailbox.execute('init', { actor: 'operator' })).code, 0);
  const run = (command, input) => mailbox.execute(command, { idempotencyKey: key(), ...input });
  const send = (changes = {}) => run('send', { from: 'coordinator', to: 'worker', kind: 'request', body: 'Synthetic authorized inspection.', scope: ['src/'], ...changes });
  const claim = (message, changes = {}) => run('claim', { actor: message.to, session: 'session-a', id: message.id, ...changes });
  const own = result => ({ actor: result.message.claim.actor, session: result.message.claim.session, id: result.message.id, token: result.message.claim.token });
  return { root, config, mailbox, run, send, claim, own, advance: milliseconds => { now += milliseconds; } };
}
function ok(result) { assert.equal(result.code, 0, JSON.stringify(result)); return result; }
function refused(result, pattern) { assert.equal(result.code, 2, JSON.stringify(result)); if (pattern) assert.match(result.error, pattern); }

test('request -> claim -> durable ACK receipt -> note -> result -> done', async t => {
  const f = await fixture(t);
  const sent = ok(await f.send({ refs: ['src/one.txt'] }));
  const claim = ok(await f.claim(sent.message));
  assert.equal(claim.refDiagnostics[0].state, 'same');
  assert.match(claim.authorityNotice, /grants no permission/);
  const owner = f.own(claim);
  const ack = ok(await f.run('reply', { ...owner, kind: 'ack', body: 'Received.' }));
  assert.equal(ack.message.to, 'coordinator');
  assert.equal(ack.receipt.kind, 'ack');
  ok(await f.run('claim', { actor: 'coordinator', session: 'coord', id: ack.message.id }));
  refused(await f.run('done', owner), /not a result/);
  ok(await f.run('reply', { ...owner, kind: 'note', body: 'Progress.' }));
  const result = ok(await f.run('reply', { ...owner, kind: 'result', status: 'ok', body: 'Inspection complete.' }));
  refused(await f.run('reply', { ...owner, kind: 'note', body: 'Late extra reply.' }), /answered/);
  const finished = ok(await f.run('done', owner));
  assert.equal(finished.message.status, 'done');
  const resultClaim = ok(await f.claim(result.message, { session: 'coord-result' }));
  refused(await f.run('reply', { ...f.own(resultClaim), kind: 'ack', body: 'Reply loop.' }), /terminal/);
  assert.equal(ok(await f.run('done', f.own(resultClaim))).message.status, 'done');
});

test('durable retry returns same delivery and receipt across reopen, independent of supplied now', async t => {
  const f = await fixture(t);
  const request = { from: 'coordinator', to: 'worker', kind: 'request', body: 'Inspect once.', scope: ['src/'], idempotencyKey: 'stable-delivery', now: 'ignored' };
  const first = ok(await f.mailbox.execute('send', request));
  const reopened = createMailbox(f.config);
  const replay = ok(await reopened.execute('send', { ...request, now: 'different ignored value' }));
  assert.equal(replay.message.id, first.message.id);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(replay.replayed, true);
  refused(await reopened.execute('send', { ...request, body: 'Different scope of work.' }), /different payload/);
  const status = ok(await f.run('status', {}));
  assert.equal(status.messages.length, 1);
  assert.equal(status.events.filter(event => event.type === 'delivered').length, 1);
});

test('ACK and result retries do not create duplicates; done retry is durable', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message));
  for (const kind of ['ack', 'result']) {
    const request = { ...f.own(claimed), kind, body: 'Synthetic response.', ...(kind === 'result' ? { status: 'ok' } : {}), idempotencyKey: `stable-${kind}` };
    const first = ok(await f.mailbox.execute('reply', request));
    const replay = ok(await createMailbox(f.config).execute('reply', request));
    assert.equal(replay.message.id, first.message.id);
    assert.equal(replay.replayed, true);
  }
  const done = { ...f.own(claimed), idempotencyKey: 'stable-done' };
  ok(await f.mailbox.execute('done', done));
  assert.equal(ok(await f.mailbox.execute('done', done)).replayed, true);
  assert.equal(ok(await f.run('status', {})).messages.length, 3);
});

test('same participant in a different session cannot reply, complete or offer ownership', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message));
  const impersonated = { ...f.own(claimed), session: 'different-session' };
  refused(await f.run('reply', { ...impersonated, kind: 'result', status: 'ok', body: 'Should refuse.' }), /another owner/);
  refused(await f.run('done', impersonated), /another owner/);
  refused(await f.run('offer', { ...impersonated, to: 'worker2', reason: 'Unauthorized synthetic handoff.' }), /another owner/);
  refused(await f.run('reply', { ...f.own(claimed), token: 'wrong', kind: 'ack', body: 'Should refuse.' }), /fencing/);
});

test('invalid claim lease leaves delivery reclaimable and preserves expiry/refusal bookkeeping', async t => {
  const f = await fixture(t);
  const expired = ok(await f.send({ scope: ['tests/'], ttlSeconds: 1 }));
  const sent = ok(await f.send());
  f.advance(1001);
  const before = ok(await f.run('read', { id: sent.message.id })).message;
  for (const leaseSeconds of [0, 3601, 1.5, '10']) {
    refused(await f.claim(sent.message, { leaseSeconds }), /lease must be within/);
    const after = ok(await f.run('read', { id: sent.message.id })).message;
    assert.deepEqual(after, before);
    assert.equal(after.status, 'new');
    assert.equal(after.claim, null);
  }
  const snapshot = JSON.parse(await fs.readFile(path.join(f.config.mailboxDir, 'state.json'), 'utf8'));
  assert.equal(snapshot.messages[expired.message.id].status, 'dead');
  assert.equal(snapshot.events.filter(event => event.type === 'expired').length, 1);
  assert.equal(snapshot.events.filter(event => event.type === 'refused' && event.command === 'claim').length, 4);
  assert.equal(snapshot.events.filter(event => event.type === 'claimed').length, 0);
  assert.equal(ok(await f.claim(sent.message, { leaseSeconds: 10 })).message.status, 'claimed');
});

test('two-step ownership transfer records receipt and fences previous owner', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message));
  const old = f.own(claimed);
  refused(await f.run('offer', { ...old, to: 'worker2' }), /body must be nonempty/);
  const offer = ok(await f.run('offer', { ...old, to: 'worker2', reason: 'Synthetic handoff of remaining scoped work.' }));
  assert.equal(offer.transfer.reason, offer.receipt.reason);
  assert.equal(ok(await f.run('read', { id: old.id })).message.owner, 'worker');
  refused(await f.run('accept', { actor: 'critic', session: 'critic', id: old.id, offerId: offer.transfer.id }), /another recipient/);
  const accepted = ok(await f.run('accept', { actor: 'worker2', session: 'session-b', id: old.id, offerId: offer.transfer.id }));
  assert.equal(accepted.receipt.type, 'ownership-accepted');
  assert.notEqual(accepted.message.claim.token, old.token);
  refused(await f.run('reply', { ...old, kind: 'result', status: 'ok', body: 'Old owner.' }), /another owner/);
  ok(await f.run('reply', { ...f.own(accepted), kind: 'result', status: 'ok', body: 'New owner complete.' }));
  ok(await f.run('done', f.own(accepted)));
});

test('an offered transfer cannot be accepted after original owner sends a result', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message));
  const offer = ok(await f.run('offer', { ...f.own(claimed), to: 'worker2', reason: 'Synthetic pending handoff.' }));
  ok(await f.run('reply', { ...f.own(claimed), kind: 'result', status: 'ok', body: 'Original owner completed before acceptance.' }));
  refused(await f.run('accept', { actor: 'worker2', session: 'new-session', id: claimed.message.id, offerId: offer.transfer.id }), /answered or terminal/);
  ok(await f.run('done', f.own(claimed)));
});

test('invalid acceptance lease preserves old custody and pending offer; valid retry succeeds', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message));
  const offer = ok(await f.run('offer', { ...f.own(claimed), to: 'worker2', reason: 'Synthetic transfer with explicit remaining custody.' }));
  const before = ok(await f.run('read', { id: claimed.message.id })).message;
  for (const leaseSeconds of [0, 3601, 1.5, '10']) {
    refused(await f.run('accept', { actor: 'worker2', session: 'new-session', id: claimed.message.id, offerId: offer.transfer.id, leaseSeconds }), /lease must be within/);
    const after = ok(await f.run('read', { id: claimed.message.id })).message;
    assert.deepEqual(after, before);
    assert.equal(after.owner, 'worker');
    assert.equal(after.claim.token, claimed.message.claim.token);
    assert.equal(after.transfer.id, offer.transfer.id);
  }
  const accepted = ok(await f.run('accept', { actor: 'worker2', session: 'new-session', id: claimed.message.id, offerId: offer.transfer.id, leaseSeconds: 10 }));
  assert.equal(accepted.message.owner, 'worker2');
  assert.equal(accepted.message.transfer, null);
  assert.notEqual(accepted.message.claim.token, claimed.message.claim.token);
});

test('unavailable pinned reference refuses acceptance without changing custody or pending offer', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send({ refs: ['src/one.txt'] })).message));
  const offer = ok(await f.run('offer', { ...f.own(claimed), to: 'worker2', reason: 'Synthetic handoff with pinned evidence.' }));
  const before = ok(await f.run('read', { id: claimed.message.id })).message;
  await fs.unlink(path.join(f.config.projectRoot, 'src', 'one.txt'));
  refused(await f.run('accept', { actor: 'worker2', session: 'new-session', id: claimed.message.id, offerId: offer.transfer.id }), /unsafe or missing/);
  const after = ok(await f.run('read', { id: claimed.message.id }));
  assert.deepEqual(after.message, before);
  assert.equal(after.refDiagnostics[0].state, 'unavailable');
  await fs.writeFile(path.join(f.config.projectRoot, 'src', 'one.txt'), 'synthetic original\n');
  const accepted = ok(await f.run('accept', { actor: 'worker2', session: 'new-session', id: claimed.message.id, offerId: offer.transfer.id }));
  assert.equal(accepted.refDiagnostics[0].state, 'same');
});

test('acceptance returns changed pinned evidence diagnostics to the receiving owner', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send({ refs: ['src/one.txt'] })).message));
  const offer = ok(await f.run('offer', { ...f.own(claimed), to: 'worker2', reason: 'Synthetic handoff requiring evidence comparison.' }));
  await fs.writeFile(path.join(f.config.projectRoot, 'src', 'one.txt'), 'synthetic evidence changed\n');
  const accepted = ok(await f.run('accept', { actor: 'worker2', session: 'new-session', id: claimed.message.id, offerId: offer.transfer.id }));
  assert.equal(accepted.message.owner, 'worker2');
  assert.equal(accepted.refDiagnostics[0].state, 'changed');
  assert.equal(accepted.refDiagnostics[0].sha256, claimed.message.refs[0].sha256);
});

test('expired lease retains scope until explicit operator recovery; old fence cannot finish', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message, { leaseSeconds: 1 }));
  f.advance(1001);
  const second = ok(await f.send({ to: 'worker2' }));
  refused(await f.claim(second.message), /already owned/);
  refused(await f.run('reply', { ...f.own(claimed), kind: 'result', status: 'ok', body: 'Too late.' }), /lease expired/);
  refused(await f.run('recover', { actor: 'coordinator', id: claimed.message.id, reason: 'Expired synthetic lease.' }), /operator/);
  const recovered = ok(await f.run('recover', { actor: 'operator', id: claimed.message.id, reason: 'Expired synthetic lease verified.' }));
  assert.equal(recovered.message.status, 'new');
  ok(await f.claim(second.message));
  refused(await f.run('done', f.own(claimed)), /not active/);
});

test('recover refuses active work and completes answered stale work without repeating it', async t => {
  const f = await fixture(t);
  const claimed = ok(await f.claim(ok(await f.send()).message, { leaseSeconds: 1 }));
  refused(await f.run('recover', { actor: 'operator', id: claimed.message.id, reason: 'No expiry yet.' }), /remains active/);
  ok(await f.run('reply', { ...f.own(claimed), kind: 'result', status: 'ok', body: 'Completed before expiry.' }));
  f.advance(1001);
  const recovered = ok(await f.run('recover', { actor: 'operator', id: claimed.message.id, reason: 'Finish durable result after expired lease.' }));
  assert.equal(recovered.message.status, 'done');
  assert.ok(recovered.message.resultId);
});

test('TTL expiry is dead, refuses claim/finish and has durable retry receipt', async t => {
  const f = await fixture(t);
  refused(await f.send({ ttlSeconds: 0 }), /ttl/);
  const expired = ok(await f.send({ ttlSeconds: 1 }));
  f.advance(1001);
  assert.equal(ok(await f.run('read', { id: expired.message.id })).effectiveStatus, 'dead');
  const attempt = { actor: 'worker', session: 'a', id: expired.message.id, idempotencyKey: 'expired-attempt' };
  refused(await f.mailbox.execute('claim', attempt), /expired/);
  const replay = await f.mailbox.execute('claim', attempt);
  refused(replay, /expired/); assert.equal(replay.replayed, true);
  const active = ok(await f.send({ ttlSeconds: 1, scope: ['tests/'] }));
  const claimed = ok(await f.claim(active.message));
  f.advance(1001);
  refused(await f.run('reply', { ...f.own(claimed), kind: 'result', status: 'ok', body: 'Expired work.' }), /not active/);
  assert.equal(ok(await f.run('status', {})).messages.find(message => message.id === active.message.id).status, 'dead');
});

test('TTL-dead write custody still blocks overlap until explicit expired-lease reconciliation', async t => {
  const f = await fixture(t);
  const old = ok(await f.claim(ok(await f.send({ ttlSeconds: 1 })).message, { leaseSeconds: 5 }));
  f.advance(1001);
  const independent = ok(await f.send({ to: 'worker2', scope: ['tests/'] }));
  ok(await f.claim(independent.message));
  const overlapping = ok(await f.send({ to: 'worker2', scope: ['src/one.txt'] }));
  refused(await f.claim(overlapping.message), /already owned/);
  refused(await f.run('recover', { actor: 'operator', id: old.message.id, reason: 'Too soon to reconcile synthetic old editor.' }), /remains active/);
  f.advance(4000);
  const recovered = ok(await f.run('recover', { actor: 'operator', id: old.message.id, reason: 'Verified synthetic old editor stopped; reconcile TTL-dead custody.' }));
  assert.equal(recovered.message.status, 'dead');
  assert.equal(recovered.message.claim, null);
  assert.equal(recovered.receipt.previousOwner, 'worker');
  ok(await f.claim(overlapping.message));
  refused(await f.run('reply', { ...f.own(old), kind: 'result', status: 'ok', body: 'Expired previous owner cannot resume.' }), /not active/);
});

test('STOP blocks mutations/check, permits read/status; refused retry survives resume', async t => {
  const f = await fixture(t);
  const sent = ok(await f.send());
  refused(await f.run('stop', { actor: 'coordinator', reason: 'Not an operator.' }), /operator/);
  ok(await f.run('stop', { actor: 'operator', reason: 'Pause synthetic work.' }));
  const blocked = { actor: 'worker', session: 'a', id: sent.message.id, idempotencyKey: 'while-stopped' };
  assert.equal((await f.mailbox.execute('claim', blocked)).code, 3);
  assert.equal((await f.run('check', { actor: 'worker' })).code, 3);
  ok(await f.run('read', { id: sent.message.id }));
  assert.ok(ok(await f.run('status', {})).stopped);
  ok(await f.run('resume', { actor: 'operator', reason: 'Synthetic test resumes.' }));
  const replay = await f.mailbox.execute('claim', blocked);
  assert.equal(replay.code, 3); assert.equal(replay.replayed, true);
  ok(await f.claim(sent.message));
});

test('overlapping file/directory scopes refuse claims; independent CPU scopes continue', async t => {
  const f = await fixture(t);
  ok(await f.claim(ok(await f.send({ scope: ['src/one.txt'] })).message));
  const overlap = ok(await f.send({ to: 'worker2', scope: ['src/'] }));
  refused(await f.claim(overlap.message), /already owned/);
  const independent = ok(await f.send({ to: 'worker2', scope: ['tests/'] }));
  ok(await f.claim(independent.message));
});

test('read-only review can coexist with scoped writes; critic cannot reserve writes', async t => {
  const f = await fixture(t);
  const work = ok(await f.claim(ok(await f.send()).message));
  const review = ok(await f.send({ to: 'critic', kind: 'review', body: 'Review synthetic source without edits.' }));
  const reviewClaim = ok(await f.claim(review.message, { session: 'critic-session' }));
  assert.equal(reviewClaim.message.kind, 'review');
  const wrong = ok(await f.send({ to: 'critic', scope: ['tests/'] }));
  refused(await f.claim(wrong.message), /cannot own write/);
  refused(await f.run('offer', { ...f.own(work), to: 'critic', reason: 'Synthetic invalid write transfer.' }), /cannot receive write/);
  ok(await f.run('reply', { ...f.own(reviewClaim), kind: 'result', status: 'ok', body: 'Read-only review complete.' }));
});

test('references carry complete SHA256 and diagnose changed bytes on claim/read', async t => {
  const f = await fixture(t);
  const sent = ok(await f.send({ refs: ['src/one.txt'] }));
  assert.match(sent.message.refs[0].sha256, /^[a-f0-9]{64}$/);
  await fs.writeFile(path.join(f.config.projectRoot, 'src', 'one.txt'), 'synthetic changed\n');
  assert.equal(ok(await f.run('read', { id: sent.message.id })).refDiagnostics[0].state, 'changed');
  assert.equal(ok(await f.claim(sent.message)).refDiagnostics[0].state, 'changed');
});

test('unsafe paths, protected names, reserved names and unallowlisted refs are refused', async t => {
  const f = await fixture(t);
  for (const unsafe of ['../escape', '/absolute', 'C:/drive', '\\\\host\\share', 'src/file:stream', 'src/../one.txt', 'src//one.txt', 'src/CON.txt', 'src/.git/object', 'src/.env', 'src/settings.local.json', 'src/AGENTS.md', 'src/a.key', 'src/credentials.txt', 'src/a*', 'src/trailing.', 'other/file', 'src/COM¹.txt']) {
    refused(await f.send({ scope: [unsafe] }));
  }
  refused(await f.send({ scope: [] }), /nonempty/);
  refused(await f.send({ refs: ['tests/missing.txt'] }), /missing/);
  const fakeCredential = ['password', '=', '1234567890'.repeat(2)].join(' ');
  refused(await f.send({ body: fakeCredential }), /credential/);
});

test('symbolic links/junctions are refused on send and diagnosed if refs change to links', async t => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external');
  await fs.mkdir(external); await fs.writeFile(path.join(external, 'data.txt'), 'outside synthetic scope');
  await fs.symlink(external, path.join(f.config.projectRoot, 'src', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  refused(await f.send({ scope: ['src/linked/'] }), /link|junction/);
  const sent = ok(await f.send({ refs: ['src/one.txt'] }));
  await fs.unlink(path.join(f.config.projectRoot, 'src', 'one.txt'));
  // A junction directory replacing a file is sufficient to prove no external content is followed.
  await fs.symlink(external, path.join(f.config.projectRoot, 'src', 'one.txt'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(ok(await f.run('read', { id: sent.message.id })).refDiagnostics[0].state, 'unavailable');
  refused(await f.claim(sent.message), /unsafe or missing/);
});

test('three-hop guard routes to configured operator; cannot reply to receipt/result', async t => {
  const f = await fixture(t);
  const first = ok(await f.claim(ok(await f.send()).message));
  const child = ok(await f.run('send', { ...f.own(first), from: 'worker', to: 'worker2', kind: 'request', replyTo: first.message.id, body: 'Second hop synthetic task.', scope: ['tests/'] }));
  assert.equal(child.message.hops, 2);
  const claimed = ok(await f.claim(child.message));
  const routed = ok(await f.run('reply', { ...f.own(claimed), kind: 'result', status: 'needs-human', body: 'Third hop goes to operator.' }));
  assert.equal(routed.message.hops, 3);
  assert.equal(routed.message.to, 'operator');
  assert.equal(routed.receipt.type, 'routed-to-operator');
});

test('crash-leftover exclusive lock is bounded busy, never stolen; status remains available', async t => {
  const f = await fixture(t);
  const leftover = path.join(f.config.mailboxDir, '.lock');
  await fs.writeFile(leftover, 'synthetic crash leftover\n');
  const start = Date.now();
  const busy = await f.send();
  assert.equal(busy.code, 4);
  assert.ok(Date.now() - start < 3000);
  assert.equal(await fs.readFile(leftover, 'utf8'), 'synthetic crash leftover\n');
  assert.equal(ok(await f.run('status', {})).lockPresent, true);
  await fs.writeFile(path.join(f.config.mailboxDir, 'state.leftover.part'), 'incomplete');
  assert.deepEqual(ok(await f.run('status', {})).incompleteSnapshots, ['state.leftover.part']);
});

function child(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [script, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', bytes => { stdout += bytes; });
    proc.stderr.on('data', bytes => { stderr += bytes; });
    proc.on('error', reject);
    proc.on('close', code => { try { resolve({ code, output: JSON.parse(stdout), stderr }); } catch (error) { reject(new Error(`CLI output invalid: ${stdout}; ${stderr}; ${error.message}`)); } });
  });
}
test('competing actual processes yield exactly one claim and one fencing owner', async t => {
  // Use wall time here because independently spawned CLIs use wall time.
  const f = await fixture(t);
  const wallMailbox = createMailbox(f.config);
  const sent = ok(await wallMailbox.execute('send', { from: 'coordinator', to: 'worker', kind: 'request', body: 'Competing synthetic claim.', scope: ['src/'], idempotencyKey: 'race-send' }));
  const configFile = path.join(f.root, 'config.json');
  await fs.writeFile(configFile, JSON.stringify(f.config));
  const inputs = await Promise.all(['race-a', 'race-b'].map(async session => {
    const filename = path.join(f.root, `${session}.json`);
    await fs.writeFile(filename, JSON.stringify({ actor: 'worker', session, id: sent.message.id, idempotencyKey: session }));
    return filename;
  }));
  const results = await Promise.all(inputs.map(filename => child(['claim', '--config', configFile, '--input', filename])));
  assert.equal(results.filter(result => result.code === 0).length, 1, JSON.stringify(results));
  assert.ok(results.some(result => [2, 4].includes(result.code)), JSON.stringify(results));
  const state = JSON.parse(await fs.readFile(path.join(f.config.mailboxDir, 'state.json'), 'utf8'));
  assert.equal(state.events.filter(event => event.type === 'claimed').length, 1);
  assert.match(state.messages[sent.message.id].claim.token, /^[a-f0-9-]{36}$/);
  assert.equal(await fs.stat(path.join(f.config.mailboxDir, 'state.json')).then(stat => stat.size > 0), true);
});

test('concurrent distinct sends preserve both updates and snapshots parse completely', async t => {
  const f = await fixture(t);
  const mailbox = createMailbox(f.config);
  const requests = [1, 2, 3].map(index => mailbox.execute('send', { from: 'coordinator', to: 'worker', kind: 'request', body: `Synthetic concurrent ${index}.`, scope: ['src/'], idempotencyKey: `concurrent-${index}` }));
  const results = await Promise.all(requests);
  results.forEach(ok);
  assert.equal(ok(await f.run('status', {})).messages.length, 3);
  const state = JSON.parse(await fs.readFile(path.join(f.config.mailboxDir, 'state.json'), 'utf8'));
  assert.equal(Object.keys(state.idempotency).length, 3);
  assert.equal((await fs.readdir(f.config.mailboxDir)).filter(name => name.endsWith('.part')).length, 0);
});

test('different messages competing for overlapping scopes yield one write owner', async t => {
  const f = await fixture(t);
  const wall = createMailbox(f.config);
  const requests = await Promise.all(['worker', 'worker2'].map(async (to, index) => ok(await wall.execute('send', { from: 'coordinator', to, kind: 'request', body: 'Scoped synthetic race.', scope: [index ? 'src/one.txt' : 'src/'], idempotencyKey: `scope-race-send-${index}` }))));
  const configFile = path.join(f.root, 'scope-race-config.json');
  await fs.writeFile(configFile, JSON.stringify(f.config));
  const inputs = await Promise.all(requests.map(async (result, index) => {
    const filename = path.join(f.root, `scope-claim-${index}.json`);
    await fs.writeFile(filename, JSON.stringify({ actor: result.message.to, session: `scope-session-${index}`, id: result.message.id, idempotencyKey: `scope-claim-${index}` }));
    return filename;
  }));
  const results = await Promise.all(inputs.map(filename => child(['claim', '--config', configFile, '--input', filename])));
  assert.equal(results.filter(result => result.code === 0).length, 1, JSON.stringify(results));
  assert.ok(results.some(result => [2, 4].includes(result.code)), JSON.stringify(results));
  const state = JSON.parse(await fs.readFile(path.join(f.config.mailboxDir, 'state.json'), 'utf8'));
  assert.equal(Object.values(state.messages).filter(message => message.status === 'claimed').length, 1);
});

test('manual capability boundary does not promise or invoke session control', async t => {
  const f = await fixture(t);
  const capabilities = ok(await f.run('capabilities', {}));
  assert.equal(capabilities.wake, false); assert.equal(capabilities.stopSession, false);
  assert.equal((await f.run('wake', { actor: 'worker' })).code, 5);
  assert.equal((await f.run('stop-session', { actor: 'worker' })).code, 5);
  assert.throws(() => createMailbox({ ...f.config, adapter: { type: 'unverified-session' } }), /manual session adapter/);
});

test('config-relative paths resolve without machine-specific paths in examples', async t => {
  const f = await fixture(t);
  const configFile = path.join(f.root, 'portable.json');
  await fs.writeFile(configFile, JSON.stringify({ ...f.config, projectRoot: './project', mailboxDir: './mailbox' }));
  const loaded = await loadConfig(configFile);
  assert.equal(loaded.projectRoot, f.config.projectRoot);
  assert.equal(loaded.mailboxDir, f.config.mailboxDir);
  refused(await f.run('claim', { actor: 'unregistered', session: 'a', id: 'none' }), /unknown participant/);
});

for (const mode of ['codex', 'claude', 'mixed']) {
  test(`synthetic end-to-end ${mode} mode with manual session adapter`, async () => {
    const result = await runDemo(mode);
    assert.equal(result.completed, true); assert.equal(result.wakeSupported, false);
  });
}
