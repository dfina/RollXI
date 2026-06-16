# Roll XI

A mobile-first football game across the European club game, 1960-2026.
Modes: daily sticker trivia with a Panini-style album, Champions
League format campaign, and link-up chains.

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

## Progress storage
localStorage under the "rollxi:" namespace. Clearing site data resets
the album and daily history.
