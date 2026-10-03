#!/usr/bin/env node
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createMailbox } from './mailbox.mjs';

export async function runDemo(engine = 'mixed') {
  assert.ok(['codex', 'claude', 'mixed'].includes(engine), 'demo mode: codex, claude, mixed');
  const root = await mkdtemp(path.join(tmpdir(), 'agent-mail-demo-'));
  try {
    const projectRoot = path.join(root, 'project');
    await mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await writeFile(path.join(projectRoot, 'src', 'sample.txt'), 'Synthetic sample only.\n');
    const mailbox = createMailbox({
      version: 1, projectRoot, mailboxDir: path.join(root, 'mailbox'), allowedScope: ['src/'],
      operator: 'operator', adapter: { type: 'manual' },
      participants: {
        operator: { role: 'operator', engine: 'other' },
        coordinator: { role: 'coordinator', engine: engine === 'claude' ? 'claude' : 'codex' },
        builder: { role: 'executor', engine: engine === 'codex' ? 'codex' : 'claude' },
      },
    });
    const run = async (command, input) => {
      const result = await mailbox.execute(command, input);
      assert.equal(result.code, 0, JSON.stringify(result));
      return result;
    };
    await run('init', { actor: 'operator' });
    const delivered = await run('send', { from: 'coordinator', to: 'builder', kind: 'review', body: 'Inspect the synthetic file; report its line count. No edits needed.', scope: ['src/'], refs: ['src/sample.txt'], idempotencyKey: 'demo-request' });
    const claimed = await run('claim', { actor: 'builder', session: 'synthetic-builder', id: delivered.message.id, idempotencyKey: 'demo-claim' });
    const owner = { actor: 'builder', session: 'synthetic-builder', id: delivered.message.id, token: claimed.message.claim.token };
    const ack = await run('reply', { ...owner, kind: 'ack', body: 'Receipt: demo-request; target: synthetic project; inspection scope: src/; no write reservation; next action: count source lines.', idempotencyKey: 'demo-receipt' });
    const sourceText = await readFile(path.join(projectRoot, 'src', 'sample.txt'), 'utf8');
    const lineCount = sourceText.trimEnd().split('\n').length;
    const result = await run('reply', { ...owner, kind: 'result', status: 'ok', body: `Evidence: synthetic source has ${lineCount} line(s); pinned SHA256 ${delivered.message.refs[0].sha256}. Next owner: coordinator.`, idempotencyKey: 'demo-result' });
    await run('done', { ...owner, idempotencyKey: 'demo-done' });
    const received = await run('read', { id: result.message.id });
    const wake = await mailbox.execute('wake', { actor: 'builder' });
    assert.equal(wake.code, 5);
    return { ok: true, mode: engine, syntheticOnly: true, request: delivered.message.id, requestKind: delivered.message.kind, sourceSha256: delivered.message.refs[0].sha256, receiptKind: ack.message.kind, resultOutcome: received.message.outcome, completed: true, wakeSupported: false, cleanup: 'synthetic temporary directory removed' };
  } finally { await rm(root, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await runDemo(process.argv[2] ?? 'mixed'), null, 2) + '\n'); }
  catch (error) { process.stderr.write(`Synthetic demo failed: ${error.message}\n`); process.exitCode = 2; }
}
