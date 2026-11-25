import { cases, jobInputs, loadLimits, loadPlan, loadTape, priorities } from './tape.mjs';

export const baselinePlan = Object.freeze({ policy: 'fifo', burst: null });
export const priorityPlan = Object.freeze({ policy: 'deadline', burst: null });

function compareIds(left, right) {
  return left < right ? -1 : left === right ? 0 : 1;
}

function replayCase(pool, jobs, latestStarts, plan) {
  const burstClose = plan.burst ? plan.burst.from + plan.burst.minutes : 0;
  const pending = new Set(jobs);
  const byJob = new Map();
  const rows = [];
  const slots = Array(pool + Number(Boolean(plan.burst))).fill(0);
  let minute = 0;
  let missed = 0;
  let lateness = 0;
  let backgroundWait = 0;

  while (pending.size) {
    const ready = [];
    let next = Infinity;
    for (const job of pending) {
      if (!job.needs.every(id => byJob.has(id))) continue;
      const eligibleAt = Math.max(job.arrival, ...job.needs.map(id => byJob.get(id).end));
      if (eligibleAt <= minute) ready.push({ job, eligibleAt });
      else next = Math.min(next, eligibleAt);
    }

    ready.sort((left, right) => {
      if (plan.policy === 'deadline') {
        const a = latestStarts.get(left.job.id);
        const b = latestStarts.get(right.job.id);
        if (a !== b) return a < b ? -1 : 1;
      }
      return left.eligibleAt - right.eligibleAt || compareIds(left.job.id, right.job.id);
    });

    for (let slot = 0; slot < slots.length; slot++) {
      if (slots[slot] > minute) continue;
      if (slot === pool && (minute < plan.burst.from || minute >= burstClose)) continue;
      const item = ready.shift();
      if (!item) break;

      const { job, eligibleAt } = item;
      const end = minute + job.minutes;
      const row = { id: job.id, slot, start: minute, end };
      rows.push(row);
      byJob.set(job.id, row);
      slots[slot] = end;
      pending.delete(job);
      next = Math.min(next, end);

      if (job.deadline !== null && end > job.deadline) {
        missed++;
        lateness += end - job.deadline;
      }
      if (latestStarts.get(job.id) === Infinity) {
        backgroundWait = Math.max(backgroundWait, minute - eligibleAt);
      }
    }

    for (const release of slots) {
      if (release > minute) next = Math.min(next, release);
    }
    if (plan.burst && plan.burst.from > minute) next = Math.min(next, plan.burst.from);
    if (pending.size && !Number.isFinite(next)) throw new Error('Replay stalled.');
    minute = next;
  }

  return {
    rows,
    stats: {
      missed,
      lateness,
      backgroundWait,
      extraMinutes: plan.burst ? Math.max(burstClose, slots[pool]) - plan.burst.from : 0,
      finish: Math.max(...slots),
    },
  };
}

function prepare(tape) {
  const latestStarts = priorities(tape);
  const workloads = cases(tape).map(variant => ({
    caseId: variant.id, jobs: jobInputs(tape, variant),
  }));
  return plan => workloads.map(({ caseId, jobs }) => ({
    caseId, ...replayCase(tape.runners, jobs, latestStarts, plan),
  }));
}

export function replay(input, plan) {
  return prepare(loadTape(input))(loadPlan(plan));
}

export function worst(results) {
  return {
    missed: Math.max(...results.map(item => item.stats.missed)),
    lateness: Math.max(...results.map(item => item.stats.lateness)),
    extraMinutes: Math.max(...results.map(item => item.stats.extraMinutes)),
    backgroundWait: Math.max(...results.map(item => item.stats.backgroundWait)),
  };
}

function outranks(left, right) {
  const difference = left.findIndex((amount, index) => amount !== right[index]);
  return difference !== -1 && left[difference] < right[difference];
}

export function search(input, constraints) {
  const tape = loadTape(input);
  const caps = loadLimits(constraints);
  const evaluate = prepare(tape);
  const baseline = evaluate(baselinePlan);
  const priority = evaluate(priorityPlan);
  const lastStart = Math.max(...tape.jobs.map(job => job.deadline ?? 0));
  let evaluated = 0;
  let feasible = 0;
  let best;

  function consider(plan, runs) {
    evaluated++;
    const summary = worst(runs);
    if (summary.extraMinutes > caps.budget || runs.some((item, index) =>
      item.stats.backgroundWait > baseline[index].stats.backgroundWait + caps.wait)) {
      return;
    }
    feasible++;
    const rank = [
      summary.missed, summary.lateness, summary.extraMinutes, summary.backgroundWait,
      plan.burst?.minutes ?? 0, plan.burst?.from ?? 0, Number(plan.policy === 'deadline'),
    ];
    if (!best || outranks(rank, best.rank)) best = { plan, runs, summary, rank };
  }

  consider(baselinePlan, baseline);
  consider(priorityPlan, priority);
  for (let minutes = 1; minutes <= caps.budget; minutes++) {
    for (let from = 0; from < lastStart; from++) {
      for (const policy of ['fifo', 'deadline']) {
        const plan = { policy, burst: { from, minutes } };
        consider(plan, evaluate(plan));
      }
    }
  }
  return {
    caps,
    baseline,
    priority,
    recommendation: { plan: best.plan, runs: best.runs, summary: best.summary },
    evaluated,
    feasible,
  };
}
