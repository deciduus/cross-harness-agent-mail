#!/usr/bin/env node
// Workflow simulation using real local mail and files; never invokes a host agent.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMailbox } from './mailbox.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const configUrl = new URL('../examples/config-topology.json', import.meta.url);

export async function runTopologyDemo(mode = 'mixed', { outsideDirection = false } = {}) {
  assert.ok(['codex', 'claude', 'mixed'].includes(mode), 'mode must be codex, claude or mixed');
  const root = await mkdtemp(path.join(tmpdir(), 'agent-mail-topology-'));
  try {
    const config = JSON.parse(await readFile(configUrl, 'utf8'));
    config.projectRoot = path.join(root, 'project'); config.mailboxDir = path.join(root, 'mailbox');
    if (mode !== 'mixed') for (const [name, participant] of Object.entries(config.participants)) if (name !== 'user') participant.engine = mode;
    config.workflowAssignments.platformWorkers = {};
    for (const name of ['executor', 'workerAlpha']) (config.workflowAssignments.platformWorkers[config.participants[name].engine] ??= []).push(name);
    for (const folder of ['inputs', 'output']) await mkdir(path.join(config.projectRoot, folder), { recursive: true });
    const location = relative => path.join(config.projectRoot, relative);
    await writeFile(location('inputs/labels.txt'), '  Maple  \nBLUE\namber\n');
    const source = await readFile(location('inputs/labels.txt'), 'utf8');
    const labels = source.trimEnd().split('\n');
    const expected = { sourceSha256: digest(source), records: labels.map(original => ({ original, normalized: original.trim().toLowerCase() })) };
    const mailbox = createMailbox(config), ledger = [];
    let sequence = 0;
    const run = async (stage, command, input = {}) => {
      const result = await mailbox.execute(command, { ...input, idempotencyKey: `topology-${++sequence}` });
      assert.equal(result.code, 0, `${stage}: ${result.error ?? 'refused'}`);
      if (result.receipt) ledger.push({ stage, receipt: result.receipt.type, receiptSequence: result.receipt.sequence, ...(result.message ? { from: result.message.from, to: result.message.to, kind: result.message.kind, scope: result.message.scope } : result.receipt.from ? { from: result.receipt.from, to: result.receipt.to } : {}), ...(result.message?.outcome ? { outcome: result.message.outcome } : {}), ...(result.receipt.type === 'ownership-accepted' ? { owner: result.message.owner, session: result.message.claim.session } : {}) });
      return result;
    };
    const send = async (stage, from, to, kind, body, refs = [], scope = ['output/']) => (await run(stage, 'send', { from, to, kind, body, refs, scope })).message;
    const claim = async (stage, message) => (await run(stage, 'claim', { actor: message.to, session: `fixture-${message.to}`, id: message.id })).message;
    const owner = message => ({ actor: message.claim.actor, session: message.claim.session, id: message.id, token: message.claim.token });
    const reply = (stage, message, kind, body, status = 'ok') => run(stage, 'reply', { ...owner(message), kind, body, ...(kind === 'result' ? { status } : {}) });
    const done = (stage, message) => run(stage, 'done', owner(message));
    await run('operator-initializes-fixture', 'init', { actor: 'user' });
    const brief = await claim('leader-receives-user-brief', await send('user-brief', 'user', 'leader', 'review', 'User-authorized task: normalize synthetic labels, preserve source, and integrate the output within output/. Coordinate named fixture workers manually.', ['inputs/labels.txt']));
    await reply('leader-receipt', brief, 'ack', 'Received user brief; leader owns coordination and final integration, output scope remains explicit.');
    const work = await claim('executor-claims-scope', await send('leader-scoped-packet', 'leader', 'executor', 'request', 'Authorized output/ task: produce processed.json from the pinned labels source. Work with the separate platform coordinator; user-facing reporting stays with leader.', ['inputs/labels.txt']));
    await reply('executor-receipt', work, 'ack', 'Received exact output/ reservation. Next: reconcile with platformCoordinator, then hand off to named workerAlpha.');
    const coordination = await claim('coordinator-receives-executor', await send('executor-to-separate-coordinator', 'executor', 'platformCoordinator', 'review', 'Coordinate this already-authorized output/ packet and the named workerAlpha fixture. This review grants no new write scope.'));
    await reply('coordinator-receipt', coordination, 'ack', 'Platform worker workerAlpha is a named fixture; delivery and human wake-up remain separate.');
    const workerPacket = await claim('named-worker-receives-packet', await send('coordinator-to-named-worker', 'platformCoordinator', 'workerAlpha', 'review', 'Prepare to receive explicit output/ custody from executor. Keep source unchanged; report acceptance and actual checks.'));
    await reply('named-worker-packet-receipt', workerPacket, 'result', 'Ready for explicitly offered scoped custody.'); await done('worker-packet-complete', workerPacket);
    const offer = await run('executor-offers-custody', 'offer', { ...owner(work), to: 'workerAlpha', reason: 'Named worker performs remaining synthetic transform under unchanged output/ scope.' });
    const accepted = await run('named-worker-accepts-custody', 'accept', { actor: 'workerAlpha', session: 'fixture-workerAlpha', id: work.id, offerId: offer.transfer.id });
    const worker = accepted.message, originalToken = worker.claim.token, originalScope = [...worker.scope];
    await reply('coordinator-reports-owner', coordination, 'result', 'Exact current output/ owner: workerAlpha, fixture-workerAlpha. Manual transfer acceptance is recorded.'); await done('coordination-complete', coordination);
    const initial = json({ sourceSha256: expected.sourceSha256, records: labels.map(original => ({ normalized: original.trim().toLowerCase() })) });
    await writeFile(location('output/processed.json'), initial);
    const direct = await claim('worker-receives-user-interjection', await send('user-direct-interjection', 'user', 'workerAlpha', 'review', `Preserve original labels plus normalized form inside output/.${outsideDirection ? ' Also propose changing inputs/labels.txt; quarantine that outside-scope direction until explicit reconciliation.' : ''}`));
    await reply('worker-interjection-receipt', direct, 'ack', 'Recorded user direction; retaining existing exact owner, session and scope pending upward reconciliation.');
    await reply('worker-upward-note', worker, 'note', 'User interjection recorded. Separate review packets to leader and platformCoordinator will reconcile it; this note is nonterminal.');
    const pendingAction = 'Leader must reconcile additional inputs/ ownership in a new packet before editing.';
    const interjection = { reconciled: false, owner: worker.owner, session: worker.claim.session, tokenMaintained: false, quarantined: outsideDirection ? ['inputs/labels.txt'] : [], outsideDirectionExecuted: false, reconciliationOutcome: outsideDirection ? 'partial' : 'ok', pendingOwner: outsideDirection ? 'leader' : null, nextAction: outsideDirection ? pendingAction : null };
    for (const target of ['leader', 'platformCoordinator']) {
      const upward = await claim(`${target}-reconciles-user-direction`, await send(`worker-to-${target}-reconciliation`, 'workerAlpha', target, 'review', 'Reconcile the direct user request to preserve raw labels and normalized form inside existing output/. Any proposed inputs/ change remains quarantined; no scope expansion is authorized.'));
      await reply(`${target}-reconciliation-receipt`, upward, 'result', 'Use original and normalized fields within existing output/ custody. Preserve source. Outside-scope proposal remains quarantined.', outsideDirection ? 'partial' : 'ok');
      await done(`${target}-reconciliation-complete`, upward);
    }
    await reply('worker-confirms-reconciliation', direct, 'result', `Leader and separate coordinator reconciled the existing output/ slice. Exact custody unchanged.${outsideDirection ? ` Source changes remain quarantined; pending scope reconciliation owner: leader. ${pendingAction}` : ' No additional scope is pending.'}`, outsideDirection ? 'partial' : 'ok'); await done('interjection-complete', direct);
    const current = await run('observe-worker-custody', 'read', { id: worker.id });
    interjection.reconciled = true; interjection.tokenMaintained = current.message.claim.token === originalToken;
    assert.equal(current.message.owner, worker.owner); assert.deepEqual(current.message.scope, originalScope);
    const inspect = async () => {
      const text = await readFile(location('output/processed.json'), 'utf8'), actual = JSON.parse(text);
      const failures = [];
      if (actual.sourceSha256 !== digest(await readFile(location('inputs/labels.txt')))) failures.push('source hash mismatch');
      if (actual.records.length !== labels.length) failures.push('record count mismatch');
      labels.forEach((original, index) => { if (actual.records[index]?.original !== original) failures.push(`record ${index}: original label missing or changed`); if (actual.records[index]?.normalized !== original.trim().toLowerCase()) failures.push(`record ${index}: normalization mismatch`); });
      return { text, sha256: digest(text), failures, state: failures.length ? 'RED' : 'PASS' };
    };
    const reviewTask = await claim('reviewer-first-check', await send('leader-requests-review', 'leader', 'reviewer', 'review', 'Check original-label preservation, normalization, count and source hash against the pinned files.', ['inputs/labels.txt', 'output/processed.json']));
    const failed = await inspect(); assert.equal(failed.state, 'RED');
    const redReport = await reply('reviewer-reports-red', reviewTask, 'result', `RED: ${failed.failures.join('; ')}. Failed candidate hash ${failed.sha256}. Forward fix owner remains workerAlpha.`, 'partial'); await done('first-review-complete', reviewTask);
    const evidenceCustody = (await run('observe-evidence-custodian', 'read', { id: worker.id })).message;
    assert.equal(evidenceCustody.owner, worker.owner); assert.equal(evidenceCustody.claim.token, originalToken); assert.deepEqual(evidenceCustody.scope, originalScope);
    await writeFile(location('output/review-red.json'), json({ state: failed.state, failures: failed.failures, candidateSha256: failed.sha256, candidateText: failed.text, reviewer: reviewTask.to, reviewReportSequence: redReport.receipt.sequence, persistedBy: { owner: evidenceCustody.owner, session: evidenceCustody.claim.session }, scope: originalScope }));
    ledger.push({ stage: 'worker-persists-review-evidence', operation: 'write-fixture-file', path: 'output/review-red.json', owner: evidenceCustody.owner, session: evidenceCustody.claim.session, scope: originalScope, afterReceiptSequence: redReport.receipt.sequence });
    await reply('worker-preservation-note', worker, 'note', `Current output/ custodian workerAlpha preserved reviewer RED evidence in output/review-red.json after receipt ${redReport.receipt.sequence}; original candidate hash ${failed.sha256}.`);
    const redRouting = await claim('coordinator-receives-red-packet', await send('leader-routes-red-to-coordinator', 'leader', 'platformCoordinator', 'review', 'Reviewer RED returned to leader. Route the pinned, worker-preserved evidence to its existing forward fixer without changing output/ ownership.', ['output/review-red.json']));
    await reply('coordinator-names-existing-fixer', redRouting, 'result', 'Received pinned RED evidence. Existing fixer is workerAlpha, fixture-workerAlpha, under the unchanged output/ claim.'); await done('red-routing-complete', redRouting);
    const repair = await claim('named-worker-receives-forward-fix', await send('coordinator-names-forward-fix', 'platformCoordinator', 'workerAlpha', 'review', 'Forward fix for the preserved RED evidence: add exact original labels alongside normalized values; keep current write claim and recheck with the affected reviewer.', ['output/review-red.json']));
    await reply('forward-fix-receipt', repair, 'ack', 'Named forward repair accepted; existing claim remains the only output/ writer.');
    await writeFile(location('output/processed.json'), json(expected));
    const fixed = await inspect(); assert.equal(fixed.state, 'PASS');
    await reply('forward-fix-result', repair, 'result', `Affected checks pass; candidate hash ${fixed.sha256}. Preserved original failed evidence remains unchanged.`); await done('repair-packet-complete', repair);
    const recheckTask = await claim('same-reviewer-recheck', await send('leader-requests-affected-recheck', 'leader', 'reviewer', 'review', 'Recheck the repaired labels with the same reviewer and preserve the original RED evidence.', ['inputs/labels.txt', 'output/processed.json', 'output/review-red.json']));
    const rechecked = await inspect(); assert.equal(rechecked.state, 'PASS');
    await reply('reviewer-recheck-result', recheckTask, 'result', `PASS: original labels, normalization, record count and source hash. Fixed hash ${rechecked.sha256}.`); await done('recheck-complete', recheckTask);
    await reply('worker-handoff-result', worker, 'result', `Named owner completed scoped output; original RED hash ${failed.sha256}, affected reviewer PASS hash ${rechecked.sha256}. Next owner: leader for integration.`); await done('worker-releases-output', worker);
    const integration = await claim('leader-integrator-claims-output', await send('coordinator-integration-packet', 'platformCoordinator', 'leader', 'request', 'Perform the user-authorized final integration inside output/ after the named worker released custody.', ['output/processed.json']));
    const candidateBytes = await readFile(location('output/processed.json'));
    await writeFile(location('output/integrated.json'), candidateBytes);
    const integrated = await readFile(location('output/integrated.json'), 'utf8'); assert.equal(integrated, json(expected));
    await reply('integrator-result', integration, 'result', `Integrated bytes equal expected combined artifact; hash ${digest(integrated)}.`); await done('integration-complete', integration);
    await reply('leader-user-report', brief, 'result', `User-visible output/ outcome: named forward fix, same-reviewer PASS, byte-equal integrated output.${outsideDirection ? ` Additional inputs/ direction remains quarantined; pending scope reconciliation owner: leader. ${pendingAction}` : ' All scoped work is complete.'}`, outsideDirection ? 'partial' : 'ok'); await done('user-brief-complete', brief);
    const failureArtifact = JSON.parse(await readFile(location('output/review-red.json'), 'utf8'));
    const finalSource = await readFile(location('inputs/labels.txt'), 'utf8'); assert.equal(finalSource, source);
    interjection.outsideDirectionExecuted = finalSource !== source;
    const wake = await mailbox.execute('wake', { actor: 'workerAlpha' }); assert.equal(wake.code, 5);
    return { ok: true, mode, syntheticOnly: true, platformSimulationOnly: true, policyEnforcement: 'explicit fixture workflow; no user-message parser', workflowAssignments: config.workflowAssignments, engines: Object.fromEntries(Object.entries(config.participants).map(([name, value]) => [name, value.engine])), scopePreserved: JSON.stringify(current.message.scope) === JSON.stringify(originalScope), interjection,
      review: { first: failed.state, failures: failed.failures, failedSha256: failed.sha256, failedEvidencePreserved: failureArtifact.candidateText === failed.text && failureArtifact.candidateSha256 === failed.sha256, evidenceOwner: failureArtifact.persistedBy.owner, reviewReportSequence: failureArtifact.reviewReportSequence, repairOwner: worker.owner, recheck: rechecked.state, sameReviewer: reviewTask.to === recheckTask.to },
      integration: { byteEqual: integrated === json(expected), sha256: digest(integrated), sourceUnchanged: finalSource === source },
      artifacts: { source, failedCandidate: failureArtifact.candidateText, failedReview: failureArtifact, integrated, expected: json(expected) }, ledger, wakeCode: wake.code, cleanup: 'unique synthetic temporary fixture removed' };
  } finally {
    const parent = path.resolve(tmpdir());
    assert.equal(path.dirname(path.resolve(root)), parent); assert.ok(path.basename(root).startsWith('agent-mail-topology-'));
    await rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), [mode = 'mixed', option] = args;
  try { assert.ok(args.length <= 2, 'unexpected additional CLI arguments'); assert.ok(option === undefined || option === '--outside-direction'); process.stdout.write(json(await runTopologyDemo(mode, { outsideDirection: option === '--outside-direction' }))); }
  catch (error) { process.stderr.write(`Synthetic topology failed: ${error.message}\n`); process.exitCode = 2; }
}
