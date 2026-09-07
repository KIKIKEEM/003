# claude-latex-paper-skill — a LaTeX technical-report writing skill for Claude Code

A Claude Code skill for drafting and revising a Master-level technical report or
thesis as a LaTeX document in English, with the discipline a graded
submission needs: every quantitative claim traced to a repository artifact, no
citation written from memory, human-sounding prose, and a mechanical
verification loop after every edit.

It grew out of a real Master-level report and has been generalised for
any single-author LaTeX paper — a technical report, thesis, or conference-style
writeup.

> **Local LaTeX, by design.** This skill compiles the report on your own machine
> with a local LaTeX toolchain (MiKTeX or TeX Live) — not Overleaf or any
> online/cloud service. The layout and density techniques, the build loop, and
> `verify_paper.py` all assume a local `pdflatex` + `biber` are on your machine.

## What it does

- Drafts and revises the report section by section: converse in Chinese, write
  the report in English.
- Enforces a **claim ledger** — no quantitative or comparative claim without a
  repository artifact behind it; unsupported claims are marked, not polished.
- Keeps **negative results** first-class: a leakage post-mortem, a money-losing
  strategy, and a failed value-added gate are reported as findings.
- **Never writes a citation from memory** — DOI / arXiv / CrossRef verification
  before any BibTeX entry, and every entry must carry a locator.
- Applies **human-sounding, de-AI English** while drafting, not as a post-pass.
- Runs a **mechanical verifier** after each edit (`scripts/verify_paper.py`):
  CJK leakage, unresolved markers, `\cite`/bib mismatch, missing reference
  locators, plus AI-vocabulary and emphasis warnings.

## When it triggers

Asking to write the paper / technical report / thesis-style writeup / LaTeX
report, to polish a section, add citations, reduce AI-sounding prose, fix the
layout — or the Chinese equivalents (写论文, 技术报告, 排版).

## Structure

```
claude-latex-paper-skill/
├── SKILL.md                # agent-facing instructions — the binding contract
├── README.md               # this file — human-facing overview
├── references/
│   ├── style.md            # human-sounding English; de-AI rules; rewrite safety zones
│   ├── latex.md            # class/layout, single-column density, front matter, compile loop
│   ├── citations.md        # verify-before-BibTeX workflow; locators required
│   ├── verification.md     # the mechanical check loop; how to report findings for verdict
│   └── evidence-map.md     # (project-specific) claim → artifact mapping
└── scripts/
    └── verify_paper.py     # offline mechanical checks; exits 1 on hard failures
```

`SKILL.md` is read first and is authoritative; the `references/` files are
loaded on demand per task (style pass, citation work, layout complaint,
verification), which keeps context small and the rules consistent across a long
document.

## Requirements

- A LaTeX toolchain with `pdflatex` and `biber` (MiKTeX or TeX Live), providing
  `biblatex`, KOMA-Script, `geometry`, `microtype`, `siunitx`, `booktabs`,
  `cleveref`, and `etoolbox`.
- Python 3 for `verify_paper.py` (standard library only — no dependencies).

## Reusing it for another paper

The general machinery transfers unchanged: `style.md`, `latex.md` (including the
single-column density and continuous-chapter techniques and the front-matter /
title-page recipe), `citations.md`, `verification.md`, and `verify_paper.py`.
Adapt the two project-specific pieces: `evidence-map.md` (fill it with your
project's artifacts) and the metadata block in `SKILL.md` (author, institution,
faculty, module).

## Attribution

The reference rules distil practice from several open academic-writing skills:
nature-polishing (Yuan1z0825/nature-skills), the English-LaTeX de-AI rules
(BoHeFan/academic-paper-writer-pro-2), the writing-quality checklist
(Imbad0202/academic-research-skills), and citation-verification discipline
(Galaxy-Dawn/claude-scholar). The mechanical verification loop borrows the
zero-source-character idea from a novel-translation skill.
