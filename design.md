# Design system

The rules and building blocks for every page on this site: home, blog, blog posts, study notes and the notes themselves. Read this before changing how anything looks. If a page needs something this file doesn't cover, add it here first, then build it.

## Direction

- Minimal, sleek, technical. A polished independent engineer's site, not a SaaS landing page.
- Quiet confidence over effects. When in doubt, remove an element instead of styling it.
- One coherent flow per page. No card grids, framed sections or dashboard layouts.
- Whitespace, rhythm and type hierarchy before borders. Divider lines are rare and faint.
- Amber is the accent for what you can act on; the green dot is the only other colour mark. Neither is decoration.

## Files

| File | Holds | Rule |
| --- | --- | --- |
| `assets/design/tokens.css` | Fonts, the type scale, every colour, both themes | The only place a colour or font size is defined. Need a new one? Add a token here. |
| `assets/design/components.css` | The shared header, the dot tag, graph paper | Every page loads it, study notes included. |
| `styles.css` | Page layouts: home, list pages, blog posts | Uses tokens only; no literal colours. |
| `../study/notes/ML/core/_theme/build_public.py` | Builds the study-note pages | Links the same two design files and maps the notebook's token names onto them. |

A few home-page details (the work timeline, the GitHub activity grid) still set fixed sizes in `styles.css`; move them onto the scale when you next touch them.

Every page loads, in order: Google Fonts (IBM Plex Sans and Mono), `tokens.css`, `components.css`, then its own styles. When a design file changes, bump its `?v=` on every page that loads it: the four hand-written pages, plus `DESIGN_CSS` in `build_public.py`, then rebuild the notes.

## Type

One family, IBM Plex: **Plex Sans** for all text, **Plex Mono** for the mark, nav, tags, dates, metadata and code. No display serif, and no tight negative tracking (headings at most −0.02em).

| Token | Size | Used for |
| --- | --- | --- |
| `--fs-hero` | 40–60px | The home page name only |
| `--fs-title` | 30–40px | Blog post and note titles |
| `--fs-h2` | 22px | Section headings |
| `--fs-h3` | 18px | Subsections |
| `--fs-row` | 19px | List titles (blog, study notes) |
| `--fs-body` | 16.5px | Reading text, line height 1.7 |
| `--fs-small` | 15px | Nav, list descriptions |
| `--fs-tag` | 13px | The dot tag |
| `--fs-label` | 12px | Dates, metadata, table heads (mono) |

Sizes are the same on every page and on phones; nothing grows on mobile.

## Colour

Dark is the default; `html[data-theme="light"]` switches. Each page sets `data-theme` before first paint (the saved `deepam-theme` choice, else the OS preference), so the toggle and the OS setting stay in step across every page.

| Role | Token |
| --- | --- |
| Page background | `--void` |
| Raised surface (code, contents panel) | `--surface` |
| Text, secondary text, labels | `--text`, `--soft`, `--muted` |
| Borders and table rules | `--rule`; the header rule is `--ink-line` |
| Accent: links, the mark's `>`, tag text, hover | `--amber` (`--link` for link text, slightly darker in light mode for contrast) |
| The dot, strings in code, quote bars | `--green` |
| Note diagrams: forward values, gradients, gates | `--blue`, `--orange`, `--neutral`, `--green`, each with a `-wash` |
| Graph paper | `--grid`, `--grid-major` |

## Components

- **Header** (`components.css`): `> deepam` on the left; `blog`, `notes` and the round sun/moon toggle on the right; a faint rule underneath. Same markup on every page (copy it from the comment in `components.css`).
- **Tag**: a green dot and a short lowercase mono label (`.tag`). It names a section: "learning", "writing". Amber by default; `.tag-muted` for status lines like "applied ML engineer".
- **List row**: title at `--fs-row`, an optional one-line description in `--muted`, and the date in mono on the right. No borders or cards.
- **Graph paper** (`.graph-paper`): faint 20px and 100px grid behind reading pages, i.e. note pages and blog posts. Never behind the home page or list pages.
- **Reading components** (blog posts and notes look the same):
  - **Body text:** `--fs-body`, colour `--text`.
  - **Links:** `--link`, underlined on hover.
  - **Inline code:** mono on `--surface` with a `--rule` border.
  - **Code blocks:** `--surface`, 1px `--rule` border, 10px radius, 13px mono. Only comments (muted) and strings (green) are coloured.
  - **Tables:** no outer border; uppercase mono heads in `--muted`, rows split by `--rule`.
  - **Quotes and asides:** a 2px coloured bar on the left and no box.
  - **Equations:** two or more go on their own lines, aligned on `=`, never chained inside a sentence.

## Page templates

- **Home:** header; the muted tag ("applied ML engineer"); the name at `--fs-hero`; a short intro; links.
- **List page** (blog, study notes): header; the tag as the page's only heading (it is the `h1`); the list right below it. No big title, because the nav and the tag already say where you are.
- **Reading page** (blog post, note): header; graph paper; the tag ("writing", or "Notes · topic"); title at `--fs-title`; date or reading meta in mono; then the body. Notes add the contents rail on wide screens.

## Don'ts

- No literal colours or font sizes outside `tokens.css`.
- No display or decorative fonts, pull quotes or large callouts.
- No floating buttons or arrows (scroll-to-top or bottom, back-to-top). The notes' "Contents" button on phones is the one exception, because it's navigation.
- No redundant titles that repeat the nav or the tag.
- No card grids, nested boxes or heavy borders.
- No pointer-only or scroll-triggered interactions for important content. Expandable rows must be keyboard accessible and keep accurate ARIA states.

## Copy

- Keep first-view copy short.
- Use specific technical nouns, without internal implementation detail or company-confidential terms.
- Frame projects by capabilities and outcomes.
- Cut generic portfolio filler and sentences that sound AI-generated.

## Before shipping

- Check both themes, desktop and phone width (no sideways scroll), and keyboard focus.
- For notes: no MathJax errors, and no raw `<` inside maths.
- Take a screenshot. If it feels crowded, remove something before adding structure.
