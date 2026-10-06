# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Modern Java" is a book (not an application) that teaches Java from scratch, built with [mdBook](https://rust-lang.github.io/mdBook/). All content is Markdown under `src/`. There is no Java build system, test suite, or linter wired up.

## Commands

- `mdbook serve` — build and serve locally with live reload (requires `mdbook` installed)
- `mdbook build` — build to `./book` (this is what the deploy workflow runs)
- `node dev/serve.mjs` — `mdbook serve` plus a local Java runner on the same origin (`POST /_runner/execute`, uses `java` on PATH or `$JAVA_HOME`, needs JDK 25), so Run works end to end at http://localhost:3000. Not sandboxed; dev only.

CI: `.github/workflows/deploy-gh-pages.yaml` deploys on push to `master`. Note the default/working branch is `develop`. PRs run a LanguageTool typo check (`language.yaml`); the markdownlint and link-check jobs are commented out, but `.markdownlint.yaml` documents the intended rules (line length 300, 4-space list indent, only `iframe`/`sup` HTML allowed).

## Structure

- `src/SUMMARY.md` is the table of contents and the single source of truth for what appears in the book. A new page must be added here or it won't be built. Large parts of it (including planning notes and unfinished chapters) are wrapped in `<!-- -->` comments, so check before assuming a chapter is live.
- Chapter layout convention: `src/<topic>.md` is the chapter landing page, and `src/<topic>/` holds its sub-pages (e.g. `src/boolean.md` + `src/boolean/and.md`, `not.md`, `challenges.md`, `header.png`). Most chapters end with a `challenges.md`.
- `book.toml` configures the book: MathJax enabled, custom `ferris.css`/`ferris.js`, `heading-split-level = 2`, and a custom `theme/` (overrides `index.hbs`, `book.js`, CSS) — edit theme files only deliberately.

## Code blocks in chapters

Java snippets use mdBook playground attributes, and the choice matters because the code is shown/run for readers:

- ```` ```java,editable ```` — runnable and editable (used for challenges)
- ```` ```java,no_run ```` — displayed but not runnable (fragments)
- ```` ```java,does_not_compile ```` / ```` ```java,panics ```` — intentionally broken examples demonstrating errors
- Lines prefixed with `~` are hidden from readers (`hidelines` configured for `java`)
- Examples target the newest Java (21+ and preview features): unnamed classes / instance `void main()` and `IO.println` rather than `public static void main` / `System.out.println`. Keep new snippets in that style.

## Editorial rules (from README)

- Topic ordering is the core goal: every topic's prerequisites must be covered in earlier sections. Don't reference concepts introduced later.
- Write as if the newest Java were always *the* Java (e.g. no "addendum: new in Java X", and teach switch expressions rather than C-style switch statements first).
- Avoid the terms "object oriented"/"functional programming" as framing; explain the mechanics and motivation instead.
- Maintainers are not accepting broad changes to main chapter content; welcome contributions are challenges, theming, and grammar/ordering fixes.
- Contribution guidelines live in the GitHub wiki (see `CONTRIBUTING.md`).

## Challenge editor (theme)

On `challenges.html` pages only, `theme/book.js` (`setupChallengeBlock`) renders code blocks locked, with Run, Edit, Undo and Copy buttons. Edit unlocks the block as an Ace editor with Java completion (`theme/js/java-completions.js`, vendored Ace 1.4.4 `theme/js/ace/ext-language_tools.js` + `mode-java.js`, which must match mdBook's bundled `ace.js`). Other chapters are unchanged.

- Run posts to `RUNNER_ENDPOINT` (relative `../_runner/execute`, proxied to the sandboxed runner) with `release: JAVA_RELEASE`. Keep the endpoint relative and the request/response shape unchanged.
- The theme targets mdBook 0.4.x (`{{previous}}` helper); mdBook 0.5 fails to render `theme/index.hbs`.
