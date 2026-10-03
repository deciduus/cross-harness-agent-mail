import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTopologyDemo } from '../topology-demo.mjs';

for (const mode of ['codex', 'claude', 'mixed']) test(`named fixture topology ${mode}: actual RED -> forward fix -> affected PASS -> equal integration`, async () => {
  const result = await runTopologyDemo(mode);
  assert.equal(result.review.first, 'RED'); assert.equal(result.review.recheck, 'PASS');
  assert.ok(result.review.failures.some(failure => failure.includes('original label')));
  assert.equal(result.review.failedEvidencePreserved, true); assert.equal(result.review.sameReviewer, true);
  assert.equal(result.review.repairOwner, 'workerAlpha'); assert.equal(result.scopePreserved, true);
  assert.equal(result.interjection.reconciled, true); assert.equal(result.interjection.tokenMaintained, true);
  assert.equal(result.integration.byteEqual, true); assert.equal(result.artifacts.integrated, result.artifacts.expected);
  assert.notEqual(result.artifacts.failedCandidate, result.artifacts.integrated);
  assert.equal(result.integration.sha256, createHash('sha256').update(result.artifacts.integrated).digest('hex'));
  assert.deepEqual(JSON.parse(result.artifacts.integrated).records[0], { original: '  Maple  ', normalized: 'maple' });
  const stages = result.ledger.map(record => record.stage);
  for (const required of ['user-brief', 'executor-to-separate-coordinator', 'coordinator-to-named-worker', 'named-worker-accepts-custody', 'worker-to-leader-reconciliation', 'worker-to-platformCoordinator-reconciliation', 'reviewer-reports-red', 'worker-persists-review-evidence', 'worker-preservation-note', 'leader-routes-red-to-coordinator', 'coordinator-names-existing-fixer', 'coordinator-names-forward-fix', 'reviewer-recheck-result', 'leader-user-report']) assert.ok(stages.includes(required), required);
  const redReport = result.ledger.find(record => record.stage === 'reviewer-reports-red');
  const persistence = result.ledger.find(record => record.stage === 'worker-persists-review-evidence');
  assert.equal(redReport.from, 'reviewer'); assert.equal(redReport.to, 'leader');
  assert.ok(stages.indexOf('first-review-complete') < stages.indexOf('worker-persists-review-evidence'));
  assert.equal(persistence.afterReceiptSequence, redReport.receiptSequence);
  assert.equal(persistence.owner, 'workerAlpha'); assert.equal(persistence.session, result.interjection.session);
  assert.deepEqual(persistence.scope, ['output/']);
  assert.deepEqual(result.artifacts.failedReview.persistedBy, { owner: persistence.owner, session: persistence.session });
  assert.equal(result.artifacts.failedReview.reviewReportSequence, redReport.receiptSequence);
  assert.equal(result.ledger.find(record => record.stage === 'worker-preservation-note').kind, 'note');
  assert.ok(stages.indexOf('worker-persists-review-evidence') < stages.indexOf('leader-routes-red-to-coordinator'));
  assert.ok(stages.indexOf('coordinator-names-existing-fixer') < stages.indexOf('coordinator-names-forward-fix'));
  assert.ok(stages.indexOf('worker-releases-output') < stages.indexOf('leader-integrator-claims-output'));
  assert.equal(result.wakeCode, 5); assert.equal(result.platformSimulationOnly, true);
  assert.equal(result.workflowAssignments.integrator, 'leader');
  for (const stage of ['worker-confirms-reconciliation', 'leader-user-report']) {
    const envelope = result.ledger.find(record => record.stage === stage);
    assert.equal(envelope.to, 'user'); assert.equal(envelope.kind, 'result'); assert.equal(envelope.outcome, 'ok');
  }
  assert.equal(result.interjection.pendingOwner, null); assert.equal(result.interjection.nextAction, null);
  const encoded = JSON.stringify(result);
  assert.doesNotMatch(encoded, /"token"|[A-Z]:[\\/]|\/home\/|\/Users\//);
  const agentEngines = Object.entries(result.engines).filter(([name]) => name !== 'user').map(([, engine]) => engine);
  if (mode !== 'mixed') assert.ok(agentEngines.every(engine => engine === mode));
  else assert.ok(agentEngines.includes('codex') && agentEngines.includes('claude'));
});

test('topology CLI refuses unexpected extra positional arguments without executing fixture work', () => {
  const script = fileURLToPath(new URL('../topology-demo.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'mixed', '--outside-direction', 'unexpected'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 2); assert.equal(result.stdout, '');
  assert.match(result.stderr, /unexpected additional CLI arguments/);
});

test('outside-scope direct direction is quarantined and reconciled without changing owner token or source', async () => {
  const result = await runTopologyDemo('mixed', { outsideDirection: true });
  assert.deepEqual(result.interjection.quarantined, ['inputs/labels.txt']);
  assert.equal(result.interjection.outsideDirectionExecuted, false);
  assert.equal(result.interjection.reconciled, true); assert.equal(result.interjection.tokenMaintained, true);
  assert.equal(result.interjection.owner, 'workerAlpha'); assert.equal(result.interjection.session, 'fixture-workerAlpha');
  assert.equal(result.scopePreserved, true); assert.equal(result.integration.sourceUnchanged, true);
  assert.equal(result.interjection.reconciliationOutcome, 'partial'); assert.equal(result.interjection.pendingOwner, 'leader');
  assert.match(result.interjection.nextAction, /additional inputs\/ ownership in a new packet before editing/);
  for (const stage of ['worker-confirms-reconciliation', 'leader-user-report']) {
    const envelope = result.ledger.find(record => record.stage === stage);
    assert.equal(envelope.to, 'user'); assert.equal(envelope.kind, 'result'); assert.equal(envelope.outcome, 'partial');
  }
  assert.equal(result.artifacts.source, '  Maple  \nBLUE\namber\n');
  assert.ok(result.ledger.filter(record => /reconciliation-receipt$/.test(record.stage)).every(record => record.kind === 'result'));
  assert.equal(result.review.recheck, 'PASS');
});
