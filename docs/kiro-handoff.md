# Continue Runner Rehearsal in Kiro

## Provenance as of November 24, 2026

| Source | Verified activity |
| --- | --- |
| Codex in ChatGPT Work | Concept research and selection, tape model, event simulator, finite search, independent proof checker, browser interface, tests, and submission drafts. Local commits record this work. |
| Kiro | Kiro Web was reachable and redirected to sign-in. The workspace had no installed Kiro executable and the official CLI download endpoint timed out from the shell. No authenticated Kiro session or Kiro-generated project artifact was observed. |

Kiro Web's personal sign-in flow currently requires a paid Kiro subscription. If your account is on Free, use Kiro IDE or CLI with the same GitHub login. The Kiro credit award and account entitlements are separate checks. A Linux cloud workspace with the official CLI and an interactive sign-in is sufficient for the CLI workflow. [Kiro Web setup](https://kiro.dev/docs/web/setup/) · [Official downloads](https://kiro.dev/downloads/) · [CLI documentation](https://kiro.dev/docs/cli/)

The starter contains a runnable Codex-built checkpoint. Kiro has two substantive features to deliver before we claim Kiro usage. Open the project root in the signed-in workspace and use the **Spec** workflow. The spec should live under `.kiro/specs/`. [Kiro spec documentation](https://kiro.dev/docs/cli/v3/specs/)

## Prompt for the first Kiro session

Copy the following into Kiro and approve the requirements and design after reviewing them.

> Build a Requirements-First Feature Spec for **importing a CI event trace** in Runner Rehearsal. Inspect README.md, docs/engineering.md, app/tape.mjs, app/main.mjs, and test/replay.test.mjs. First write functional steering for the project and generate requirements, design, and tasks through Kiro's Spec workflow. Then implement the feature and run its checks.
>
> Give a release engineer a local import path for completed CI jobs with ISO timestamps, one runner pool, dependencies, release cutoffs, and optional observed queue times. Define and document a compact versioned input shape, with explicit job IDs and independent arrival times. The importer must distinguish arrival, observed queue time, start time, completion, and dependency readiness. It must reject ambiguous dependencies, unsupported timezones, out-of-range values, and missing deadlines with an actionable message. Use a consistent rounding rule for minute-granularity replay and document its consequences. Route the converted tape through the existing validator and worker. The existing tape import must keep working. Process data locally and keep GitHub tokens and log contents out of the app.
>
> Add a deterministic test fixture that illustrates why observed job starts cannot be used for counterfactual arrivals. Add a documented example of how an engineer can construct the input from an authorized CI export and a deadline manifest. Add negative tests for missing or ambiguous input. Use a Kiro hook to run the checks when it is supported by this surface, and confirm the hook executed. Run npm test, npm run build, and npm run evaluate. Keep the implementation on a dedicated branch. Report the generated spec and steering paths, source diff, test results, and changes made after the first failing test.

## Prompt for the second Kiro session

> Use a new Kiro Feature Spec to protect any release deadline that FIFO already meets in the same case. Provide a small multi-deadline fixture where improving the worst aggregate result alone would newly miss a previously met deadline. Add the guard to the planner and to the independently implemented proof verifier, using the actual job IDs and deadlines. The UI should explain why the guard matters and report infeasibility without claiming that every requested goal was met. Preserve version-1 proof compatibility by explicitly versioning changed semantics. Add property tests that generate DAGs with competing deadlines and show that no accepted recommendation creates a new miss against its own baseline. Record how the spec and tests affected implementation. Re-run the existing fixtures and evaluation, and update the draft's reported results if they change.

## Record the actual work

1. Keep Kiro-generated specs, steering, and any exercised hook in the root `.kiro/` directory. Review the files for secrets or personal data before committing.
2. Keep the Codex baseline and Kiro implementation in identifiable commits. Record the base and result SHA, date, Kiro surface, relevant spec path, implemented change, and executed test command with its result.
3. Retain a redacted session transcript, screenshot, or short screen recording showing the actual spec run, implementation diff, or hook output. Kiro CLI V3 can save the active session locally with `/chat save runner-rehearsal-kiro.zip`. Review session exports for private details before sharing any excerpt. [Kiro session documentation](https://kiro.dev/docs/cli/chat/session-management/)
4. Update the Kiro write-up in the submission draft from those records. The judges evaluate how the tool changed the implementation and may reject insufficient use.
