# LaTeX conventions and layout for the report

## Project layout

```
paper/
├── main.tex          # documentclass, packages, metadata, \input chain
├── sections/         # one .tex per chapter
├── figures/          # generated from docs/results/*.csv (matplotlib, colorblind-safe)
├── tables/           # generated .tex tables — never hand-type result numbers
├── refs.bib          # verified entries only (see citations.md)
└── Makefile          # or latexmk config
```

## Document setup

- Class: `scrreprt` (KOMA) or `report`, 11pt, A4, oneside — a Master project
  report, not a two-column conference paper. If the compiled PDF reads sparse
  or wastes vertical space, densify it in single column (see §Density and
  vertical whitespace); do not switch to two columns — that breaks the
  title/declaration/TOC frontmatter and forces the wide result tables to span
  columns.
- `biblatex` + `biber`; numeric (IEEE-like) style unless the user chooses
  author-year at scaffold time.
- Title page carries the fixed metadata block from SKILL.md (institution,
  faculty or department, degree/programme, module or venue, supervisor). If the
  submission expects a declaration-of-originality page, include one and confirm
  the exact wording with the user.
- `booktabs` for tables, `siunitx` for numbers/units, `graphicx`, `hyperref`
  last (before `cleveref` if used).

## Front matter

Order: title page → declaration → abstract → table of contents, each on its own
page (the `titlepage` environment and the `\chapter*` headings break regardless
of any chapter-flow gate from §Density).

**Title page.** Build the hierarchy with typography and rules, not decoration,
and never invent a university logo — if no logo asset exists, type alone reads
clean. A reliable recipe, everything centred inside
`\begin{titlepage}\centering`:

1. optionally a single institution line at the top — default the English name,
   no bilingual block and no separator rule (keep it minimal);
2. the document kind in `\scshape` (the module, programme, or venue name), then
   a plain descriptor line (e.g. `Technical Report` or `Master's Thesis`);
3. the title framed by a pair of heavier rules (`\rule{\linewidth}{1.3pt}`
   above and below) set `\huge\bfseries`, subtitle in `\large` beneath;
4. the author in `\Large\bfseries` with the degree under it;
5. `\vfill`, then a small `tabular` (supervisor, module, submission city and
   `\today`) at the foot.

Keep every fixed-metadata value exactly as SKILL.md fixes it (author,
institution, faculty, degree/programme, module or venue, supervisor).

**Declaration.** If the submission expects an originality declaration, add a
short one in the report's language and confirm the exact wording with the user.

**Abstract.** `\chapter*{Abstract}`, no citations, following the abstract job in
style.md: problem → approach → the 2–3 headline numbers → the honest verdict.

## Report skeleton (adapt at outline stage, don't impose)

1. Introduction — motivation, research questions, contributions
2. Background & Related Work — the literatures the work builds on
3. Methods / System / Architecture — the reproducible description
4. Experiments / Results — organised by the question answered, not chronology
5. Discussion — what held, what failed, threats to validity
6. Conclusion & Future Work
7. Appendices — reproducibility (commands, versions), extended tables

## Numbers pipeline

Generate result tables/figures by script from `docs/results/*.csv` into
`paper/tables/` and `paper/figures/` — hand-typed numbers drift from the
artifacts and break the claim ledger. Keep the generating script in `paper/`.

## Compile loop

Windows host: check `Get-Command latexmk, pdflatex, tectonic` first; if no
TeX distribution, tell the user (MiKTeX or `winget install TeXLive.TeXLive`;
tectonic is the lightweight alternative) rather than silently producing
uncompilable sources.

Every edit batch: `latexmk -pdf main.tex` (or tectonic), then:
1. Scan the log — undefined references, missing citations, overfull hboxes.
2. Open the PDF and look at changed pages; never judge layout from source.

## Layout fixes (from nature-polishing latex-layout)

- Loose/sparse page or stranded heading → check float placement before
  touching text; `\usepackage[section]{placeins}` + `\FloatBarrier` beats
  scattering `[H]`.
- Figure split across pages / "Float too large" → the figure is oversized
  for the text block: regenerate it at the right aspect ratio at the source
  (matplotlib `figsize`), don't `\resizebox` distortions.
- Wide multi-panel figures → regenerate taller at the source rather than
  shrinking to illegibility.
- Widows/orphans and one-line section tails → reword the paragraph (style.md
  pass) before reaching for `\enlargethispage`.

## Density and vertical whitespace (single-column)

A default KOMA `scrreprt`/`report` reads sparse for a table-heavy technical
report: the typearea is deliberately narrow (wide side margins) and, worse,
every `\chapter` starts a new page, stranding blank space at the foot of each
chapter's last page. "The layout looks primitive / big blanks at page bottoms"
is a legitimate, common complaint. Fix it in single column — the steps below
took this report from 34 → 24 pages with no lost content and no new overfull.
Apply them only when a *compiled* PDF actually reads sparse (rule 5: compile
before judging), and preferably in this order, recompiling after each.

1. **Widen the text block.** `geometry` with modest margins, e.g.
   `\usepackage[a4paper,top=2.3cm,bottom=2.3cm,left=2.4cm,right=2.4cm]{geometry}`
   (or raise the KOMA `DIV`). Reclaims the wide side margins; fewer pages,
   fuller lines. A harmless "geometry overrides typearea" note is expected.
2. **`\usepackage{microtype}`** — tighter justification, fewer overfull boxes,
   a more even grey.
3. **Pull chapter titles up.** KOMA opens a chapter about a third down the page.
   `\RedeclareSectionCommand[beforeskip=-\baselineskip,afterskip=.7\baselineskip]{chapter}`
   plus `\renewcommand*{\chapterheadstartvskip}{\vspace{3\baselineskip}}` sets
   the gap above the title explicitly. Use non-starred `\vspace` so the gap is
   discarded at the top of a page but kept mid-page.
4. **Let chapters flow instead of each opening a new page** (optional — only if
   the per-chapter blank pages are the real problem, and you want a continuous
   document that still marks chapter boundaries with a gap). KOMA issues the
   break inside `\scr@startchapter` (in `scrreprt.cls`, the line
   `\if@openright\cleardoublepage\else\clearpage\fi`). Gate it behind a toggle
   so the body flows while front/back matter still breaks:

   ```latex
   \usepackage{etoolbox}
   \newif\ifchapflow \chapflowfalse          % no @ in the name: it is switched
   \makeatletter                             % in the document body, where @ is
   \patchcmd{\scr@startchapter}              % not a letter (an @-name silently
     {\if@openright\cleardoublepage\else\clearpage\fi}   % no-ops there)
     {\ifchapflow\else\if@openright\cleardoublepage\else\clearpage\fi\fi}
     {}{\typeout{PATCHFAIL: chapter-break gate}}
   \makeatother
   ```

   In the body: after `\tableofcontents` do `\clearpage` then `\chapflowtrue`
   before the first chapter, and `\chapflowfalse` before `\printbibliography`
   so the bibliography and appendix keep fresh pages. This preserves `\chapter`
   numbering, every `\cref{ch:…}` (still "Chapter N"), and the prose word
   "chapter" — only the page-break behaviour changes, so no section files need
   editing. Verify: `grep PATCHFAIL main.log` must be empty, and eyeball a page
   where two chapters meet to check the gap.

When a user points at a dense conference paper (e.g. a two-column USENIX
template) as the visual target, these are the single-column-compatible ways to
approach that density. Going genuinely two-column is a larger, riskier change
that conflicts with the report frontmatter and the wide tables; treat it as a
separate decision the user must opt into, not a default.
