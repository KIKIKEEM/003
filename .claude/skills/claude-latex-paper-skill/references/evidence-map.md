# Evidence map — where every claim in the report must trace to

The claim-ledger gate: before a sentence asserts a number, comparison, or
capability, identify the artifact that supports it. Build this map at scaffold
time from the project's own outputs; conversation memory is not evidence.

This file is a template — fill the tables with *your* project's artifacts.

## Canonical artifacts

List the source-of-truth files the report is written from, and note what kind
of claim each one backs:

| Evidence | Artifact |
|---|---|
| Headline result numbers | your results files (e.g. `results/*.csv`) |
| Experiment provenance (what was run, when, with which settings) | your experiment log / notebooks |
| Scope, milestones, resolved decisions | your design and status notes |
| Domain language, ubiquitous terms | your glossary / context notes |
| System architecture | your architecture doc / module READMEs |
| Reproducibility claims | test suite, build files, dependency manifest |

## Load-bearing findings the report must state accurately

Before drafting, write down the two or three findings the report stands on, in
shape only (no numbers yet) — then verify each exact number from its artifact
when you write it. Keep negative and cautionary findings on this list; a
carefully bounded failure is often the most defensible contribution a report
has.

## Rules

- A number in the report must appear in (or be arithmetically derived from) an
  artifact above; cite the table or figure built from that source.
- Claims about wall-clock time, hardware, or library versions → check the
  environment or dependency manifest, do not guess.
- If the user supplies a new number verbally, ask for the artifact or mark
  `[CLAIM NEEDS EVIDENCE]`.

## Threats-to-validity vocabulary (Discussion section)

Use your field's standard threat-to-validity terms — reviewers pattern-match on
them. Map each named threat to where the project mitigated it or explicitly did
not; an admitted, bounded threat reads as rigor, not weakness. For empirical or
data-driven work these commonly include selection bias, look-ahead / leakage,
overfitting and multiple comparisons, external validity / generalisation, and
reproducibility.
