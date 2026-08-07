# Roll XI — Content Target

**This file defines the finished state of the Roll XI dataset and the rules for expanding it.**

Machine-readable scope lives in `public/data/coverage-target.json`. Progress is
derived from the live decade shards by `scripts/coverage.mjs`; do not infer
completion from filenames, notes or production history.

## 1. Resume protocol

Before adding or rebuilding content:

1. Run `npm run validate`. Fix structural or gameplay-invariant failures first.
2. Run `npm run coverage` and `npm run coverage:next`.
3. Read the relevant section of `docs/COVERAGE-AUDIT.md` for prior evidence,
   corrections and unresolved caveats.
4. Research the next edition/season as an atomic production unit.
5. Merge the finished rows into the appropriate decade shard(s), never into a
   new edition-specific JSON file.
6. Re-run validation, coverage, rating/duplicate checks and the production
   build before release.

A season being **touched** only means at least one row exists. It is proven
complete only where `coverage-target.json` contains a researched
`expectedRostersPerEdition` count and the required number of roster rows is
present.

## 2. Finished dataset

The target is:

- **Serie A:** every club-season from 1929-30 through 2025-26, excluding
  1943-44, 1944-45 and 1945-46 as decided on 2026-08-07.
- **European Cup / Champions League:** every main-draw participant from 1955-56
  through 2025-26.
- **Cup Winners' Cup:** every main-draw participant from 1960-61 through
  1998-99.
- **Inter-Cities Fairs Cup:** every main-draw participant in all 13 editions.
- **UEFA Cup:** every main-draw participant from 1971-72 through 2008-09.
- **Europa League:** every main-draw participant from 2009-10 through 2025-26.
- **Conference League:** every main-draw participant from 2021-22 through
  2025-26.
- **UEFA Intertoto Cup:** every main-draw participant from 1995 through 2008.

For every European competition, winners, runners-up and losing semi-finalists
must also be usable as Campaign opponents.

The operative definition of **main draw** is the first competition stage after
qualifying/preliminary rounds. Where a competition has a group or league phase,
that is the main draw. In straight-knockout eras, Round 1 proper is the main
draw. Competition-specific notes live in `coverage-target.json`.

## 3. Canonical club-season schema

Every club-season row uses two independent properties.

### 3.1 Depth

- `role: "roster"` means the row has a player list and is draftable in Campaign.
  Its players are also available to Daily and Chains.
- `role: "stub"` means the row has no player list and is not draftable. A stub
  may exist as a historical opponent summary or as a coverage placeholder until
  a full roster is built.

### 3.2 European progress

`achievements[]` records competition participation/progress for that exact
club-season. Canonical stage codes are:

- `W` — winner
- `RU` — runner-up
- `SF` — losing semi-finalist
- `QF` — quarter-finalist
- `R16` — round of 16
- `GROUP` — group/league phase participant
- `MAIN` — main-draw participant where a narrower stage is unknown or not
  applicable

Campaign opponent eligibility is derived only from `W`, `RU` or `SF`.

A roster can therefore be both pickable and faceable. If it is, simulated
scorers are drawn from the full roster with position/rating weighting. A stub
with `GROUP`, `QF`, `R16` or `MAIN` is **not** a Campaign opponent merely by
existing in the database.

### 3.3 Removed legacy schema

The old mutually-exclusive `tierType: "P"/"O"` model has been removed from the
production dataset and runtime. It must not be reintroduced.

On 2026-08-07 the final 26 legacy rows were migrated to explicit achievements:
25 Champions League 2000-01 main-draw placeholders and Manchester City
2018-19. Their real `GROUP`/`QF` stages are retained for coverage, without
inventing `W`/`RU`/`SF` honours simply to preserve old opponent behaviour.

## 4. Canonical storage architecture

Production data is stored in stable **decade shards**:

- `clubs-1950s.json`
- `clubs-1960s.json`
- `clubs-1970s.json`
- `clubs-1980s.json`
- `clubs-1990s.json`
- `clubs-2000s.json`
- `clubs-2010s.json`
- `clubs-2020s.json`

Future Serie A expansion will add `clubs-1920s.json`, `clubs-1930s.json` and
`clubs-1940s.json` only when those decades are first needed.

Each club-season exists **exactly once**. The shard is selected by the season
start year, so `2024-25` belongs in `clubs-2020s.json` and the irregular
`1955-58` Fairs Cup season belongs in `clubs-1950s.json`.

Shard boundaries are storage concerns only. They do not encode competition,
league, pickability, production wave or opponent status.

This replaced the former production-pack layout because the browser already
loads the whole historical dataset for Daily, Chains and Campaign. Stable
shards reduce request/file count and GitHub-web friction without changing the
club-season data model or historical accuracy.

`public/data/index.json` lists only the canonical shards. `loadData()` fetches
them in parallel and merges them into the same runtime pools used by the game.

## 5. Current state after the shard migration

As of 2026-08-07:

- 1,114 club-season rows
- 805 full rosters
- 309 stubs
- 12,816 player-season records
- 8 decade shards
- 474 Campaign-eligible opponents derived from real `W`/`RU`/`SF` achievements
- 191 of those opponents are also pickable rosters and therefore use their full
  roster as the scorer pool

Conference League measured coverage is 40/168 rosters, with 2025-26 proven
complete at 36/36. `coverage:next` should therefore return Conference League
2024-25 until that edition is completed.

## 6. Data conventions

### IDs

IDs are globally unique and stable. Prefer readable club/season identifiers,
for example `ita-roma-2000-01`. Never change an established ID merely because
the row moved between storage files.

### Club names

Use one canonical display name per club across every shard. Previously reviewed
aliases are enforced by `scripts/validate.mjs`. `Dundee` and `Dundee United`
are explicitly recorded as distinct clubs.

### Competition codes

Canonical codes are:

`EC`, `UCL`, `CWC`, `FAIRS`, `UEFA`, `UEL`, `CONFL`, `ITC`.

Deprecated aliases `UECL` and `INT` must not appear in production data.

### Rosters

The release house standard is **16 players** where source coverage supports it,
with at least one goalkeeper. The validator keeps an 11-player hard minimum for
historical compatibility but rebuilt/new release content should target 16.

Ratings remain within 62-97 and should average near 78 at pack/cycle level.
Ratings are gameplay calibration, not claims of an external numerical rating.

Detailed positions should be as historically faithful as evidence supports.
Do not broaden a player's stored `dp` merely to make a formation work. Gameplay
proxies are handled separately in `src/lib/positions.js`.

### Provenance

For every new or rebuilt edition/season, record the source-evidence matrix,
Priority A decisions and release-gate result in the single persistent
`docs/COVERAGE-AUDIT.md` file. Do not create one audit document per edition.

Evidence should prioritise:

1. official competition/club squad and match records;
2. competition-specific appearance tables;
3. independent historical squad/line-up sources for cross-checking identity,
   nationality and position.

Where only a broad position is established, use the generic `DF`, `MF` or `FW`
code rather than inventing a narrower role.

### Dead fields

`decoys`, `tier`, `conf`, `honour` and `tierType` are not part of the current
production schema. `tierType` is rejected as an error; the other dead fields
remain validator warnings if they resurface.

## 7. Production-cycle rules

The **research/finalisation unit** and the **storage file** are separate ideas.

### Serie A

- Work in cycles of at most **five seasons**.
- Build a source-evidence matrix before writing final JSON.
- Validate each club-season against appearances/games played.
- Escalate unresolved Priority A identity/selection cases before release.
- Run cross-cycle duplicate and rating audits.
- Merge the finalised club-season rows into the appropriate decade shard(s).

The earlier C15-C19 attempt demonstrated that larger or rushed batches are too
error-prone. The first pass is draft production, not release.

### European competitions

- Keep each main-draw edition atomic during research and finalisation.
- Do not release a partially researched edition merely to hit an arbitrary row
  count.
- Once finalised, merge every club-season into the relevant decade shard. A
  European edition should not create a new production JSON file.
- If an existing row is a stub, upgrade it in place instead of creating a
  duplicate roster.

## 8. Build recipe for one edition or season

1. Run `npm run validate`.
2. Run `npm run coverage:next`.
3. Confirm the participant count from authoritative sources. If the edition's
   `expectedRostersPerEdition` is unknown, research and add that count to
   `coverage-target.json` before treating completion as measurable.
4. Build a source-evidence matrix in `docs/COVERAGE-AUDIT.md`.
5. Select the 16-player game roster from competition/season participation
   evidence, not reputation or a generic current squad list.
6. Cross-check names, nationalities and positions. Resolve Priority A issues
   before release.
7. Assign gameplay ratings conservatively and audit the mean/range.
8. Merge the row into the correct `clubs-YYYYs.json` shard. Upgrade existing
   stubs in place.
9. Run `npm run validate` and `npm run coverage`.
10. Run the production build. If the environment prevents dependency
    installation, record that as an infrastructure limitation rather than a
    successful build.
11. Append the release-gate result to `docs/COVERAGE-AUDIT.md`.

## 9. Gameplay/data invariants tied to coverage

Coverage work must not break these game rules:

- Pickable roster + `W`/`RU`/`SF` achievement means the same club-season is also
  a Campaign opponent.
- Such an opponent uses the full roster for simulated scorers, with all players
  having non-zero weight and forwards favoured over defenders/goalkeepers.
- CM may proxy to DM and AM; LB/RB may proxy to LM/RM only in 3-5-2 and 3-4-3.
  Rejected blanket proxies must stay rejected.
- A rolled squad with no compatible player for any remaining empty XI slot is
  skipped for free and does not consume a manual re-roll.

These are covered by the validation/regression scripts invoked by
`npm run validate`.

## 10. Priority order

The machine-readable priority order in `coverage-target.json` is authoritative.
At the current state the next measured task is:

1. Conference League 2024-25
2. then the remaining Conference League editions newest to oldest
3. then the other scopes according to their declared priority and researched
   completeness targets

Do not skip to a lower-priority scope merely because its existing breadth
report looks closer to 100%; breadth without expected roster counts is not
proof of completion.
