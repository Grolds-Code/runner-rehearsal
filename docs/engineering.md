# Runner Rehearsal engineering record

## Concept selection

The five columns follow the official equally weighted criteria. These are feasibility judgments for a solo build. The current submission evidence is in the [competition scorecard](submission.md). [Official rubric](https://kiroween.devpost.com/rules)

| Candidate | Potential impact | Implementation using Kiro | Design | Innovation | Presentation |
| --- | --- | --- | --- | --- | --- |
| **Runner Rehearsal** | CI maintainers can estimate deadline and capacity trade-offs before changing runner policy. | The scheduler, proof verifier, and real trace import offer testable contracts, meaningful specs, and invariant tests. | A side-by-side timeline and dependency graph support one decision. | Combines CI replay, a graph-aware planning search, and a portable schedule proof. | One blocked release, one concrete change, and a proof a judge can alter and verify. |
| Agent decision investigation studio | Useful to engineering teams looking for agent failure causes. Harder to demonstrate value without a specific workflow. | Broad traces and nondeterministic tool outcomes make a reliable replay contract harder to scope. | Flexible trace navigation requires substantial interface work. | LangGraph already offers checkpoint replay and forking. The approach also overlaps with PARALLEL's use of replay for oversight. | The explanation depends on a synthetic agent task and extra setup. |
| Data correction rehearsal | Analysts could see which downstream report values a late correction would change. | Credible support for arbitrary SQL, lineage, snapshots, and recomputation needs more integration. | A changed report is legible. Connecting it back to source rows gets crowded. | Data diff and lineage already exist. The strongest differentiation would require integration across systems. | A before/after report is easy to explain. A synthetic toy pipeline may undercut the payoff. |

Runner Rehearsal wins the feasibility comparison because an engineer can see the deadline, runner occupancy, and proposed policy in one view. Local CI runners execute jobs sooner and queue tools report past wait. Runner Rehearsal uses an explicit workload to test a policy counterfactual and hand the resulting schedule to a separate checker. [Rehearse](https://rehearse.sh/) · [runner-queue](https://github.com/paulund/runner-queue) · [LangGraph time travel](https://langchain-ai.github.io/langgraph/concepts/time-travel/) · [Google Cloud data lineage](https://docs.cloud.google.com/knowledge-catalog/docs/about-data-lineage)

The 2025 gallery provided two relevant examples. InteractionKit made gesture input tangible, and UnitSet showed canvas, code, and an active sandbox in one flow. Here the equivalent moment is watching the same release move across the deadline after changing one capacity constraint. [2025 project gallery](https://kiroween-2025.devpost.com/project-gallery)

Originality review covered the public READMEs for PARALLEL (agent action policies), WhyLab (scientific investigations), HemoGrid (blood dispatch), and LotGuard (recall tracing). Runner Rehearsal uses a new repository, data model, scheduler, verifier, fixtures, and interface. The prior repositories supplied background only. [PARALLEL](https://github.com/Grolds-Code/parallel) · [WhyLab](https://github.com/Grolds-Code/WhyLab) · [HemoGrid](https://github.com/Team-Relay/hemo-grid-backend) · [LotGuard](https://github.com/Grolds-Code/LotGuard)

## Architecture

| Source | Responsibility |
| --- | --- |
| `app/tape.mjs` | Validates bounded inputs and the dependency DAG. Computes latest-start priorities from job estimates and explicit deadlines. |
| `app/replay.mjs` | Advances on release, completion, and capacity events. Searches the finite space of two dispatch policies and an optional extra runner window. |
| `app/search.worker.mjs` | Runs the search off the browser's main thread. The UI can fall back to the same bounded search in browsers without module workers. |
| `app/proof.mjs` | Checks interval occupancy and dispatch one minute at a time. Derives urgency by traversing downstream jobs. It shares the input schema with the simulator and uses a different scheduling implementation. |
| `app/main.mjs` | Presents results, a job graph, and local file import and verification. Imported labels render as text. |
| `scripts/verify.mjs` | Checks that the downloaded proof can be used outside the browser. |

This is a browser-local decision model. The planning component is finite search over an explicit action space. It requires no generated text, model API, or runtime account. The application runs the same model for every policy and can be hosted as static assets.

### Tape contract

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `name` | Display name, up to 80 characters |
| `runners` | One to four permanent, identical runners |
| `jobs` | One to 32 job objects |
| `jobs[].id` | Unique lowercase ID of at most 32 letters, digits, and hyphens, starting with a letter or digit |
| `jobs[].name` | Display label, up to 80 characters |
| `jobs[].arrival` | First minute the job is offered to the runner pool, from 0 to 120 |
| `jobs[].minutes` | Observed or assumed runtime, from 1 to 45 whole minutes |
| `jobs[].estimate` | Optional forecast used by priority dispatch, with the reference runtime as the default |
| `jobs[].needs` | Optional array of upstream job IDs. Cycles, missing jobs, and duplicate dependencies are rejected. |
| `jobs[].deadline` | Optional latest completion time from 1 to 120. At least one job needs a deadline. |
| `variants` | Up to three named stress cases with unique IDs and optional `minutes` and `arrivals` maps keyed by job ID. Forecasts and deadlines stay fixed. |

A job becomes eligible after its arrival and all prerequisites have finished. Its queue wait begins at that eligibility time. Deadline-first dispatch propagates latest starts backward through prerequisites, using the earliest implied latest start when paths branch. It prefers the earliest latest-start with ties broken by eligibility time and ID. Jobs run to completion on the slot that accepted them.

The extra slot admits work in the half-open interval `[from, from + minutes)`. Its bill extends through any in-progress work when the window closes. The search tries both dispatch policies with the permanent pool, then every extra slot opening before the last deadline and every window length within budget. A plan is feasible when its billed extra runner-minutes stay within budget and its longest background wait exceeds the same case's FIFO maximum by at most the allowed change. Jobs with a path to any deadline count as release work.

The search minimizes the worst deadline miss count, then worst total late minutes, worst billed extra minutes, and worst background wait. Ties favor shorter reservations and earlier starts. These modeled interventions hold the workload fixed within each case. Assumptions include immediate runner availability, interchangeable runners, non-preemptive jobs, no new work in reaction to the plan, and no observed production outcome.

## Validation

`npm test` executes 12 tests covering known deadlines, cycle detection, simultaneous events, capacity spillover, changed schedules and metrics, and 64 generated DAGs. `npm run evaluate` runs a separate 96-workload synthetic suite with three cases per workload, an eight-runner-minute cap, and at most two extra minutes of longest background wait. The workload generator, seed step, and comparisons are checked in.

| Method | Workloads meeting all deadlines | Total deadline misses across 288 replays | Total late minutes |
| --- | ---: | ---: | ---: |
| FIFO | 9 / 96 | 322 | 5,430 |
| Deadline priority only | 40 / 96 | 162 | 816 |
| Searched plan | 51 / 96 | 129 | 1,268 |

All 96 searched plans passed the independent checker. The search evaluated 21,968 plans and had an observed p95 search time of about 15 ms in Node.js 24.22.3 in this cloud environment. The priority-only comparator exceeded the background-wait cap in at least one case for 57 workloads. It had lower aggregate late minutes than the searched plan. The search prioritizes worst-case missed deadlines and applies the wait cap. The suite measures behavior on synthetic inputs and does not estimate production speedups.

The default incident provides a small regression case. The current release is six minutes late in the reference case and nine minutes late under slow checks. The recommended six-minute reservation meets every deadline across all three cases. A five-runner-minute budget leaves a miss in at least one case.
