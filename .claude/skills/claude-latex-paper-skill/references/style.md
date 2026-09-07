# English prose style — reading like a person, not a model

Distilled from nature-polishing (Yuan1z0825/nature-skills), the English-LaTeX
de-AI rules (BoHeFan/academic-paper-writer-pro-2), and the writing-quality
checklist (Imbad0202/academic-research-skills). These are good-writing rules,
not detection evasion: the goal is prose a tired reviewer reads without
friction.

## Modification threshold

If a passage is already natural — varied rhythm, no buzzwords, clean logic —
**leave it untouched**. Editing for the sake of editing degrades text.

## Vocabulary

Replace AI-overused words with plain alternatives (only when they carry no
precise technical meaning):

| Avoid | Prefer |
|---|---|
| leverage | use, employ |
| delve into | examine, investigate |
| pivotal / paramount | key, central / important |
| underscore | show, emphasize |
| robust (as filler) | reliable, stable — or the specific property |
| seamless / holistic | integrated / comprehensive |
| cutting-edge / groundbreaking | state-of-the-art (sparingly), novel |
| paradigm / realm / landscape | approach / area / field |
| burgeoning / multifaceted / nuanced | growing / complex / subtle |
| unprecedented | new, notable |

Keep domain terms exact and untouched — the field's terms of art, model and
metric names, identifiers, and units, whatever they are. Never "synonymize" a
technical term, identifier, path, or math expression.

## Rewrite safety zones

A style or de-AI pass edits prose only. Leave these untouched,
character-for-character — a "cleaner" rewrite that changes them is a bug, not
an improvement:

- math mode: `$...$`, `\[...\]`, and `equation`/`align` bodies;
- `verbatim`, `\texttt{}`, code, paths, filenames, identifiers;
- cross-reference plumbing: `\label`, `\ref`, `\cref`, `\cite` keys, and the
  numbers/units inside `siunitx` (`\SI`, `\num`, `S` columns);
- LaTeX comments (`% ...`) — notes to the author, not reader prose.

And a de-AI rewrite subtracts, it does not add: the reworded passage should be
**no longer than the original**. If a fix needs more words, it is a content
change (claim, evidence, boundary) — handle it as one, not as polish.

## Structure

- **Prose over lists.** Convert `itemize`/`enumerate` runs into connected
  paragraphs unless the content is genuinely enumerable (parameter tables,
  gate criteria). A report full of bullets reads like slides.
- **Cut throat-clearing.** Delete "It is worth noting that", "It is important
  to note", "First and foremost", "In order to" (→ "to"), "Last but not
  least". Let sentence order carry the logic.
- **Vary rhythm.** Alternate sentence lengths; avoid three same-shaped
  sentences in a row and uniform paragraph sizes. Read a paragraph aloud
  mentally — monotone means rewrite one sentence, not all of them.
- **Limit em dashes** to at most one per paragraph; prefer commas,
  parentheses, or a relative clause.
- **No bold/italic emphasis in body text** (`\textbf`, `\emph` reserved for
  definitions on first use, if at all). Emphasis comes from sentence
  position: put the load-bearing clause last.

## Stance and claims

- State what was done and measured in plain past tense; reserve present
  tense for what the artifact *is*.
- One claim per sentence near evidence; put the number and the pointer
  (table/figure) in the same sentence.
- Boundary every positive claim ("on this synthetic universe", "over
  2015–2024 daily bars") — the boundaries are what make the negative results
  credible.
- First person plural ("we") is fine and preferable to passive contortions;
  this is a single-author report, so "we" = author + reader convention or
  use "this project".

## Section jobs (fix the section before the sentence)

- **Abstract**: problem → approach → the 2–3 headline numbers → the honest
  verdict. No citations, no suspense.
- **Introduction**: the motivation and the gap, the research questions, and the
  contributions as claims the body will defend — each mapped to a section.
- **Methods/Architecture**: reproducible description; a reader with the repo
  should find every named component.
- **Experiments/Results**: chronology is not structure — organize by
  question answered (E-series entries group naturally).
- **Discussion**: interpret, bound, compare to the anchors; the leakage
  post-mortem belongs here as a first-class finding.
- **Conclusion**: what a follow-up project should do differently; no new
  claims.
