---
name: claude-latex-paper-skill
description: Write and revise a technical report or thesis as a LaTeX document in English, with the discipline a graded or peer-reviewed submission needs — every claim traced to an artifact, no citation from memory, human-sounding prose, and a mechanical verification loop. Use when the user asks to write the paper, technical report, thesis-style writeup, LaTeX report, 写论文, 技术报告, 排版, polish a section, add citations, or reduce AI-sounding prose.
---

# LaTeX technical-report writing skill

Produce and maintain a LaTeX report or thesis in English, section by section,
with a claim ledger, verified citations, human-sounding prose, and a mechanical
check after every edit. Converse with the user in their language; write the
report in English unless the user sets another target language.

## Project metadata (collect once, then never re-ask)

At scaffold time, collect the report's fixed metadata from the user and record
it — never invent it, and never re-ask it later. Typical fields for a title
page and declaration:

| Field | Example |
|---|---|
| Author | full name (or leave to the user's preference) |
| Institution | university / organisation |
| Faculty / department | as it should appear on the title page |
| Degree / programme | e.g. B.Sc. / M.Sc., or "not applicable" |
| Module / course / venue | module name and credits, or the target venue |
| Supervisor / advisor | name and title, if any |
| Deliverable | what is being submitted (report, software, presentation) |

Confirm these once and treat them as fixed thereafter unless the user changes
them.

## Non-negotiable rules

1. **Claim ledger.** Every quantitative or comparative claim must trace to a
   project artifact (see [references/evidence-map.md](references/evidence-map.md)).
   No artifact → mark `[CLAIM NEEDS EVIDENCE]`, never polish an unsupported claim.
2. **Negative results stay.** Honestly reported failures — a bug post-mortem, a
   result that did not hold up, a hypothesis that failed — are findings, not
   embarrassments. Report them with the same care as the positives.
3. **No citation from memory.** Follow
   [references/citations.md](references/citations.md): verify via DOI/CrossRef/
   arXiv/Semantic Scholar before any BibTeX entry; unverifiable → explicit
   `PLACEHOLDER_` key + tell the user.
4. **Human-sounding English.** Apply
   [references/style.md](references/style.md) while drafting, not as a
   post-pass. If a passage already reads naturally, leave it alone.
5. **Compile before judging.** Never assess layout from `.tex` source; build
   the PDF and look at it ([references/latex.md](references/latex.md)).
6. **Mechanical verification after every section.** Run
   `scripts/verify_paper.py` and fix all hard failures before moving on —
   see [references/verification.md](references/verification.md). Trust the
   scan, not your impression of what you wrote.
7. **Context hygiene.** Long context is the main hallucination driver in
   long-document work: draft one section per sitting with only that section's
   evidence artifacts open; re-read the artifact before writing its numbers,
   never quote them from conversational memory. If drafting quality degrades or
   a session has grown long, hand off to a fresh session (`/handoff`).

## Workflow

### First invocation (no `paper/` yet)
1. Read the project's source-of-truth artifacts — its results and data files,
   experiment logs, design and status notes, README. The report is written
   *from* these, not from memory of the conversation. Build the evidence map
   ([references/evidence-map.md](references/evidence-map.md)) from them.
2. Propose a section outline (see report skeleton in
   [references/latex.md](references/latex.md)) and the evidence each section
   will draw on; get the user's verdict before drafting.
3. Scaffold `paper/` (main.tex, sections/, refs.bib, a build script) and draft
   section by section, citing as you write.

### Per-section loop (draft and revision alike)
1. Open only the evidence artifacts this section draws on; draft.
2. Run `py -3.13 scripts/verify_paper.py paper/` (adjust the path to wherever
   the skill lives).
3. Fix hard failures (CJK leakage, unresolved markers, cite/bib mismatch),
   rerun until clean — two passes is normal; fixes can introduce new errors.
4. Compile, scan the log, eyeball changed pages.
5. Update `paper/glossary.md` with any new term-of-art before the next section
   (one term, one rendering — consistency beats variety).

### Revision passes
- Section rewrite / polish → load [references/style.md](references/style.md);
  state which section and what failure mode you are fixing.
- Citation work → load [references/citations.md](references/citations.md).
- Layout complaints (loose pages, split figures, floats) → load
  [references/latex.md](references/latex.md) §Layout, skip the prose rules.
- After every edit batch: recompile, check the log for warnings, eyeball the
  changed pages.

## Priority order when editing prose

Paper-type architecture → section's job → paragraph logic →
claim/evidence/boundary → sentence polish. Fix the highest broken level first;
a beautiful sentence in a paragraph with no argument is wasted work.

## What NOT to do

- Do not invent related work, datasets, or numbers to fill gaps.
- Do not restructure into bullet-heavy "AI slide" prose; the report is flowing
  technical prose with tables/figures where the data lives.
- Do not commit anything; leave git operations to the user's verdict.
- Do not re-derive results by rerunning pipelines unless asked — the archived
  result files are canonical.
