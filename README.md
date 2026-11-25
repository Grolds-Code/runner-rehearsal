# Runner Rehearsal

**Test a runner policy before it reaches your CI queue.**

Both runners are busy when a release arrives. FIFO misses the deadline, and prioritizing release jobs can only help after a runner frees up. Runner Rehearsal finds a short extra-runner window and checks the new schedule against the same arrivals, dependencies, and runtime stress cases.

In the built-in incident, the worst total release delay drops from **9 minutes to 0** across three modeled cases with **6 extra runner-minutes**. A second example reaches its deadline with a policy change and the original runner pool.

## Run

Node.js 22 or later. The application and its tests use built-in browser and Node APIs.

```sh
npm start
```

Open http://127.0.0.1:5173. Try **Slow checks**, then **Priority only**. Change the extra capacity budget to **5**, replay, and inspect the remaining deadline miss. Select a job to see its prerequisites and actual queue wait in each schedule.

Use **Load tape** to replay a local JSON file. [Try the example tape](examples/blocked-release.json). All tape processing runs in the browser. [Tape format, objective, and assumptions](docs/engineering.md).

## Verify independently

**Export proof** includes the tape fingerprint, search limits, FIFO baseline, and proposed schedule. The verifier independently checks each dispatch, dependency, runner interval, metric, and limit. The same verifier is available under **Verify a proof** in the browser.

```sh
node scripts/verify.mjs examples/blocked-release-proof.json
npm test
npm run evaluate
npm run build
```

A proof demonstrates a schedule and its metrics for the supplied workload and model. It identifies the normalized tape by SHA-256. Use a trusted copy or fingerprint to establish the tape's provenance. The verifier does not test physical runner availability or search optimality.

Deploy the contents of `dist/` on a static HTTPS host. The app does not need a server-side runtime, a database, or credentials. All included workloads are synthetic.

## Project records

- [Design, concept selection, and measured results](docs/engineering.md)
- [Kiro development and provenance](docs/kiro-handoff.md)
- [Competition checklist, scorecard, and demo draft](docs/submission.md)

Original project created for Kiroween 2026. The source is available under the [MIT license](LICENSE).
