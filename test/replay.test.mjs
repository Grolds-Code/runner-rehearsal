import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseTape, pullRequestTape, defaultLimits } from '../app/examples.mjs';
import { baselinePlan, priorityPlan, replay, search, worst } from '../app/replay.mjs';
import { createProof, verifyProof } from '../app/proof.mjs';
import { loadTape, priorities } from '../app/tape.mjs';
import { generatedTape } from './workloads.mjs';

test('the release needs six extra runner-minutes to meet all modeled deadlines', () => {
  const result = search(releaseTape, defaultLimits);
  assert.deepEqual(result.baseline.map(item => item.stats.lateness), [6, 9, 6]);
  assert.deepEqual(result.priority.map(item => item.stats.lateness), [5, 8, 6]);
  assert.deepEqual(result.recommendation.plan, { policy: 'deadline', burst: { from: 2, minutes: 6 } });
  assert.equal(result.recommendation.summary.missed, 0);
  assert.equal(result.recommendation.summary.extraMinutes, 6);
  assert.equal(result.evaluated, 162);
  assert.ok(search(releaseTape, { budget: 5, wait: 2 }).recommendation.summary.missed > 0);
});

test('priority propagates through dependencies and uses estimated runtimes', () => {
  const tape = loadTape(releaseTape);
  const start = priorities(tape);
  assert.equal(start.get('publish'), 9);
  assert.equal(start.get('release-build'), 4);
  assert.equal(start.get('check-api'), Infinity);
  const alternate = replay(pullRequestTape, priorityPlan);
  assert.deepEqual(alternate.map(item => item.stats.missed), [0, 0]);
  assert.equal(alternate[1].rows.find(row => row.id === 'preview').end, 3);
});

test('completion exactly at the deadline is on time', () => {
  const run = replay(releaseTape, search(releaseTape, defaultLimits).recommendation.plan)[2];
  assert.equal(run.rows.find(row => row.id === 'publish').end, 10);
  assert.equal(run.stats.missed, 0);
});

test('an active extra runner bills spillover after the admission window closes', () => {
  const [run] = replay(releaseTape, { policy: 'deadline', burst: { from: 2, minutes: 1 } });
  assert.deepEqual(run.rows.find(row => row.slot === 2),
    { id: 'release-build', slot: 2, start: 2, end: 5 });
  assert.equal(run.stats.extraMinutes, 3);
});

test('a budget of zero searches only the non-rental rules', () => {
  const result = search(releaseTape, { budget: 0, wait: 0 });
  assert.equal(result.evaluated, 2);
  assert.equal(result.recommendation.plan.burst, null);
  assert.equal(result.recommendation.summary.extraMinutes, 0);
});

test('an already healthy workload can retain FIFO', () => {
  const tape = { version: 1, name: 'Healthy queue', runners: 1,
    jobs: [{ id: 'publish', name: 'Publish', arrival: 0, minutes: 1, deadline: 8 }] };
  const result = search(tape, { budget: 8, wait: 2 });
  assert.deepEqual(result.recommendation.plan, baselinePlan);
});

test('invalid tapes fail before scheduling', () => {
  const cycle = structuredClone(releaseTape);
  cycle.jobs.find(job => job.id === 'release-build').needs = ['publish'];
  assert.throws(() => loadTape(cycle), /cycle/);
  const missing = structuredClone(releaseTape);
  missing.jobs[0].needs = ['missing'];
  assert.throws(() => loadTape(missing), /unknown job/);
  const repeated = structuredClone(releaseTape);
  repeated.jobs.push(repeated.jobs[0]);
  assert.throws(() => loadTape(repeated), /Duplicate job/);
  const badVariant = structuredClone(releaseTape);
  badVariant.variants[0].id = 'reference';
  assert.throws(() => loadTape(badVariant), /reserved stress case/);
  const badMinutes = structuredClone(releaseTape);
  badMinutes.jobs[0].minutes = 1.5;
  assert.throws(() => loadTape(badMinutes), /runtime must be an integer/);
  const empty = structuredClone(releaseTape);
  empty.jobs = [];
  assert.throws(() => loadTape(empty), /needs 1 to 32 jobs/);
});

test('replay handles simultaneous eligibility, completions and burst boundaries', () => {
  const tape = {
    version: 1, name: 'Coincident events', runners: 1,
    jobs: [
      { id: 'blocker', name: 'Blocker', arrival: 0, minutes: 4 },
      { id: 'prepare', name: 'Prepare', arrival: 1, minutes: 3 },
      { id: 'publish', name: 'Publish', arrival: 4, minutes: 1, needs: ['prepare'], deadline: 5 },
      { id: 'queue', name: 'Queued check', arrival: 4, minutes: 3 },
    ],
  };
  const [run] = replay(tape, { policy: 'deadline', burst: { from: 1, minutes: 3 } });
  assert.deepEqual(run.rows, [
    { id: 'blocker', slot: 0, start: 0, end: 4 },
    { id: 'prepare', slot: 1, start: 1, end: 4 },
    { id: 'publish', slot: 0, start: 4, end: 5 },
    { id: 'queue', slot: 0, start: 5, end: 8 },
  ]);
});

test('proof checks reject edits to metrics, dispatch idling and stress cases', async () => {
  const output = search(releaseTape, defaultLimits);
  const proof = await createProof(releaseTape, output);
  assert.equal((await verifyProof(proof)).cases, 3);

  const summaryEdit = structuredClone(proof);
  summaryEdit.proposal.summary.lateness = 4;
  await assert.rejects(() => verifyProof(summaryEdit), /Reported metrics/);

  const idle = structuredClone(proof);
  for (const row of idle.baseline[0].rows) { row.start++; row.end++; }
  await assert.rejects(() => verifyProof(idle), /Unexpected runner idle time/);

  const wrongOrder = structuredClone(proof);
  const first = wrongOrder.baseline[0].rows[0];
  const second = wrongOrder.baseline[0].rows[1];
  [first.slot, second.slot] = [second.slot, first.slot];
  await assert.rejects(() => verifyProof(wrongOrder), /Dispatch policy mismatch/);

  const alteredTape = structuredClone(proof);
  alteredTape.tape.jobs[0].minutes++;
  await assert.rejects(() => verifyProof(alteredTape), /fingerprint mismatch/);

  const missingCase = structuredClone(proof);
  missingCase.proposal.runs.pop();
  await assert.rejects(() => verifyProof(missingCase), /Missing replay cases/);
});

test('proof rejects a dispatch outside the burst, overlaps and broken dependencies', async () => {
  const proof = await createProof(releaseTape, search(releaseTape, defaultLimits));
  const gated = structuredClone(proof);
  const outside = gated.proposal.runs[0].rows.find(item => item.id === 'publish');
  outside.slot = 2;
  outside.start = 8;
  outside.end = 9;
  await assert.rejects(() => verifyProof(gated), /outside the extra runner window/);

  const overlap = structuredClone(proof);
  overlap.baseline[0].rows[1].slot = overlap.baseline[0].rows[0].slot;
  await assert.rejects(() => verifyProof(overlap), /overlap/);

  const dependence = { version: 1, name: 'Dependency test', runners: 2, jobs: [
    { id: 'build', name: 'Build', arrival: 0, minutes: 3 },
    { id: 'publish', name: 'Publish', arrival: 0, minutes: 1, needs: ['build'], deadline: 5 },
  ] };
  const early = await createProof(dependence, search(dependence, defaultLimits));
  const release = early.proposal.runs[0].rows.find(item => item.id === 'publish');
  release.start = 1;
  release.end = 2;
  release.slot = 1;
  await assert.rejects(() => verifyProof(early), /dependencies finish/);
});

test('proof independently enforces extra runner cost and background wait limits', async () => {
  const proof = await createProof(releaseTape, search(releaseTape, defaultLimits));
  proof.limits.budget = 5;
  await assert.rejects(() => verifyProof(proof), /budget exceeded/);

  const pr = await createProof(pullRequestTape, search(pullRequestTape, defaultLimits));
  const { runs } = pr.proposal;
  assert.ok(runs[0].stats.backgroundWait > pr.baseline[0].stats.backgroundWait);
  pr.limits.wait = 0;
  await assert.rejects(() => verifyProof(pr), /Background wait limit/);
});

test('search and independent verification agree over seeded DAGs', async () => {
  for (let seed = 1; seed <= 64; seed++) {
    const tape = generatedTape(seed * 7919);
    const caps = { budget: seed % 9, wait: seed % 4 };
    const result = search(tape, caps);
    const verified = await verifyProof(await createProof(tape, result));
    assert.deepEqual(verified.summary, result.recommendation.summary, 'seed ' + seed);
    assert.ok(result.recommendation.summary.missed <= worst(result.baseline).missed);
    assert.ok(result.recommendation.summary.extraMinutes <= caps.budget);
    for (const [index, run] of result.recommendation.runs.entries()) {
      assert.ok(run.stats.backgroundWait <= result.baseline[index].stats.backgroundWait + caps.wait);
    }
  }
});
