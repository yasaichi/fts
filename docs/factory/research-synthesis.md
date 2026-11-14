# Research synthesis: evolvability and intent recoverability

Date: 2026-09-28

Status: Phase 0 research synthesis. Evaluation protocols and FTS experiments
remain to be designed.

## Conclusion and scope

The reusable foundations are scenario-based change analysis, stakeholder-owned
utility, explicit decision records, and continuous architectural checks. The
FTS experiment should test whether repeated intent reconstruction and concrete
counterfactual changes make those foundations more useful at an affordable
cost. It should not claim to have invented scenario analysis, rationale
recovery, or forecast validation.

This is a focused synthesis of the sources requested by the
[agent brief](../software-factory-agent-brief.md#phase-0--prior-art-synthesis),
with additional primary work on architectural knowledge, reconstruction, and
longitudinal validation. It is not a systematic literature review or evidence
that the proposed evaluation model already works. Statements under **FTS
implication** are proposals or inferences for this project, not findings of the
cited authors. No experiment topic or candidate architecture is selected here.

## Evolvability: mechanisms to reuse

### ALMA: scenario-dependent modifiability

**Problem, inputs, and outputs.** ALMA selects an analysis goal, describes the
architecture, elicits changes, evaluates their effects, and interprets results.
Goals include maintenance prediction, risk discovery, and comparing designs.
Stakeholder interviews can start with change categories or collect concrete
scenarios and categorize them afterward. In maintenance prediction, estimated
occurrence counts become normalized scenario weights. Architects trace affected
components and ripple effects; change-volume and productivity estimates produce
effort forecasts. These are estimates, not measured future implementation costs.

**Human judgment and expense.** Scenario coverage, occurrence estimates, missing
architectural information, and impact estimates require knowledgeable people.
Repeated interviews and tracing across boundaries are substantial work. An
architectural view can omit implementation dependencies. See Bengtsson et al.,
[ALMA, sections 4–5](https://www.cs.vu.nl/~hans/publications/y2004/alma.pdf)
([publication DOI](https://doi.org/10.1016/S0164-1212(03)00080-3)).

**FTS implication.** Reuse goal-specific scenario selection and explicit
assumptions. Let agents propose and simulate changes to supplement expert impact
estimates. Keep likely-change samples separate from adversarial stress cases;
neither an agent-generated scenario nor a difficult one establishes frequency.

### ATAM: competing qualities and explicit trade-offs

**Problem, inputs, and outputs.** ATAM relates business drivers and architecture
to quality-attribute scenarios. A utility tree refines broad qualities into
concrete scenarios, ranked by importance and perceived difficulty/risk. Wider
stakeholder brainstorming tests that prioritization. Outputs include risks,
non-risks, sensitivity points, and trade-off points. A decision can benefit one
quality while harming another. The prioritization and much of the analysis are
qualitative; a utility tree is not a probability distribution.

**Human judgment and expense.** Stakeholders choose priorities; architects and
evaluators explain how the architecture responds. Facilitating agreement and
repeatedly examining approaches costs expert time. See Kazman, Klein, and
Clements, [ATAM, sections 5 and 8](https://www.sei.cmu.edu/documents/629/2000_005_001_13706.pdf).

**FTS implication.** Reuse concrete response criteria and a visible trade-off
record. An LLM may draft scenarios and collect evidence for each criterion;
maintainers still decide which outcomes matter. Do not interpret high importance
as high likelihood, or aggregate away a failed compatibility requirement.

### CBAM: costs, benefits, and uncertainty

**Problem, inputs, and outputs.** CBAM adds economic comparison to architecture
analysis. Inputs include candidate strategies, stakeholder valuations of quality
outcomes, cost estimates, constraints, and uncertainty. Outputs support ranking
or selecting investments by their costs and benefits. The original report
explicitly distinguishes uncertainty in technical effects from subjectivity in
utility assessment; simulation can inform the former without deciding the
latter. See Asundi, Kazman, and Klein,
[CBAM, sections 3–5](https://www.sei.cmu.edu/documents/670/2001_005_001_13916.pdf).

**Human judgment and expense.** Eliciting values, costs, and disagreement is
expensive. Stakeholders retain responsibility for economic preferences and risk
tolerance. Nord et al.'s
[ATAM/CBAM integration report](https://sei.cmu.edu/documents/2038/2003_004_001_14201.pdf)
reuses architectural analysis and enriches its business context instead of
performing two disconnected exercises.

**FTS implication.** Reuse an explicit distinction between consequences and their
value. Agents can populate consequence estimates from simulated diffs and explore
sensitivity to assumptions. Start with separate dimensions and ordinal beliefs;
do not import a numerical ROI formula without defensible scales and weights.

### Evolutionary Architecture: continuous observation

**Problem, inputs, and outputs.** Architectural fitness functions assess selected
characteristics while a system changes incrementally. Inputs are the qualities
to protect and assessment mechanisms; outputs are recurring feedback about their
integrity. The authors connect this to delivery pipelines and multiple
architectural dimensions. See Ford, Parsons, and Kua's
[book précis](https://evolutionaryarchitecture.com/precis.html).

**Human judgment and expense.** People must identify meaningful characteristics
and maintain checks as context changes. An executable check only observes the
property encoded in it. Dependency direction, contract tests, and performance
budgets can be checked mechanically; whether a boundary expresses the right
domain concept requires interpretation, as discussed in
[Agentic Fitness Functions](https://www.infoq.com/articles/agentic-fitness-functions-evolutionary-architecture/).

**FTS implication.** Reuse deterministic checks as evidence and hard gates where
appropriate. LLMs may help find concerns that need interpretation. Passing all
current checks does not measure the cost of a future change or prove that the
original rationale is recoverable.

### Forecast validation already has a longitudinal precedent

Lassing, Rijsenbrij, and van Vliet compared an earlier architecture assessment
with 117 subsequent change requests. Their study identifies limits arising from
unrecorded decisions, unpredictable evolution, and component complexity that may
be invisible at architecture level. Inputs were the earlier scenarios and later
change records; outputs compared forecasts and observed changes, including
expert assessment of complexity. See
[How well can we predict changes at architecture design time?](https://doi.org/10.1016/S0164-1212(02)00056-0).

**Human judgment and expense.** Matching later requests to earlier forecasts and
interpreting their complexity requires domain knowledge and longitudinal data.

**FTS implication.** Calibration is existing practice to reuse. Agents could
reduce the work of retrieving and matching change records, but actual future
observations still require time. One successful simulation cannot validate a
forecast of later maintenance cost. Record both scenario-selection error and
conditional cost-prediction error; a correctly simulated scenario may never occur.

## Intent: preservation, reconstruction, and their limits

### Architectural knowledge and design rationale

**Problem, inputs, and outputs.** Jansen and Bosch make design decisions explicit
architectural objects to address knowledge loss. Their Archium model connects
decisions, design fragments, and changes, preserving the relationship between
reasoning and realization. Inputs include problems, alternatives, decisions, and
their rationale; the output represents more than the final structure. See
[Software Architecture as a Set of Architectural Design Decisions](https://www.researchgate.net/publication/220864796_Software_Architecture_as_a_Set_of_Architectural_Design_Decisions)
(WICSA 2005, DOI: `10.1109/WICSA.2005.61`).

**Human judgment and expense.** Decision makers must expose assumptions and
alternatives and keep their relationship to implementation meaningful. The
paper presents a model and realization approach, not a validated blind-recovery
score. Capturing and maintaining knowledge costs attention during development.

**FTS implication.** Reuse decision-level evidence rather than asking for an
undifferentiated explanation of the repository. LLM-assisted extraction may
lower retrieval cost, but unrecorded rejected alternatives and organizational
constraints cannot be established as historical facts from code alone.

### ADRs: lightweight preservation with history

**Problem, inputs, and outputs.** Nygard's ADR format records context, a decision,
status, and consequences in small repository documents, retaining superseded
decisions. Inputs come from the decision context; outputs preserve motivation
for future maintainers. His experience report describes positive feedback from
developers rotating through projects, not a controlled recovery benchmark. See
[Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

**Human judgment and expense.** Authors decide which choices are significant and
which forces explain them. Writing accurate context and recognizing changed
assumptions remain work even with a small format.

**FTS implication.** Existing ADRs can supply dated evidence for ground truth,
subject to their coverage and status. An LLM can retrieve related decisions and
test what readers recover. Document presence or length is not an outcome measure.
An ADR deliberately withheld for a reconstruction trial must not leak through
history, summaries, or evaluator conversation context.

### Architecture reconstruction: recovering structure

**Problem, inputs, and outputs.** SEI's reconstruction guidelines describe
extracting information from an implemented system and aggregating it into
architectural representations. The output should help reasoning about the
system. This is evidence about the architecture that exists. See Kazman,
O'Brien, and Verhoef,
[Architecture Reconstruction Guidelines](https://www.sei.cmu.edu/library/architecture-reconstruction-guidelines/).

**Human judgment and expense.** Analysts choose useful abstractions and validate
their interpretation. SEI's
[reconstruction experience report](https://www.sei.cmu.edu/asset_files/TechnicalNote/2002_004_001_13943.pdf)
describes significant analysis effort and the importance of dynamic information
for some systems; case-study architects judged whether views answered their
questions.

**FTS implication.** Agents may make repository navigation and repeated
reconstruction cheaper. Score structural correctness separately from historical
intent: accurately identifying a dependency does not establish why it was chosen.
Human comprehension and LLM reconstruction are also different outcomes; one
must not silently serve as proof of the other.

### Intent debt: an explicit target, not a ready-made metric

**Problem, inputs, and outputs.** Storey's triple-debt framing distinguishes
implementation problems, eroded team understanding, and missing externalized
goals, constraints, and rationale. It offers a conceptual diagnosis and practices
for preserving understanding, rather than a validated numerical cost function.
Its inputs are evidence about code, people, and recorded intent; its output is
a way to distinguish failure modes. See
[From Technical Debt to Cognitive and Intent Debt](https://doi.org/10.1145/3807966)
and the accessible [author manuscript](https://arxiv.org/pdf/2603.22106).

**Human judgment and expense.** Whether the team understands the system and
whether its purpose remains appropriate require human involvement. Maintaining
shared understanding and externalizing rationale consume time.

**FTS implication.** Repeated LLM reconstruction could expose missing or ambiguous
intent more cheaply. It does not establish that maintainers share that knowledge,
or that the recorded intent is desirable. Preserve this distinction when
operationalizing `R(I_t | D, A)`.

### LLM rationale generation: recovery is not plausibility

Zhou et al. evaluate five LLMs and three prompting strategies on 100 architecture
problems from Stack Overflow and GitHub. Inputs contain problems and decisions;
generated arguments are compared with human rationale. Reported precision is
0.267–0.278, recall 0.627–0.715, and F1 0.351–0.389. Of arguments outside the
recorded rationale, 64.45–69.42% were judged helpful and 1.59–3.24% potentially
misleading. Low overlap precision therefore does not mean that all unmatched
arguments are false. See
[Using LLMs in Generating Design Rationale for Software Architecture Decisions](https://doi.org/10.1145/3785010)
and [author manuscript v2, sections 3–6](https://arxiv.org/html/2504.20781v2).

**Human judgment and expense.** Humans extract reference arguments, match meaning,
and assess unmatched arguments; annotation and adjudication remain expensive.

**FTS implication.** Reuse argument-level evaluation, but separate documented
intent, plausible unsupported explanations, and contradicted claims. This study
is not a benchmark of blind reconstruction from a complete repository. Its
scores cannot be used as FTS thresholds. LLMs make repeated generation practical;
the accuracy and cost of this repository's recovery protocol remain untested.

## Agentic architecture evaluation: useful controls, a different objective

Mahato, Sieczkowski, and Kuppusamy propose an advisory judgment layer alongside
deterministic checks. Inputs are bounded evidence packs and versioned rubrics;
outputs include evidence, confidence, and structured verdicts. Human-labeled
examples calibrate the judge, and uncertain results return to people. The
article is a practitioner proposal with a reference implementation, not evidence
of validated prediction of maintenance costs. See
[Agentic Fitness Functions](https://www.infoq.com/articles/agentic-fitness-functions-evolutionary-architecture/).

**Human judgment and expense.** Experts still own criteria, calibration labels,
and difficult trade-offs. The proposed saving is repeated evidence review.

**FTS implication.** Reuse bounded evidence, rubric versions, separate evaluators,
and retained disagreement. A review of boundary fidelity does not itself test
historical intent recovery or simulate a future change. Those need their own
protocols and observations. Do not turn a review verdict into the two target
quantities by renaming its score.

## What this experiment could add

The following are hypotheses for FTS, not claims of research novelty or results:

| Existing mechanism | FTS experiment to test | Observation needed |
| --- | --- | --- |
| Recorded decisions and rationale | Repeated reconstruction under controlled access to artifacts | Correct, missed, unsupported, and contradicted intent; context and evaluator cost |
| Scenario-based impact analysis | Implement the same counterfactual change against two credible designs | Accepted diffs, check results, interface changes, migration work, and failed attempts |
| Stakeholder utility and trade-offs | Make those preferences explicit before comparing designs | Whether the choice or its rationale differs from a current-specification baseline |
| Longitudinal forecast validation | Preserve predictions so later real changes can test them | Scenario coverage, forecast error, and changes to confidence |

The claimed economic advantage also needs measurement. Count setup, retrieval,
model usage, failed simulations, human review, and correction work. A fast agent
run that requires extensive repair may not be cheaper than expert analysis.

## Implications for Phases 1–3

These are design requirements for the next documents, not completed protocols.

1. **Define evidence and ground truth separately.** Use dated, pre-existing or
   prospectively recorded rationale. Record coverage limitations; absence from
   an ADR is not proof that a reason never existed. Freeze the reference before
   viewing evaluator output. Separate recovery from generating useful new advice.
2. **Specify what “blind” means.** Enumerate allowed files, history, external
   access, and prior context. Compare controlled conditions, such as code/tests
   alone and code/tests plus ordinary documentation. If the target ADR becomes
   visible, label the result as recovery with explicit rationale access. Keep
   the scoring reference separate and audit indirect leaks.
3. **Separate measurement from valuation.** A touched-file count is observed;
   difficulty inferred from it is estimated; migration acceptability is a
   maintainer decision. Define units before combining quantities. Ordinal
   likelihood labels cannot be multiplied into a defensible expected cost.
4. **Include forecast failure and present cost.** Compare the complexity paid
   now with costs under expected, unexpected, and absent changes. Keep mandatory
   conditions outside compensating soft-objective scores. The brief's additive
   `DecisionLoss` remains a decomposition until scales and assumptions justify
   arithmetic.
5. **Control the simulator as a measurement instrument.** Define common starting
   points, tasks, budgets, acceptance criteria, and recorded model/tool versions.
   Distinguish a valid costly change from a failed agent attempt. Repeat runs and
   inspect disagreement; one bad patch does not establish an architectural limit.
6. **Allow an inconclusive or negative result.** Failure to recover intent,
   unstable comparisons, no difference from the baseline, or review costs that
   erase automation savings must remain reportable outcomes.

Business utility, authoritative change beliefs, hidden constraints, and genuine
design intent remain external inputs to the evaluator. An LLM can propose
questions or estimates, but cannot make these inputs authoritative by repetition.

## Evidence limits and next task

Sources were checked on 2026-09-28. ALMA's author-hosted paper, SEI's ATAM and
CBAM reports, the ATAM/CBAM integration report, the Archium paper text, the ADR
article, the evolutionary-architecture précis, both recent author manuscripts,
and the agentic-fitness article were consulted. Reconstruction and longitudinal
validation claims above are limited to the official abstracts and available
report excerpts. The synthesis does not substitute those for full empirical
replication. Publication dates refer to the works, not search-index crawl dates.

The reviewed sources support the mechanisms and cautions above. They do not
establish that LLM simulation predicts later FTS changes, that reconstruction
scores track human maintenance effort, or that the two costs are independent
and additive. These remain empirical questions.

Next: Phase 1, `docs/factory/intent-recoverability.md`. Define the ground-truth
unit, evidence conditions, scoring and adjudication, repeated-run comparison,
and resource measurements. Then complete the evolvability and LLM-delta
documents before extracting FTS-specific models or selecting an experiment.
