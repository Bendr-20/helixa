'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { CANDIDATE_PARAMETERS } = require('../../cred-shadow/parameters');
const { canonicalStringify } = require('../../cred-shadow/artifact');
const { normalizeEvidenceSnapshot } = require('../../cred-shadow/evidence');
const pins = require('./fixtures/replay-pins.json');
const {
  replaySnapshots,
  enumerateSensitivityVariants,
  applySensitivityVariant,
  parseReplayInput,
} = require('../../cred-shadow/replay');

const fixturePath = path.join(__dirname, 'fixtures/replay-input.jsonl');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');
const fixtures = fixtureText.trim().split('\n').map((line) => JSON.parse(line));
const categories = ['operational', 'financial', 'onchain', 'identity'];
const requiredEvidence = ['included', 'excluded', 'quarantined', 'deduplicated', 'capped', 'decayed'];

function assertCompleteSnapshot(row) {
  for (const key of ['subjectId','actorEpochId','computedAt','freshness','flags','evidenceSetHash','identityResolution','legacy','candidate','transition','evidence']) assert.ok(Object.hasOwn(row,key), key);
  for (const side of ['legacy','candidate']) {
    for (const key of ['score','tier','ratingStatus','categories','confidence','coverage']) assert.ok(Object.hasOwn(row[side],key), side+'.'+key);
    for (const category of categories) assert.ok(Object.hasOwn(row[side].categories,category), side+'.categories.'+category);
  }
  for (const key of requiredEvidence) {
    assert.equal(typeof row.evidence[key].count, 'number');
    assert.match(row.evidence[key].massMicroEu, /^(0|[1-9]\d*)$/);
  }
}

test('replay publishes complete sorted snapshots and migration aggregates', () => {
  const report = replaySnapshots([...fixtures].reverse(), { sensitivity: false });
  assert.equal(report.schemaVersion, 'cred-shadow-replay-v1');
  assert.deepEqual(report.snapshots.map((row) => [row.subjectId,row.actorEpochId,row.computedAt]), [
    ['subject_alpha','epoch_1','2026-10-10T00:00:00.000Z'],
    ['subject_beta','epoch_2','2026-10-09T00:00:00.000Z'],
  ]);
  for (const row of report.snapshots) assertCompleteSnapshot(row);
  assert.equal(report.snapshots[0].evidence.quarantined.count, 1);
  assert.ok(BigInt(report.snapshots[0].evidence.excluded.massMicroEu) > 0n);
  assert.ok(BigInt(report.snapshots[0].evidence.quarantined.massMicroEu) > 0n);
  assert.equal(report.snapshots[0].evidence.deduplicated.count, 1);
  assert.ok(BigInt(report.snapshots[0].evidence.deduplicated.massMicroEu) > 0n);
  assert.equal(report.snapshots[0].evidence.capped.count, 1);
  assert.ok(report.snapshots[0].evidence.decayed.count >= 1);
  assert.deepEqual(report.aggregate.scoreDeltaSeries, [...report.aggregate.scoreDeltaSeries].sort((a,b) => a.subjectId.localeCompare(b.subjectId)||a.actorEpochId.localeCompare(b.actorEpochId)||a.computedAt.localeCompare(b.computedAt)));
  assert.deepEqual(Object.keys(report.aggregate.thresholdCounts), ['greaterThan5','greaterThan10','greaterThan20','greaterThan30']);
  assert.ok(report.aggregate.tierTransitionMatrix);
  assert.ok(report.aggregate.ratingStatusTransitionMatrix);
  assert.equal(report.aggregate.segments.length, 24);
  assert.equal(report.aggregate.extremeExplanations.length, report.snapshots.length);
});

test('capped mass includes correlation mass removed before bucket allocation', () => {
  const correlated = structuredClone(fixtures[0]);
  correlated.records = correlated.records.filter((record) => record.status === 'ACTIVE').slice(0, 6).map((record, index) => ({
    ...record, category: 'operational', observedAt: correlated.computedAt, correlationKey: 'one-cluster', incidentKey: 'unique-' + index,
  }));
  const capped = replaySnapshots([correlated], { sensitivity: false }).snapshots[0].evidence.capped;
  assert.ok(capped.count > 0);
  assert.ok(BigInt(capped.massMicroEu) > 0n);
});

test('time-split validation rejects future evidence and identity links', () => {
  const futureEvidence = structuredClone(fixtures[0]);
  futureEvidence.records[0].observedAt = '2026-10-10T00:00:00.001Z';
  assert.throws(() => replaySnapshots([futureEvidence], { sensitivity: false }), /future/i);
  const futureIdentity = structuredClone(fixtures[0]);
  futureIdentity.identity.controlProofObservedAt = '2026-10-10T00:00:00.001Z';
  assert.throws(() => replaySnapshots([futureIdentity], { sensitivity: false }), /future/i);
});

test('sensitivity is baseline plus exact ordered OAT variants with immutable production constants', () => {
  const before = JSON.stringify(CANDIDATE_PARAMETERS, (_, value) => typeof value === 'bigint' ? value.toString() : value);
  const variants = enumerateSensitivityVariants();
  assert.equal(variants.length, 47);
  assert.equal(variants[0].id, 'baseline');
  const baselineBytes = canonicalStringify({ methodologyId: CANDIDATE_PARAMETERS.methodologyId, candidateParameters: CANDIDATE_PARAMETERS, replayParameterOverrides: {} });
  assert.equal(variants[0].parameterSetHash, 'sha256:' + createHash('sha256').update('CRED-REPLAY-PARAMS-v1\0').update(baselineBytes).digest('hex'));
  assert.deepEqual(variants.slice(1,3).map((item) => item.id), ['prior-mass:low','prior-mass:high']);
  assert.deepEqual(variants.slice(-4).map((item) => item.id), ['confidence-gate:low','confidence-gate:high','coverage-gate:low','coverage-gate:high']);
  assert.equal(new Set(variants.map((item) => item.parameterSetHash)).size, variants.length);
  for (const item of variants) assert.match(item.parameterSetHash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(variants.map(({id,dimension,target,direction,parameterSetHash}) => ({id,dimension,target,direction,parameterSetHash})), pins.parameterSets);
  const report = replaySnapshots(fixtures);
  assert.equal(createHash('sha256').update(JSON.stringify(report)).digest('hex'), pins.reportSha256);
  assert.equal(report.parameterSets.length, 47);
  assert.equal(report.sensitivity.length, 47);
  for (const sweep of report.sensitivity) {
    assert.match(sweep.parameterSetHash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(sweep.subjectDeltas.length, fixtures.length);
    for (const key of ['minimum','maximum','meanMicroPoints','absoluteMeanMicroPoints']) assert.ok(Object.hasOwn(sweep.aggregateDelta,key));
  }
  assert.equal(JSON.stringify(CANDIDATE_PARAMETERS, (_, value) => typeof value === 'bigint' ? value.toString() : value), before);
});

test('sensitivity half-lives round half away from zero to whole days', () => {
  const snapshot = structuredClone(normalizeEvidenceSnapshot(fixtures[0]));
  snapshot.empPolicies[0].evidenceFamily = 'financial';
  snapshot.empPolicies[0].positiveHalfLifeDays = 365;
  snapshot.empPolicies[0].negativeHalfLifeDays = 730;
  const variants = enumerateSensitivityVariants();
  const positiveLow = applySensitivityVariant(snapshot, variants.find((item) => item.id === 'positive-half-life:financial:low'));
  const negativeHigh = applySensitivityVariant(snapshot, variants.find((item) => item.id === 'negative-half-life:financial:high'));
  assert.equal(positiveLow.snapshot.empPolicies[0].positiveHalfLifeDays, 274);
  assert.equal(negativeHigh.snapshot.empPolicies[0].negativeHalfLifeDays, 913);
  const forged = structuredClone(variants[0]);
  forged.overrides.priorMassMicroEu = '1';
  assert.throws(() => applySensitivityVariant(snapshot, forged), /canonical OAT descriptor/);
});

test('fractional-day decay uses fixed-point half-away-from-zero', () => {
  const halfDay = structuredClone(fixtures[1]);
  halfDay.computedAt = '2026-10-09T12:00:00.000Z';
  halfDay.validUntil = '2026-10-09T13:00:00.000Z';
  halfDay.records = [halfDay.records[0]];
  halfDay.records[0].observedAt = '2026-10-09T00:00:00.001Z';
  const row = replaySnapshots([halfDay], { sensitivity: false }).snapshots[0];
  const event = row.evidence.eventMasses.find((item) => item.evidenceId === halfDay.records[0].evidenceId);
  assert.equal(event.ageMicroDays, '500000');
  assert.ok(BigInt(event.effectiveIndependentMassMicroEu) < BigInt(event.allocatedMassMicroEu));
});

test('input parser accepts JSON and JSONL and enforces row limits', () => {
  assert.equal(parseReplayInput(JSON.stringify(fixtures), 'input.json').length, 2);
  assert.equal(parseReplayInput(fixtureText, 'input.jsonl').length, 2);
  assert.throws(() => parseReplayInput('x'.repeat(1_048_577), 'input.jsonl'), /row.*1 MiB/i);
  assert.throws(() => parseReplayInput('{}\n'.repeat(100_001), 'input.jsonl'), /100000 rows/i);
  assert.throws(() => parseReplayInput('[]', 'input.txt'), /json or jsonl/i);
});

test('CLI writes deterministic mode-600 JSON and rejects unsafe paths and flags', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cred-replay-'));
  const input = path.join(dir, 'input.jsonl');
  fs.copyFileSync(fixturePath, input);
  const cli = path.join(__dirname, '../../scripts/run-cred-shadow-replay.js');
  const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding:'utf8' });
  const first = path.join(dir, 'first.json');
  const second = path.join(dir, 'second.json');
  assert.equal(run(['--input',input,'--output',first]).status, 0);
  assert.equal(run(['--input',input,'--output',second]).status, 0);
  assert.deepEqual(fs.readFileSync(first), fs.readFileSync(second));
  assert.equal(fs.statSync(first).mode & 0o777, 0o600);
  assert.notEqual(run(['--input',input,'--output',first]).status, 0);
  assert.notEqual(run(['--wat']).status, 0);
  assert.notEqual(run(['--input','-','--output',path.join(dir,'stdin.json')]).status, 0);
  for (const flag of ['--rpc','--key','--signer','--broadcast','--production-db']) assert.notEqual(run([flag,'forbidden']).status, 0);
  assert.notEqual(run(['--input','https://example.com/a.json','--output',path.join(dir,'url.json')]).status, 0);
  const symlink = path.join(dir, 'link.jsonl'); fs.symlinkSync(input, symlink);
  assert.notEqual(run(['--input',symlink,'--output',path.join(dir,'symlink.json')]).status, 0);
  const outputSymlink = path.join(dir, 'output-link.json'); fs.symlinkSync(first, outputSymlink);
  assert.notEqual(run(['--input',input,'--output',outputSymlink]).status, 0);
  const oversized = path.join(dir, 'oversized.jsonl'); fs.closeSync(fs.openSync(oversized, 'w')); fs.truncateSync(oversized, 64 * 1024 * 1024 + 1);
  assert.notEqual(run(['--input',oversized,'--output',path.join(dir,'oversized.json')]).status, 0);
  assert.notEqual(run(['--input',dir,'--output',path.join(dir,'directory.json')]).status, 0);
  assert.notEqual(run(['--input',path.join(dir,'data.sqlite'),'--output',path.join(dir,'db.json')]).status, 0);
  const raced = path.join(dir, 'raced.json');
  const children = [0,1].map(() => spawn(process.execPath,[cli,'--input',input,'--output',raced],{stdio:'ignore'}));
  const statuses = await Promise.all(children.map((child) => new Promise((resolve) => child.on('exit',(code) => resolve(code)))));
  assert.deepEqual(statuses.sort(), [0,1]);
});
