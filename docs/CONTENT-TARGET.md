# Roll XI — Content Target

**This file defines the finished state of the Roll XI dataset.**
If you are an AI assistant picking this project up cold, read this file and
then run `node scripts/coverage.mjs`. Between them they tell you the goal and
the current position. You should not need any other context to continue.

Machine-readable scope lives in `public/data/coverage-target.json`.
This file explains it and records the decisions behind it.

---

## 1. Resume protocol

Do these four things, in order, at the start of any session about content:

1. `npm run validate` — must pass with zero errors before touching content.
   Warnings are fine to proceed past (see section 3B), but fix any error
   first; building new packs on top of a broken invariant compounds it.
2. `node scripts/coverage.mjs` — reports breadth for every scope and real
   depth/completeness only where `expectedRostersPerEdition` has been researched
   in `coverage-target.json`. `--next` prefers a measured incomplete edition;
   otherwise it can only point to an untouched breadth gap.
3. Check the **Decisions log** in section 6. All six original decisions are
   resolved as of 2026-08-07. If a new question comes up that isn't covered
   there, resolve it with the project owner and add a row before building.
4. Follow the build recipe in section 7.

Do not infer progress from pack filenames, `index.json` labels, or pack `meta`
notes. Those describe what was built at the time and drift. `coverage.mjs` is
authoritative for the rows that actually exist, but an edition is only proven
complete when the report says its depth is known. A touched season with unknown
depth must never be treated as finished.

---

## 2. The goal

**Playable (full rosters, draftable by the player):**

- Serie A, every club, every season, for the entire history of the competition.
- Every main-draw participant of every edition of: European Cup / Champions
  League, Cup Winners' Cup, Fairs Cup, UEFA Cup, Europa League, Conference
  League, Intertoto Cup.

**Opponents (faceable in Campaign):**

- Every winner, runner-up and losing semi-finalist of every edition of those
  same seven competitions.

---

## 3. The architecture change this forces

**Status: implemented 2026-08-07.** This section records the reasoning for
the schema change and the compatibility layer that still exists for 26 legacy
opponent rows.

Before the migration, the dataset used two mutually exclusive tiers:

- `tierType: "P"` — full roster, draftable.
- `tierType: "O"` — stub (rating, kit, scorer names), opposition only.

That old invariant could not satisfy the finished content target. Winners,
runners-up and semi-finalists are a subset of main-draw participants, so the
same club-season often needs to be both draftable and Campaign opposition. If
promotion to playable had continued to remove the opponent row, Campaign's
opponent pool would have shrunk as coverage improved.

The implemented model therefore separates squad depth from achievement. The
legacy `tierType` field remains only as a compatibility fallback for 26 rows in
`pack-opponents-ucl-main-200001.json` and
`pack-opponents-provisional.json`; it is not the schema for new content.

### The fix

Stop treating playable and opponent as tiers. Treat them as **two independent
properties of one canonical club-season record**:

- **Depth** — does this record carry a player list? (`roster` or `stub`)
- **Achievement** — how far did it go in which competition? This is what
  decides opponent eligibility.

A record with a roster is draftable. A record whose achievements include a
final or semi-final is opponent-eligible. Both can be true at once, and in the
finished dataset they usually will be.

```jsonc
{
  "id": "esp-realmadrid-2001-02",
  "club": "Real Madrid",
  "country": "Spain",
  "league": "ESP",
  "season": "2001-02",
  "kit": ["#FFFFFF", "#00529F"],
  "crest": null,

  "role": "roster",                    // "roster" | "stub"
  "achievements": [
    { "comp": "UCL", "season": "2001-02", "stage": "W" }
  ],

  "rating": 92,                        // stubs need this; rosters derive it
  "scorers": ["Zidane", "Raúl"],       // opponent goal timeline
  "players": [ /* ... */ ]             // present only when role === "roster"
}
```

Opponent eligibility becomes a derived query, not a stored tier:

```js
const opponentEligible = (r) =>
  (r.achievements || []).some((a) => ["W", "RU", "SF"].includes(a.stage));
```

### What this buys you

- The manual de-dup sweep disappears. It was a recurring hand-maintained
  process across nearly every pack note, and it's the single most likely place
  for silent data loss.
- A club-season is authored once, not twice in two formats.
- Campaign opposition no longer shrinks as rosters are added. Under the old
  tier model, promoting a club-season to playable removed it from opposition.
- Stage granularity opens up gameplay you can't currently express: seeding the
  Campaign draw by how far a side actually went, era-locked or
  competition-locked runs, "face the four semi-finalists of 1987-88".

### Migration without breaking the app — as implemented

**Status: done, 2026-08-07 — see section 3C for the full record.** The plan
below is left here as originally written, with one correction, because the
correction matters if this pattern comes up again.

Add a compatibility shim in `src/lib/data.js` that derives the old shape from
the new fields, so nothing downstream changes on day one:

```js
const role = row.role || (row.players?.length ? "roster" : "stub");
const isOpp = row.achievements
  ? row.achievements.some((a) => ["W","RU","SF"].includes(a.stage))
  : row.tierType === "O";

if (role === "roster") squads.push(row);
if (isOpp) oppRows.push(toStub(row));   // a roster can now yield both
```

This part of the plan held up exactly as written and is now the real
implementation in `src/lib/data.js`.

**The one correction**: this section originally continued "...convert existing
packs with a one-off script: `tierType: "P"` → `role: "roster"`, `tierType:
"O"` → `role: "stub"`, `euro[]` and `comps[]` → `achievements[]` with `stage:
"MAIN"` where the stage isn't recorded." That instruction is wrong for O-tier
rows specifically, and following it literally would have been a regression,
not a migration: O-tier rows never had per-row stage data to draw on in the
first place (only a pack-level claim like "winners and runners-up of every
edition"), so defaulting them all to `stage: "MAIN"` would have made every
single one of them fail the `isOpp` check above — the entire 311-row opponent
pool would have silently gone opponent-ineligible the moment this ran, which
is the exact failure this whole migration exists to prevent. What was
actually done: P-tier rows got real stage values, derived from data that
genuinely existed (`honour` text) rather than defaulted; O-tier rows were left
on the `tierType` fallback rather than force-migrated with a wrong default.
See section 3C for the reasoning and what's still deferred.

---

## 3A. Album mode — removed

Decided 2026-08-07: Album mode is out of the game entirely, not deferred. This
was a live decision made mid-project, not part of the original content target,
recorded here because it changes what "finished" means for the dataset.

Why it's relevant to a *content* document: Album was the one mode whose
viability scaled directly with dataset size (145,000 stickers at target, over
60 years to complete at six a day). Removing it removes that constraint. It no
longer needs factoring into loader or rendering work as content grows (see
section 4) — there was previously a three-item list of things that don't
survive scale; it's now two.

What was actually removed, for reference if this needs auditing later:
`src/modes/Album.jsx` deleted; the "album" tab, its `TABS` entry, its home
screen entry point and progress counter, and the `Daily.jsx` → Album handoff
(`onAlbum` prop, "Open the album" button, and the `localStorage["album"]`
write-on-correct-answer) all removed. Daily mode itself is untouched — it still
asks player trivia and still shows a sticker-style result card — it just no
longer persists an album or links to one. README updated to match. Build
verified clean (`npm run build`) with no remaining references.

The `role`/`achievements` schema migration in section 3 is unaffected by this;
`Sticker`/`KitMark` and photo-resolution code stay in place because Daily and
Chains still use them.

---

## 3B. Data audit and fixes — 2026-08-07

This session fixed the two issues raised as "nothing checks the data" and
"the format isn't consistent with itself." What changed, for the record:

- **Validator added**: `scripts/validate.mjs`, wired into CI on every push,
  pull request, and deploy. Checks: duplicate IDs; P/O club-season collisions;
  rosters under 11 players or missing a goalkeeper; deprecated or unknown
  competition codes; packs on disk but missing from `index.json` (or vice
  versa); `index.json` entries missing `name`; missing crest-override
  coverage; and — new, not in the original point-4 list — likely club-name
  spelling variants, as a WARNING requiring human judgement.
- **Competition codes normalised**: `UECL`→`CONFL`, `INT`→`ITC`, across 6
  pack files that still used the deprecated forms. `badges.js` was itself
  keyed by the deprecated codes (`COMPETITIONS.UECL`, `COMPETITIONS.INT`) —
  fixing the data without fixing this would have newly broken Conference
  League and Intertoto badges rather than fixed them. Both `badges.js` and
  `scripts/coverage.mjs` now carry a defensive alias resolver.
- **Dead fields stripped**: `decoys`, `tier`, `conf`, `honour` — 3,076 field
  occurrences removed across every pack.
- **`index.json` fixed**: 5 entries using `label` instead of `name` renamed;
  `pack-opponents-provisional.json` (Manchester City 2018-19, one opponent
  row) was on disk but never listed — it was dead data that never loaded.
  Added.
- **Crest overrides fixed**: the original "9 missing clubs" list turned out to
  be a mix of two different problems on closer check. Three were genuine
  spelling mismatches where the *other* spelling already resolved correctly
  (`Roma`/`AS Roma`, `PSV`/`PSV Eindhoven`, `Sparta Praha`/`Sparta Prague`,
  plus `Heerenveen`/`SC Heerenveen`) — fixed by renaming the single
  minority-spelling occurrence in each case to match the majority, rather than
  growing the override map. Five were genuinely absent from both data and
  map (`besiktas`, `helsingborg`, `rosenborg`, `sturm graz`, `vicenza`) —
  added, flagged unverified per above.
- **Club-name variants resolved 2026-08-07**: the 12 human-review warnings
  were adjudicated and the data canonicalised. Eleven clusters were the same
  club under different display names; `Dundee` and `Dundee United` are genuinely
  different clubs and are now an explicit known-distinct exemption. The
  threshold-missed `Bayern Munich`/`Bayern München` drift was normalised in the
  same pass. `scripts/validate.mjs` now hardens those decisions: known legacy
  aliases are errors if reintroduced, while genuinely new near-matches remain
  warnings for human review. See section 5 for the canonical-name table.

---

## 3C. Schema migration — role + achievements — 2026-08-07

Section 3's proposed fix, implemented. This was order-of-work item 1 —
first, because everything else was going to get more expensive the longer it
waited.

**What changed:**

- Every pack row now carries `role: "roster" | "stub"`, replacing `tierType`
  as the signal for whether a row has players. `tierType` itself is left in
  place (additive migration, nothing deleted) — see "What's still on the old
  schema" below for why it can't be removed yet.
- Every P-tier (roster) row now carries `achievements: [{comp, season, stage}]`
  derived from its `euro` field plus its (now-retired) `honour` text, with a
  real stage — `W`, `RU`, `SF`, or `MAIN` for rows whose only European record
  is participation with no further progress. 753 of 769 rosters were derived
  this way; the 16-row gap is the seed pack, which pre-dates the wave/euro
  tagging system entirely and has no `euro` field to derive from — those got
  `achievements: []`, honestly reflecting that no European record exists in
  the data for them, even though several (Real Madrid 1960-61, Bayern 1973-74,
  and others) are famous European Cup winners in fact. That's a real,
  known gap, not an oversight — see "What's still on the old schema" below.
- `src/lib/data.js` now derives BOTH the draftable pool and the opponent pool
  from `role` and `achievements` (with a `tierType`-based fallback for any row
  not yet migrated), rather than the old either/or split. A roster whose
  achievements include a final or semi-final now also yields a lightweight
  opponent stub at load time (`toStub()`), with its single `rating` number
  synthesised as the average of every listed player's rating.
- **Result, verified by simulating `loadData()` against the live pack data**:
  the opponent pool grew from 311 rows to 498. 187 of those are club-seasons
  that are now BOTH draftable and faceable — Real Madrid's 2020-21 UCL
  semi-final run, for instance, is something the old model could never
  represent, because a single club-season could only ever be `tierType: "P"`
  or `"O"`, never both. This is the actual functional payoff of the
  migration, not just a data-shape exercise.

**How the achievement stage was derived, and where it came from:** the old
`honour` field (stripped from the data as a dead field in section 3B, before
this session) turned out to be the only place per-row European stage
information had ever been recorded, and only for rosters — e.g. `"Champions
League winner 2024-25"` or `"UCL semi-finalist 2010-11"`. Before stripping it
for good, its text was mined once, keyword-matched against the row's own
`euro.comp` (not just matched anywhere in the string — see "Bologna" below for
why that distinction matters), and converted into a real `stage` value. 3 rows
used the word "finalist" without saying "winner" or "runner-up" explicitly
(`AS Roma` UEL 2022-23, `Fiorentina` CONFL 2022-23 and 2023-24) — inferred as
`RU` on the strength of the dataset's own internal convention: every genuine
winner in the entire dataset says "winner" explicitly, with zero exceptions,
so a row that avoids that word while still saying "finalist" is doing so
because it lost. Flagged here as an inference, not a certainty, in case a
future pass wants to verify it against a primary source.

**A parsing trap worth knowing about, in case the same shape recurs:**
Bologna's 2024-25 row has `euro: [{comp: "UCL", ...}]` and honour text
`"Serie A 7th, Coppa Italia winners 2024-25"`. A naive "does the string
contain the word 'winner'" check would have wrongly tagged their Champions
League entry as `W` — the winner text is about the Coppa Italia, an unrelated
domestic cup, not their UCL run (which was just group-stage qualification).
The parser only accepts a stage keyword if it appears in the same
comma-separated clause as a name or abbreviation matching that row's own
`euro.comp` — Bologna's UCL entry correctly resolved to `MAIN`.

A second trap, same root cause in reverse: four rows from the 1991-92 European
Cup (`Bayern München`, `Spartak Moscow`, `Sparta Prague`, `Red Star Belgrade`)
have `euro.comp: "EC"` but honour text reading `"UCL final group stage
1991-92"` — a naming inconsistency in the source text itself, from the season
football was transitioning from the European Cup to the Champions League
brand. The comp-alias list originally only recognised "european cup" for
`EC`; all four rows silently fell through to the `MAIN` default on the first
pass. Caught by manually verifying one of the four before trusting the batch
result rather than assuming a clean run meant a correct one — worth doing
that kind of spot check any time a script processes hundreds of rows in one
pass with no per-row visual confirmation.

**What was on the old schema, and why it wasn't forced initially — since resolved, see section 3D:** O-tier
(opponent-only) rows — 311 of them — got `role: "stub"` but, in this section's
first pass, not an `achievements` array. Every O-tier pack's own `meta.scope`
text claims its rows are collectively "winners and runners-up" (or similar) of
some competition, but that claim was never recorded per-row, only at the pack
level. Assigning real `W`/`RU` stage to 285 individual historical cup finals
from memory would have been exactly the kind of unverified-claim risk this
project has been explicit about avoiding elsewhere (see the `UNVERIFIED`
comment above the five crest overrides added in section 3B) — the constraint
was memory, not principle. **This was corrected the same day**: with actual
web access to RSSSF and Wikipedia, all 285 resolvable rows now carry real,
sourced achievements. See section 3D for the full record, including a real
transcription error the cross-checking caught.

One O-tier pack is a different case entirely and is called out so it isn't
mistaken for an oversight: `pack-opponents-ucl-main-200001.json` was never a
finalist/semi-finalist index — its own `meta.scope` says "main draw / group-
stage participants," full stop. Its 25 rows (plus 1 in
`pack-opponents-provisional.json`) keep functioning as opponents via the
`tierType` fallback, which is correct and intentional — they should NOT be
assigned `W`/`RU`/`SF` achievements, because most of those clubs did not reach
a final or semi-final that season, and claiming otherwise would be wrong, not
just imprecise. If these are ever migrated, they need their own honest
treatment (probably `MAIN`-only achievements, kept opponent-eligible some
other way, or folded into the bulk UCL main-draw content once that's built)
rather than being lumped in with the genuine finalist packs. These 26 rows are
the entire remaining legacy-schema footprint in the dataset.

---

## 3D. O-tier achievement research — 2026-08-07 (same day as 3C)

Section 3C left 311 O-tier rows on the legacy `tierType` fallback because
assigning real stage data from memory was an unverified-claim risk. That
constraint turned out to be about environment access, not something
structural — with web search actually available, this was finished the same
day. Recorded separately from 3C because it's a distinct piece of work with
its own sourcing and its own mistake worth learning from.

**What was done:** every W/RU-eligible O-tier row across
`pack-opponents-cwc.json`, `pack-opponents-uefa.json` (Fairs Cup + UEFA Cup +
Europa League, three competitions sharing one file) and
`pack-opponents-confl-itc.json` (Conference League + Intertoto Cup) — 285 rows
in total — now carries a real `achievements[]` entry with a sourced stage,
not a placeholder. Sourced from:

- Cup Winners' Cup: RSSSF's complete 1961-99 finals table
  (`rsssf.org/ec/ec2stats.html`), one page, all 39 editions.
- Fairs Cup and UEFA Cup/Europa League: RSSSF's combined 1958-2026 finals
  table (`rsssf.org/ec/ec3stats.html`), one page, both competitions plus the
  seam where one becomes the other.
- Conference League: Wikipedia, cross-checked against two independent
  secondary sources for the same five results.
- Intertoto Cup: RSSSF's year-by-year qualifier list
  (`rsssf.org/tablesi/intertoto.html`), which conveniently also confirms the
  2006-2008 format change already documented in the pack's own `meta.scope`
  (11 parallel winners, no runner-up).

The 26 rows in `pack-opponents-ucl-main-200001.json` and
`pack-opponents-provisional.json` were deliberately left untouched — see the
end of section 3C for why; they aren't finalist data and shouldn't be tagged
as if they were.

**How ties were resolved, since most editions before 1998 were two-legged:**
rather than trust which team a source happens to list first, every two-legged
aggregate was computed directly from both legs' scores. Where the aggregate
was level, the away-goals rule or a penalty-shootout result had to be
identified specifically — not assumed — for six UEFA Cup editions (1977, 1980,
1984, 1988, 1992, 1997) and one Fairs Cup edition (1971). Every one of those
seven was cross-checked against the source's own per-club win tallies (e.g.
"Ajax: 1 title" only fits one specific year once the rest of Ajax's UEFA Cup
history is accounted for), rather than accepted on a single reading.

**A transcription error the cross-checking actually caught:** the first pass
had Real Zaragoza and Dinamo Zagreb's Fairs Cup finals transposed — assigning
1963-64 to a Zagreb match that was actually Zaragoza's, and vice versa for
1962-63. Similar-sounding city names (Zaragoza, Spain vs Zagreb, Croatia),
copied by hand from source text into a lookup table. It didn't surface as a
crash or a validator error — the data was internally well-formed, just wrong.
It surfaced because Real Zaragoza's win count came out to 2 against the
source's own stated tally of 1, which forced a recheck. The general lesson,
consistent with the note already in section 3C about the 1991-92 "UCL" vs
"EC" naming trap: **when a script processes a batch of rows in one pass with
no per-row visual confirmation, check the aggregate result against an
independent total the source already provides, not just against the absence
of an error.** A clean run and a correct run are not the same thing.

**One error caught in review, not in the data:** a draft edit briefly set
Braga's 2010-11 Europa League result to `W`. Braga were the losing finalist
that year — FC Porto won, in an all-Portuguese final. The mistake was in
applying a manual fix inconsistently with the very research dict that had the
correct result sitting one line away, not in the research itself. Caught by
re-reading the fix against its own source before moving on, corrected before
this file was written up. Included here rather than quietly fixed, because
"the research was right but a fix touching it wasn't" is exactly the kind of
error that a purely outcome-focused check (does the file build, does the
validator pass) would never catch — both of those stayed green through this
one being wrong.

**Net effect on the dataset**, verified by simulating `loadData()` against the
final data: the opponent pool is 498 rows, of which 472 now carry real
`achievements[]` data (187 derived from rosters, per section 3C, plus 285 from
this pass) and only 26 remain on the legacy `tierType` fallback — exactly the
two packs documented above as deliberately out of scope. That's the entire
gap section 3C left, closed.

---

## 4. Scale, and why it changes the delivery plan

Current density is about 3.1 KB per roster and 0.6 KB per stub.

Rough order-of-magnitude estimate of the target — **these are estimates, not
researched counts, and the first job of any new scope is to replace them with
real numbers**. Revised down from the first pass now that "main draw" is
decided (section 6, #1): the first post-qualifying competition stage. That is
the group/league phase where one exists, and Round 1 proper in straight-knockout
eras; qualifying and preliminary rounds are excluded. This cuts hardest into
the modern competitions, which run large qualifying pyramids ahead of a
fixed-size group or league phase. The pre-1992 knockout competitions are less
affected because only preliminary-round entrants are trimmed from Round 1.

| Scope | Est. club-seasons | Direction of the revision |
|---|---|---|
| EC / UCL main draw 1955-2026 | ~1,600 | Down — 1992-2026 group/league phase is a fixed 32-36 clubs/edition, well below the wider entry list |
| UEFA Cup main draw 1971-2009 | ~2,200 | Slightly down — knockout for most of its life; only 2004-09 group stage and later-era qualifying rounds are trimmed |
| Cup Winners' Cup main draw 1960-1999 | ~1,150 | Slightly down — straight knockout throughout, minor preliminary-round trims only |
| Serie A full history | ~1,700 | Unchanged — not a European scope |
| Europa League main draw 2009-2026 | ~450 | Down sharply — large qualifying pyramid ahead of the group/league phase |
| Intertoto main draw 1995-2008 | ~750 | Roughly unchanged 1995-2005 (no separate qualifying tier); shrinks for 2006-08 under the mini-tournament format |
| Fairs Cup main draw 1955-1971 | ~480 | Barely affected — small, irregular early fields |
| Conference League main draw 2021-2026 | **168** | Exact: 32 group-stage teams in each of 2021-22 to 2023-24; 36 league-phase teams in 2024-25 and 2025-26 |
| **Total, before de-duplicating clubs appearing in two competitions in one season** | **~8,450** | Still approximate outside Conference League |

This is still a placeholder. Confirm real counts scope-by-scope as each one is
researched; do not build packs against this table.

Call it **~9,000 unique club-seasons and ~145,000 player records, around 28 MB
of JSON**. That is a 12x increase on today's 769 rosters and 2.5 MB.

Two parts of the app do not survive that and must be dealt with before the
dataset grows past roughly 2,000 rosters:

**Loading.** `loadData()` fetches every pack in parallel and merges the lot
before any mode can render. At 28 MB that's an unusable cold start on mobile.
Needs: a core pack loaded eagerly, everything else lazy-loaded per mode, and an
index that carries enough summary metadata (club, season, comps, rating) to
drive menus without parsing rosters.

**Pool weighting.** `rollSequence` shuffles the entire roster pool uniformly.
The composition of the dataset therefore dictates the feel of the game. Serie A
is 68% of rosters today; at target it would be ~19%, but the same problem just
moves to whichever scope you build first. Weight the draft by league and era so
content decisions stop leaking into gameplay.

---

## 5. Conventions for new packs

Every new pack must follow these or `npm run validate` will reject it. Run
`npm run validate` before committing any new pack — it's also wired into CI
(`.github/workflows/validate.yml`) on every push and pull request, and into
the deploy workflow, so a bad pack can't reach production either way. It
checks duplicate IDs, P/O collisions, roster shape, competition codes,
`index.json` drift, and crest override coverage; see `scripts/validate.mjs`
for the full list, including the checks it does NOT auto-fix (see "Club
names" below).

**Identity.** `id` is `{country3}-{clubslug}-{season}`, lowercase, no accents,
e.g. `ita-roma-2000-01`. IDs are globally unique across all packs and all
tiers. One club-season, one ID, forever.

**Club names.** Use one canonical display name per club across all packs and
all eras. New near-matches remain a WARNING because a heuristic cannot know
whether two similar names are the same institution. Once a human decision is
made, record it in `scripts/validate.mjs`: rejected aliases become validation
errors, while genuinely distinct near-matches go into the explicit exemption
set. This prevents the same editorial question resurfacing on every run.

The 12 warnings reviewed on 2026-08-07 are now resolved:

| Warning cluster | Decision |
|---|---|
| `Marseille` / `Olympique Marseille` | Same club → canonical `Marseille` |
| `Monaco` / `AS Monaco` | Same club → canonical `AS Monaco` |
| `Deportivo La Coruna` / `Deportivo La Coruña` / `Deportivo` | Same club → canonical `Deportivo La Coruña` |
| `Glasgow Rangers` / `Rangers` | Same club → canonical `Rangers` |
| `FC Porto` / `Porto` | Same club → canonical `FC Porto` |
| `Dundee United` / `Dundee` | **Different clubs** → keep both; validator exemption added |
| `Girondins Bordeaux` / `Bordeaux` | Same club → canonical `Bordeaux` |
| `1.FC Koln` / `Koln` | Same club → canonical `1. FC Köln` |
| `SV Hamburg` / `Hamburg` | Same club → canonical `Hamburger SV` |
| `Real Zaragoza` / `Zaragoza` | Same club → canonical `Real Zaragoza` |
| `VfB Stuttgart` / `Stuttgart` | Same club → canonical `VfB Stuttgart` |
| `Hellas Verona` / `Verona` | Same club → canonical `Hellas Verona` |

The previously documented but threshold-missed `Bayern Munich` / `Bayern
München` drift was resolved in the same pass to canonical `Bayern München`.
The crest override map deliberately keeps legacy aliases as defensive lookup
keys, but pack data must use the canonical display names above.

Any new canonical club name must also resolve in `CREST_PAGE_OVERRIDES` in
`src/lib/crestResolver.js` in the same change, or the crest will fall back to a
live search/monogram path.

**Competition codes.** Canonical set: `EC`, `UCL`, `CWC`, `FAIRS`, `UEFA`,
`UEL`, `CONFL`, `ITC`. `UECL` and `INT` are deprecated aliases — fixed
2026-08-07 across all pack data (see section 3B); `badges.js` and
`scripts/coverage.mjs` also carry a defensive alias resolver so a stray old
code degrades gracefully instead of silently failing a badge lookup, but new
packs should never write the deprecated forms in the first place.

**Role and achievements — use these, not `tierType`.** As of 2026-08-07 every
row carries `role: "roster" | "stub"`; every new pack must set it explicitly
rather than relying on the `tierType`-based fallback in `data.js`, which
exists for legacy rows only. If the row has a real historical stage — it won,
lost a final, or lost a semi-final — record it in `achievements: [{comp,
season, stage}]` with `stage` one of `W`, `RU`, `SF`, `QF`, `R16`, `GROUP`,
`MAIN`. Use `MAIN` for a row whose only known continental record is
participation with no further progress, not as a placeholder for "don't know
yet" — if the true stage is genuinely unknown, leave `achievements` off the
row entirely rather than guessing, the same way O-tier rows were deliberately
left unmigrated in section 3C rather than assigned a fabricated stage.
`achievements` entries determine Campaign opponent eligibility (`W`/`RU`/`SF`
qualify, see `isOpponentEligible()` in `src/lib/data.js`), so getting this
right isn't just bookkeeping — it decides whether the row shows up as
opposition at all.

**Rosters.** 16 players is the house standard. Minimum 11, and at least one
goalkeeper. Ratings are 62-97 with a mean near 78; keep new packs inside that
band or the Campaign difficulty curve shifts under you. 21 existing rosters sit at exactly 11 players: 20 in
`pack-pickable-waveff.json` (1955-56 to 1969-70) and Malmö FF 1978-79 in
`pack-pickable-wavefe.json`. The validator warns on these rather than erroring,
because that may simply be the limit of what's documented for that era; it's
a prompt to double check the source, not necessarily a defect.

**Provenance.** Every **new or rebuilt** pack must carry `meta.source` naming
where the data came from, and `meta.verified: true` only if it was cross-checked
against a second independent source. Where data is unverified, say so explicitly
in `meta.note`. Some legacy packs, including several C-series files and the seed
pack, still lack a top-level `meta` object; do not copy that omission into new
work. The same standard applies to crest overrides: five entries added 2026-08-07
(`besiktas`, `helsingborg`, `rosenborg`, `sturm graz`, `vicenza`) are flagged
`UNVERIFIED` in a comment in `crestResolver.js` because this environment has
no live web access to confirm the Wikipedia page titles — spot-check them
before depending on them.

**Dead fields.** `decoys`, `tier`, `conf` and `honour` were written into packs
but read by nothing in `src/`. Removed from all packs 2026-08-07 (3,076 field
occurrences stripped — see section 3B). Do not reintroduce them by copying an
old pack as a template; if a genuine need for decoy answers or honours
resurfaces, design the field properly and wire it into the code in the same
change, don't let it drift again.

---

## 6. Decisions log

All open decisions from the first draft are now resolved. Recorded here for
provenance; the operative values live in `coverage-target.json`.

| # | Decision | Affects | Resolution |
|---|---|---|---|
| 1 | Does "main draw" mean group/league phase only, or all entrants including qualifying rounds? | Every European scope | **Decided 2026-08-07**: the first competition stage after qualifying/preliminary rounds. Use the group/league phase where one exists; use Round 1 proper in straight-knockout eras. Qualifying and preliminary rounds are excluded. Full per-competition breakdown is in `coverage-target.json` → `mainDrawDefinition`. |
| 2 | Does "entire history of Serie A" start at 1929-30 (first single national round-robin) or 1898? | Serie A scope | **Decided 2026-08-07**: 1929-30. `coverage-target.json` → `scopes[domestic-ita].seasonFrom`. |
| 3 | Are the wartime seasons in scope — Campionato Alta Italia 1944, Divisione Nazionale 1945-46? | Serie A scope, 3 seasons | **Decided 2026-08-07**: excluded permanently. `coverage-target.json` → `scopes[domestic-ita].excludeSeasons`. |
| 4 | Is the pre-1995 International Football Cup in scope, or only the UEFA-run Intertoto from 1995? | Intertoto scope | **Decided 2026-08-07**: pre-1995 excluded permanently, scope begins 1995. `coverage-target.json` → `scopes[euro-itc].seasonFrom`. |
| 5 | What unit should a pack be built at? | Build process, not scope | **Decided 2026-08-07, clarified after C-series review**: European packs target roughly 80-120 club-seasons while keeping editions atomic. Serie A remains one JSON pack per season (~18-20 rows) and is produced in cycles of **at most five seasons**, with finalisation and validation inside the same cycle. See `coverage-target.json` → `packGranularity` and section 6A below. |
| 6 | Album mode — keep, and if so, count player-seasons or unique players? | Album mode | **Decided 2026-08-07**: Album mode is removed from the game entirely (not deferred — code already deleted, see section 3A). This decision is moot as a content question. |

---

### 6A. Decision 5 in full — pack granularity

There are two separate units that must not be conflated: **JSON pack size** and
**production-cycle size**.

For Serie A, one season is one JSON pack, normally about 18-20 club-season rows.
A five-season production cycle therefore contains roughly 90-100 rows **across
five separate pack files**. The earlier wording that described a single
C-series pack as ~90-100 rows was wrong.

The project also learned that throughput is not a quality metric. An earlier
C15-C19 production attempt was error-prone and is superseded. The files now
listed in `index.json` as rebuilt/source-checked are the only C15-C19 versions
to use, subject to the same release checks as every other pack. Future Serie A
production is capped at five seasons per cycle; first-pass production is draft,
not release.

For European competitions, participant count per edition varies too much for a
fixed seasons-per-pack rule. Use roughly 80-120 club-season rows as a packaging
target, but keep each edition atomic:

- Never mix competitions or leagues in one JSON pack.
- Do not split one European edition's main draw across two packs.
- Low-density competitions can combine multiple whole editions to approach the
  target range.
- A high-density edition can stand alone even if it exceeds the range; do not
  add another edition merely to hit a nominal size.
- Serie A stays one JSON pack per season and a maximum of five seasons per
  production cycle.

Every Serie A production cycle requires a source-evidence matrix before JSON is
written, squad validation against appearances/games played, escalation of all
unresolved Priority A cases before packaging, and a cross-batch ratings and
duplicate audit before release.

---

## 7. Build recipe for one pack

1. Run `npm run validate`. Zero errors is a precondition for new content.
2. Run `node scripts/coverage.mjs --next`. If it says **known incomplete**, the
   target has a researched expected roster count and the gap is measurable. If
   it says **untouched; depth target unknown**, research and record the expected
   main-draw roster count before treating the edition as a completeness target.
3. Research the participant list from at least two independent sources. Record
   the sources in `meta.source`, and add/update `expectedRostersPerEdition` in
   `coverage-target.json` when the edition count has been established.
4. Build a source-evidence matrix before writing roster JSON: one row per
   club-season, with participant evidence, squad/appearance source coverage and
   any Priority A uncertainties called out explicitly.
5. Check every club-season against existing IDs. If a record already exists as
   a stub, upgrade that canonical record in place to `role: "roster"`; do not
   create a second club-season row.
6. Build rosters to the 16-player house standard where sources support it.
   Validate selections against appearances/games played rather than relying on a
   remembered or nominal squad list. Unresolved Priority A cases block release.
7. Add `achievements[]` with the correct competition and stage. Main-draw
   participation must be represented honestly; `W`/`RU`/`SF` determines
   Campaign opponent eligibility.
8. Add the pack to `index.json` with `file`, `name` and, where used, `v`.
   `name` is mandatory and the validator enforces it.
9. Ensure every canonical club display name resolves in
   `CREST_PAGE_OVERRIDES`; do not reintroduce an alias already rejected by the
   club-name policy in section 5.
10. Re-run `npm run validate`, `node scripts/coverage.mjs`, and the build. For a
    multi-pack production cycle, run the finalisation pass across the whole
    cycle, including cross-pack duplicate and rating audits, before packaging.

For Serie A specifically: one JSON pack per season, at most five seasons in one
production cycle. Do not treat first-pass generation as release-quality output.

---

## 8. Suggested order of work

Both items 1 and 2 are done now — left struck through with dates so the
history stays legible rather than deleted, per the same convention used
throughout this file.

1. ~~Schema migration to `role` + `achievements`~~ — **done 2026-08-07**, see
   sections 3C-3D. Only 26 legacy opponent rows remain on the `tierType`
   compatibility fallback, deliberately, because they are main-draw stubs rather
   than W/RU/SF achievement rows.
2. ~~Validation script in CI~~ — **done 2026-08-07**, see section 3B and
   `scripts/validate.mjs`.
3. **Conference League pilot** — smallest scope at 5 editions and now the first
   scope with researched depth targets in `coverage-target.json`: 168 required
   main-draw rosters in total. Use it to prove the schema, evidence matrix,
   validation gates and measured coverage end to end. `coverage --next` now
   points here as a known incomplete scope rather than skipping it merely because
   every season had at least one finalist row. This is the next item.
4. **Loader rework** (section 4), before passing ~2,000 rosters.
5. **Then bulk content**, in the priority order set in `coverage-target.json`:
   Conference League, EC/UCL, Serie A, Europa League, Cup Winners' Cup, UEFA
   Cup, Fairs Cup, Intertoto.
