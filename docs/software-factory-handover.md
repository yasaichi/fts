# Software Factory Research Handover — Evolvability and Intent Recoverability

## Purpose

This document records the research model that should guide the next stage of the
FTS software-factory experiment.

The central problem is no longer "how do we make an AI write code with better
taste?" That framing was useful for discovering the problem, but it is not the
research target.

The research target is to make two properties of software design explicit and
evaluable:

1. **Evolvability** — how costly is the design to change under the futures we
   currently believe are plausible?
2. **Intent recoverability** — how costly and error-prone is it for a future
   maintainer or agent to reconstruct why the design has its current shape?

Current spec-driven agent workflows are good at evaluating present behavioral
correctness. The hypothesis here is that they are missing explicit evaluators
for these two properties.

The purpose of the factory is to investigate whether existing software
architecture research can be operationalized more directly now that LLMs can
read large codebases, reconstruct rationale, plan changes, and cheaply simulate
counterfactual modifications.

---

## 1. Core model

At design time `t`, let:

- `D` be the current design and implementation structure;
- `A` be supporting artifacts such as tests, comments, ADRs, specifications,
  issue history, and documentation;
- `I_t` be the intent available at design time: assumptions, domain
  understanding, constraints, goals, trade-offs, and the reasoning that led to
  the design;
- `Δ_i` be a possible future change scenario;
- `P_t(Δ_i)` be the current belief about the probability or relative frequency
  of that future change;
- `U_t(Δ_i | D)` be the loss or utility associated with absorbing that change
  under design `D`.

A useful working decomposition of future software cost is:

```text
C_t(D, A)
  =
    Σ_i P_t(Δ_i) * U_t(Δ_i | D)
    +
    R(I_t | D, A)
```

where:

- the first term is **expected future change loss**;
- `R(I_t | D, A)` is **intent-reconstruction cost**: the cost and risk of
  recovering the design-time understanding and trade-offs from the available
  artifacts.

This is a working research model, not a claim that prior literature uses this
exact equation.

It is valuable because it separates two things that are often collapsed into
words such as "good design", "clean code", "taste", "maintainability", or
"technical debt".

---

## 2. Evolvability

### 2.1 Definition

For this research, evolvability is the degree to which a design keeps expected
loss low across plausible future changes.

Conceptually:

```text
ExpectedFutureChangeLoss(D)
  = Σ_i P_t(Δ_i) * U_t(Δ_i | D)
```

This means a design is not "evolvable" in the abstract.

It is evolvable **relative to a model of the future and a model of what costs
matter**.

A generic extension point that protects changes we do not expect may be worse
than a simpler design. Conversely, a simple implementation that makes a
high-probability change expensive may be locally elegant but globally poor.

### 2.2 Change distribution

The factory therefore needs an explicit representation of current beliefs about
future change.

That model may contain:

- change scenario;
- time horizon;
- estimated probability or frequency;
- confidence;
- evidence;
- affected concepts and boundaries;
- assumptions;
- date of last review.

Exact probabilities are not mandatory. `high / medium / low / unknown` plus a
confidence level may initially be more honest than false precision.

### 2.3 Utility / loss model

The second input is what we care about when a change happens.

Possible dimensions include:

- implementation effort;
- number of modules changed;
- public interfaces changed;
- migration cost;
- compatibility breakage;
- regression risk;
- operational risk;
- runtime performance;
- source compatibility;
- cognitive load;
- time to ship;
- removability;
- new coupling.

Do not assume they should all be collapsed into one number.

A more realistic ordering may be:

```text
hard invariants
    ↓
risk constraints
    ↓
soft-objective trade-offs
```

For example, a design that violates an externally promised compatibility
boundary should not win merely because it reduces implementation effort.

### 2.4 Present cost and forecast error

Design selection also has to account for the cost paid now.

A more complete decision loss can be represented as:

```text
DecisionLoss(D)
  =
    PresentComplexity(D)
    +
    ExpectedFutureChangeLoss(D)
    +
    IntentReconstructionCost(D, A)
```

This is important because otherwise "evolvability" degenerates into maximum
generic extensibility.

YAGNI, premature abstraction, the Rule of Three, and the "architecture
astronaut" failure mode can all be interpreted as warnings about paying too
much present cost for an uncertain future distribution.

The factory must therefore ask not only:

> What if our predicted change happens?

but also:

> What if it never happens, or the opposite change happens?

Reversibility and stranded complexity are first-class concerns.

---

## 3. Intent recoverability

### 3.1 Definition

Intent recoverability is the degree to which another maintainer can reconstruct
the understanding and trade-offs that produced the current design.

The relevant question is not merely whether documentation exists.

It is:

> Given the available code and repository artifacts, how much effort,
> ambiguity, and error are involved in recovering the design intent?

Conceptually:

```text
R(I_t | D, A)
```

is low when the intent can be reconstructed cheaply and accurately.

### 3.2 What counts as intent

`I_t` includes at least:

- domain model and ontology;
- assumptions about what is stable and what changes independently;
- goals;
- constraints;
- rejected alternatives;
- accepted compromises;
- reasons for non-obvious complexity;
- beliefs about likely future changes;
- the utility or risk model used to choose among alternatives.

This is broader than "comments explaining the code".

### 3.3 Code and artifacts are different projections of intent

Different mechanisms encode different parts of `I_t`:

- names and types encode concepts;
- module/class boundaries encode expected independence of change;
- domain models encode current understanding of the problem;
- tests encode behavior considered contractual;
- comments encode local rationale not obvious from implementation;
- ADRs encode decisions, alternatives, assumptions, and consequences;
- executable architecture checks encode invariants.

The goal should not be to maximize documentation volume.

The goal should be to minimize total reconstruction cost across these artifacts.

### 3.4 Intent debt

Margaret-Anne Storey's 2026 "triple debt" framing distinguishes technical debt,
cognitive debt, and intent debt. Intent debt is the absence of clear goals,
constraints, and rationale that explain what the system is for and how it
should evolve.

This research adopts that distinction because it prevents intent loss from being
treated as merely another code-smell metric.

Reference:

- Margaret-Anne Storey, "From Technical Debt to Cognitive and Intent Debt",
  ACM Queue, 2026:
  https://doi.org/10.1145/3807966

---

## 4. Existing research for evolvability

The change-model side is not a new problem. Important parts already exist in
software architecture research.

### 4.1 ALMA — Architecture-Level Modifiability Analysis

ALMA is explicitly scenario-based.

Its main steps are:

1. select the analysis goal;
2. describe the architecture;
3. elicit change scenarios;
4. evaluate the effect of those scenarios;
5. interpret the result.

It supports goals including maintenance prediction, identification of
inflexibility, and comparison of alternative architectures.

This is directly relevant to `P_t(Δ_i)` and `U_t(Δ_i | D)`: the architecture
is evaluated against concrete possible future changes rather than against a
generic notion of cleanliness.

Reference:

- Bengtsson, Lassing, Bosch, van Vliet, "Architecture-level modifiability
  analysis (ALMA)", Journal of Systems and Software, 2004:
  https://doi.org/10.1016/S0164-1212(03)00080-3

### 4.2 ATAM — Architecture Tradeoff Analysis Method

ATAM evaluates an architecture against multiple competing quality attributes
such as modifiability, security, performance, and availability.

Its contribution here is that "good architecture" is explicitly
multi-objective. Improving one characteristic can make another worse.

Reference:

- Kazman, Klein, Clements et al., "The Architecture Tradeoff Analysis Method":
  https://www.sei.cmu.edu/library/atam-method-for-architecture-evaluation/

### 4.3 CBAM — Cost Benefit Analysis Method

CBAM adds economic reasoning to architecture decisions, associating
architectural strategies with priorities, costs, benefits, uncertainty, and
return on investment.

It is relevant to the utility side of the model because a technical design
choice only makes sense relative to the value assigned to its consequences.

References:

- Asundi, Kazman, Klein, "Using Economic Considerations to Choose Among
  Architecture Design Alternatives":
  https://www.sei.cmu.edu/library/using-economic-considerations-to-choose-among-architecture-design-alternatives/
- Nord et al., "Integrating ATAM with CBAM":
  https://sei.cmu.edu/library/integrating-the-architecture-tradeoff-analysis-method-atam-with-the-cost-benefit-analysis-method-cbam/

### 4.4 Evolutionary Architecture and fitness functions

Evolutionary Architecture defines architecture as guided incremental change
across multiple dimensions and uses fitness functions to protect important
architectural characteristics continuously.

This is highly relevant to the executable part of the utility model.

References:

- Ford, Parsons, Kua, Sadalage, "Building Evolutionary Architectures":
  https://evolutionaryarchitecture.com/
- précis:
  https://evolutionaryarchitecture.com/precis.html

The important limitation for this project is that many architectural concerns
we care about are not yet deterministic predicates.

---

## 5. Existing research for intent recoverability

### 5.1 Design rationale and architectural knowledge

Software architecture research has long recognized that the architecture itself
does not contain all information required to understand why it exists.

Decision rationale, assumptions, alternatives, and context must often be
captured separately.

FTS already follows this principle in ADR 1:

> durable context is needed for choices that cannot be recovered from the
> implementation alone.

The research question now is whether LLMs let us evaluate **recoverability
itself**, rather than prescribing one documentation mechanism.

### 5.2 LLM generation and recovery of design rationale

A 2026 ACM TOSEM study directly evaluates LLMs for generating and recovering
software-architecture design rationale.

The reported results are important precisely because they are imperfect:
LLMs recovered substantial rationale, but precision was low and some generated
arguments were misleading.

This means LLMs are promising as reconstruction instruments but must not be
treated as ground-truth oracles.

Reference:

- Zhou et al., "Using LLMs in Generating Design Rationale for Software
  Architecture Decisions", ACM TOSEM, 2026:
  https://doi.org/10.1145/3785010

---

## 6. What LLMs change for intent evaluation

Historically, intent preservation was mostly framed as:

> Did we document the rationale sufficiently?

LLMs create a different possible evaluation:

> Can an independent agent reconstruct the rationale from the artifacts we
> actually left behind?

That allows a **blind reconstruction test**.

### 6.1 Blind intent reconstruction

The evaluator receives:

- code;
- ordinary repository structure;
- tests;
- normal documentation that future maintainers would naturally have;

but does **not** receive the ground-truth rationale under evaluation.

It is asked to reconstruct:

- domain concepts;
- intentional boundaries;
- expected independent change directions;
- non-obvious trade-offs;
- assumptions;
- deliberate compromises.

Its reconstruction is then compared with the recorded design-time intent.

### 6.2 Possible observables

Intent recoverability is unlikely to reduce to one perfect scalar, but useful
observables include:

- recall of ground-truth intent;
- false or invented rationale;
- uncertainty;
- disagreement between independent evaluator runs;
- amount of context needed;
- number of files that must be inspected;
- need to consult an ADR;
- concepts consistently misunderstood;
- whether code structure alone communicates the intended model.

This is materially different from a complexity metric.

It attempts to measure the thing we actually care about: recoverability of the
latent decision model.

### 6.3 Research caution

LLMs can hallucinate plausible rationale.

Therefore:

- evaluator output must be compared to recorded ground truth;
- confidence matters;
- multi-run disagreement is a useful signal;
- a convincing explanation is not evidence that the explanation was intended;
- the experiment should distinguish "recoverable intent" from "plausible story
  generation".

---

## 7. What LLMs change for evolvability evaluation

This may be the more important shift.

Traditional scenario-based architecture evaluation relied heavily on architects
mentally estimating the ripple effects of future changes.

An LLM-based coding agent can make this analysis far cheaper.

### 7.1 Counterfactual change simulation

For each future-change scenario, an agent can:

1. inspect the current design;
2. produce a concrete implementation plan;
3. optionally implement the scenario in an isolated branch/worktree;
4. run tests and architecture checks;
5. measure the resulting change.

Instead of asking:

> Would this architecture make scenario X difficult?

we can increasingly ask:

> Try scenario X against candidate architecture A and candidate architecture B.
> What actually has to change?

### 7.2 Observable scenario cost

Potential measurements include:

- files/modules touched;
- public interfaces changed;
- existing tests rewritten versus extended;
- dependency changes;
- new coupling;
- migration steps;
- compatibility breaks;
- implementation effort or agent steps;
- required context;
- failed invariants;
- reversibility.

This turns part of architecture analysis from expert prediction into a cheap
counterfactual experiment.

### 7.3 Sampling many futures

LLMs also make it cheap to evaluate many scenarios.

This means the factory can potentially compare designs over a distribution of
changes rather than one hand-picked example.

However, the LLM must not be allowed to invent both the future distribution and
the winning architecture without independent evidence. That would create a
self-justifying evaluator.

The future-change model should therefore be grounded in sources such as:

- product roadmap;
- issue history;
- Git history;
- previous migrations;
- upstream proposal activity;
- incidents;
- domain-expert beliefs;
- explicit uncertainty.

### 7.4 Updating the prior

The factory should eventually compare forecasts with what actually happened.

For example:

```text
forecast:
  proposal semantic churn = high

observed over 12 months:
  5 semantic migrations

→ strengthen or maintain belief
```

or:

```text
forecast:
  build-host replacement = high

observed:
  no change for 3 years

→ lower probability; inspect whether abstraction is stranded complexity
```

The long-term loop is therefore not static architecture governance. It is
forecast calibration.

---

## 8. Agentic fitness functions are adjacent, not sufficient

Recent "agentic fitness function" work extends deterministic architecture checks
with calibrated LLM judgments for concerns such as boundary fidelity, semantic
contract drift, workflow coupling, and stale ADR assumptions.

This is useful because it shows how to make some judgment-heavy architecture
concerns continuously observable.

Reference:

- Mahato, Sieczkowski, Kuppusamy, "Agentic Fitness Functions: Extending
  Evolutionary Architecture Beyond Deterministic Rules", 2026:
  https://www.infoq.com/articles/agentic-fitness-functions-evolutionary-architecture/

But this project should go further than "LLM as architecture-review judge".

The research target is:

- **intent reconstruction** as an explicit evaluation problem; and
- **future-change simulation under an explicit distribution and utility model**
  as an explicit evaluation problem.

---

## 9. The two evaluators

The factory should conceptually have two separate evaluators.

```text
                     candidate design
                           |
              +------------+------------+
              |                         |
              v                         v
     Intent Recoverability        Evolvability
          evaluator                 evaluator
              |                         |
     blind reconstruction        future scenarios
     against ground truth              ×
              |                    utility model
              |                         |
              v                         v
       reconstruction cost       expected change loss
              +------------+------------+
                           |
                           v
                    design decision
```

These evaluators should not be collapsed prematurely.

A design can be:

- easy to understand but expensive to evolve;
- hard to understand but accidentally resilient to likely changes;
- good on both;
- bad on both.

That distinction is analytically useful.

---

## 10. Relationship to technical debt

This project should avoid defining all future cost as technical debt.

Some change cost is inherent in the domain.

A useful conceptual definition is:

```text
TechnicalDebt(D)
  =
    FutureChangeCost(D)
    -
    FutureChangeCost(realistic better alternative)
```

where the comparison is against an alternative that was realistically available
under the same information, time, and budget constraints.

Intent debt is separate:

```text
IntentDebt
  ≈ avoidable increase in future reasoning cost
     caused by missing or unrecoverable intent
```

The two interact because poor intent recoverability makes future modification
more expensive and riskier.

---

## 11. Why current spec-driven agent workflows are insufficient

A common loop is:

```text
requirement
  -> plan
  -> implementation
  -> tests pass
  -> acceptance
```

This is a fast version of optimizing current contractual behavior.

It does not necessarily preserve:

- a domain model;
- design rationale;
- assumptions about future change;
- utility trade-offs;
- knowledge of which boundaries are intentional.

The failure mode is a system that contains all commissioned features and passing
tests but no coherent model of how the problem should continue to evolve.

This is precisely why the research must not stop at "better specs" or "more
architecture rules".

---

## 12. Research questions

The next work should be framed around these questions before implementation.

### RQ1 — Intent recoverability

Can we operationalize `R(I_t | D, A)` well enough to compare two designs or
two versions of a repository?

Sub-questions:

- What is the ground-truth representation of intent?
- Which parts should be recoverable from code and which from ADRs/comments?
- Which observable proxies correlate with human judgments of recoverability?
- How stable are results across models and runs?
- How do we distinguish true recovery from plausible hallucinated rationale?

### RQ2 — Evolvability

Can we operationalize:

```text
Σ_i P_t(Δ_i) * U_t(Δ_i | D)
```

well enough to compare candidate designs?

Sub-questions:

- How should change scenarios be represented?
- How much probability precision is useful?
- Which costs are deterministic, measured, estimated, or judged?
- Which objectives must remain hard constraints?
- How do we include present complexity and reversibility?

### RQ3 — LLM counterfactual validity

Does LLM-based change simulation predict the cost of later real changes?

Compare:

- predicted touched boundaries;
- predicted files/modules;
- predicted migration risk;
- simulated diff;
- later actual diff.

### RQ4 — Forecast calibration

Can repository history and external evidence improve the change model over time?

The goal is not autonomous prediction for its own sake. The goal is a maintained
and inspectable belief model.

### RQ5 — Interaction between the two axes

Does better intent recoverability reduce actual future change cost?

This is plausible but should be tested rather than assumed.

---

## 13. FTS as the experimental system

FTS is a strong testbed because its existing ADRs already contain real beliefs
about future change.

Examples include:

- upstream proposal syntax and semantics may change;
- proposal adapters should be removable;
- ordinary TypeScript is the compatibility and exit boundary;
- host integrations can evolve while proposal semantics should have one source
  of truth;
- generated implementation details should not become public contracts.

These are not generic coding preferences. They are architecture decisions based
on beliefs about future evolution and on explicit utility choices.

The experiment should first reconstruct those beliefs from existing ADRs and
history, then test whether exposing them explicitly changes an agent's design
choice.

---

## 14. What not to do yet

Do not start by building a large software-factory framework.

Do not start by inventing a universal YAML schema.

Do not start by creating a generic "taste score".

Do not ask an LLM simply:

> Is this architecture good?

The immediate work is:

1. map the prior research;
2. define the two target quantities;
3. identify measurable proxies;
4. identify what LLMs make newly feasible;
5. design one falsifiable FTS experiment;
6. only then introduce the minimum durable artifacts and automation required by
   that experiment.

---

## 15. Working thesis

The working thesis for the next phase is:

> Existing architecture research already provides ways to reason about future
> change scenarios, trade-offs, economic value, design rationale, and
> architectural fitness. LLMs may change the economics of applying those ideas:
> they can reconstruct intent from repository artifacts and can cheaply simulate
> counterfactual future changes against candidate designs. A software factory
> should exploit those capabilities to evaluate intent recoverability and
> evolvability explicitly, rather than merely accelerating implementation of
> current specifications.

That thesis — not "automating taste" — is the basis for the next experiment.
