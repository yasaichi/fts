# Software Factory Design Model — Handover

## Purpose

This document records the design model we want to use when experimenting with an
AI-driven software factory for FTS.

The central claim is that a useful software factory must optimize for more than
"the requested behavior exists and the tests pass." A system can satisfy today's
requirements while steadily losing the domain model, the rationale behind its
boundaries, and its ability to absorb likely future changes.

The factory should therefore preserve and evaluate two different properties:

1. **Intent legibility** — can a future maintainer recover why the system has
   this shape?
2. **Evolvability** — does the current shape keep the expected cost of likely
   future changes low?

These are related but not identical.

---

## 1. The working definition of design sense

What engineers often call "taste" or "design sense" can be decomposed into a
more operational model:

> Design sense is the ability to predict likely future changes reasonably well,
> balance their expected cost against present complexity and the cost of being
> wrong, and encode the resulting judgment in a form that future maintainers can
> reconstruct.

This has four parts:

- **Forecast quality**: which changes are likely, unlikely, or uncertain?
- **Trade-off quality**: which costs matter most if those changes occur?
- **Robustness to forecast error**: how expensive is it if the prediction is
  wrong?
- **Intent legibility**: can another engineer recover the model and trade-offs
  that led to the design?

A design can fail on any one of these dimensions.

Examples:

- A highly abstract design can have good internal consistency but poor forecast
  quality: it paid for many future changes that never arrived.
- A simple design can be locally easy to read but have poor evolvability if it
  ignores a high-probability change direction.
- A structurally good design can still accumulate intent debt if nobody can
  recover why its boundaries exist.

---

## 2. "Beauty" as low intent-reconstruction cost

A useful working interpretation of "beautiful code" is:

> The designer's understanding of the world, assumptions, and accepted
> trade-offs can be reconstructed from the code structure at low cost.

This does not mean beauty is identical to code style, terseness, abstraction,
or any named design principle.

The important question is whether a future maintainer can infer things such as:

- What concepts did the designer believe were first-class domain concepts?
- Which parts were expected to change independently?
- Which boundaries were deliberate rather than accidental?
- Which compromises were accepted?
- Which behaviors are contractual rather than incidental?
- Which complexity exists to protect a likely future change direction?

Names, types, modules, classes, tests, comments, and ADRs are all different
ways to encode parts of that intent.

A good domain model is therefore not merely an object-oriented representation
of today's requirements. It is a compressed representation of the current
understanding of the problem and, often, of expected future change structure.

---

## 3. Evolvability as expected future change cost

Intent legibility is only one side of good design. A second property is whether
the design is cheap to change in the futures we currently consider plausible.

For a design `D`, a useful conceptual model is:

```text
ExpectedChangeCost(D)
  = sum over scenarios i:
      P(change_i) * Cost(change_i | D)
```

In practice the cost function is multi-dimensional. It can include:

- implementation effort,
- number of modules or public interfaces touched,
- regression risk,
- migration cost,
- operational risk,
- compatibility breakage,
- cognitive load,
- runtime cost,
- delay to shipping.

Not all of these should necessarily be collapsed into a single scalar. Some are
hard constraints; others are weighted preferences.

The important point is that "extensible" is not universally good. Extensibility
is valuable only when it cheaply protects changes that are sufficiently likely
or sufficiently costly.

---

## 4. Present complexity and the cost of being wrong

A more complete loss model is:

```text
Loss(D)
  = PresentComplexity(D)
  + IntentReconstructionCost(D)
  + ExpectedFutureChangeCost(D)
```

This explains several familiar design heuristics.

### YAGNI

YAGNI is a warning against assigning too much probability or utility to
speculative futures and paying present complexity for them.

### Architecture astronauts

An "architecture astronaut" can be understood as overestimating the probability
or value of many possible future changes and therefore paying excessive present
complexity for optionality that is never exercised.

### Premature abstraction

When evidence about the change distribution is weak, prematurely locking in an
abstraction amounts to acting on an uncertain forecast as though it were known.

### Rule of Three

Waiting for repeated examples before abstracting can be understood as waiting
for more observations before updating the change model.

### Refactoring

Refactoring is not merely cosmetic cleanup. It is often an update of the code
structure after our posterior understanding of the domain or its likely changes
has changed.

---

## 5. Intent debt and technical debt

We should keep two debts conceptually separate.

### Intent debt

Intent debt is the future reasoning cost caused by losing the rationale,
assumptions, domain understanding, or accepted trade-offs behind the current
design.

It increases the cost and risk of answering questions such as:

- Is this boundary essential or accidental?
- Is this duplication deliberate?
- Is this behavior a contract?
- What future did the original design optimize for?
- Which compromise was knowingly accepted?

### Technical debt

For this factory, "technical debt" should mean the avoidable increase in future
change cost caused by the current technical structure.

A useful conceptual form is:

```text
TechnicalDebt(D)
  = FutureCost(D) - FutureCost(realistic better alternative)
```

The comparison must be against a realistic alternative available under the
same information, time, and budget constraints. Otherwise inherent domain
complexity is incorrectly classified as debt.

Intent debt can contribute to technical debt, because future changes become
more expensive when the reason for the current structure must first be
rediscovered, but they are not the same thing.

---

## 6. Why current spec-driven agent workflows are insufficient

Many agentic development workflows optimize roughly for:

```text
requirement
  -> implementation
  -> tests pass
  -> acceptance
```

This is effective at accelerating implementation of current requirements, but
it does not automatically preserve:

- the domain model,
- the expected direction of future change,
- the assumptions behind current boundaries,
- the trade-offs that justified current complexity,
- the costs we intentionally chose to optimize.

The failure mode resembles conventional delivery where acceptance tests prove
that the commissioned behavior exists while the system gradually becomes a
collection of implemented features rather than an evolving model.

The problem is not that tests are unimportant. Tests are excellent executable
records of behavior we intend to preserve. The problem is that they mostly
encode current behavioral constraints, not the design's forecast and utility
model.

---

## 7. What the factory should make first-class

The factory should maintain at least four categories of durable knowledge.

### 7.1 Current requirements

What must the system do now?

This is the area current spec-driven tooling already handles reasonably well.

### 7.2 Change model

What changes do we currently believe are likely?

Each scenario should be able to record:

- description,
- affected concepts or boundaries,
- time horizon,
- estimated probability or frequency,
- confidence,
- evidence,
- assumptions,
- date of last review.

Exact probabilities are optional at first. Relative buckets such as
`high / medium / low` plus confidence may be more honest.

### 7.3 Utility model

What costs do we care about, and how strongly?

Separate:

- hard constraints,
- risk thresholds,
- soft objectives.

Candidate dimensions include:

- change locality,
- public API stability,
- source compatibility,
- runtime dependencies,
- performance,
- correctness,
- operational risk,
- implementation speed,
- conceptual complexity,
- removability,
- migration cost.

### 7.4 Decision rationale

Why did we choose this design given the change and utility models available at
the time?

FTS already uses ADRs for decisions and compromises that cannot be recovered
from the implementation alone. The factory should extend that practice rather
than replace it.

Accepted ADRs remain immutable. A changed belief or decision should create a new
record that supersedes the old one where appropriate.

---

## 8. Two distinct evaluators

The factory should eventually evaluate both intent legibility and evolvability.

### 8.1 Intent evaluator

The key idea is blind reconstruction.

Given the code and ordinary repository context, but not the original rationale,
ask an evaluator to reconstruct:

- the domain model,
- the intended boundaries,
- the assumed change directions,
- the accepted trade-offs,
- the reasons for non-obvious complexity.

Then compare the reconstruction with the recorded intent.

Useful signals may include:

- factual agreement with recorded intent,
- false inferred rationale,
- uncertainty,
- number of files/context tokens required,
- disagreement across multiple evaluator runs,
- concepts that can only be understood after reading an ADR.

This is not a perfect measurement of beauty, but it is closer to the property we
care about than generic complexity metrics.

A failure does not imply that everything must be encoded in code. Some rationale
belongs in comments or ADRs. The target is low total reconstruction cost across
the repository's knowledge artifacts.

### 8.2 Change evaluator

Take the current change model and simulate likely future changes against a
candidate design.

For each scenario, measure or estimate:

- modules touched,
- public interfaces changed,
- existing tests rewritten,
- new dependencies introduced,
- migration work,
- compatibility impact,
- operational risk,
- implementation effort.

An agent can first perform planning-only simulations. Later experiments can
apply changes in isolated worktrees or branches and measure the actual diff.

The scenario result is then interpreted using the utility model.

---

## 9. The desired decision loop

The target loop is closer to:

```text
current requirement
+ current code
+ change model
+ utility model
+ ADRs / assumptions
        |
        v
candidate designs
        |
        +--> intent reconstruction evaluation
        |
        +--> counterfactual change simulation
        |
        v
trade-off report
        |
        v
implementation
        |
        v
tests + architecture checks
        |
        v
real change history / incidents / upstream changes
        |
        v
update beliefs and utility assumptions when evidence changes
```

The important shift is that the agent is not asked merely to make the current
task pass. It is given an explicit model of what futures matter and which costs
matter in those futures.

---

## 10. FTS is a useful experiment for this model

FTS already contains several characteristics that make it a good testbed:

- it has accepted ADRs and explicitly records trade-offs that cannot be
  recovered from implementation alone;
- ordinary TypeScript is an explicit compatibility and exit boundary;
- proposal adapters are intentionally removable and must follow upstream
  proposal changes;
- editor, build, and language-tooling integrations share semantic concerns but
  have distinct host boundaries;
- upstream proposal changes are a real and observable source of future change.

This means the repository already contains implicit change beliefs and utility
choices. The first factory experiment should extract those beliefs rather than
invent a generic architecture framework.

Examples of likely hypotheses to validate from existing ADRs and history:

- upstream proposal syntax and semantics are expected to change;
- host integrations may change independently from core proposal semantics;
- removability and compatibility with ordinary TypeScript are high-value
  objectives;
- generated implementation details should not become public contracts;
- duplicated proposal semantics across editor/build paths are especially
  expensive.

These are hypotheses, not yet a formal change model. They must be verified
against the repository's ADRs, code, commit history, and intended roadmap.

---

## 11. What success would mean

The first experiment is successful if it demonstrates that the factory can make
a better architecture decision than a plain "implement the spec and pass the
tests" agent because it had access to explicit future-change beliefs and
utilities.

We do not need a mathematically perfect optimizer.

We need evidence that:

1. recorded design intent is recoverable by another agent with less ambiguity;
2. candidate designs can be compared against concrete future-change scenarios;
3. the comparison changes at least one real design decision;
4. the assumptions behind that decision remain inspectable and updateable;
5. later real changes can be used to calibrate the earlier forecast.

The goal is not to automate taste by inventing more coding rules.

The goal is to externalize enough of the reasoning behind taste that agents can
participate in the same decision process.
