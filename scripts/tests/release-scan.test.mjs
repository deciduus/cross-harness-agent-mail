import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scanner = fileURLToPath(new URL('../scan-release.mjs', import.meta.url));
async function repository(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-mail-scan-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('agent-mail-scan-'));
    await rm(root, { recursive: true, force: true });
  });
  const git = (args, input) => execFileSync('git', ['-C', root, '-c', 'core.excludesFile=', '-c', 'user.name=Public Fixture Author', '-c', 'user.email=public-fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', windowsHide: true, input, stdio: ['pipe', 'pipe', 'pipe'] });
  git(['init', '--quiet']);
  const file = async (relative, text) => { await mkdir(path.dirname(path.join(root, relative)), { recursive: true }); await writeFile(path.join(root, relative), text); git(['add', '--', relative]); };
  const commit = body => git(['commit', '--quiet', '--file=-'], body);
  const scan = (...terms) => spawnSync(process.execPath, [scanner, root, ...terms], { encoding: 'utf8', windowsHide: true });
  return { root, git, file, commit, scan };
}

test('release scanner accepts clean staged/history files and public author metadata', async t => {
  const r = await repository(t);
  await r.file('README.md', 'Public synthetic project.\n'); r.commit('Initial synthetic revision.\n');
  await r.file('scripts/example.mjs', 'export const fixture = true;\n');
  const result = r.scan();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 commit messages, 1 commits/);
});

test('release scanner detects a constructed fake credential and private term only in commit body', async t => {
  const r = await repository(t);
  const fake = 'gh' + 'p_' + 'A'.repeat(36), privateTerm = 'private-' + 'fixture-topic';
  await r.file('README.md', 'Clean content with no credential.\n');
  r.commit(`Synthetic subject.\n\nConstructed fake sample: ${fake}\nPrivate fixture term: ${privateTerm}\n`);
  const result = r.scan(privateTerm);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit-message:.*GitHub credential/);
  assert.match(result.stderr, /commit-message:.*configured private source\/project term/);
  assert.ok(!result.stderr.includes(fake), 'scanner reports category without echoing credential text');
});

test('release scanner detects staged POSIX home path and historical macOS personal path', async t => {
  const r = await repository(t);
  const homePath = '/' + 'home/' + 'fixture-person/work', macPath = '/' + 'Users/' + 'fixture-person/work';
  await r.file('reference.txt', `Old machine path: ${macPath}\n`); r.commit('Old synthetic reference.\n');
  await r.file('reference.txt', 'Current reference is sanitized.\n'); r.commit('Sanitize current reference.\n');
  await r.file('draft.txt', `Staged machine path: ${homePath}\n`);
  const result = r.scan();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /staged:draft\.txt: personal absolute path/);
  assert.match(result.stderr, /history:reference\.txt: personal absolute path/);
});

test('release scanner detects personal paths in commit subject/body and escaped Windows source', async t => {
  const r = await repository(t);
  const homePath = '/' + 'home/' + 'fixture-person', macPath = '/' + 'Users/' + 'fixture-person';
  const windowsPath = 'C:' + '\\\\' + 'Users' + '\\\\' + 'fixture-person' + '\\\\' + 'work';
  await r.file('reference.txt', `Escaped Windows source: ${windowsPath}\n`);
  r.commit(`Subject contains ${homePath}\n\nBody contains ${macPath}\n`);
  const result = r.scan();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit-message:.*personal absolute path/);
  assert.match(result.stderr, /history:reference\.txt: personal absolute path/);
});

test('release scanner rejects staged local mailbox runtime artifacts', async t => {
  const r = await repository(t);
  await r.file('README.md', 'Synthetic toolkit.\n'); r.commit('Clean initial tree.\n');
  await r.file('.local-mailbox/state.json', '{"synthetic":true}\n');
  const result = r.scan();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /staged:\.local-mailbox\/state\.json: unexpected runtime\/generated artifact/);
});
