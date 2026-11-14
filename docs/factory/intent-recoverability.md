# Proposal: evaluating intent recoverability

Date: 2026-09-28

Status: Phase 1 proposal for review. No experiment has been run, no FTS decision
has been selected, and no acceptance thresholds have been validated. The
protocol choices below are proposed defaults, not adopted policy.

## Purpose and rationale

Define an experimentable interpretation of `R(I_t | D, A)`: the effort and error
in recovering recorded design-time intent from a particular design and its
available artifacts. An observation is conditional on the evaluator, evidence
access, task, and resource budget. It is not an intrinsic score of the code.

The [research synthesis](research-synthesis.md) motivates three distinctions:
structural understanding versus historical rationale, recorded intent versus
plausible advice, and LLM performance versus human comprehension. This proposal
uses those distinctions to evaluate a small, bounded decision before attempting
a repository-wide assessment.

The first result should be a profile of recovered intent, errors, uncertainty,
and resource use. Do not combine these into a single cost or architecture score.
No exchange rate between missed intent, model tokens, and human review time is
established here.

## Questions the experiment should answer

- Which recorded concepts, boundaries, assumptions, and trade-offs can an
  evaluator recover, with what supporting evidence?
- Which intentions are missed, contradicted, or replaced by an unsupported story?
- What changes when tests, ordinary documentation, or the target ADR are available?
- How stable are results across fresh runs with the same task and budget?
- What retrieval, inference, and human adjudication effort is required?

The experiment does not establish whether the original decision was correct,
whether future maintainers agree with it, or whether recovery reduces later
change cost. Those require different observations.

## Reference intent and ground truth

### Unit of evaluation

Choose one bounded architectural decision in the later experiment-design phase.
Record both its design-time reference and the repository snapshot being studied.
For historical evaluation, use artifacts from the relevant time, or explicitly
identify later artifacts as a separate condition. Do not silently mix superseded
intent with the current implementation.

Represent reference intent as atomic claims that can be judged individually.
Each claim should retain its scope, conditions, and causal relationship. For
example, “boundary X permits Y to change independently” is more informative than
“X is modular.” This is a template example, not FTS ground truth.

| Reference field | Purpose |
| --- | --- |
| Stable claim ID and category | Track a concept, boundary, change direction, assumption, constraint, trade-off, or deliberate compromise |
| Claim and essential qualifiers | Specify what must be recovered without requiring exact wording |
| Provenance and date | Identify the source revision and relevant passage |
| Decision-time applicability | Record accepted, superseded, conflicting, or uncertain context |
| Matching guidance | Describe acceptable paraphrases and distinctions that must survive |
| Consequence of misunderstanding | Identify critical claims before seeing results |
| Coverage limitations | State what the evidence cannot establish |

Use contemporaneous accepted ADRs, explicit issue/PR discussions, or an
attributable domain model. For prospective candidate designs, have the decision
owner review and record the rationale before implementation. An agent may help
extract claims, but its explanation is not itself authoritative intent.

### Freeze and maintain the reference

Before any reconstruction run, the maintainer reviews the reference claims,
their provenance, and unresolved conflicts. Freeze a versioned reference and
scoring guide. Exclude unresolved historical claims from quantitative
denominators and list them separately; do not resolve them by majority vote
among evaluators.

Absence from the reference is not proof that a reason was never intended.
Reference completeness is a limitation to report. A later discovery may justify
a new reference version, but preserve the original result and label any
rescoring. Do not add a persuasive evaluator argument to the original ground
truth after observing it.

## Evidence conditions and blinding

The reference custodian prepares an explicit evidence manifest and holds the
scoring reference separately. Reconstruction agents receive a neutral task,
generic output categories, and the allowed evidence. They do not receive the
reference claim list, matching guide, expected conclusion, or other runs.

Proposed evidence conditions are nested, using the same code snapshot:

| Condition | Available evidence | Question it addresses |
| --- | --- | --- |
| C: source | Production source, its existing comments, manifests, and build/configuration files | What is recoverable from implementation artifacts? |
| T: source and tests | C plus relevant tests and fixtures | What do behavioral contracts contribute? |
| D: ordinary documentation | T plus selected normal documentation, excluding the target rationale and its duplicates | What is recoverable without explicit access to the tested rationale? |
| R: explicit rationale | D plus the target ADR or contemporaneous rationale source; the scoring reference stays hidden | Can the repository communicate the intent when its explicit record is available? |

C, T, and D are blind to the target rationale only after a leakage audit. R is an
explicit-rationale retrieval/comprehension condition, not a blind reconstruction
success. Run each condition in a fresh context rather than giving a previously
tested agent more information and treating that as independent evidence.

Existing comments are legitimate source artifacts. If a comment directly states
the target reason, mark that claim as explicitly disclosed in that condition.
Do not count it as inferred from structure. A C result can establish recovery
from source artifacts; a claim about structure alone would need a separately
specified comment-ablation experiment. Do not modify production code for it.

### Leakage controls

Prefer an isolated copy containing only manifested evidence, without `.git`,
untracked handoffs, personal memory, experiment answers, or inherited task
conversation. A normal worktree alone is insufficient if it still permits access
to excluded history or sibling files. External browsing and unlisted filesystem
access are unavailable during reconstruction. If the execution environment
cannot enforce these restrictions, report the run as insufficiently isolated.

Audit README text, comments, tests, filenames, other ADRs, and summaries for
direct or paraphrased disclosure of target rationale. Record exclusions and
disclosed claims. If withholding the rationale makes the case incoherent, use
another case or report the condition as infeasible. Do not rewrite evidence to
make a favored design appear clearer.

Public-repository knowledge in model training cannot be ruled out by a fresh
session. Record that limitation; require artifact citations and prefer a
prospectively recorded decision for a stronger later replication.

## Reconstruction task and proposed run procedure

Use the same neutral task template across candidates and evidence conditions:

> Explain the design intent of the specified decision using only the supplied
> artifacts. Address domain concepts, intentional boundaries, expected independent
> changes, assumptions, hard constraints, trade-offs, and deliberate compromises.
> Separate observed structure from inferred intent. Give evidence for each claim
> and state what cannot be determined. Do not propose a better design or invent
> missing historical context.

The task identifies the decision scope without stating the reason being tested.
The evaluator returns an atomic claim list, each with category, evidence
path/location, short explanation, confidence (`low`, `medium`, or `high`), and
whether the claim is explicit in evidence or inferred. It also lists unresolved
questions and abstentions. Confidence is self-reported, not a calibrated
probability. Keep recommendations, if any, outside the scored reconstruction.

Proposed pilot procedure:

1. Freeze the reference, snapshots, evidence manifests, task, rubric, and run
   configuration before starting. Record model/version, instructions, tools,
   accessible context, and any controllable sampling settings.
2. Predeclare equal resource caps for comparable runs: context/input allowance,
   output allowance, tool access, and timeout. Set the actual values when the
   case is selected, using setup work that does not expose target answers.
3. Start with three fresh runs per evidence condition. This is a pragmatic pilot
   default, not a sample-size or statistical-power claim. Use the same evaluator
   configuration initially; treat a different model as a separate replication.
4. Retain all outputs and access logs, including abstentions and failures. Do not
   select the best run or keep adding runs until an attractive result appears.
5. Audit protocol compliance, then score the valid outputs. Report leaked runs
   separately. Distinguish infrastructure failures from budget exhaustion; the
   latter is an observed limitation at the declared budget.
6. If comparing designs, use the same current task and budget and disclose
   reference differences. Compare shared intent claims directly and report
   candidate-specific claims separately. Avoid conflating design quality with
   unequal documentation or reference granularity.

No implementation or orchestration tooling is required to review this proposal.

## Scoring and human adjudication

Match meaning rather than keywords. Split compound output statements into atomic
claims, deduplicate paraphrases, and keep links to the original output. Do not
reward repeated claims. A correct statement of behavior alone does not recover
the reason for that behavior.

Score two separate dimensions:

| Dimension | Labels and interpretation |
| --- | --- |
| Relation to reference intent | Full match; partial match with missing qualifier; contradicted by the reference; outside the reference; unresolved |
| Support in visible evidence | Explicitly supported; reasonable inference with cited support; unsupported; contradicted by visible evidence; unresolved |

A matching guess without visible support is reference overlap, not demonstrated
artifact-based recovery. A useful new argument outside the reference receives no
recovery credit, but is not automatically false. Presenting such an argument as
known historical intent is an unsupported attribution. Reserve “contradicted”
for evidence of a conflict; do not equate “unrecorded” with “invented.”

For each reference claim, report recovered, partially recovered, missed, or
contradicted. A supported full match counts as recovered; an unsupported match
is listed separately and does not count toward supported recovery. Flag outputs
that both assert and deny the same intent rather than crediting only their
matching sentence.

Use a separate scoring pass with access to the frozen reference and evidence.
The maintainer adjudicates the pilot's claim labels and material disagreements;
an LLM may suggest matches but must not be the final authority on historical
intent. Preserve initial labels and corrections. If feasible, have two scorers
label independently before adjudication and report agreement counts. If only one
person scores, record that limitation rather than claiming inter-rater reliability.

## Observations and interpretation

| Observation | Proposed reporting |
| --- | --- |
| Coverage | Supported full matches / eligible reference claims, plus partial, missed, contradicted, and unsupported matches by claim ID |
| Output reliability | Unique output claims fully matching the reference with visible support / all unique scored intent claims, with outside-reference and unresolved claims shown separately; label this reference-based supported precision, not factual accuracy |
| Unsupported or false rationale | Counts of unsupported historical attributions and contradicted claims, including confidence and evidence; keep the two categories separate |
| Uncertainty | Abstentions, unresolved questions, confidence by label, and high-confidence unsupported/contradicted claims |
| Stability | Per-claim recovery frequency and contradictions across runs; report each run and the range, not only an average |
| Context | Available evidence size, unique files read, read volume, tool calls, and explicit-rationale exposure |
| Resources | Input/output tokens and cached tokens where exposed, elapsed time, model cost when available, and budget exhaustion |
| Human effort | Reference preparation, leakage audit, scoring, adjudication, and correction time, separately from model runtime |

Use `N/A` for an undefined denominator, such as an empty output. Keep partial
matches visible without assigning an arbitrary half-credit weight. Report
critical claims individually; recovering many easy claims must not hide a missed
constraint. File counts and read volume describe observed usage, not the minimum
context necessary. Record unavailable telemetry as unknown, not zero.

If R consistently recovers a claim that D misses, report that explicit rationale
helped under these conditions and budgets. This does not prove that an ADR is
universally necessary. If C recovers it, inspect whether it came from a comment
or structural inference. Failure even in R can indicate retrieval, task,
reference, or evaluator problems, not necessarily poor documentation.

For the pilot, produce descriptive results without a global pass/fail score.
Repeated success on one decision establishes feasibility for that case only.
Before using this evaluation as a gate, calibrate task-specific thresholds and
critical-error treatment against maintainer judgments on additional cases.

## Proposed report and negative outcomes

Retain a compact report containing protocol/reference versions, snapshot IDs,
evidence manifests and exclusions, run configurations, raw outputs, claim labels,
resource measurements, and adjudication notes. Keep hidden reference material
outside reconstruction access until all blind runs are complete.

The report must allow these conclusions:

- Intent was recoverable only with explicit rationale access at the tested budget.
- Plausible explanations were generated, but historical intent was not recovered.
- Results varied too much to support a design comparison.
- Reference coverage or evidence leakage prevented a valid conclusion.
- Preparation and review effort outweighed the proposed automation savings.

These are useful findings. A convincing narrative, passing behavior tests, or
agreement among identically configured models is not sufficient evidence of
historical truth.

## Decisions for review and later experiment design

| Question | Proposed default | What remains open |
| --- | --- | --- |
| Initial scope | One bounded decision, atomic reference claims | Select the FTS case in Phase 5, after Phases 2–4 |
| Evidence comparison | C, T, D, and R as separate fresh conditions | Feasibility of each manifest and rationale-withholding boundary |
| Repetition | Three runs per condition with one fixed evaluator configuration | Resource caps, model, and later replication size |
| Scoring | Two dimensions, no scalar score, maintainer adjudication | Reviewer availability and criteria for critical claims |
| Acceptance | Descriptive pilot with negative/inconclusive outcomes permitted | Thresholds only after calibration; no CI gate proposed |

Review these defaults before conducting an experiment. This document does not
authorize or record an experiment run. The remaining conceptual work is Phase 2
(`evolvability.md`) and Phase 3 (`llm-delta.md`); their outcomes may require a
versioned revision of this proposal before Phase 5.
