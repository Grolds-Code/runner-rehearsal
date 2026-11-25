export const limits = Object.freeze({
  jobs: 32, runners: 4, variants: 3, minutes: 45, clock: 120,
  burst: 15, wait: 30, fileBytes: 192 * 1024,
});

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object.');
  }
  return value;
}

function integer(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum + '.');
  }
  return value;
}

function title(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 80) {
    throw new Error(label + ' must contain 1 to 80 characters.');
  }
  return value.trim();
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(value)) {
    throw new Error(label + ' must contain 1 to 32 lowercase letters, digits, or hyphens.');
  }
  return value;
}

function orderedJobs(jobs) {
  const byId = new Map(jobs.map(job => [job.id, job]));
  const active = new Set();
  const done = new Set();
  const order = [];

  function visit(job) {
    if (active.has(job.id)) throw new Error('Dependency cycle at ' + job.id + '.');
    if (done.has(job.id)) return;
    active.add(job.id);
    for (const id of job.needs) {
      if (!byId.has(id)) throw new Error(job.id + ' depends on unknown job ' + id + '.');
      visit(byId.get(id));
    }
    active.delete(job.id);
    done.add(job.id);
    order.push(job);
  }

  for (const job of jobs) visit(job);
  return order;
}

export function loadTape(input) {
  record(input, 'Tape');
  if (input.version !== 1) throw new Error('Use tape version 1.');
  if (!Array.isArray(input.jobs) || !input.jobs.length || input.jobs.length > limits.jobs) {
    throw new Error('A tape needs 1 to ' + limits.jobs + ' jobs.');
  }

  const ids = new Set();
  const jobs = input.jobs.map((item, index) => {
    record(item, 'Job ' + (index + 1));
    const id = identifier(item.id, 'Job ID');
    if (ids.has(id)) throw new Error('Duplicate job ID ' + id + '.');
    ids.add(id);

    const needs = item.needs === undefined ? [] : item.needs;
    if (!Array.isArray(needs) || needs.length >= limits.jobs) {
      throw new Error(id + ' needs must be an array of dependency IDs.');
    }
    const prerequisites = needs.map(value => identifier(value, id + ' dependency'));
    if (new Set(prerequisites).size !== prerequisites.length) {
      throw new Error(id + ' has a repeated dependency.');
    }

    const minutes = integer(item.minutes, 1, limits.minutes, id + ' runtime');
    return {
      id,
      name: title(item.name, id + ' name'),
      arrival: integer(item.arrival, 0, limits.clock, id + ' arrival'),
      minutes,
      estimate: item.estimate === undefined
        ? minutes
        : integer(item.estimate, 1, limits.minutes, id + ' runtime estimate'),
      needs: prerequisites.sort(),
      deadline: item.deadline === undefined || item.deadline === null
        ? null
        : integer(item.deadline, 1, limits.clock, id + ' deadline'),
    };
  });

  if (!jobs.some(job => job.deadline !== null)) throw new Error('Set at least one job deadline.');
  orderedJobs(jobs);

  const variants = input.variants === undefined ? [] : input.variants;
  if (!Array.isArray(variants) || variants.length > limits.variants) {
    throw new Error('Use up to ' + limits.variants + ' stress cases.');
  }
  const variantIds = new Set(['reference']);

  return {
    version: 1,
    name: title(input.name, 'Tape name'),
    runners: integer(input.runners, 1, limits.runners, 'Permanent runners'),
    jobs,
    variants: variants.map(item => {
      record(item, 'Stress case');
      const id = identifier(item.id, 'Stress case ID');
      if (variantIds.has(id)) throw new Error('Duplicate or reserved stress case ID ' + id + '.');
      variantIds.add(id);
      return {
        id,
        name: title(item.name, id + ' name'),
        minutes: overrides(item.minutes, ids, 1, limits.minutes, id + ' runtime'),
        arrivals: overrides(item.arrivals, ids, 0, limits.clock, id + ' arrival'),
      };
    }),
  };
}

function overrides(value, ids, min, max, label) {
  if (value === undefined) return {};
  const entries = Object.entries(record(value, label));
  return Object.fromEntries(entries.map(([id, amount]) => {
    if (!ids.has(id)) throw new Error(label + ' references unknown job ' + id + '.');
    return [id, integer(amount, min, max, label + ' for ' + id)];
  }).sort(([left], [right]) => left < right ? -1 : left === right ? 0 : 1));
}

export function loadPlan(input) {
  record(input, 'Plan');
  if (input.policy !== 'fifo' && input.policy !== 'deadline') {
    throw new Error('Choose FIFO or deadline-first dispatch.');
  }
  let burst = null;
  if (input.burst !== null) {
    record(input.burst, 'Extra runner window');
    burst = {
      from: integer(input.burst.from, 0, limits.clock, 'Extra runner opening'),
      minutes: integer(input.burst.minutes, 1, limits.burst, 'Extra runner window length'),
    };
  }
  return { policy: input.policy, burst };
}

export function loadLimits(input) {
  record(input, 'Search limits');
  return {
    budget: integer(input.budget, 0, limits.burst, 'Extra runner-minute budget'),
    wait: integer(input.wait, 0, limits.wait, 'Additional background wait limit'),
  };
}

export function cases(tape) {
  return [{ id: 'reference', name: 'Reference load', minutes: {}, arrivals: {} }, ...tape.variants];
}

export function priorities(tape) {
  const starts = new Map(tape.jobs.map(job => [
    job.id, job.deadline === null ? Infinity : job.deadline - job.estimate,
  ]));
  const jobById = new Map(tape.jobs.map(job => [job.id, job]));
  for (const job of orderedJobs(tape.jobs).reverse()) {
    for (const id of job.needs) {
      starts.set(id, Math.min(starts.get(id), starts.get(job.id) - jobById.get(id).estimate));
    }
  }
  return starts;
}

export function jobInputs(tape, variant) {
  return tape.jobs.map(job => ({
    ...job,
    arrival: Object.hasOwn(variant.arrivals, job.id) ? variant.arrivals[job.id] : job.arrival,
    minutes: Object.hasOwn(variant.minutes, job.id) ? variant.minutes[job.id] : job.minutes,
  }));
}
