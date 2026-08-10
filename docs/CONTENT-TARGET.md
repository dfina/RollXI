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

Ratings use the repository-wide `absolute-v3` model and remain within 62-97.
There is no pack/cycle target mean. Weak/minnow squads may legitimately average in
the high 60s or low 70s, while elite squads may average above 80. Player ratings
must also be meaningfully distributed within every playable roster: for rosters of
12+ players the validator requires a range of at least 6 points, standard
deviation of at least 2, at least 5 distinct rating values, and no single exact
rating may account for more than 40% of the roster. A squad averaging below 75
must also contain at least one sub-70 player. These are hard repository gates,
not expansion-only heuristics.
Ratings are gameplay calibration, not claims of an external numerical rating.

When rebuilding legacy content, preserve the existing player hierarchy where it
contains useful information, but do not preserve an inflated absolute floor merely
for continuity. `npm run ratings:recalibrate` applies the one-time v3 migration and
`npm run ratings:check` verifies that all playable rosters remain compliant.

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

## 8. Coverage-production workflow

Coverage expansion uses an **exception-driven production pipeline**. The goal is
to automate repetitive candidate assembly while preserving human judgement on
identity, selection, position and source conflicts.

### 8.1 Prepared source matrix

Before writing a decade shard, create a machine-readable JSON matrix outside the
production data directory. The canonical schema is `rollxi-coverage-matrix-v1`.
A European edition should contain the full main-draw field and record the
authoritative participant/results sources once, plus appearance and identity
sources for each club.

Minimal shape:

```json
{
  "schema": "rollxi-coverage-matrix-v1",
  "status": "draft",
  "edition": {
    "scopeId": "euro-confl",
    "competition": "CONFL",
    "season": "2024-25"
  },
  "sources": {
    "participants": "authoritative participant source",
    "results": "authoritative results/stage source"
  },
  "clubs": [
    {
      "club": "Example FC",
      "country": "Exampleland",
      "league": "EXA",
      "stage": "MAIN",
      "kit": ["#111111", "#ffffff"],
      "sources": {
        "appearances": "competition-specific appearances source",
        "identity": "identity/nationality/position cross-check source"
      },
      "players": [
        {
          "n": "Example Player",
          "nat": "Exampleland",
          "p": "MF",
          "dp": ["CM"],
          "r": 78,
          "competition": { "minutes": 720, "apps": 9, "starts": 8 },
          "registered": true
        }
      ]
    }
  ]
}
```

`expectedParticipants` can be supplied explicitly in `edition` only where the
relevant target is not yet researched. If `coverage-target.json` already has a
count for that edition, that count is authoritative and a conflicting matrix
value is a release blocker.

`competition` statistics refer to the competition proper, excluding qualifying
where qualifying is out of scope. `season` statistics may be supplied for
verified registered players who did not appear in the competition proper and
are needed as controlled fallbacks when fewer than 16 participants are
documented.

### 8.2 Candidate generation

Run:

```text
npm run coverage:prepare -- --input /path/to/source-matrix.json
```

The helper in `scripts/prepare-coverage.mjs`:

1. ranks competition participants by minutes, then appearances and starts;
2. selects a 16-player candidate roster and guarantees a goalkeeper where the
   evidence pool contains one;
3. uses verified registered/season-squad fallbacks only when fewer than 16
   competition participants are available;
4. matches player names against the existing Roll XI database and reuses
   unanimous nationality/broad-position identity metadata when the matrix omits
   it; if only a broad current-season position is established, it keeps the
   generic `DF`/`MF`/`FW` detailed code rather than borrowing a narrower role
   from another season;
5. flags conflicts instead of silently overriding sourced values;
6. detects an existing club-season and classifies the action as add, stub
   upgrade or roster replacement;
7. calculates the projected edition coverage delta; and
8. writes a draft JSON plus a human-readable exception report to the
   gitignored `coverage-work/` directory.

The 16-player cut is a candidate, not an automatic historical verdict. A close
16th/17th participation cut-off is surfaced for review. Human judgement can
override the mechanical cut cleanly with `selection: "include"` or
`selection: "exclude"` on individual source-matrix players; the underlying
appearance statistics must not be altered merely to force a preferred roster.

### 8.3 Exception-driven human review

Research effort should concentrate on reported exceptions rather than repeating
full manual checks for every straightforward roster.

Release blockers include missing participants, fewer than 16 eligible players,
no goalkeeper, duplicate identities, missing final ratings/positions/nationality,
missing source references and ID collisions.

Priority A exceptions include cases such as fewer than 16 competition-proper
participants, replacement of an existing full roster, and nationality/identity
ambiguities. Ordinary season-to-season positional drift is surfaced as Priority
B rather than blocking production automatically. A Priority A exception may be acknowledged only after
human review by adding its exact code to `reviewedExceptions` on that club (or
at matrix level for edition-wide issues). The report retains the exception as
`A-REVIEWED` so the decision remains visible.

Priority B findings, such as a close participation cut-off or an unusual rating
mean, are review prompts rather than automatic release blockers.

### 8.4 Final application

After the candidate roster has been reviewed, positions/nationalities are
resolved and ratings are final, set `status` to `"final"` and run:

```text
npm run coverage:apply -- --input /path/to/source-matrix.json
```

`--apply` refuses to edit production data if any release blocker or unreviewed
Priority A exception remains. When clear, it upgrades existing stubs in place
and merges the final rows into the correct decade shard. It never creates a
season-specific production pack.

The generated report also contains a compact audit block to append or adapt in
`docs/COVERAGE-AUDIT.md`. The source matrix and generated draft/report are
working files and should not be committed; `coverage-work/` is gitignored.

### 8.5 Release gate

After applying an edition/season:

1. run `npm run validate`;
2. run `npm run coverage` and confirm the edition reaches its researched target;
3. inspect duplicate/identity and rating exceptions from the production report;
4. run the production build;
5. append the source-evidence decisions and release result to
   `docs/COVERAGE-AUDIT.md`.

For Serie A, the same helper may be used season by season inside the existing
five-season maximum production cycle. The five-season cap and cross-cycle audit
remain in force.

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
