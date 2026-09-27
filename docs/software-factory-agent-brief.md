# AI Research and Experiment Brief — Evolvability and Intent Recoverability

## Mission

Continue the software-factory research in `yasaichi/fts`.

The goal is **not** to build a generic agent workflow and not to optimize for
"AI-written clean code".

The goal is to investigate whether two properties of software design can be made
explicitly evaluable in an LLM-assisted factory:

1. **Intent recoverability**
2. **Evolvability under an explicit future-change and utility model**

Read before doing anything else:

1. `README.md`
2. all accepted ADRs in `docs/adr/`
3. `docs/software-factory-handover.md`
4. relevant code and tests only after the conceptual work below is understood

Do not implement a factory framework before completing the research and
operationalization phases.

---

## Core model

Use this as the working model:

```text
C_t(D, A)
  =
    Σ_i P_t(Δ_i) * U_t(Δ_i | D)
    +
    R(I_t | D, A)
```

where:

- `D`: design/code structure;
- `A`: comments, tests, ADRs, specs, docs, history, and other artifacts;
- `I_t`: design-time intent — domain understanding, assumptions, constraints,
  goals, trade-offs, and rationale;
- `Δ_i`: future change scenario;
- `P_t(Δ_i)`: current probability/frequency belief for that change;
- `U_t(Δ_i | D)`: loss or utility of absorbing that change under the design;
- `R(I_t | D, A)`: intent-reconstruction cost.

Treat this as a research hypothesis and decomposition, not established prior-art
notation.

Also account for present design cost:

```text
DecisionLoss(D)
  =
    PresentComplexity(D)
    +
    ExpectedFutureChangeLoss(D)
    +
    IntentReconstructionCost(D, A)
```

This prevents the experiment from rewarding speculative generic extensibility.

---

# Phase 0 — Prior-art synthesis

Before introducing repository artifacts or code, produce a concise research
synthesis.

Create:

```text
docs/factory/research-synthesis.md
```

The document must distinguish what already exists from what the experiment adds.

## 0A. Evolvability literature

At minimum investigate:

### ALMA

Questions:

- How are change scenarios elicited?
- How are scenario weights/frequencies handled?
- How is change impact evaluated?
- What relies on human architectural judgment?
- What is measured versus estimated?

Primary starting point:

- Bengtsson et al., Architecture-Level Modifiability Analysis (ALMA)
  https://doi.org/10.1016/S0164-1212(03)00080-3

### ATAM

Questions:

- How are competing quality attributes represented?
- How are utility/trade-offs elicited?
- What is the role of scenarios?
- Which parts are qualitative?

Starting point:

- https://www.sei.cmu.edu/library/atam-method-for-architecture-evaluation/

### CBAM

Questions:

- How are cost, benefit, uncertainty, and economic value included?
- What can be reused as a utility model for this experiment?

Starting points:

- https://www.sei.cmu.edu/library/using-economic-considerations-to-choose-among-architecture-design-alternatives/
- https://sei.cmu.edu/library/integrating-the-architecture-tradeoff-analysis-method-atam-with-the-cost-benefit-analysis-method-cbam/

### Evolutionary Architecture / fitness functions

Questions:

- Which architectural characteristics are directly executable?
- Which require judgment?
- How is architectural intent made continuously observable?

Starting points:

- https://evolutionaryarchitecture.com/
- https://evolutionaryarchitecture.com/precis.html

## 0B. Intent-recoverability literature

Investigate:

- design rationale;
- architectural knowledge;
- Architecture Decision Records;
- program comprehension / architecture recovery where relevant;
- intent debt;
- LLM-based design-rationale recovery.

At minimum include:

- Margaret-Anne Storey, "From Technical Debt to Cognitive and Intent Debt":
  https://doi.org/10.1145/3807966
- Zhou et al., "Using LLMs in Generating Design Rationale for Software
  Architecture Decisions":
  https://doi.org/10.1145/3785010

Questions:

- What has prior work tried to preserve?
- How has success traditionally been evaluated?
- What cannot be recovered from implementation alone?
- How accurate are LLMs at rationale reconstruction?
- What failure modes matter, especially invented plausible rationale?

## 0C. Agentic architecture evaluation

Investigate recent work on LLM judgment layered over deterministic checks.

Starting point:

- Mahato, Sieczkowski, Kuppusamy, "Agentic Fitness Functions":
  https://www.infoq.com/articles/agentic-fitness-functions-evolutionary-architecture/

Do not treat this as the final model. Determine which parts are useful and which
parts stop at "LLM architecture review" rather than evaluating the two target
quantities directly.

## Deliverable standard

For each line of prior work, record:

- what problem it formalizes;
- what inputs it requires;
- what output it produces;
- what remains a human judgment;
- what is expensive in the traditional method;
- what an LLM could plausibly make cheaper or newly observable.

Do not write a generic literature summary. The purpose is to identify reusable
mechanisms and unfilled gaps.

---

# Phase 1 — Operationalize intent recoverability

Produce:

```text
docs/factory/intent-recoverability.md
```

The document must define an experimentable version of:

```text
R(I_t | D, A)
```

## 1A. Ground truth

Define what counts as ground-truth intent for an experiment.

Potential sources:

- accepted ADRs;
- issue/PR discussion contemporaneous with a decision;
- explicit experiment rationale recorded before implementation;
- human-authored domain model description.

Do not use post-hoc explanations generated after seeing evaluator output as
ground truth.

## 1B. Blind reconstruction protocol

Design a protocol in which an evaluator can see normal repository artifacts but
not the rationale being tested.

Ask the evaluator to reconstruct:

- domain concepts;
- intentional boundaries;
- expected independent change directions;
- assumptions;
- hard constraints;
- trade-offs;
- deliberate compromises.

## 1C. Candidate observables

Evaluate at least these dimensions:

- correct recovered intent;
- missed intent;
- false/invented rationale;
- uncertainty;
- disagreement across independent runs;
- files/context required;
- whether an ADR was required;
- whether code structure alone was sufficient.

Do not invent a single "beauty score" unless evidence shows it is useful.

## 1D. Main methodological risk

Explicitly address this failure mode:

> the LLM generates a convincing rationale that was never the actual intent.

The protocol must separate plausible explanation generation from genuine
recoverability.

---

# Phase 2 — Operationalize evolvability

Produce:

```text
docs/factory/evolvability.md
```

Define an experimentable version of:

```text
ExpectedFutureChangeLoss(D)
  = Σ_i P_t(Δ_i) * U_t(Δ_i | D)
```

## 2A. Change model

Define the minimum fields needed for a change scenario.

Candidate fields:

- stable ID;
- scenario;
- time horizon;
- probability/frequency bucket;
- confidence;
- evidence;
- affected concepts;
- assumptions;
- review date.

Do not require exact numeric probabilities initially.

## 2B. Utility / loss model

Define which costs can be:

- deterministically measured;
- estimated from a simulated diff;
- judged by an LLM rubric;
- supplied by a human/business owner.

Separate:

1. hard invariants;
2. risk constraints;
3. soft objectives.

Possible dimensions include:

- public compatibility;
- changed modules;
- changed interfaces;
- test rewrites;
- migration cost;
- source-map/debugging integrity;
- new coupling;
- implementation effort;
- removability;
- present complexity.

## 2C. Forecast-error cost

The model must explicitly ask:

- What if the scenario never occurs?
- What if a different scenario occurs?
- What complexity becomes stranded?
- How reversible is the design?

This is necessary to avoid rewarding architecture-astronaut behavior.

---

# Phase 3 — Define what the LLM changes

Produce:

```text
docs/factory/llm-delta.md
```

This document is central.

Do not merely list things an LLM can do.

Compare traditional architecture analysis with the LLM-enabled version.

## 3A. Intent side

Traditional framing:

```text
preserve rationale through documentation
```

LLM-enabled framing to test:

```text
measure whether rationale is recoverable
through blind reconstruction
```

Explain what becomes newly practical:

- repeated blind reconstruction;
- multi-agent disagreement measurement;
- context-budget measurement;
- architecture/domain reconstruction over a large repository.

## 3B. Evolvability side

Traditional framing:

```text
architect mentally estimates impact of change scenario
```

LLM-enabled framing to test:

```text
agent plans or implements counterfactual future changes
and produces an observable diff
```

Explain what becomes newly practical:

- simulation of many future scenarios;
- candidate-design A/B comparison;
- disposable branch/worktree implementation;
- deterministic measurement of touched interfaces and modules;
- calibration of predictions against later real changes.

## 3C. Boundaries

Record what the LLM still cannot legitimately supply by itself:

- business utility;
- authoritative future probabilities;
- hidden organizational constraints;
- ground-truth design intent;
- permission to average away hard constraints.

The LLM is an evaluator/simulator and possibly a prior estimator. It is not the
source of truth for the objective.

---

# Phase 4 — Recover the current FTS model

Only now inspect the repository deeply.

Produce initial FTS-specific artifacts, but keep them minimal and experimental.

Suggested location:

```text
docs/factory/
  change-model.yaml
  utility-model.yaml
```

The exact format is not predetermined.

## 4A. Extract change beliefs

Use evidence from:

- ADRs;
- repository structure;
- commit/issue history where useful;
- upstream proposal lifecycle;
- stated project goals.

Likely hypotheses to verify include:

- proposal syntax and semantics can change;
- proposal adapters may be removed after native support;
- host integrations may change independently;
- ordinary TypeScript must remain an exit boundary;
- generated implementation details should not become contracts.

Do not label these high probability merely because they sound plausible.

## 4B. Extract utility

Recover existing priorities from repository evidence.

Examples to verify:

- removability;
- ordinary TypeScript compatibility;
- semantic single source of truth;
- source-map fidelity;
- proposal-revision traceability;
- low public coupling to generated implementation details.

Classify each as:

- hard invariant;
- risk constraint;
- soft objective.

---

# Phase 5 — Design one falsifiable FTS experiment

Choose one real design question with at least two credible candidate designs.

The experiment must be capable of producing a negative result.

Good properties:

- both candidates can satisfy current tests;
- they differ in present complexity;
- they differ under at least one plausible future scenario;
- the rationale can be recorded before implementation;
- the scope is small enough to simulate counterfactual changes.

Do not choose a toy problem detached from actual FTS architecture.

---

# Phase 6 — Evaluate intent recoverability

Before implementation, record the ground-truth rationale for each candidate and
the selected design.

After implementation, run the blind reconstruction protocol.

Report:

- what was recovered;
- what was missed;
- what was invented;
- what required ADR context;
- how much repository context was needed;
- disagreement across runs.

The purpose is not to prove that code should contain all rationale.

The purpose is to measure total recoverability from the repository as a system
of artifacts.

---

# Phase 7 — Evaluate evolvability by counterfactual simulation

For each relevant future scenario:

1. ask an agent to produce a concrete implementation plan;
2. where feasible, implement the change in an isolated worktree or branch;
3. run deterministic checks;
4. measure the diff;
5. apply the utility model.

Compare candidate architectures using actual observable consequences where
possible.

At minimum report:

- files/modules touched;
- interfaces changed;
- tests rewritten versus extended;
- dependency changes;
- migration/compatibility implications;
- failed hard constraints;
- stranded complexity if the forecast is wrong.

Do not reduce the result to a single score unless necessary.

---

# Phase 8 — Compare prediction with reality

Design the artifacts so the experiment can later record:

- forecast scenario;
- predicted cost;
- actual later change;
- actual cost;
- forecast error.

This is necessary for long-term calibration.

The eventual factory should learn whether its change model and simulator are
useful, not simply accumulate unchallenged architectural assumptions.

---

# Phase 9 — Implement only the minimum supporting tooling

Only after the above work identifies a concrete need should you add code for the
factory itself.

Possible justified tooling includes:

- schema validation for change/utility models;
- scripts to create isolated counterfactual worktrees;
- deterministic diff metrics;
- structured evaluator outputs;
- report generation;
- retrieval of relevant ADR/change scenarios for an agent.

Do not build orchestration infrastructure merely because it seems factory-like.

---

# Required final report

The first research iteration is complete only when it answers:

1. How are **intent recoverability** and **evolvability** defined operationally?
2. Which parts already exist in software-architecture research?
3. Which traditional costs or limitations are materially changed by LLMs?
4. What remains irreducibly human/business input?
5. Can an LLM reconstruct one FTS design intent with useful accuracy?
6. Can an LLM counterfactually simulate one future FTS change well enough to
   compare two designs?
7. Did the explicit change/utility model cause a design choice or rationale that
   differs from a normal "implement the current spec and pass tests" workflow?
8. How would the forecast be calibrated when real future changes occur?

If these questions cannot be answered, do not claim that a software factory has
been built.

The first milestone is a validated evaluation model, not an autonomous coding
pipeline.
