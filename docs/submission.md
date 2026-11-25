# Kiroween 2026 submission draft

**Category** Frankenstein

**Project** Runner Rehearsal

**Current state** Runnable engineering checkpoint with public source. Kiro implementation, public judge access to the app, and the YouTube video are open submission requirements.

## Devpost

### Short description

Rehearse a CI runner policy on the same queue, find the smallest capacity change that protects a release, and verify the proposed schedule from a portable proof.

### The problem

Two routine jobs occupy the only two runners. A release arrives with ten minutes to publish. Even after you prioritize its build and tests, it waits behind jobs that have already started. Should you add a runner? When should it start, and how long do you need it?

### What it does

Runner Rehearsal compares the current queue with a policy change and a short extra-runner window. It reruns the same dependency graph under slower checks and a slower artifact build. The default incident cuts worst-case delay from nine minutes to zero. Six extra runner-minutes meet the deadline in all three modeled cases. Set the budget to five and the replay shows what still misses.

The application combines a discrete-event simulator, a dependency-aware planner, and a schedule proof that a separate verifier can check. Select a job on the timeline to inspect its prerequisites and queue wait. Export the proof to reproduce the outcome locally or in the browser.

### How it was built

The app runs locally in the browser. A worker handles the bounded search. The verifier reads the schedule as occupancy intervals, checks policy order, and independently recomputes deadlines, extra capacity, and background wait. All examples are synthetic. The project uses a new codebase and is available under the MIT license.

### Kiro write-up status

Codex recorded the engineering checkpoint and test results. Fill the Kiro write-up after a signed-in Kiro session adds the CI trace import and deadline guard. Describe the spec decision, the exact code change, and a test or hook run that changed the result. Include verified paths and a commit link. [Kiro tasks and provenance](kiro-handoff.md).

## Demo recording plan

Target duration **2:30**. Record the interaction with the default sample on the deployed build after Kiro work lands. Use a clean browser profile and English captions. Use original voiceover and project footage.

| Time | On screen and narration |
| --- | --- |
| 0:00–0:19 | Start on the live timeline. “Two runners are busy when the release arrives. The publish job finishes at minute sixteen. It was due at ten. What would make it on time?” |
| 0:19–0:45 | Switch to **Slow checks** and **Priority only**. “Under slow checks, changing the priority still leaves it eight minutes late. The check jobs are already running.” |
| 0:45–1:12 | Return to **Recommendation**. Point to the extra lane and choose **Slow artifact**. “One extra runner opens at minute two and costs six runner-minutes. The release meets its deadline across every workload shown here.” |
| 1:12–1:33 | Set the budget to **5**, click **Replay queue**, and show the remaining miss. Restore **8**. “The planner has to respect this budget and the wait limit for background jobs. At five runner-minutes, the tool shows a missed deadline instead of hiding it.” |
| 1:33–1:56 | Export the proof and check it in the verifier. Open a copy with a changed metric. “The checker reads the schedule and rejects the altered result. You can run it outside the app too.” |
| 1:56–2:19 | Show the real Kiro spec, a changed source file, and the relevant check output. Narrate one grounded development decision after the Kiro session has happened. |
| 2:19–2:30 | Show the replay and source links. “Rehearse a runner policy before rolling it out.” |

Re-time after recording and verify the default example numbers on that build. Publish publicly to YouTube during the submission period. Use no footage or content from a third party without permission.

## Internal scorecard

| Criterion | What judges need to see | Verified evidence | Main weakness and highest-value improvement |
| --- | --- | --- | --- |
| Potential impact (20%) | Engineers make a better queue change before spending runner minutes. | Two distinct CI incidents, a bounded budget, a background wait cap, and a 96-workload synthetic comparison. | Validate the import and scheduling model with one authorized, measured CI trace. |
| Technological implementation using Kiro (20%) | A real spec, implementation decisions, and test evidence tied to Kiro. | Codex implementation and results. Kiro sign-in barrier observed. | Complete both Kiro specs, run the implementation tasks and checks, and retain actual session evidence. |
| Design (20%) | A legible workflow from incident signal to plan and proof. | Desktop browser demonstrated stress selection, priority comparison, zero-budget replays, and switching examples. | Re-run desktop and mobile checks on the exact public build after Kiro changes. |
| Innovation (20%) | A technical combination that solves an operational problem. | Shared-input queue replay, graph-aware search, and independent dispatch verification work together. | Include a measured trace whose input uncertainty and runner limits are visible. |
| Presentation (20%) | First twenty seconds show the conflict. The rest shows changing outcomes and Kiro's actual contribution. | Timed script and testable demo path. | Record the live app with verified numbers, a rejected proof, and the real Kiro development clip. |

## Compliance and bonuses

The official cutoff is **December 4, 2026 at 2:00 p.m. Pacific**, which is **December 5 at 1:00 a.m. EAT**. Finish on December 4 in Kenya. The build window opened October 30 at 9:00 a.m. Pacific. Eligibility is subject to the full rules and organizer verification. [Official rules](https://kiroween.devpost.com/rules)

| Requirement | Status / evidence |
| --- | --- |
| Solo eligibility and Devpost registration | The rules allow solo entrants of majority age subject to listed exclusions and conflicts. Confirm registration and entrant details in Devpost. |
| Newly created working Frankenstein project | Original repository started November 24. Prior projects were consulted for originality. CI examples and code were created for this project. |
| Meaningful Kiro use and tracked root `.kiro/` | Pending authenticated Kiro implementation, reviewed artifacts, and write-up. The Git ignore file permits `.kiro/` paths. |
| Public GitHub source, detectable license, complete instructions | The public repository includes the source, MIT license, and run instructions. [Grolds-Code/runner-rehearsal](https://github.com/Grolds-Code/runner-rehearsal) |
| Functional app URL with judge access | Application works from a static build. Confirm the final public URL and test it signed out. Leave it accessible through the judging period. |
| Public YouTube video under three minutes | Script drafted. Record and publish after verifying final behavior and Kiro footage. |
| English description, category, bonus links, and final review | Draft prepared. Enter exact verified links and obtain entrant approval before final submission. |
| Rights and external code | License included. The checkpoint uses original code and assets, synthetic data, and no runtime third-party services. Disclose the technical assistance from Codex and the later Kiro work. The entrant must own and review the original work product as required by the rules. |

The $30,000 overall first-place prize and $5,000 Frankenstein category prize are alternatives for one entry, with eligible bonuses available in addition. [Prize rules](https://kiroween.devpost.com/rules)

| Bonus | Decision |
| --- | --- |
| Best Student Project, Frankenstein | Pursue using the MSc program you can document as actively attending at submission. Kenya's CUE lists JOOUST as chartered. WQU reports DEAC accreditation for its MSc in Financial Engineering. Provide school, degree, academic year, student email, LinkedIn, and current enrollment proof if requested. The prize is $1,500 and one year of Kiro Pro Max. [Devpost](https://kiroween.devpost.com/) · [CUE](https://www.cue.or.ke/index.php?Itemid=492&id=81%3Aapproved-academic-programmes-dec-2023&option=com_phocadownload&view=category) · [WQU catalog](https://www.wqu.edu/documents/wqu-catalog.pdf) |
| Best Demo | Eligible submissions are automatically considered. The official rule also requires a top-10% overall score. |
| Best Startup | Enter only if this project genuinely belongs to an eligible startup. The current entry is a solo project. |
| Blog and Social Blitz | Optional after real Kiro usage. The blog must identify Kiroween 2026 and be public on a third-party platform during the period. The social post must start with `#KiroweenHackathon26` and describe actual Kiro use. |
| Ghost of Kiroween Past and Crew | Require verified 2025 registration or a separate newly built Kiro Crew app, respectively. Neither has been established for this entry. |

## Remaining milestones

| By (EAT) | Exit condition |
| --- | --- |
| November 25 | GitHub repository available and Kiro session authenticated. Original checkpoint pushed and attributable. |
| November 28 | Kiro specs, CI trace import, deadline guard, and tests merged with verified provenance. |
| November 30 | Public app and source accessible. Test imported case and the proof round trip in the public build. |
| December 2 | Re-run evaluation, inspect regressions, and rehearse the video. |
| December 3 | Public YouTube URL and Kiro write-up ready. |
| December 4 | Complete the signed-out source and app check and review the Devpost draft with the entrant. |
