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

The `dist/` folder is fully static and can be deployed to GitHub Pages, Netlify
or another static host.

## Data architecture

Game data lives in `public/data/` as stable **decade shards** listed in
`index.json`:

    clubs-1950s.json
    clubs-1960s.json
    ...
    clubs-2020s.json

Each club-season exists exactly once, in the shard selected by its season start
year. For example, `2024-25` belongs in `clubs-2020s.json`. Future historical
Serie A expansion will add `clubs-1920s.json`, `clubs-1930s.json` and
`clubs-1940s.json` when those decades are first needed.

File boundaries do not encode gameplay meaning. The canonical club-season
schema separates two independent properties:

- `role: "roster"` means the row has a full player list and is draftable.
- `role: "stub"` means it has no player list and is not draftable.
- `achievements[]` records European progress and coverage. `W`, `RU` and `SF`
  make a club-season eligible as Campaign opposition, whether the row is a
  roster or a stub.

The old `tierType: "P"/"O"` field has been removed. Do not reintroduce it.

When a Campaign opponent is also a pickable roster, match scorers are drawn
from that complete roster rather than from a short opponent-only name list.
Scoring probability is weighted by detailed position and player rating.

Campaign drafting keeps historical detailed positions intact but applies a
small gameplay compatibility layer so formations are not interpreted too
literally. CM can fill CM, DM or AM; DM can fill DM or CM. In 3-5-2 and 3-4-3
only, conventional LB/RB players may also fill the LM/RM wide roles. More
aggressive proxies such as DM -> CB, full-back -> CB or AM <-> winger are not
inferred unless the player's own `dp` data explicitly records those roles.

A rolled squad that has no player compatible with any remaining empty XI slot
is treated as a dead roll and skipped automatically for free. The four manual
re-rolls are consumed only when the current squad contains at least one valid
signing option and the player chooses to pass.

### Adding coverage

Do not create a new JSON file for each season, edition or production wave.
Research and finalise the edition as an atomic unit, then merge its rows into the
relevant decade shard. If a club-season already exists as a stub, upgrade that
row in place instead of adding another copy.

Source evidence and release notes belong in the single persistent
`docs/COVERAGE-AUDIT.md` file. `docs/CONTENT-TARGET.md` defines the finished
scope and build rules.

Crest/photo fields take URLs; the kit monogram renders as fallback whenever
those fields are null or fail to load.

## Content target and checks

The finished dataset is specified in **docs/CONTENT-TARGET.md**. The goal, in
one line: full rosters for all Serie A seasons from 1929-30 plus every main-draw
participant of all seven European competition families, with all winners,
runners-up and semi-finalists usable as Campaign opposition.

    npm run coverage        # breadth everywhere; real depth where target counts exist
    npm run coverage:next   # next measured incomplete or untouched edition
    npm run validate        # schema, shard, data and gameplay invariants
    npm run build           # production build

Scope is declared in `public/data/coverage-target.json`. Progress is derived
from the live decade shards by `coverage.mjs`. A season being "touched" is not
proof of completion: only scopes with researched `expectedRostersPerEdition`
counts can be measured for real depth.

`validate.mjs` runs in CI on every push and pull request and again before every
deploy. It rejects duplicate IDs and club-seasons, rows in the wrong decade
shard, malformed roles/achievements, reintroduced `tierType`, invalid position
codes and previously adjudicated club-name aliases. Genuinely new near-name
matches remain warnings for human review.

## Progress storage

Player progress is stored in `localStorage` under the `rollxi:` namespace.
Clearing site data resets daily history and Campaign progress.
