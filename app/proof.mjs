import { cases, jobInputs, limits, loadLimits, loadPlan, loadTape } from './tape.mjs';

export const proofFormat = 'runner-rehearsal-proof/v1';

async function fingerprint(tape) {
  if (!globalThis.crypto?.subtle) throw new Error('Proofs require HTTPS or localhost.');
  const bytes = new TextEncoder().encode(JSON.stringify(tape));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createProof(tape, result) {
  const normalized = loadTape(tape);
  return {
    format: proofFormat,
    tape: normalized,
    tapeSha256: await fingerprint(normalized),
    limits: result.caps,
    baseline: result.baseline,
    proposal: result.recommendation,
  };
}

// Derive urgency by following children. The replay engine propagates deadlines
// backward through a topological order, so the two implementations can disagree.
function urgencyFor(jobs) {
  const children = new Map(jobs.map(job => [job.id, []]));
  for (const job of jobs) {
    for (const parent of job.needs) children.get(parent).push(job);
  }
  const urgency = new Map();

  function latest(job) {
    if (!urgency.has(job.id)) {
      const downstream = children.get(job.id).map(latest);
      urgency.set(job.id, Math.min(job.deadline ?? Infinity, ...downstream) - job.estimate);
    }
    return urgency.get(job.id);
  }
  for (const job of jobs) latest(job);
  return urgency;
}

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function checkStats(actual, claimed) {
  requireThat(claimed && Object.entries(actual).every(([key, value]) => claimed[key] === value),
    'Reported metrics do not match the schedule.');
}

function checkSchedule(tape, scenario, plan, claim, urgency) {
  try {
    const jobs = jobInputs(tape, scenario);
    const byId = new Map(jobs.map(job => [job.id, job]));
    requireThat(claim && Array.isArray(claim.rows) && claim.rows.length === jobs.length,
      'Expected exactly one row per job.');
    const count = tape.runners + Number(Boolean(plan.burst));
    const lanes = Array.from({ length: count }, () => []);
    const scheduled = new Map();
    const latestTime = limits.clock + limits.burst + limits.jobs * limits.minutes;
    const close = plan.burst ? plan.burst.from + plan.burst.minutes : 0;

    for (const row of claim.rows) {
      requireThat(row && byId.has(row.id) && !scheduled.has(row.id), 'Unknown or repeated job.');
      requireThat(Number.isInteger(row.slot) && row.slot >= 0 && row.slot < count,
        row.id + ' uses an unavailable runner.');
      const job = byId.get(row.id);
      requireThat(Number.isInteger(row.start) && row.start >= job.arrival &&
        row.end === row.start + job.minutes && row.end <= latestTime,
      row.id + ' has an invalid arrival or runtime.');
      if (row.slot === tape.runners) {
        requireThat(row.start >= plan.burst.from && row.start < close,
          row.id + ' starts outside the extra runner window.');
      }
      scheduled.set(row.id, row);
      lanes[row.slot].push(row);
    }

    for (const lane of lanes) {
      lane.sort((left, right) => left.start - right.start);
      for (let index = 1; index < lane.length; index++) {
        requireThat(lane[index - 1].end <= lane[index].start, 'Jobs overlap on a runner.');
      }
    }

    const eligibleAt = new Map();
    const stats = { missed: 0, lateness: 0, backgroundWait: 0, extraMinutes: 0, finish: 0 };
    for (const job of jobs) {
      const row = scheduled.get(job.id);
      const ready = Math.max(job.arrival, ...job.needs.map(id => scheduled.get(id).end));
      eligibleAt.set(job.id, ready);
      requireThat(row.start >= ready, job.id + ' starts before its dependencies finish.');
      if (job.deadline !== null && row.end > job.deadline) {
        stats.missed++;
        stats.lateness += row.end - job.deadline;
      }
      if (urgency.get(job.id) === Infinity) {
        stats.backgroundWait = Math.max(stats.backgroundWait, row.start - ready);
      }
      stats.finish = Math.max(stats.finish, row.end);
    }

    if (plan.burst) {
      const extra = lanes[tape.runners];
      stats.extraMinutes = Math.max(close, extra.at(-1)?.end ?? 0) - plan.burst.from;
    }

    // Read the supplied schedule as occupancy intervals at each minute. At every
    // tick, check that idle eligible slots dispatch precisely the expected jobs.
    const endOfDispatch = Math.max(...claim.rows.map(row => row.start));
    for (let minute = 0; minute <= endOfDispatch; minute++) {
      const free = [];
      const started = [];
      for (const [slot, lane] of lanes.entries()) {
        if (slot === tape.runners && (minute < plan.burst.from || minute >= close)) continue;
        if (lane.some(row => row.start < minute && row.end > minute)) continue;
        free.push(slot);
        const dispatch = lane.find(row => row.start === minute);
        if (dispatch) started.push(dispatch);
      }

      const waiting = jobs.filter(job =>
        eligibleAt.get(job.id) <= minute && scheduled.get(job.id).start >= minute);
      waiting.sort((a, b) => {
        if (plan.policy === 'deadline' && urgency.get(a.id) !== urgency.get(b.id)) {
          return urgency.get(a.id) < urgency.get(b.id) ? -1 : 1;
        }
        return eligibleAt.get(a.id) - eligibleAt.get(b.id) || (a.id < b.id ? -1 : a.id === b.id ? 0 : 1);
      });
      requireThat(started.length === Math.min(free.length, waiting.length),
        'Unexpected runner idle time at minute ' + minute + '.');
      requireThat(started.every((row, index) => row.id === waiting[index].id && row.slot === free[index]),
        'Dispatch policy mismatch at minute ' + minute + '.');
    }
    checkStats(stats, claim.stats);
    return stats;
  } catch (error) {
    throw new Error(scenario.name + ' | ' + error.message, { cause: error });
  }
}

export async function verifyProof(proof) {
  requireThat(proof?.format === proofFormat, 'Choose a Runner Rehearsal proof (version 1).');
  const tape = loadTape(proof.tape);
  const tapeSha256 = await fingerprint(tape);
  requireThat(proof.tapeSha256 === tapeSha256, 'Tape fingerprint mismatch.');
  const policy = loadPlan(proof.proposal?.plan);
  const caps = loadLimits(proof.limits);
  const variants = cases(tape);
  const urgency = urgencyFor(tape.jobs);

  function checkAll(runs, plan) {
    requireThat(Array.isArray(runs) && runs.length === variants.length, 'Missing replay cases.');
    return variants.map((variant, index) => {
      requireThat(runs[index]?.caseId === variant.id, 'Cases differ from the tape or are out of order.');
      return checkSchedule(tape, variant, plan, runs[index], urgency);
    });
  }

  const baseline = checkAll(proof.baseline, { policy: 'fifo', burst: null });
  const proposed = checkAll(proof.proposal?.runs, policy);
  for (const [index, stats] of proposed.entries()) {
    requireThat(stats.extraMinutes <= caps.budget, 'Extra runner-minute budget exceeded.');
    requireThat(stats.backgroundWait <= baseline[index].backgroundWait + caps.wait,
      'Background wait limit exceeded.');
  }
  const summary = {
    missed: Math.max(...proposed.map(stats => stats.missed)),
    lateness: Math.max(...proposed.map(stats => stats.lateness)),
    extraMinutes: Math.max(...proposed.map(stats => stats.extraMinutes)),
    backgroundWait: Math.max(...proposed.map(stats => stats.backgroundWait)),
  };
  checkStats(summary, proof.proposal.summary);
  return { name: tape.name, tapeSha256, cases: variants.length, policy, summary };
}
