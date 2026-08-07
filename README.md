# Roll XI

A mobile-first football game across the European club game, 1960-2026.
Modes: daily sticker trivia, Champions League format campaign, and
link-up chains.

## Run locally
    npm install
    npm run dev

## Build / deploy
    npm run build
The dist/ folder is fully static (relative paths), so it can be dropped
onto GitHub Pages, Netlify or any static host as-is.

## Data packs
Game data lives in public/data/ as JSON packs listed in index.json and
merged at runtime. Two tiers share one ID space:
- "P" (pickable): full squads with [name, pos, rating, nationality].
- "O" (opponent-only): club, country, season, comps, one rating,
  optional scorer names. Used as campaign opposition.
Add a pack by dropping the file in public/data/ and listing it in
index.json. Crest/photo fields take URLs; the kit monogram renders as
fallback whenever they are null or fail to load.

Before adding a pack, read docs/CONTENT-TARGET.md — see below — then run
`npm run validate` once the new pack is in place.

## Content target — read this before adding teams
The finished dataset is specified in **docs/CONTENT-TARGET.md**. The goal, in
one line: full rosters for all of Serie A history plus every main-draw
participant of all seven European competitions, with all winners, runners-up
and semi-finalists usable as Campaign opposition.

    npm run coverage        # coverage per scope, names the next pack to build
    npm run coverage:next   # just the next pack
    npm run validate        # data correctness — duplicate IDs, malformed
                             # rosters, deprecated codes, missing crest
                             # entries, index.json drift, club-name variants

Scope is declared in `public/data/coverage-target.json`. Progress is
**derived** by `coverage.mjs`, never hand-written — don't infer what's done
from pack filenames or `meta` notes, they go stale. `validate.mjs` runs in CI
on every push and pull request (`.github/workflows/validate.yml`) and again
before every deploy, so bad data can't reach production either way.

## Progress storage
localStorage under the "rollxi:" namespace. Clearing site data resets
daily history and campaign progress.
