# ROLL XI · Design document v0.4 (13 June 2026)
Status: app phase COMPLETE (v0.8 live: all three modes, PWA, share cards; B1 opponent index done). Data-depth phase underway. Supersedes v0.3.

A mobile-first football game across the European club game, 1960-2026. Three modes: a daily sticker trivia feeding a Panini-style album, a Champions-League-format campaign built around drafting an XI from rolled squads, and link-up chains.

## 1. Data universe and the two-tier model

Scope of clubs: every main-draw participant (qualifiers excluded) in the European Cup / Champions League, Cup Winners' Cup, Inter-Cities Fairs Cup, UEFA Cup / Europa League, Conference League and UEFA-era Intertoto Cup (1995-2008; the pre-1995 private Intertoto is deferred), plus every Serie A club-season 1960-61 to 2025-26. Estimated ~8,000 club-season rows.

Two depths, shared IDs, upgradeable in place:
- Tier P (pickable): full record. 16-20 players, each [name, position, rating, nationality], kit colours, era crest ref, optional photo refs. Powers squad rolling, trivia, album, chains, named goalscorers.
- Tier O (opponent-only): one line. Club, country, season, competitions entered, one team rating, era crest ref, optional 3-5 named scorers. Powers campaign opposition at correct strength.

Participant lists are web-verified per edition during data sessions, not recalled. Ratings rubric, tiers and confidence flags unchanged (95-99 all-time greats down to 60-69 fringe; conf A/B/C). New per-player field: nationality, era-accurate (West Germany, Yugoslavia, USSR where applicable).

## 2. Crests and stickers

Each club-era carries a crest reference (Wikimedia URL where an era-accurate crest exists) with a guaranteed fallback: a two-tone kit monogram shield rendered locally. Player stickers use a real photo URL where available (populated progressively in data sessions) and otherwise the kit-monogram sticker design. External images render fully in the self-hosted app; trademark/likeness responsibility for any public release sits with the publisher.

## 3. Game modes

### 3.1 Daily sticker trivia (with album)
- Six questions per day, identical for everyone (date-seeded), drawn from the pickable pool, no repeated player within a day.
- Hints shown: nationality, club, season. Answer = tap 1 of 4 names (three distractors, same nationality preferred, then same decade). One attempt per question, progress persisted mid-quiz so a refresh cannot grant retries.
- Each correct answer unlocks that player-season sticker into the album: organised by decade, rarity tiers by rating (Legend 93+, Star 87-92, First XI 80-86, Squad under 80), completion percentages per decade and overall.

### 3.2 Campaign (free play, current UCL format)
- Build your XI: choose a formation (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3), then eleven rounds; each round rolls a pickable squad and shows its full list with ratings; tap one player to sign him for his line. Up to 4 re-rolls total to swap squads. No membership guessing.
- League phase: 36 teams (you plus 35 drawn from the full opponent universe, any competition, any era), 8 matchdays, live table. Top 8 to the round of 16; 9th-24th into the knockout play-off; 25th-36th out.
- Knockouts: two-legged ties; if level on aggregate after the second leg, extra time then penalties (shootout shown kick by kick). Single-leg final.
- Opposition strength rises with the round in knockouts, with seeded room for upsets. Campaign state persists between sessions; one campaign at a time.
- Match presentation: accelerated minute clock, goals appear at their minute with scorer names (yours weighted by position and rating; theirs from their scorer pool or unnamed), score settles only at full time.

### 3.3 Link-up chains
Connect player A to player B through shared squads in the fewest steps. Generated from the pickable pool; daily chain plus free chains.

Proposed extras awaiting approval: a one-player transfer window between knockout rounds; campaign wins earning bonus sticker packs; album page completion bonuses.

## 4. App architecture (chunk A series)

Vite + React, no router dependency, mobile-first, deployable to GitHub Pages. Data shipped as static JSON packs under public/data/, loaded via an index manifest, merged at runtime; localStorage persistence (namespaced, versioned). Pitch chips auto-fit names with no truncation.

```
roll-xi-app/
  package.json · vite.config.js · index.html · README.md
  public/data/index.json · public/data/pack-seed.json
  src/main.jsx · src/App.jsx · src/theme.css
  src/lib/{rng,storage,data,date}.js
  src/components/KitMark.jsx
  src/modes/{Daily,Album,Campaign,Chains}.jsx
```

## 5. Roadmap (one chunk per session)

### A-series (app build) — COMPLETE
- A1: doc, scaffold, seed pack, daily trivia + album.
- A2: campaign league phase (XI builder, table, matchday ticker).
- A3: knockouts, extra time, penalties, campaign persistence.
- A4: link-up chains.
- A5: PWA install (manifest, icons, service worker, offline) + share cards.

### B-series (opponent INDEX — tier-O, web-verified, "clubs that mattered" core)
Each B-chunk indexes finalists + both semi-finalists of a competition as lightweight tier-O rows (one line: club, season, rating, kit, scorers). Breadth across competitions first.
- B1 (done): European Cup / Champions League, 1955-56 to 2025-26. 284 verified club-seasons.
- B2 (done): Cup Winners' Cup, 1960-61 to 1998-99. 78 verified club-seasons (winner + runner-up of all 39 editions) as tier-O rows.
- B3 (done): Fairs Cup (1955-1971) + UEFA Cup (1971-2009) + Europa League (2009-2025). 134 verified club-seasons (winner + runner-up of all 67 editions) as tier-O rows. 2025-26 excluded (in progress).
- B4: Conference League + UEFA-era Intertoto (1995-2008).

### Ultimate data goal (confirmed)
**Most main-draw participants of EVERY European competition (EC/UCL, CWC, Fairs/UEFA, Europa, Conference, Intertoto), from EVERY country, become PICKABLE (tier-P, full 16-20 player rosters).** All Serie A 1960-2026 on top. "Main draw" = proper competition rounds; qualifying-round-only entrants are excluded. Trivia, chains and the album all draw from the pickable pool, so the end state gives all three modes full all-competition, all-country breadth. Scale is large (~8,000-12,000 club-seasons; 150-200+ sessions to complete fully) — this is fine because the two-tier model keeps the game whole at every stage.

### C-series (PICKABLE promotion — tier-P, full rosters) — promotion WAVES
The two-tier model means any tier-O club is promoted to pickable in place without touching the engine. Tier O is the staging pen; tier P is the finished state; clubs move O→P over time. Promotion order = play-value-per-effort (recurrence + recognisability + source availability). **The game is complete and coherent at the end of every wave; there is never a "broken pending data" state.**

- **Baseline (now):** all Serie A 1960-2026 + EC/UCL winners and runners-up.
- **Wave 1 — free promotions:** EC/UCL semi-finalists (already in data from B1; roster-building only, no new indexing). Gives every UCL edition its full final-four as draftable.
- **Wave 2 — other competitions' latter stages:** as B2-B4 index each competition at finalist/SF level, promote those to pickable.
- **Wave 3 — modern main-draw breadth, ALL competitions, ALL countries:** full main-draw fields, most-recent-decade-first (2020s → 2010s → 2000s…). Highest recognisability and source availability.
- **Wave 4 — historic deep tail:** older main-draw fields (1990s back to 1960s), all competitions, all countries. Lowest marginal value-per-row; runs last and open-endedly.

**Planning line:** commit firmly to Baseline + Waves 1-3 as the worth-finishing target (the bulk of play value); treat Wave 4 as indefinite enrichment, dialled up only if appetite remains. Serie A backbone (the C1, C2… "Serie A by decade" sessions) runs in parallel with the Waves as the other long-running pickable strand.

Note: trivia and chains only use tier-P clubs (tier-O rows have no player list), so those two modes get richer strictly as promotion WAVES progress — not as the tier-O index (B-series) grows. The campaign benefits from both tiers immediately.

### Crest and headshot enrichment (progressive, across the Waves)
Crests and headshots are best-effort enrichment, NEVER blockers; the kit-monogram sticker is the permanent fallback so the album never looks broken. They are attached per club-season as rosters are built, and ride alongside the promotion waves:
- **Crests** (the tractable half — Wikimedia Commons, stable URLs): attached during each wave's roster-building, modern-first (cleanest sources). A dedicated catch-up pass ("L-series", e.g. L1 = crests for the EC/UCL + seed packs) can run standalone any time, independent of B/C chunks. Target: full crest coverage tracking the pickable pool roughly one wave behind.
  - Wave 1-2 clubs: crests added as those rosters are built.
  - Wave 3 (modern): crests near-complete on arrival (best source availability).
  - Wave 4 (historic): crests added where stable free images exist; monogram otherwise.
- **Headshots** (the hard half — uneven by era): opportunistic throughout, NOT tied to a wave milestone. Coverage is naturally strong from ~2000s on, patchy 1980s-90s, thin pre-1980. A player gets a photo only when a verified, stable, free image exists for that exact name/era. No "done" point; the monogram remains baseline.
  - Realistically: Wave 3 rosters arrive with substantial photo coverage; Wave 1-2 and Wave 4 (older) rosters stay mostly monogram, enriched over time.

Resume protocol: name the chunk ("continue with C1", "Wave 1", "B2", "L1") in any future session.

## 6. Verification workflow

Unchanged: conf flags on every P-tier squad; spot-check C then B; corrections as "REMOVE name / ADD name POS rating NAT / RERATE name 84 / BADNAT name Country". O-tier rows carry a source note (edition list checked) for auditability.
