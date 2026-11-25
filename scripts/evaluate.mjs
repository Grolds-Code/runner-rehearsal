import { performance } from 'node:perf_hooks';
import { search, worst } from '../app/replay.mjs';
import { createProof, verifyProof } from '../app/proof.mjs';
import { generatedTape } from '../test/workloads.mjs';

const count = 96;
const totals = {
  fifo: { allDeadlines: 0, misses: 0, lateMinutes: 0 },
  priority: { allDeadlines: 0, misses: 0, lateMinutes: 0 },
  searched: { allDeadlines: 0, misses: 0, lateMinutes: 0 },
};
const durations = [];
let proved = 0;
let candidates = 0;
let chargedMinutes = 0;
let priorityViolations = 0;

for (let index = 1; index <= count; index++) {
  const tape = generatedTape(index * 104729);
  const started = performance.now();
  const result = search(tape, { budget: 8, wait: 2 });
  durations.push(performance.now() - started);
  candidates += result.evaluated;
  chargedMinutes += result.recommendation.summary.extraMinutes;
  const data = { fifo: result.baseline, priority: result.priority, searched: result.recommendation.runs };
  for (const [name, runs] of Object.entries(data)) {
    if (worst(runs).missed === 0) totals[name].allDeadlines++;
    for (const { stats } of runs) {
      totals[name].misses += stats.missed;
      totals[name].lateMinutes += stats.lateness;
    }
  }
  if (result.priority.some((run, caseIndex) =>
    run.stats.backgroundWait > result.baseline[caseIndex].stats.backgroundWait + result.caps.wait)) {
    priorityViolations++;
  }
  await verifyProof(await createProof(tape, result));
  proved++;
}

durations.sort((a, b) => a - b);
const time = percentile => Number(durations[Math.ceil(percentile * durations.length) - 1].toFixed(2));
console.log(JSON.stringify({
  workloads: count, cases: count * 3, seedStep: 104729, caps: { budget: 8, wait: 2 },
  totals, priorityViolations, verifiedProofs: proved, candidatePlans: candidates,
  summedWorstCaseRunnerMinutes: chargedMinutes,
  searchMilliseconds: { p50: time(.5), p95: time(.95), max: time(1) },
  runtime: process.version,
}, null, 2));
