// Inspect staged Git blobs and every reachable commit; no remote writes.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root = resolve(process.argv[2] ?? '.');
// The release tree does not need a personal global ignore file.
const git = args => execFileSync('git', ['-C', root, '-c', 'core.excludesFile=', ...args], {encoding:'utf8', maxBuffer: 10*1024*1024});
const errors = [];
let checked = 0;
const patterns = [
  [/\b(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/])[^\s`"']+/i, 'personal absolute path'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'GitHub credential'],
  [/\bAKIA[A-Z0-9]{16}\b/, 'cloud credential'],
  [/\bsk-[A-Za-z0-9_-]{24,}\b/, 'API credential'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/\b(?:password|api_key|access_token)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{20,}/i, 'credential assignment']
];
for (const term of process.argv.slice(3)) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  patterns.push([new RegExp(`\\b${escaped}\\b`, 'i'), 'configured private source/project term']);
}
function scan(path, content, label) {
  checked++;
  if (Buffer.byteLength(content) > 250000) errors.push(`${label}:${path}: exceeds 250 KB review bound`);
  if (/(?:^|\/)(?:node_modules|\.agent-mail|mailbox|\.env)(?:\/|$)|\.(?:sqlite|db|log|zip|exe|png|jpg|mp4)$/i.test(path)) errors.push(`${label}:${path}: unexpected runtime/generated artifact`);
  for (const [pattern, reason] of patterns) if (pattern.test(content)) errors.push(`${label}:${path}: ${reason}`);
}
for (const path of git(['diff','--cached','--name-only','--diff-filter=ACMR','-z']).split('\0').filter(Boolean)) scan(path, git(['show',`:${path}`]), 'staged');
const revs = git(['rev-list','--all']).trim().split('\n').filter(Boolean);
for (const rev of revs) for (const path of git(['ls-tree','-r','--name-only','-z',rev]).split('\0').filter(Boolean)) scan(path,git(['show',`${rev}:${path}`]),'history');
if (!checked) errors.push('No staged or committed files to inspect');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`PASS release scan: ${checked} staged/history blobs, ${revs.length} commits; heuristic scan plus human source review required`);
