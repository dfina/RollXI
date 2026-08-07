# Roll XI

A mobile-first historical European club football game, spanning Serie A from
1929-30 and European competitions from 1955-56 through 2025-26.
Modes: daily sticker trivia, Champions League-format Campaign, and link-up
Chains.

## Run locally
    npm install
    npm run dev

## Build / deploy
    npm run build
The dist/ folder is fully static (relative paths), so it can be dropped
onto GitHub Pages, Netlify or any static host as-is.

## Data packs
Game data lives in `public/data/` as JSON packs listed in `index.json` and
merged at runtime.

The current schema separates two properties that used to be conflated:
- `role: "roster"` means the club-season has a full player list and is
  draftable.
- `role: "stub"` means it has no player list and is not draftable.
- `achievements[]` records European progress. `W`, `RU` and `SF` make a
  club-season eligible as Campaign opposition, whether the row is a roster or
  a stub.

The old `tierType: "P"/"O"` field remains only for compatibility with legacy
rows and must not be used as the design model for new content.

Add a pack by dropping the file in `public/data/` and listing it in
`index.json`. Crest/photo fields take URLs; the kit monogram renders as fallback
whenever they are null or fail to load.

Before adding a pack, read `docs/CONTENT-TARGET.md`, then run the validation,
coverage and build checks below.

## Content target — read this before adding teams
The finished dataset is specified in **docs/CONTENT-TARGET.md**. The goal, in
one line: full rosters for all Serie A seasons from 1929-30 plus every main-draw
participant of all seven European competition families, with all winners,
runners-up and semi-finalists usable as Campaign opposition.

    npm run coverage        # breadth everywhere; real depth where target counts exist
    npm run coverage:next   # next measured incomplete or untouched edition
    npm run validate        # structural/data invariants and club-name policy
    npm run build           # production build

Scope is declared in `public/data/coverage-target.json`. Progress is derived
from the live packs by `coverage.mjs`. A season being "touched" is not proof of
completion: only scopes with researched `expectedRostersPerEdition` counts can
be measured for real depth. Do not infer completion from pack filenames,
`index.json` labels or `meta` notes.

`validate.mjs` runs in CI on every push and pull request
(`.github/workflows/validate.yml`) and again before every deploy. Known club-name
aliases that have already been adjudicated are rejected; genuinely new
near-matches remain warnings for human review.

## Progress storage
`localStorage` under the `rollxi:` namespace. Clearing site data resets daily
history and Campaign progress.
