# AI Implementation Brief — Build the First FTS Software Factory Experiment

## Role

You are continuing an experiment in `yasaichi/fts`.

Before changing code, read:

1. `README.md`
2. all accepted ADRs in `docs/adr/`
3. `docs/software-factory-handover.md`
4. the relevant implementation and tests for any area you propose to use as the
   first experiment

Do not treat passing current tests as the final objective.

The purpose of this work is to test whether an AI-assisted development loop can
reason explicitly about:

- likely future changes,
- the utility/cost model used to judge those changes,
- design intent and its reconstructability,
- present complexity,
- robustness when our future prediction is wrong.

---

## Goal

Build the smallest useful prototype of a software-factory layer for FTS that
makes two previously implicit inputs explicit:

1. a **change model** describing likely future changes and our confidence in
   them;
2. a **utility model** describing which technical costs and constraints matter
   when evaluating a design.

Then use those inputs in one concrete architecture experiment.

The result should allow us to compare at least two plausible designs for a real
FTS change and explain why one is preferable under the recorded model.

Do not build a generic workflow engine. Optimize for learning.

---

## Non-goals

Do not:

- replace the existing ADR process;
- rewrite accepted ADRs;
- introduce a large agent framework;
- add speculative abstractions merely because this is a "factory";
- invent precise probabilities when the evidence does not justify them;
- reduce all architecture quality to a single score;
- optimize only for current test pass/fail;
- require a new hosted service unless absolutely necessary;
- change FTS runtime or language semantics solely to support the experiment.

---

## Phase 1 — Recover the current implicit model

Read the existing ADRs and repository structure.

Produce a first-pass inventory with evidence for:

### A. Change scenarios

Identify changes that the current architecture appears intentionally prepared
for.

For each scenario capture:

- stable ID,
- description,
- horizon,
- relative likelihood: `high | medium | low | unknown`,
- confidence: `high | medium | low`,
- evidence,
- affected boundaries,
- what in the current design appears to protect this change,
- cost if the prediction is wrong.

Prefer repository evidence over generic software-engineering assumptions.

Likely areas worth examining include, but are not limited to:

- upstream proposal syntax changes,
- upstream proposal semantic changes,
- proposal withdrawal or native adoption,
- adding another proposal adapter,
- changes in TypeScript support,
- changes in Babel/Volar/Unplugin/SWC integration,
- preserving an ordinary-TypeScript exit path.

Do not assume these are all high probability. Verify them.

### B. Utility and constraints

Extract what the repository already appears to value.

Classify each item as one of:

- **hard invariant** — unacceptable to violate;
- **risk constraint** — violation may be acceptable only with explicit review;
- **soft objective** — tradeable against other objectives.

For each item record:

- stable ID,
- description,
- evidence,
- scope,
- how it could be measured or reviewed.

Candidate examples that must be verified include:

- ordinary TypeScript compatibility as an exit boundary,
- removability of proposal-specific tooling,
- source-map/debugging fidelity,
- avoiding public exposure of generated details,
- one semantic implementation shared by editor/build integrations,
- proposal revision traceability,
- implementation simplicity.

---

## Phase 2 — Introduce durable factory artifacts

Propose and then add a minimal representation under a dedicated directory such
as:

```text
docs/factory/
  change-model.yaml
  utility-model.yaml
  README.md
```

The exact format is your decision, but optimize for:

- human editability,
- stable IDs,
- meaningful diffs,
- agent readability,
- uncertainty representation,
- links to evidence,
- future machine validation.

Do not encode information that is already better represented by tests or ADRs.

The factory artifacts should reference ADRs rather than duplicate their full
contents.

If introducing these artifacts is itself an architectural decision with durable
trade-offs, create a new ADR following the repository's existing ADR process.
Do not modify accepted ADRs in place.

---

## Phase 3 — Choose one real architecture experiment

Select one bounded, non-trivial FTS design question where at least two
reasonable implementations exist and where future-change assumptions could
plausibly change the preferred design.

Good experiments have these properties:

- current behavior can be verified;
- at least one future scenario is realistic and repository-specific;
- alternative designs differ in change locality or present complexity;
- the experiment can be completed without a large repository rewrite.

Examples may involve an existing feature-adapter boundary, duplicated host
integration logic, proposal-version handling, or another area discovered during
inspection.

Do not choose an example merely because it is easy to demonstrate. It must
exercise the model.

---

## Phase 4 — Compare candidate designs before implementing

For the chosen problem, produce at least two candidate designs.

For each candidate record:

### Present cost

Estimate:

- added concepts,
- added modules,
- extra indirection,
- implementation effort,
- new dependencies,
- cognitive overhead.

### Scenario cost

For each relevant change scenario, estimate or simulate:

- files/modules touched,
- interfaces changed,
- tests that require rewriting rather than extension,
- migration requirements,
- public compatibility impact,
- runtime/operational impact,
- new coupling.

Where practical, use an isolated branch/worktree or planning agent to simulate a
future change rather than relying only on prose judgment.

### Forecast-error cost

Explicitly ask:

- What if the predicted change never happens?
- What if the opposite change happens?
- What complexity becomes stranded?
- Is the design reversible?

### Utility interpretation

Do not sum everything blindly.

Apply:

1. hard invariants,
2. risk constraints,
3. soft-objective trade-offs.

Produce a short decision record explaining which candidate is preferred under
the current model and what change in assumptions would reverse that decision.

---

## Phase 5 — Prototype intent-legibility evaluation

Add a lightweight experiment for blind intent reconstruction.

The evaluator should receive enough code and normal repository context to
understand the relevant implementation, but it should not receive the design
rationale being tested.

Ask it to reconstruct:

- the domain/concept model,
- intended boundaries,
- likely independent change directions,
- non-obvious trade-offs,
- deliberate compromises.

Compare the reconstruction with the recorded rationale.

Initially this can be a documented manual/agent procedure rather than a fully
automated CI gate.

Record:

- correctly reconstructed intent,
- missed intent,
- invented/false rationale,
- ambiguous areas,
- extra context required.

The purpose is not to grade prose quality. The purpose is to identify places
where the system's design knowledge cannot be cheaply recovered.

---

## Phase 6 — Implement only after the comparison

After completing the architecture comparison, implement the selected candidate.

Preserve existing repository conventions.

Run:

```sh
npm run verify
```

Tests remain necessary evidence of present correctness, but they are not the
only acceptance criterion for this experiment.

---

## Phase 7 — Report what the factory changed

Create a concise experiment report containing:

1. the current requirement or design question;
2. the extracted change scenarios;
3. the relevant utility constraints/objectives;
4. the candidate designs;
5. present-cost comparison;
6. counterfactual future-change comparison;
7. intent-reconstruction result;
8. selected design and why;
9. which assumption, if changed, would make another design preferable;
10. what should be automated next.

The most important question is:

> Did explicit change and utility models cause a different or better-supported
> design decision than a normal code-generation agent would likely have made?

If the answer is no, explain why. A negative result is useful.

---

## Guardrails

### Preserve uncertainty

Do not convert weak qualitative beliefs into fake numerical precision.

`high / medium / low` with confidence and evidence is preferable to
`P = 0.63` without evidence.

### Separate beliefs from facts

A roadmap assumption is not an invariant. A historical pattern is not a
guarantee. Record the distinction.

### Avoid self-fulfilling architecture

Do not prefer a design simply because the change model was written to justify
it. Include at least one scenario that challenges the candidate architecture.

### Keep the model updateable

Every belief should have evidence and a review point. The system must allow the
change model to evolve as upstream proposals, repository history, and actual
changes provide new evidence.

### Do not confuse legibility with documentation volume

More documentation can increase reconstruction cost. Prefer intent encoded in
clear concepts and boundaries, with comments/ADRs only where the code cannot
carry the rationale safely.

### Do not confuse generic extensibility with evolvability

The goal is not maximum optionality. The goal is low expected cost over the
currently plausible future distribution, with acceptable cost when that
distribution is wrong.

---

## Completion criteria

The first iteration is complete when the repository contains:

- a reviewed first-pass change model;
- a reviewed first-pass utility model;
- documentation for how they relate to ADRs and tests;
- one real candidate-design comparison;
- one intent-reconstruction experiment;
- the selected implementation, if code changes are justified;
- verification passing;
- a written assessment of what the factory learned.

Keep the implementation deliberately small. The purpose of iteration one is to
validate the decision model, not to build the final factory.
