# Citation workflow — nothing enters refs.bib unverified

Distilled from citation-verification practice (e.g. Galaxy-Dawn/claude-scholar).
AI-generated citations run a high error rate; a fabricated reference in a graded
or peer-reviewed paper is misconduct, not a typo.

## The rule

**Never write a BibTeX entry from memory.** Path for every citation:

1. Find the identifier: DOI > arXiv ID > publisher landing page.
   Use WebSearch/WebFetch; Semantic Scholar and CrossRef are the
   verification authorities, Google Scholar is discovery only.
2. Confirm title, first author, year, venue against the identifier's
   landing page.
3. Fetch BibTeX programmatically:
   - CrossRef: `https://api.crossref.org/works/<DOI>/transform/application/x-bibtex`
   - arXiv: export page → BibTeX
4. If citing a *specific claim*, confirm the claim appears in the paper
   (abstract or fetched text), and note the section.
5. Only then add to `paper/refs.bib`.

Unverifiable → `\cite{PLACEHOLDER_author_year}` + `% TODO verify` comment,
and tell the user how many placeholders exist. Never silently invent a
similar-sounding paper.

## Style

- Use `biblatex` numeric or author-year (pick once; IEEE-style numeric fits
  many technical fields; confirm with the user at scaffold time).
- Every entry carries a locator a reader can follow — `doi`, `eprint` (arXiv),
  `url`, or `isbn`. `verify_paper.py` warns on any entry with none; an
  unlocatable reference is where a fabricated one hides.
- Cite where the claim is made, not in decorative clusters at paragraph ends.
- The project's own experiment logs or data files are *not* citations — they
  are the evidence base; reference them as an appendix pointer if needed.
