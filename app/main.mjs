import { defaultLimits, pullRequestTape, releaseTape } from './examples.mjs';
import { createProof, verifyProof } from './proof.mjs';
import { search, worst } from './replay.mjs';
import { cases, jobInputs, limits, loadTape, priorities } from './tape.mjs';

const byId = id => document.getElementById(id);
const state = {
  tape: loadTape(releaseTape), result: null, caseIndex: 0, view: 'plan',
  selected: 'publish', root: 'publish', searchId: 0, importId: 0, proofId: 0, worker: null,
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, attributes, className) {
  const node = element('button', className, text);
  node.type = 'button';
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function clearError() {
  const notice = byId('app-error');
  notice.hidden = true;
  notice.textContent = '';
}

function showError(message) {
  const notice = byId('app-error');
  notice.textContent = message;
  notice.hidden = false;
}

function proofStatus(message, type = '') {
  const feedback = byId('proof-status');
  feedback.className = 'proof-status small ' + type;
  feedback.textContent = message;
}

function describeWorkload(custom) {
  const { tape } = state;
  byId('tape-origin').textContent = custom ? 'Imported workload' : 'Synthetic incident';
  byId('tape-overview').textContent =
    tape.jobs.length + ' jobs · ' + tape.runners + (tape.runners === 1 ? ' runner' : ' runners');
  byId('case-count').textContent = cases(tape).length + ' load cases';
  byId('cases').replaceChildren(...cases(tape).map((variant, index) =>
    button(variant.name, { 'data-case': index, 'aria-pressed': index === state.caseIndex })));
}

function runSearch(caps) {
  const id = ++state.searchId;
  state.proofId++;
  if (state.worker) state.worker.terminate();
  state.worker = null;
  state.result = null;
  byId('replay-button').setAttribute('aria-busy', 'true');
  byId('export-proof').disabled = true;
  proofStatus('Export includes the workload and the recommended schedule.');
  byId('search-status').textContent = 'Searching feasible dispatch plans…';
  byId('hero-status').textContent = 'Replaying the reference and stress cases.';
  byId('timelines').replaceChildren(element('p', '', 'Running the replay…'));
  byId('plan-scope').textContent = 'Searching the schedule space.';
  for (const key of ['proposal', 'plan-stats', 'case-table', 'job-detail']) byId(key).replaceChildren();
  for (const key of ['hero-before', 'hero-after']) byId(key).textContent = '—';

  function settle(result, error) {
    if (id !== state.searchId) return;
    if (state.worker) state.worker.terminate();
    state.worker = null;
    byId('replay-button').removeAttribute('aria-busy');
    if (error) {
      showError('Replay could not run. ' + error);
      byId('search-status').textContent = 'Replay failed.';
      byId('hero-status').textContent = 'Change the workload or limits and try again.';
      byId('timelines').replaceChildren(element('p', '', 'No schedule available.'));
      return;
    }
    state.result = result;
    byId('export-proof').disabled = false;
    renderResult();
    renderComparison();
  }

  function localSearch() {
    setTimeout(() => {
      if (id !== state.searchId) return;
      try { settle(search(state.tape, caps)); }
      catch (error) { settle(null, error.message); }
    }, 0);
  }

  try {
    const worker = new Worker(new URL('./search.worker.mjs', import.meta.url), { type: 'module' });
    state.worker = worker;
    worker.onmessage = ({ data }) => settle(data.result, data.error);
    worker.onerror = event => {
      event.preventDefault();
      if (id !== state.searchId) return;
      worker.terminate();
      state.worker = null;
      localSearch();
    };
    worker.postMessage({ tape: state.tape, caps });
  } catch {
    localSearch();
  }
}

function currentLimits() {
  return { budget: byId('budget').valueAsNumber, wait: byId('wait').valueAsNumber };
}

function selectTape(tape, custom) {
  state.tape = tape;
  state.caseIndex = 0;
  state.view = 'plan';
  state.selected = tape.jobs.find(job => job.deadline !== null).id;
  state.root = state.selected;
  byId('budget').value = defaultLimits.budget;
  byId('wait').value = defaultLimits.wait;
  describeWorkload(custom);
  renderGraph();
  runSearch(defaultLimits);
}

function renderResult() {
  const { result } = state;
  const { plan, runs, summary } = result.recommendation;
  const passed = runs.filter(item => item.stats.missed === 0).length;
  byId('hero-before').textContent = worst(result.baseline).lateness + ' min';
  byId('hero-after').textContent = summary.lateness + ' min';
  byId('hero-after').classList.toggle('incomplete', summary.missed > 0);
  byId('hero-status').textContent = passed + ' of ' + runs.length + ' load cases meet every deadline.';
  byId('plan-scope').textContent = 'Best feasible plan within the search space';

  const dispatch = plan.policy === 'deadline' ? 'Prioritize the release path' : 'Keep FIFO dispatch';
  const timing = plan.burst
    ? 'Open one extra runner at minute ' + plan.burst.from + ' for ' + plan.burst.minutes + ' min.'
    : 'Use the existing runner pool.';
  byId('proposal').replaceChildren(element('strong', '', dispatch), element('p', '', timing));

  const delayChip = summary.missed
    ? element('span', 'neutral', 'Deadlines still missed')
    : element('span', '', 'All modeled deadlines met');
  byId('plan-stats').replaceChildren(delayChip, element('span', 'neutral',
    summary.extraMinutes + ' worst-case runner-min'));
  byId('search-status').textContent =
    result.evaluated.toLocaleString('en') + ' plans tested · ' + result.feasible.toLocaleString('en') + ' within limits';
}

function percent(value, horizon) {
  return (value / horizon * 100) + '%';
}

function markTime(node, value, horizon) {
  node.style.setProperty('--left', percent(value, horizon));
  return node;
}

function timeline(run, label, plan, horizon, ticks, deadline, latestStarts) {
  const root = element('section', 'timeline');
  const header = element('div', 'timeline-heading');
  const misses = run.stats.missed;
  header.append(
    element('strong', '', label),
    element('p', misses ? 'bad' : 'good',
      misses ? run.stats.lateness + ' min late · ' + misses + (misses === 1 ? ' miss' : ' misses') : 'On time'));
  root.append(header);
  const axis = element('div', 'time-axis');
  const track = element('div', 'axis-track');
  axis.append(element('span'), track);
  for (const tick of ticks) track.append(markTime(element('span', 'tick-label', String(tick)), tick, horizon));
  root.append(axis);

  const jobs = new Map(state.tape.jobs.map(job => [job.id, job]));
  const count = state.tape.runners + Number(Boolean(plan?.burst));
  for (let slot = 0; slot < count; slot++) {
    const extra = slot === state.tape.runners;
    const row = element('div', 'lane');
    const lane = element('div', 'lane-track');
    row.append(element('span', extra ? 'lane-name extra' : 'lane-name', extra ? 'Extra runner' : 'Runner ' + (slot + 1)), lane);
    for (const tick of ticks) lane.append(markTime(element('i', 'tick-line'), tick, horizon));

    if (extra) {
      const burst = markTime(element('i', 'burst-window'), plan.burst.from, horizon);
      burst.style.setProperty('--length', percent(plan.burst.minutes, horizon));
      burst.title = 'Extra runner admission window';
      lane.append(burst);
    }

    for (const item of run.rows.filter(item => item.slot === slot)) {
      const job = jobs.get(item.id);
      const critical = Number.isFinite(latestStarts.get(item.id));
      const description = job.name + ', minutes ' + item.start + ' to ' + item.end + ', ' + label;
      const jobButton = button(job.name, {
        'data-job': job.id, 'aria-label': description, 'aria-pressed': state.selected === job.id, title: description,
      }, critical ? 'job-bar critical' : 'job-bar');
      markTime(jobButton, item.start, horizon);
      jobButton.style.setProperty('--length', percent(item.end - item.start, horizon));
      lane.append(jobButton);
    }

    const line = markTime(element('i', 'deadline-line'), deadline, horizon);
    line.title = 'First deadline · minute ' + deadline;
    lane.append(line);
    root.append(row);
  }
  return root;
}

function shownRuns() {
  return state.view === 'plan' ? state.result.recommendation.runs : state.result.priority;
}

function renderComparison() {
  if (!state.result) return;
  const { result, tape, caseIndex, view } = state;
  const baseline = result.baseline[caseIndex];
  const alternate = shownRuns()[caseIndex];
  const plan = view === 'plan' ? result.recommendation.plan : null;
  const deadline = Math.min(...tape.jobs.flatMap(job => job.deadline === null ? [] : [job.deadline]));
  const bound = Math.max(baseline.stats.finish, alternate.stats.finish, deadline,
    plan?.burst ? plan.burst.from + plan.burst.minutes : 0);
  const step = [1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 240].find(value => value * 8 >= bound);
  const horizon = Math.ceil((bound + 1) / step) * step;
  const ticks = Array.from({ length: 1 + horizon / step }, (_, index) => index * step);
  const latestStarts = priorities(tape);
  byId('timelines').replaceChildren(
    timeline(baseline, 'Current · FIFO', null, horizon, ticks, deadline, latestStarts),
    timeline(alternate, view === 'plan' ? 'Recommendation' : 'Deadline priority only',
      plan, horizon, ticks, deadline, latestStarts));
  byId('show-plan').setAttribute('aria-pressed', view === 'plan');
  byId('show-priority').setAttribute('aria-pressed', view === 'priority');
  byId('alternate-column').textContent = view === 'plan' ? 'Plan delay' : 'Priority delay';
  for (const item of byId('cases').querySelectorAll('[data-case]')) {
    item.setAttribute('aria-pressed', Number(item.dataset.case) === caseIndex);
  }
  byId('case-table').replaceChildren(...cases(tape).map((variant, index) => {
    const current = result.baseline[index].stats;
    const alternative = shownRuns()[index].stats;
    const row = element('tr');
    const title = element('td');
    title.append(button(variant.name, { 'data-case': index, 'aria-current': index === caseIndex }));
    row.append(
      title,
      element('td', current.missed ? 'bad' : '', current.lateness + ' min'),
      element('td', alternative.missed ? 'bad' : 'good', alternative.lateness + ' min'),
      element('td', '', String(alternative.extraMinutes)));
    return row;
  }));
  renderSelected();
}

function graphDepths(jobs, root) {
  const depths = new Map();
  function walk(id) {
    if (depths.has(id)) return depths.get(id);
    const depth = Math.max(-1, ...jobs.get(id).needs.map(walk)) + 1;
    depths.set(id, depth);
    return depth;
  }
  walk(root);
  return depths;
}

let graphObserver;
function renderGraph() {
  if (graphObserver) graphObserver.disconnect();
  const graph = byId('job-graph');
  const jobs = new Map(state.tape.jobs.map(job => [job.id, job]));
  const root = jobs.get(state.root);
  const depths = graphDepths(jobs, root.id);
  const layers = Array.from({ length: depths.get(root.id) + 1 }, () => element('div', 'graph-layer'));
  const nodes = new Map();
  const canvas = element('canvas', 'graph-links');
  canvas.setAttribute('aria-hidden', 'true');
  for (const [id, depth] of depths) {
    const node = button(jobs.get(id).name, { 'data-job': id, 'aria-pressed': state.selected === id }, 'graph-job');
    nodes.set(id, node);
    layers[depth].append(node);
  }
  graph.replaceChildren(canvas, ...layers);
  byId('trace-description').textContent = root.needs.length
    ? 'Upstream chain for ' + root.name + '.' : root.name + ' has no prerequisites.';

  function draw() {
    const bounds = graph.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(bounds.width * ratio);
    canvas.height = Math.ceil(bounds.height * ratio);
    canvas.style.width = bounds.width + 'px';
    canvas.style.height = bounds.height + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = '#ac94e1';
    ctx.lineWidth = 1.5;
    for (const [id, node] of nodes) {
      const target = node.getBoundingClientRect();
      for (const need of jobs.get(id).needs) {
        const source = nodes.get(need).getBoundingClientRect();
        const x1 = source.right - bounds.left;
        const x2 = target.left - bounds.left;
        const y1 = source.top - bounds.top + source.height / 2;
        const y2 = target.top - bounds.top + target.height / 2;
        const middle = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(middle, y1, middle, y2, x2 - 2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2 - 6, y2 - 3);
        ctx.lineTo(x2 - 2, y2);
        ctx.lineTo(x2 - 6, y2 + 3);
        ctx.stroke();
      }
    }
  }

  draw();
  if ('ResizeObserver' in window) {
    graphObserver = new ResizeObserver(draw);
    graphObserver.observe(graph);
  }
}

function renderSelected() {
  for (const node of document.querySelectorAll('[data-job]')) {
    node.setAttribute('aria-pressed', node.dataset.job === state.selected);
  }
  if (!state.result) return;
  const scenario = cases(state.tape)[state.caseIndex];
  const job = jobInputs(state.tape, scenario).find(item => item.id === state.selected);
  function interval(rows) {
    const byJob = new Map(rows.map(row => [row.id, row]));
    const ready = Math.max(job.arrival, ...job.needs.map(id => byJob.get(id).end));
    const { start, end } = byJob.get(job.id);
    return start + '–' + end + ' min · ' + (start - ready) + ' min queued';
  }
  const detail = [
    element('strong', '', job.name),
    element('span', '', 'FIFO ' + interval(state.result.baseline[state.caseIndex].rows)),
    element('span', '', 'Alternate ' + interval(shownRuns()[state.caseIndex].rows)),
  ];
  if (job.deadline !== null) detail.push(element('span', '', 'Due at ' + job.deadline + ' min'));
  byId('job-detail').replaceChildren(...detail);
}

function selectCase(index) {
  state.caseIndex = index;
  renderComparison();
}

function download(name, content) {
  const object = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' }));
  const link = element('a');
  link.href = object;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(object), 3000);
}

async function readJson(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return null;
  if (file.size > limits.fileBytes) throw new Error('Choose a JSON file under 192 KiB.');
  try { return { data: JSON.parse(await file.text()) }; }
  catch { throw new Error('This file is not valid JSON.'); }
}

byId('controls').addEventListener('submit', event => {
  event.preventDefault();
  clearError();
  runSearch(currentLimits());
});
byId('controls').addEventListener('input', () => {
  byId('search-status').textContent = 'Limits changed. Replay the queue to apply them.';
});
byId('workload').addEventListener('change', event => {
  state.importId++;
  clearError();
  if (event.target.value === 'custom') {
    selectTape(state.customTape, true);
  } else {
    selectTape(loadTape(event.target.value === 'pr' ? pullRequestTape : releaseTape), false);
  }
});
byId('load-tape').addEventListener('click', () => byId('tape-file').click());
byId('tape-file').addEventListener('change', async event => {
  const id = ++state.importId;
  try {
    const file = await readJson(event.target);
    if (!file || id !== state.importId) return;
    const tape = loadTape(file.data);
    state.customTape = tape;
    const select = byId('workload');
    let option = select.querySelector('[value="custom"]');
    if (!option) {
      option = element('option');
      option.value = 'custom';
      select.add(option);
    }
    option.textContent = tape.name;
    select.value = 'custom';
    clearError();
    selectTape(tape, true);
  } catch (error) {
    if (id === state.importId) showError('Tape rejected. ' + error.message);
  }
});
byId('show-plan').addEventListener('click', () => {
  state.view = 'plan';
  renderComparison();
});
byId('show-priority').addEventListener('click', () => {
  state.view = 'priority';
  renderComparison();
});
byId('export-tape').addEventListener('click', () => download('runner-rehearsal-tape.json', state.tape));
byId('export-proof').addEventListener('click', async () => {
  if (!state.result) return;
  const id = ++state.proofId;
  const searchId = state.searchId;
  try {
    const proof = await createProof(state.tape, state.result);
    const verified = await verifyProof(proof);
    if (id !== state.proofId || searchId !== state.searchId) return;
    download('runner-rehearsal-proof.json', proof);
    proofStatus('Verified ' + verified.cases + ' cases · tape ' + verified.tapeSha256.slice(0, 12), 'good');
  } catch (error) {
    if (id === state.proofId) proofStatus('Proof could not be exported. ' + error.message, 'bad');
  }
});
byId('import-proof').addEventListener('click', () => byId('proof-file').click());
byId('proof-file').addEventListener('change', async event => {
  const id = ++state.proofId;
  try {
    const file = await readJson(event.target);
    if (!file) return;
    const accepted = await verifyProof(file.data);
    if (id !== state.proofId) return;
    const missed = accepted.summary.missed;
    const outcome = missed ? missed + ' worst-case misses.' : 'Every modeled deadline met.';
    proofStatus('Verified ' + accepted.cases + ' cases for ' + accepted.name + '. ' + outcome, 'good');
  } catch (error) {
    if (id === state.proofId) proofStatus('Proof rejected. ' + error.message, 'bad');
  }
});

document.addEventListener('click', event => {
  const job = event.target.closest('[data-job]');
  if (job) {
    state.selected = job.dataset.job;
    if (!job.closest('#job-graph')) {
      state.root = state.selected;
      renderGraph();
    }
    renderSelected();
  }
  const caseButton = event.target.closest('[data-case]');
  if (caseButton) {
    selectCase(Number(caseButton.dataset.case));
    if (caseButton.closest('#case-table')) {
      byId('cases').querySelector('[aria-pressed="true"]')?.focus();
    }
  }
});

describeWorkload(false);
renderGraph();
runSearch(defaultLimits);
