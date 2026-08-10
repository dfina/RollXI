Roll XI — Coverage and Data Audit
This is the persistent evidence and migration log for coverage work. New editions
and rebuilds should append sections here rather than creating additional audit
files. `docs/CONTENT-TARGET.md` remains the normative specification; this file
records how particular data was researched, corrected and released.
2026-08-07 — Exception-driven coverage-production tooling
A reusable production helper was added at `scripts/prepare-coverage.mjs` before
starting the next European coverage edition. The purpose is to preserve the
2025-26 Conference League evidence standard while removing repetitive manual
roster assembly.
The helper consumes a `rollxi-coverage-matrix-v1` source matrix, ranks
competition-proper participation by minutes/appearances/starts, enforces a
goalkeeper, uses verified registered fallbacks only where necessary, reuses
unambiguous nationality/broad-position identity metadata, reconciles stubs,
calculates projected coverage and emits Priority A/B exceptions. Detailed
positions stay current-season evidence-led; where only a broad role is known,
the generic role code is retained rather than copied from another season. Human selection overrides are
explicit (`selection: "include"` / `"exclude"`) and never rewrite source
appearance statistics.
Production writes are deliberately gated. `coverage:apply` requires
`status: "final"`, authoritative participant/results sources, club-level
appearance and identity sources, 16 eligible players, a goalkeeper, final
ratings/positions/nationalities, and no unreviewed Priority A issue. Working
drafts/reports live in gitignored `coverage-work/`; the persistent evidence
record remains this file. The helper's self-test is part of `npm run validate`.
Implementation release gate: `npm run validate` passes with zero data errors
and all scorer, formation/dead-roll and coverage-production regression checks
green. Coverage state itself is unchanged; Conference League 2024-25 remains
the next measured gap.
2026-08-07 — Canonical decade-shard migration
The former production-wave/competition pack layout was consolidated into stable
decade shards. No club-season row was dropped or duplicated during the storage
migration.
Release state after migration:
1,114 club-season rows across 8 shards;
805 full rosters and 309 stubs;
12,816 player-season records;
every row stored exactly once in the shard matching its season start year;
`tierType` removed from all 1,114 rows and from runtime logic;
`index.json` changed from a production-pack manifest to a decade-shard manifest;
validation now rejects wrong-shard placement, duplicate club-seasons and any
reintroduced `tierType`.
The final 26 legacy rows that previously relied on `tierType: "O"` were migrated
to explicit `achievements[]` without inventing finalist honours. Manchester City
2018-19 and Arsenal, Deportivo La Coruña, Galatasaray and Manchester United
2000-01 are recorded as UCL quarter-finalists. The other 21 UCL 2000-01
placeholder rows are recorded as group-stage participants. Because none of these
26 rows has `W`, `RU` or `SF`, they no longer enter Campaign opposition through a
legacy fallback. This reduces the opponent pool to the historically intended
`W`/`RU`/`SF` set while retaining the rows for coverage accounting.
The eight canonical files created were `clubs-1950s.json` through
`clubs-2020s.json`. Future Serie A work may add `clubs-1920s.json`,
`clubs-1930s.json` and `clubs-1940s.json` when first needed.
Migration release gate:
old/new ID sets: 1,114/1,114 and identical;
no row-content changes beyond removal of `tierType` and the intended 26
explicit achievement migrations;
zero duplicate club-seasons;
`npm run validate`: zero errors and zero warnings;
scorer regression: 191 overlapping pickable opponents use their full rosters;
Campaign opponent pool after removing the inaccurate legacy fallback: 474;
`coverage:next`: Conference League 2024-25, `clubs-2020s.json`;
production build could not be executed in this environment because Vite is
not installed (`vite: not found`).
Pre-migration production metadata snapshot
The old files are intentionally deleted after consolidation. Their top-level
metadata is preserved below so source/provenance notes remain recoverable from
the repository without restoring dozens of production files.
```json
[
  {
    "file": "pack-opponents-confl-itc.json",
    "rows": 72,
    "meta": {
      "name": "Conference League + UEFA Intertoto Cup — finalists index (tier-O)",
      "competitions": [
        "CONFL",
        "ITC"
      ],
      "scope": "Conference League: winner + runner-up all 5 editions 2021-22 to 2025-26. Intertoto: winner + runner-up of each final 1995-2005 (2-3 finals per year); outright winner only for 2006-2008 (format changed to 11 parallel finals, no traditional runner-up designation).",
      "source": "Wikipedia finals, UEFA.com, aworldofsoccer.com, RSSSF, cross-checked",
      "verified": true,
      "note": "2025-26 Conference League final (Crystal Palace 1-0 Rayo Vallecano) independently confirmed 2026-08-07 via live Wikipedia fetch, superseding the earlier \"user context, not independently verified\" status.",
      "achievementsAdded": "2026-08-07: per-row achievements[] (stage W/RU) added for all 74 rows — Conference League from Wikipedia, Intertoto Cup winners-per-year from RSSSF (rsssf.org/tablesi/intertoto.html); non-winning Intertoto entries assigned RU by elimination within each year, since the pack itself only ever holds winner+runner-up pairs for 1995-2005. 2006-2008 Intertoto entries correctly carry no RU (11 parallel winners, no runner-up concept, per the pack's existing scope note). See docs/CONTENT-TARGET.md section 3D."
    }
  },
  {
    "file": "pack-opponents-cwc.json",
    "rows": 78,
    "meta": {
      "name": "European Cup Winners' Cup — finalists index (tier-O)",
      "competition": "CWC",
      "scope": "Winner and runner-up of every edition 1960-61 to 1998-99",
      "source": "aworldofsoccer.com year-by-year + Wikipedia finals, cross-checked",
      "verified": true,
      "achievementsAdded": "2026-08-07: per-row achievements[] (stage W/RU) added for all 78 rows, derived from RSSSF (rsssf.org/ec/ec2stats.html) full finals table, cross-checked against the same source's own winners-by-club and runners-up-by-club tallies. See docs/CONTENT-TARGET.md section 3D."
    }
  },
  {
    "file": "pack-opponents-ec-ucl.json",
    "rows": 0,
    "meta": {
      "name": "European Cup / Champions League — finalists & semi-finalists",
      "source": "myfootballfacts.com (finals + semi-finals), cross-checked vs Wikipedia",
      "verified": true,
      "scope": "Winner, runner-up and both semi-finalists of every edition 1955-56 to 2025-26",
      "comps": [
        "EC",
        "UCL"
      ],
      "note": "Tier-O staging index. Promoted finalists/SFs removed as they became pickable (global O/P de-dup sweep, 14 Jun 2026). Trends toward empty as promotion completes."
    }
  },
  {
    "file": "pack-opponents-provisional.json",
    "rows": 1,
    "meta": {
      "name": "Residual unique opponents (post-B-series)",
      "note": "Former campaign-testing placeholder. The B-series verified indexes have landed, so all covered/promoted rows were removed (14 Jun 2026). Only club-seasons unique to this pack and absent from the verified indexes remain.",
      "provisional": false
    }
  },
  {
    "file": "pack-opponents-ucl-main-200001.json",
    "rows": 25,
    "meta": {
      "scope": "UEFA Champions League 2000-01 main draw / group-stage participants not already represented as P/O",
      "source": "UEFA official season clubs page"
    }
  },
  {
    "file": "pack-opponents-uefa.json",
    "rows": 133,
    "meta": {
      "name": "Inter-Cities Fairs Cup / UEFA Cup / Europa League — finalists index (tier-O)",
      "competitions": [
        "FAIRS",
        "UEFA",
        "UEL"
      ],
      "scope": "Winner and runner-up of every edition: Fairs Cup 1955-1971, UEFA Cup 1971-2009, Europa League 2009-2025 (2025-26 in progress, excluded)",
      "source": "rsssf.org + aworldofsoccer.com + Wikipedia finals, cross-checked",
      "verified": true,
      "note": "2025-26 Europa League final (Aston Villa 3-0 Freiburg, Istanbul) independently confirmed 2026-08-07 via live Wikipedia/RSSSF fetch, superseding the earlier \"user-supplied, not independently verified\" status.",
      "achievementsAdded": "2026-08-07: per-row achievements[] (stage W/RU) added for all 133 rows — Fairs Cup and UEFA Cup/Europa League finals both sourced from RSSSF (rsssf.org/ec/ec3stats.html), cross-checked against that source's own club/country win tallies. One transcription error caught and corrected during cross-checking: the 1962-63 and 1963-64 Fairs Cup finalists (Dinamo Zagreb vs Real Zaragoza) had been transposed between seasons in the first pass. See docs/CONTENT-TARGET.md section 3D."
    }
  },
  {
    "file": "pack-pickable-c1.json",
    "rows": 19,
    "meta": {
      "name": "C1 — Serie A 2024-25 (all 20 clubs)",
      "wave": "C1",
      "note": "Complete. All 20 Serie A 2024-25 clubs pickable — 19 rosters built this wave (Inter 2024-25 was already in Wave Fa). Napoli champion (4th title); relegated: Empoli, Venezia, Monza. UCL qualifiers: Napoli/Inter/Milan/Atalanta/Juventus. Sources: official club sites, AC Milan lineup archives, Wikipedia season articles, ESPN match sheets for confirmed XIs. All squads web-verified. Nationality corrections applied post-build for Retegui→Atalanta, Di Gregorio→Juventus, Buongiorno→Napoli, Vojvoda→Como, Luperto/Marin→Cagliari.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-c10.json",
    "rows": 20,
    "meta": {
      "id": "pack-pickable-c10",
      "name": "C10: Serie A 2015-16 (all non-duplicated clubs)",
      "source": "C-series five-season batch; public roster/stat spot checks; human validation gate for Priority A issues"
    }
  },
  {
    "file": "pack-pickable-c11.json",
    "rows": 19,
    "meta": {
      "id": "pack-pickable-c11",
      "name": "C11: Serie A 2014-15 (all non-duplicated clubs)",
      "source": "C-series five-season batch; public roster/stat spot checks; human validation gate for Priority A issues"
    }
  },
  {
    "file": "pack-pickable-c12.json",
    "rows": 20,
    "meta": {
      "id": "pack-pickable-c12",
      "name": "C12: Serie A 2013-14 (all non-duplicated clubs)",
      "source": "C-series five-season batch; public roster/stat spot checks; human validation gate for Priority A issues"
    }
  },
  {
    "file": "pack-pickable-c13.json",
    "rows": 20,
    "meta": {
      "id": "pack-pickable-c13",
      "name": "C13: Serie A 2012-13 (all non-duplicated clubs)",
      "source": "C-series five-season batch; public roster/stat spot checks; human validation gate for Priority A issues"
    }
  },
  {
    "file": "pack-pickable-c14.json",
    "rows": 20,
    "meta": {
      "id": "pack-pickable-c14",
      "name": "C14: Serie A 2011-12 (all non-duplicated clubs)",
      "source": "C-series five-season batch; public roster/stat spot checks; human validation gate for Priority A issues"
    }
  },
  {
    "file": "pack-pickable-c15.json",
    "rows": 20,
    "meta": null
  },
  {
    "file": "pack-pickable-c16.json",
    "rows": 19,
    "meta": null
  },
  {
    "file": "pack-pickable-c17.json",
    "rows": 20,
    "meta": null
  },
  {
    "file": "pack-pickable-c18.json",
    "rows": 20,
    "meta": null
  },
  {
    "file": "pack-pickable-c19.json",
    "rows": 19,
    "meta": null
  },
  {
    "file": "pack-pickable-c2.json",
    "rows": 20,
    "meta": {
      "name": "C2 — Serie A 2023-24 (all 20 clubs)",
      "wave": "C2",
      "note": "Complete. All 20 Serie A 2023-24 clubs pickable (all 20 built this wave — no prior 2023-24 Italian squads in the system). Inter champions (94 pts, 20th Scudetto); relegated: Sassuolo, Frosinone, Salernitana. Post-build corrections: Frattesi removed from Sassuolo (moved to Inter summer 2023); Colombo/Marin/Walukiewicz cross-squad duplication resolved; Tameze at Torino not Hellas Verona; Arnautovic at Inter not Bologna; Atalanta 2023-24 O/P overlap vs UEFA pack removed. Updated appender now cleans O/P overlaps from ALL opponent packs. O/P overlap = 0, P/P dups = 0.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-c20.json",
    "rows": 19,
    "meta": null
  },
  {
    "file": "pack-pickable-c21.json",
    "rows": 19,
    "meta": null
  },
  {
    "file": "pack-pickable-c22.json",
    "rows": 18,
    "meta": null
  },
  {
    "file": "pack-pickable-c23.json",
    "rows": 15,
    "meta": null
  },
  {
    "file": "pack-pickable-c24.json",
    "rows": 18,
    "meta": null
  },
  {
    "file": "pack-pickable-c25.json",
    "rows": 18,
    "meta": null
  },
  {
    "file": "pack-pickable-c3.json",
    "rows": 18,
    "meta": {
      "name": "C3 — Serie A 2022-23 (all 20 clubs)",
      "wave": "C3",
      "note": "Complete. All 20 Serie A 2022-23 clubs pickable (18 built this wave — Inter and AC Milan 2022-23 already in Wave Fa/1a from UCL semi-final appearances). Napoli scudetto season under Spalletti, 90 pts, their 3rd title. Relegated: Spezia, Cremonese, Sampdoria. Post-build corrections: De Ketelaere at Milan not Cremonese; Simeone/Barak/Provedel/Ricci/Caputo all moved clubs summer 2022 — correct placements applied. Castrovilli at Fiorentina not Verona. Updated appender cleared Fiorentina (UECL) and Roma (UEL) from tier-O. O/P overlap = 0, P/P dups = 0.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-c4.json",
    "rows": 20,
    "meta": {
      "name": "C4 — Serie A 2021-22 (all 20 clubs)",
      "wave": "C4",
      "note": "Complete. All 20 Serie A 2021-22 clubs pickable (all 20 built this wave). AC Milan champions (19th Scudetto, first in 11 years, Pioli). Relegated: Venezia, Cagliari, Genoa. Post-build corrections: Vlahović removed from Fiorentina (moved to Juve Jan 2022); Locatelli removed from Sassuolo (moved to Juve summer 2021); Zaccagni removed from Hellas Verona (moved to Lazio Jan 2022); Boulaye Dia removed from Salernitana (already in Villarreal wave1a). O/P overlap = 0, P/P dups = 0.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-c5.json",
    "rows": 20,
    "meta": {
      "pack": "C5: Serie A 2020-21",
      "sourceNotes": [
        "Built as C-series five-season rolling batch; participant skeleton checked against Transfermarkt/WorldFootball and player pools checked against FBref/WorldFootball/Transfermarkt where available.",
        "Ratings are game calibration judgements derived from role, team finish and statistical prominence."
      ],
      "skippedAlreadyPickable": []
    }
  },
  {
    "file": "pack-pickable-c6.json",
    "rows": 20,
    "meta": {
      "pack": "C6: Serie A 2019-20",
      "sourceNotes": [
        "Built as C-series five-season rolling batch; participant skeleton checked against Transfermarkt/WorldFootball and player pools checked against FBref/WorldFootball/Transfermarkt where available.",
        "Ratings are game calibration judgements derived from role, team finish and statistical prominence."
      ],
      "skippedAlreadyPickable": []
    }
  },
  {
    "file": "pack-pickable-c7.json",
    "rows": 20,
    "meta": {
      "pack": "C7: Serie A 2018-19",
      "sourceNotes": [
        "Built as C-series five-season rolling batch; participant skeleton checked against Transfermarkt/WorldFootball and player pools checked against FBref/WorldFootball/Transfermarkt where available.",
        "Ratings are game calibration judgements derived from role, team finish and statistical prominence."
      ],
      "skippedAlreadyPickable": []
    }
  },
  {
    "file": "pack-pickable-c8.json",
    "rows": 19,
    "meta": {
      "pack": "C8: Serie A 2017-18",
      "sourceNotes": [
        "Built as C-series five-season rolling batch; participant skeleton checked against Transfermarkt/WorldFootball and player pools checked against FBref/WorldFootball/Transfermarkt where available.",
        "Ratings are game calibration judgements derived from role, team finish and statistical prominence."
      ],
      "skippedAlreadyPickable": [
        "AS Roma"
      ]
    }
  },
  {
    "file": "pack-pickable-c9.json",
    "rows": 19,
    "meta": {
      "pack": "C9: Serie A 2016-17",
      "sourceNotes": [
        "Built as C-series five-season rolling batch; participant skeleton checked against Transfermarkt/WorldFootball and player pools checked against FBref/WorldFootball/Transfermarkt where available.",
        "Ratings are game calibration judgements derived from role, team finish and statistical prominence."
      ],
      "skippedAlreadyPickable": [
        "Juventus"
      ]
    }
  },
  {
    "file": "pack-pickable-confl-2526.json",
    "rows": 36,
    "meta": {
      "name": "Conference League 2025-26 — complete league phase",
      "source": "UEFA official league-phase participant list and final results; ESPN 2025-26 UEFA Conference League competition-specific squad/appearance pages; UEFA/team season-squad cross-checks. See docs/CONFL-AUDIT-2025-26.md.",
      "verified": true,
      "note": "36/36 league-phase clubs. Sixteen-player rosters prioritise competition-proper appearances. Generic DF/MF/FW detailed-position codes are used where accessible sources do not establish a narrower sub-role; no narrow role is invented."
    }
  },
  {
    "file": "pack-pickable-current.json",
    "rows": 1,
    "meta": {
      "name": "Reigning European champions (pickable)",
      "note": "User-supplied 2025-26 results, beyond assistant Jan 2026 knowledge cutoff and not independently verified. PSG roster from knowledge as of early 2026.",
      "userSupplied": true
    }
  },
  {
    "file": "pack-pickable-wave1a.json",
    "rows": 12,
    "meta": {
      "name": "Wave 1a — EC/UCL semi-finalists 2020-21 to 2025-26 (pickable)",
      "wave": "1a",
      "note": "Promotes 12 modern UCL semi-finalist club-seasons from tier-O to full pickable squads. Spines cross-checked vs Wikipedia/UEFA; built mostly from knowledge.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wave1b.json",
    "rows": 19,
    "meta": {
      "name": "Wave 1b — EC/UCL semi-finalists 2010-11 to 2019-20 (pickable)",
      "wave": "1b",
      "note": "Promotes 19 2010s UCL semi-finalist club-seasons to full pickable squads. Monaco 2016-17 already in seed pack. Spines cross-checked; decoys auto-selected from era/league reserves.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wave1c.json",
    "rows": 20,
    "meta": {
      "name": "Wave 1c — EC/UCL semi-finalists 2000-01 to 2009-10 (pickable)",
      "wave": "1c",
      "note": "Promotes 20 2000s UCL semi-finalist club-seasons to full pickable squads. Spines cross-checked; decoys auto-selected from era/league reserves.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wave1d.json",
    "rows": 20,
    "meta": {
      "name": "Wave 1d — EC/UCL semi-finalists 1990-91 to 1999-00 (pickable)",
      "wave": "1d",
      "note": "Promotes 20 1990s EC/UCL semi-finalist club-seasons to full pickable squads. Western sides conf B; Eastern-European/smaller-nation sides conf C (spine accurate, fringe approximate). Decoys auto-selected from era/league reserves.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wave1e.json",
    "rows": 20,
    "meta": {
      "name": "Wave 1e — European Cup semi-finalists 1980-81 to 1989-90 (pickable)",
      "wave": "1e",
      "note": "Promotes 20 1980s European Cup semi-finalist club-seasons to full pickable squads. Famous sides conf B; smaller-nation sides conf C (spine accurate, fringe approximate). Decoys auto-selected from era/league reserves.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wave1f.json",
    "rows": 20,
    "meta": {
      "name": "Wave 1f — European Cup semi-finalists 1970-71 to 1979-80 (pickable)",
      "wave": "1f",
      "note": "Promotes 20 1970s European Cup semi-finalist club-seasons to full pickable squads. Famous sides conf B; smaller-nation sides conf C (spine accurate, fringe approximate). Saint-Étienne 1974-75 spine web-verified; 1975-76 already in seed pack. Decoys auto-selected from era/league reserves.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wave1g.json",
    "rows": 30,
    "meta": {
      "name": "Wave 1g — European Cup semi-finalists 1955-56 to 1969-70 (pickable)",
      "wave": "1g",
      "note": "Promotes 30 1950s-60s European Cup semi-finalist club-seasons to full pickable squads, completing the entire EC era. Documented giants conf B; deep-tail sides conf C (spine accurate, fringe approximate). Busby Babes spine web-verified. Decoys auto-selected from era/league reserves.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wavefa.json",
    "rows": 20,
    "meta": {
      "name": "Wave Fa — EC/UCL finalists (winners + runners-up) 2015-16 to 2025-26 (pickable)",
      "wave": "Fa",
      "note": "Corrective promotion: makes the two finalists of each recent UCL edition draftable (Wave 1 had promoted only losing semi-finalists). 2024-25 & 2025-26 PSG/Arsenal user-supplied beyond Jan 2026 cutoff.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wavefb.json",
    "rows": 19,
    "meta": {
      "name": "Wave Fb — EC/UCL finalists (winners + runners-up) 2004-05 to 2014-15 (pickable)",
      "wave": "Fb",
      "note": "Corrective promotion continued (2000s/early-2010s finalists). Some winners already pickable via seed (Barca 08-09, Bayern 12-13, Inter 09-10).",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wavefc.json",
    "rows": 26,
    "meta": {
      "name": "Wave Fc — EC/UCL finalists (winners + runners-up) 1990-91 to 2003-04 (pickable)",
      "wave": "Fc",
      "note": "Complete. All 13 editions 1991-92 to 2003-04 have both finalists pickable, each web-verified per edition (BDFutbol / Wikipedia / UEFA / club sources). 1990-91 winner Red Star Belgrade built as template; 1990-91 runner-up Marseille and 1998-99 winner Manchester United are pickable via the seed pack. Every promoted club-season was removed from the EC/UCL tier-O index in the same pass; global O/P de-dup re-run with zero overlap.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wavefd.json",
    "rows": 20,
    "meta": {
      "name": "Wave Fd — EC/UCL finalists (winners + runners-up) 1980-81 to 1989-90 (pickable)",
      "wave": "Fd",
      "note": "Complete. All 10 editions 1980-81 to 1989-90 have both finalists pickable, each web-verified per edition (final match sheets, BDFutbol / Wikipedia / UEFA / club sources). Every promoted club-season removed from the EC/UCL tier-O index in the same pass; global O/P de-dup re-run with zero overlap. Eastern European sides (Steaua, Benfica) carry conf C where squad depth beyond the final XI is less documented.",
      "verified": true
    }
  },
  {
    "file": "pack-pickable-wavefe.json",
    "rows": 18,
    "meta": {
      "name": "Wave Fe — EC/UCL finalists (winners + runners-up) 1970-71 to 1979-80",
      "wave": "Fe",
      "note": "Complete. All 10 editions 1970-71 to 1979-80 have both finalists pickable (18 rosters built this wave; Bayern Munich 1973-74 and Saint-Étienne 1975-76 were already pickable). Each web-verified per edition via final match sheets. Every promoted club-season removed from EC/UCL tier-O in the same pass; O/P overlap = 0. 2026-08-07: Malmö FF 1978-79 expanded from 11 to 16 players; Tore Cervin and two positional classifications corrected. See docs/ROSTER-AUDIT-2026-08-07.md.",
      "verified": true,
      "source": "2026-08-07 Malmö FF 1978-79 depth rebuild: Malmö FF official European Cup retrospective and DFB Datencenter competition squad, cross-checked against the existing finalist match-sheet research."
    }
  },
  {
    "file": "pack-pickable-waveff.json",
    "rows": 29,
    "meta": {
      "name": "Wave Ff — EC finalists 1955-56 to 1969-70",
      "wave": "Ff",
      "note": "Complete. All 15 editions 1955-56 to 1969-70 have both finalists pickable (29 rosters built this wave; Inter 1964-65 was already pickable). Web-verified per edition via final match sheets (Real Madrid official site, Transfermarkt, The Celtic Wiki, Inter.it, AC Milan official, Wikipedia). Every promoted club-season removed from EC/UCL tier-O in the same pass. EC/UCL tier-O index is now at ZERO — all finalist club-seasons across the full competition history are pickable. O/P overlap = 0, P/P dups = 0. 2026-08-07: all 20 previously 11-player rosters rebuilt to 16 players; clear source conflicts in player identity, nationality and positional classification corrected. See docs/ROSTER-AUDIT-2026-08-07.md.",
      "verified": true,
      "source": "2026-08-07 depth rebuild: RSSSF European Champions' Cup winning-squad appearance records; DFB Datencenter European Cup competition squads and match sheets; WorldFootball appearance records; official club archives (AC Milan, Inter, Malmö FF and Barcelona/Real Madrid material) for cross-checks."
    }
  },
  {
    "file": "pack-seed.json",
    "rows": 16,
    "meta": null
  }
]
```
Legacy 11-player roster audit — 2026-08-07
Purpose
This audit resolves the 21 playable historical rosters that still sat at the
11-player compatibility minimum. The release house standard is 16 players.
The affected records were not bulk-filled from generic season lists. Each
club-season was checked against European Cup competition-squad evidence and,
where available, appearance or match-sheet evidence. Existing rows were also
checked for obvious identity, nationality and positional conflicts discovered
while researching the missing depth.
Evidence standard
Primary evidence used in this pass:
DFB Datencenter European Cup team-season squad pages and match sheets.
RSSSF, European Champions' Club Cup/UEFA Champions League Winning Squads
for appearance counts on winning teams.
WorldFootball historical European Cup appearances, squad lists and match
line-ups where the relevant edition is available.
Official club archives for targeted cross-checks, notably Real Madrid,
AC Milan, Inter, Malmö FF and Barcelona material.
Selection rule: prefer players with documented appearances in that European Cup
campaign. If fewer than 16 appearance participants could be established from
available records, fill the remaining places only with players independently
verified as members of that competition/season squad. Ratings were calibrated
against existing adjacent-season instances in the Roll XI dataset where
possible, then against role/prominence so that adding reserves did not inflate
Campaign difficulty.
This is a depth rebuild, not a claim that every historical competition had a
formal 16-player registration limit. Sixteen is Roll XI's gameplay standard.
Source-evidence matrix and changes
Club-season	Evidence used	Depth change	Other corrections made
Real Madrid 1955-56	RSSSF appearance table + DFB competition squad + Real Madrid archive spot-check	11 → 16	Added Navarro, Becerril, Olsen, Molowny, Castaño
Real Madrid 1956-57	RSSSF appearance table + DFB competition squad	11 → 16	`Joaquín Torres` corrected to Manuel Torres Pastor; added Berasaluce, Atienza, Becerril, Santisteban, Joseíto
Real Madrid 1957-58	RSSSF appearance table + DFB competition squad	11 → 16	Added Rogelio Domínguez, Marquitos, Miguel Muñoz, Marsal, Mateos
AC Milan 1957-58	European Cup match line-ups + AC Milan official season roster	11 → 16	Added Buffon, Zagatti, Zannier, Mariani, Galli; Narciso Soldan nationality corrected to Italy
Reims 1958-59	DFB 16-player competition squad + WorldFootball match line-ups	11 → 16	`Piotr Rodzik` → Bruno Rodzik; `Michel Bliard` → René Bliard; added Jacquet, Dubaële, Siatka, Baratto, Bérard
Real Madrid 1959-60	RSSSF appearance table + Real Madrid final archive + competition records	11 → 16	`Manuel Vidal` → José María Vidal; Rogelio Domínguez nationality corrected to Argentina; added Miché, Ruiz Cervilla, Mateos, Santisteban, Chus Herrera
Eintracht Frankfurt 1959-60	WorldFootball appearance table + DFB competition squad	11 → 16	`Friedrich Lutz` → Friedel Lutz; `Hans Eigenbrodt` → Hans-Walter Eigenbrodt; added Kirchhof, Schymik, Bechtold, Bäumler, Herbert. Fourteen of the final 16 have documented European Cup appearances; Kirchhof and Herbert are verified competition-squad reserves.
Barcelona 1960-61	DFB competition squad + WorldFootball squad/match line-ups	11 → 16	Split erroneous `Segarra Gensana` into Enric Gensana plus Joan Segarra; `Joaquim Garay` → Jesús Garay; `Joan Vergés` → Martí Vergés; removed unsupported Teódulo García; added Gràcia, Segarra, Olivella, Ribelles, Tejada, Villaverde
Benfica 1961-62	RSSSF appearance table + DFB competition squad	11 → 16	Added Humberto Fernandes, José Neto, Serra, Santana, José Torres
Real Madrid 1961-62	DFB competition squad + WorldFootball match evidence	11 → 16	Added Vicente Train, Isidro Sánchez, Zárraga, Ruiz Cervilla, Canário
AC Milan 1962-63	RSSSF appearance table + AC Milan official roster	11 → 16	`Angelo Mora` → Bruno Mora; Víctor Benítez nationality corrected to Peru; added Liberalato, Pelagalli, Radice, Barison, José Germano
Benfica 1962-63	WorldFootball appearance table + competition squad records	11 → 16	Added Santana, Ângelo, Augusto Silva, Germano, Jacinto Santos
Inter 1963-64	RSSSF appearance table + Inter official 1963-64 squad	11 → 16	Added Szymaniak, Ciccolo, Di Giacomo, Bugatti, Codognato
Real Madrid 1963-64	DFB competition squad + match records	11 → 16	Unsupported `Vicente Cobo` corrected to Vicente Train; added Betancort, Miera, Casado, Félix Ruiz, Evaristo
Benfica 1964-65	DFB competition squad + match records	11 → 16	Added Nascimento, Jacinto Santos, Humberto Fernandes, Santana, Ângelo
Real Madrid 1965-66	RSSSF appearance table + DFB competition squad	11 → 16	Added Betancort, Miera, Santamaría, Félix Ruiz, Puskás
Partizan Belgrade 1965-66	DFB competition squad + DFB European Cup match sheets	11 → 16	Removed unsupported Dragoslav Šekularac; corrected Radoslav Bečejac, Mane Bajić, Vladimir Kovačević, Josip Pirmajer and Rašović's primary role; added Ćurković, Paunović, Damjanović, Mihajlović, Miladinović, Vislavski
Benfica 1967-68	DFB competition squad + match records	11 → 16	`Adolfo` expanded to Adolfo Calisto; added Nascimento, Humberto Coelho, Cavém, Raúl Machado, Santana
AC Milan 1968-69	RSSSF appearance table + competition records	11 → 16	Added William Vecchi, Luigi Maldera, Nello Santin, Romano Fogli, Giorgio Rognoni
Ajax 1968-69	DFB competition squad + DFB match sheets	11 → 16	`Anton Pronk` → Tonny Pronk, primary role corrected to DF; added Stuy, Krol, Suurendonk, Bennie Muller, Haan
Malmö FF 1978-79	Malmö FF official campaign retrospective + DFB competition squad	11 → 16	`Thomas Cervin` → Tore Cervin; Kent Jönsson corrected to DF; Jan-Olov Kindvall corrected to MF; added Roy Andersson, Kristensson, Bo Larsson, Malmberg, Arvidsson
Ratings audit
The rebuilt Wave Ff pack averages 77.63 across its player ratings; Wave Fe
averages 78.88. Both remain aligned with the documented target of a pack mean
near 78. New reserve/depth players were generally rated below established
starters rather than using reputation at career peak.
Validation result
After the rebuild:
all 21 affected rosters contain exactly 16 players;
every affected roster still contains at least one goalkeeper;
no duplicate player names were introduced within a roster;
`npm run validate` reports 0 errors and 0 warnings;
no unresolved Priority A identity conflict found during this audit remains in
the affected 21 rows.
The validator's warning for future 11-player rosters remains intentionally in
place. The compatibility minimum is still 11, but new/rebuilt release content
should target 16 whenever source coverage supports it.
Roll XI — Conference League 2025-26 coverage audit
Date: 2026-08-07
Scope and evidence standard
This audit covers the complete 36-club league phase of the 2025-26 UEFA Conference League. Qualifying is excluded by the Roll XI main-draw definition.
UEFA participant source: https://www.uefa.com/uefaconferenceleague/news/029c-1e9829b53e51-119e69b956ee-1000--2025-26-conference-league-meet-the-league-phase-teams/
UEFA draw cross-check: https://www.uefa.com/uefaconferenceleague/news/029c-1e92246e7a6f-e273155cc9d3-1000--2025-26-conference-league-league-phase-draw-contenders-learn/
UEFA final results/stage source: https://www.uefa.com/uefaconferenceleague/news/029c-1e9ad66c8169-aaecb38941a7-1000--2025-26-conference-league-all-the-results/
Roster selection source family: ESPN 2025-26 UEFA Conference League team squad/stat pages, using competition-proper appearances rather than qualifying where available.
Player identity/position cross-check family: UEFA team/player pages and season-squad records. Where the cross-check only establishes a broad role, Roll XI stores `DF`, `MF` or `FW` rather than inventing a narrower detailed position.
The two pre-existing 2025-26 opponent stubs, Crystal Palace and Rayo Vallecano, are upgraded to full rosters under their existing IDs. No duplicate club-season rows are created.
Source-evidence matrix
Club	Participant	Competition-proper roster/appearance evidence	Identity/role cross-check	Deepest stage	Priority A
Noah	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Rapid Vienna	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Zrinjski Mostar	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Rijeka	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
AEK Larnaca	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Omonia	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Sigma Olomouc	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Sparta Prague	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Crystal Palace	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	W	None unresolved
KuPS	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Strasbourg	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	SF	None unresolved
Mainz	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	QF	None unresolved
Lincoln Red Imps	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
AEK Athens	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	QF	None unresolved
Breiðablik	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Fiorentina	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	QF	None unresolved
Drita	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Hamrun Spartans	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
AZ Alkmaar	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	QF	None unresolved
Shkëndija	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Jagiellonia Białystok	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Lech Poznań	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Legia Warsaw	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Raków Częstochowa	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Shamrock Rovers	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Shelbourne	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Universitatea Craiova	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Aberdeen	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Slovan Bratislava	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Celje	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Rayo Vallecano	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	RU	None unresolved
Häcken	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Lausanne-Sport	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Samsunspor	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	R16	None unresolved
Dynamo Kyiv	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	MAIN	None unresolved
Shakhtar Donetsk	UEFA league-phase list	ESPN UECL squad/appearance page	UEFA / season squad cross-check	SF	None unresolved
Priority A finalisation corrections
The final human-review pass corrected several issues before release:
Crystal Palace was re-ranked against final competition-proper appearances: Will Hughes, Eddie Nketiah and Evann Guessand replace lower-participation Chadi Riad, Jørgen Strand Larsen and Christantus Uche in the 16-player game roster.
Rayo Vallecano uses Florian Lejeune, who made nine Conference League appearances, rather than lower-participation Luiz Felipe.
Häcken identity errors were corrected: `Sigurd Rosted Lode` → Marius Lode, `Kristoffer Lundqvist` → Adam Lundkvist and `Vegard Wembangomo` → Brice Wembangomo. Isak Brusberg replaces Mikkel Bruun Madsen, and Adrian Svanbäck's nationality is Finland.
Hamrun Spartans broad roles were corrected for Ognjen Bjeličić, Marcelina Emerson and Joseph Mbong.
Lincoln Red Imps broad roles were corrected for Víctor Villacañas and Toni.
These corrections were made before the release validation gate.
Roster construction
Each club has 16 players and at least one goalkeeper. The selection prioritises players who appeared most often in the Conference League proper. When a club did not have 16 clearly documented competition-proper participants in the accessible appearance table, the remaining place(s) were filled from the verified registered/season squad and treated as depth players.
Ratings are a gameplay calibration, not a claim of an external numerical rating. Team baselines reflect 2025-26 competitive level and European progress, while player-level variation is deliberately narrow. The pack is checked against the project-wide 62-97 range and the target mean near 78.
Detailed-position policy
The evidence sources used for this cycle often expose only broad goalkeeper/defender/midfielder/forward roles. Rather than infer unverified sub-roles, the pack uses the canonical generic detailed codes `DF`, `MF` and `FW` where necessary. Those codes are already first-class Roll XI position values and deliberately provide broad tactical compatibility. More specific `dp` values can be added later only when sourced player-by-player.
Release gate
Release requires: 36/36 club-season rows, 16 players per roster, zero duplicate club-season rows, no residual Palace/Rayo stubs, valid crest override keys, validation with zero errors, and coverage reporting 2025-26 as complete.
Roll XI — Conference League 2024-25 coverage audit
Date: 2026-08-07
Scope and evidence standard
This audit covers the complete 36-club league phase of the 2024-25 UEFA Conference League. Qualifying rounds are excluded under the Roll XI main-draw definition.
UEFA participant source: https://www.uefa.com/uefaconferenceleague/news/0290-1bbb03b65c4f-be92e06ecf39-1000--2024-25-conference-league-who-has-qualified-for-the-league-/
Stage/result cross-check: UEFA 2024-25 competition records plus WorldFootball league-phase and knockout records.
Roster selection source family: competition-specific FBref, WorldFootball and ESPN appearance/stat pages, supplemented by verified UEFA/Sky/season match line-ups where complete appearance tables were not exposed.
Player identity/role cross-check family: UEFA/team season-squad records and existing Roll XI identities where the player match is unambiguous.
Competition-proper evidence only is used for the 2024-25 pack. Qualifying appearances are not used to promote a player into the 16-player game roster.
The pre-existing Chelsea and Real Betis opponent stubs are upgraded under their existing IDs. Fiorentina's pre-existing 15-player roster is deliberately replaced after a competition-proper participation review. No duplicate club-season rows are created.
Source-evidence matrix
Club	Roster evidence	Deepest stage	Finalisation note
APOEL	FBref/competition appearance table + season cross-check	MAIN	16-player roster
Omonia	FBref/competition appearance table + season cross-check	MAIN	16-player roster
Pafos	FBref/competition appearance table + season cross-check	R16	16-player roster
LASK	FBref/competition appearance table + season cross-check	MAIN	16-player roster
Rapid Vienna	competition appearance records + season cross-check	QF	16-player roster
Cercle Brugge	FBref/competition appearance table + season cross-check	R16	16-player roster
Gent	ESPN/competition appearances + verified match line-up	MAIN	16-player roster
Jagiellonia Białystok	WorldFootball/competition appearances + match line-up	QF	16-player roster
Legia Warsaw	ESPN/competition appearances + season cross-check	QF	16-player roster
Celje	ESPN/competition appearances + season cross-check	QF	16-player roster
Olimpija Ljubljana	WorldFootball/competition appearances	MAIN	16-player roster
Lugano	FBref/competition record + verified match line-ups	R16	16-player roster
St Gallen	verified competition match line-ups + season cross-check	MAIN	16-player roster
Noah	FBref/competition record + season cross-check	MAIN	16-player roster
Dinamo Minsk	FBref/competition record + verified match line-ups	MAIN	16-player roster
Borac Banja Luka	FBref/competition appearances + verified match line-ups	R16	Same-name identity exception reviewed
Mladá Boleslav	UEFA/competition history + verified match line-ups	MAIN	16-player roster
Copenhagen	WorldFootball/competition appearances	R16	16-player roster
Chelsea	WorldFootball/competition appearances + FBref cross-check	W	Existing stub upgraded
HJK Helsinki	verified competition match line-ups + season cross-check	MAIN	16-player roster
Heidenheim	FBref/competition appearances + verified match line-up	MAIN	16-player roster
Panathinaikos	FBref/competition appearances + verified match line-ups	R16	16-player roster
Víkingur Reykjavík	verified competition match line-ups + season cross-check	MAIN	16-player roster
Fiorentina	competition-proper appearance review + FBref/ESPN cross-check	SF	Existing 15-player roster replaced
Astana	FBref/competition record + verified Chelsea match line-up	MAIN	16-player roster
Petrocub	verified competition match line-ups + season cross-check	MAIN	16-player roster
Larne	FBref/competition record + verified Gent match line-up	MAIN	16-player roster
Molde	FBref/competition appearances + verified match line-ups	R16	16-player roster
Vitória Guimarães	verified competition match line-ups + season cross-check	R16	16-player roster
Shamrock Rovers	competition appearance records + season cross-check	MAIN	16-player roster
Hearts	verified competition match line-ups + season cross-check	MAIN	16-player roster
TSC Bačka Topola	WorldFootball/competition appearances + verified match line-up	MAIN	16-player roster
Real Betis	WorldFootball/competition appearances + match line-up cross-check	RU	Existing stub upgraded
Djurgården	FBref/competition appearances + verified knockout line-ups	SF	16-player roster
İstanbul Başakşehir	FBref/competition appearances + season cross-check	MAIN	16-player roster
The New Saints	UEFA/verified competition line-ups + season cross-check	MAIN	16-player roster
Where a source exposed complete minutes/appearance totals, those totals drove the cut-off. Where only verified competition line-ups and participant records were accessible, the 16-player set was finalised manually from documented competition-proper participants before passing through the coverage helper. This avoids treating qualifying appearances or unverified registered depth as equivalent evidence.
Priority A finalisation review
Two Priority A cases were reviewed before applying the edition:
Fiorentina roster replacement: the existing 2024-25 row contained 15 players and did not reflect the final competition-proper participation cut. It is replaced with a 16-player roster including Pietro Terracciano, Matías Moreno, Amir Richardson, Danilo Cataldi and Nicolò Fagioli, while lower-participation or non-selected players from the earlier row are removed.
Stefan Savić identity collision: Borac Banja Luka's Stefan Savić is the Austrian midfielder born in 1994, not the Montenegrin centre-back of the same name already present in older Fiorentina/Atlético Madrid records. The Austrian nationality and MF role are intentionally retained.
The audit also exposed a pre-existing nationality error in the 2025-26 Raków Częstochowa row: Lamine Diaby-Fadiga was stored as Côte d'Ivoire. The value is corrected to Guinea, consistent with his documented Guinean nationality/sporting association.
Ratings and role policy
The 2024-25 edition contains 576 players across 36 rosters. The edition-wide rating mean is 78.50, with a range of 74-87, inside the project's normal release band. Ratings remain gameplay calibration rather than externally sourced numerical ratings.
Broad roles are used conservatively. Where the source set does not justify a narrower detailed role, `dp` uses the corresponding generic `GK`, `DF`, `MF` or `FW` value. Same-name collisions with unrelated historical players are not allowed to overwrite current-season source evidence.
Crest finalisation
The 25 newly introduced club display names that lacked a `CREST_PAGE_OVERRIDES` entry now have explicit Wikipedia page-title mappings in `src/lib/crestResolver.js`. This removes the live-search fallback warnings introduced by the expansion.
Release gate
Final state after applying the matrix:
36/36 2024-25 main-draw participants have full 16-player rosters;
Chelsea and Real Betis are no longer stubs;
Fiorentina contains exactly 16 players;
no duplicate club-season rows were introduced;
no selected roster lacks a goalkeeper;
`npm run validate` reports 0 errors and 0 warnings;
`npm run coverage` reports Conference League at 75/168 known rosters (45%), with 2/5 editions proven complete;
the next measured Conference League gap is 2023-24.

Roll XI — Conference League 2023-24 coverage audit
Date: 2026-08-07
Scope and evidence standard
This cycle completes the 32-club group stage of the 2023-24 UEFA Europa Conference League. Qualifying-round clubs are excluded under the Roll XI main-draw definition. Olympiacos remains the separate existing winner stub because it entered this competition from the Europa League knockout transfer rather than through the 32-team Conference League group stage.
UEFA participant source: https://www.uefa.com/uefaconferenceleague/news/0285-18f613079b0e-26338542db59-1000--europa-conference-league-squads/
UEFA stage/result source: https://www.uefa.com/uefaconferenceleague/news/0285-18e1b615fd5b-6fe5294e3ddd-1000--europa-conference-league-all-the-results/
Roster selection source family: competition-specific FBref and la Repubblica player tables where available, supplemented by UEFA competition match records and verified season/match line-ups for clubs with weaker public statistical coverage.
Player identity/role cross-check family: UEFA and club squad records plus existing Roll XI identities where the player match is unambiguous. Same-name collisions are deliberately excluded from automatic identity reuse.

Source-evidence matrix
Club	Roster evidence	Deepest stage	Finalisation note
Lille	FBref/competition appearance table + UEFA records	QF	16-player roster
Slovan Bratislava	competition appearance table + UEFA records	GROUP	16-player roster
Olimpija Ljubljana	competition appearance records + verified match line-ups	GROUP	16-player roster
KÍ Klaksvík	competition appearance records + verified match line-ups	GROUP	16-player roster
Gent	competition appearance records + verified match line-ups	GROUP	16-player roster
Maccabi Tel Aviv	competition appearance records + UEFA match records	R16	16-player roster
Zorya Luhansk	FBref/competition appearance table + verified match line-up	GROUP	16-player roster
Breiðablik	verified competition match line-ups + season cross-check	GROUP	16-player roster
Dinamo Zagreb	competition appearance records + UEFA records	R16	16-player roster
Viktoria Plzeň	FBref/competition appearance table + UEFA records	QF	16-player roster
Astana	competition appearance/minutes table + UEFA records	GROUP	16-player roster
Ballkani	FBref/competition records + season squad cross-check	GROUP	Walid Hamidi retained over non-2023-24 Lucas Cardoso
Club Brugge	competition appearance records + verified knockout line-ups	SF	16-player roster
Bodø/Glimt	FBref competition minutes/appearances + UEFA records	GROUP	Appearance-led cut rebuilt; non-participant Andreas Helmersen removed
Beşiktaş	competition appearance records + UEFA records	GROUP	16-player roster
Lugano	competition appearance table + UEFA records	GROUP	16-player roster
AZ Alkmaar	competition appearance records + UEFA records	GROUP	16-player roster
Aston Villa	competition appearance table + knockout records	SF	16-player roster
Legia Warsaw	competition appearance records + UEFA records	GROUP	Canonical Roll XI club spelling reused
Zrinjski Mostar	competition appearance records + verified match line-ups	GROUP	16-player roster
Ferencváros	FBref competition minutes/appearances + identity cross-check	GROUP	Ibrahim Cissé and Marquinhos same-name collisions isolated
Fiorentina	competition-proper appearance review + UEFA knockout records	RU	Existing 14-player roster replaced with 16-player roster
Genk	competition appearance table + UEFA records	GROUP	16-player roster
Čukarički	competition appearance records + verified match line-ups	GROUP	16-player roster
Eintracht Frankfurt	competition appearance table + UEFA records	GROUP	16-player roster
PAOK	competition appearance records + UEFA knockout records	QF	16-player roster
HJK Helsinki	FBref competition records + verified match line-ups	GROUP	Both competition-proper goalkeepers retained
Aberdeen	competition appearance records + UEFA match records	GROUP	16-player roster
Fenerbahçe	competition appearance records + UEFA knockout records	QF	16-player roster
Ludogorets	competition appearance records + UEFA records	GROUP	16-player roster
Spartak Trnava	competition appearance records + UEFA records	GROUP	16-player roster
Nordsjælland	FBref/competition appearance table + verified match line-ups	GROUP	16-player roster

Stage policy
Fiorentina is encoded RU; Aston Villa and Club Brugge SF; Lille, Viktoria Plzeň, PAOK and Fenerbahçe QF; Dinamo Zagreb and Maccabi Tel Aviv R16; the other 23 group-stage clubs GROUP. Clubs eliminated in the knockout round play-offs remain GROUP because the current data model has no separate play-off stage code. Olympiacos retains the existing W stub outside the 32 group-stage roster target.

Priority A and identity finalisation
Four Priority A exceptions were explicitly reviewed before application. Fiorentina's existing 14-player row is intentionally replaced by the competition-proper 16-player cut. Antonín Barák and Edin Džeko retain current canonical source nationality labels despite legacy label variants elsewhere in the database. Ferencváros defender Ibrahim Cissé is the French-born 1996 player and must not inherit the Côte d'Ivoire identity of the unrelated KuPS player with the same name. Ferencváros winger Marquinhos is likewise kept as the current-season Brazilian forward rather than inheriting the Paris Saint-Germain defender identity attached to the same mononym.
The Bodø/Glimt cut was rebuilt from 2023-24 Conference League minutes and appearances. Andreas Helmersen, who was not a Bodø/Glimt player in this campaign, was removed; higher-participation competition contributors including Amahl Pellegrino, Faris Moumbagna, Kjetil Haug and Håkon Evjen were restored. Ballkani's Lucas Cardoso entry was replaced by documented 2023-24 participant Walid Hamidi. HJK's final cut includes both Jesse Öst and Niki Mäenpää, reflecting the split goalkeeper minutes in the group stage.

Ratings and roster policy
The edition contains 512 player slots across 32 complete rosters. Every roster has exactly 16 players and at least one goalkeeper. The edition-wide gameplay rating mean is 78.54, with a range of 71-86. Ratings are Roll XI gameplay calibration and are not presented as externally sourced numerical ratings.
Competition-proper participation drives the selection. Existing Roll XI identities are reused for nationality, role and rating continuity only where the player match is sufficiently unambiguous; current-season evidence wins where a same-name collision is detected.

Crest and naming finalisation
New explicit crest page-title mappings were added for Ballkani, Bodø/Glimt, Čukarički, Genk, KÍ Klaksvík, Ludogorets, Maccabi Tel Aviv, Nordsjælland, PAOK, Viktoria Plzeň and Zorya Luhansk. Legia is stored as `Legia Warsaw`, matching the existing Roll XI canonical display name. These changes remove all crest fallback and same-club spelling warnings introduced by the expansion.

Release gate
Final repository state after applying the matrix:
32/32 2023-24 group-stage participants have full 16-player rosters;
Fiorentina now contains exactly 16 players;
Olympiacos remains the existing Conference League winner stub and is not counted among the 32 group-stage roster targets;
no duplicate club-season rows were introduced;
no selected roster lacks a goalkeeper;
`npm run validate` reports 0 errors and 0 warnings;
`npm run coverage` reports Conference League at 106/168 known rosters (63%), with 3/5 editions proven complete;
`npm run coverage:next` advances the measured Conference League gap to 2022-23;
`npm run build` could not be executed in this sandbox because the uploaded repository has no `node_modules` and dependency restoration is blocked by the package registry returning HTTP 404 for `yallist@3.1.1`. The source-level validation gate therefore passes, while the production bundler should be re-run in GitHub/locally after dependency installation.

Roll XI — Conference League 2022-23 coverage audit
Date: 2026-08-09

Scope and authoritative competition check
This cycle completes the 32 clubs that actually took part in the 2022-23 UEFA Europa Conference League group stage. UEFA's match archive supplies the eight four-club groups and the complete knockout path. The eight Europa League transfers that first appear in the February knockout play-offs are deliberately excluded from the 32-roster main-draw target: AEK Larnaca, Bodø/Glimt, Sheriff, Ludogorets, Qarabağ, Braga, Lazio and Trabzonspor.
UEFA participant/results source: https://www.uefa.com/uefaconferenceleague/news/0278-15f79274290a-1546058291ee-1000--all-the-2022-23-europa-conference-league-results/
Competition appearance source family: StatBunker UEFA Europa Conference League 2022-23 competition tables (`comp_id=738`), captured club-by-club by provider ID.
Structured player identity source for the reusable collector: the open `transfermarkt-datasets` player dataset, whose prepared player table supplies names, citizenship and position fields for bulk identity joins.

Bulk-collector trial
The new `scripts/collect-coverage.mjs` workflow is implemented and is now part of `npm run validate` through its self-test. It accepts an edition manifest, downloads/caches competition appearance and squad pages concurrently, filters them to the authoritative Roll XI participant manifest, reuses unambiguous Roll XI identities, joins a bulk structured player dataset for unresolved identity metadata, and produces the same `rollxi-coverage-matrix-v1` format consumed by `prepare-coverage.mjs`.
The captured 2022-23 appearance snapshot contains 541 competition-participation candidate rows across the 32 target clubs. Before adding any secondary identity source, exact Roll XI name matching could safely supply only 130 of the 512 final roster slots. That measured reuse rate is why the new collector now has a deterministic bulk identity layer rather than falling back to hundreds of model-led look-ups.
This sandbox cannot make the collector's live external HTTP requests, so the 2022-23 release matrix was finalised from the already captured StatBunker appearance snapshot, existing Roll XI identities and targeted source-checked identity completion. The network limitation affects acquisition only; the collector parser, cache/join logic and release integration are exercised by local self-tests. Future expansion runs in a normal connected environment should use `npm run coverage:collect -- --manifest <manifest>` first, then the existing prepare/apply gates.

Identity and rating safeguards added during the trial
The trial exposed two failure modes that are now guarded against in the reusable pipeline. First, nationality labels such as `Czech Republic`/`Czechia`, `Republic of Ireland`/`Ireland`, `Türkiye`/`Turkey`, `Bosnia-Herzegovina`/`Bosnia and Herzegovina` and `Cabo Verde`/`Cape Verde` are canonicalised before identity-conflict checks, preventing semantic label variants from becoming false Priority A exceptions. Second, rating reuse is no longer based on name alone: an existing Roll XI rating anchor must be compatible with the resolved nationality and broad position, and anchors more than two seasons from the target season are treated as stale and replaced by the edition/club draft baseline.
West Ham's `Emerson` was the concrete same-name test case. The selected player is Emerson Palmieri, Italy, defender/left-back. The older Roll XI database also contains unrelated Brazilian players stored simply as `Emerson`; the current-season identity is explicitly retained and the conflict is recorded as reviewed rather than allowing the old Brazilian rating/identity to leak into the new roster.

Source-evidence matrix
Club	Roster evidence	Deepest stage	Finalisation note
1. FC Köln	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Apollon Limassol	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
AZ Alkmaar	StatBunker competition-proper appearances + structured identity/season cross-check	SF	16-player roster
CFR Cluj	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Djurgårdens IF	StatBunker competition-proper appearances + structured identity/season cross-check	R16	16-player roster
Dnipro-1	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Basel	StatBunker competition-proper appearances + structured identity/season cross-check	SF	16-player roster
Slovácko	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Vaduz	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Fiorentina	StatBunker competition-proper appearances + structured identity/season cross-check	RU	16-player roster
Austria Wien	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
RFS	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Žalgiris	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Hapoel Be'er Sheva	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Hearts	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
İstanbul Başakşehir	StatBunker competition-proper appearances + structured identity/season cross-check	R16	16-player roster
Gent	StatBunker competition-proper appearances + structured identity/season cross-check	QF	16-player roster
Ballkani	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Lech Poznań	StatBunker competition-proper appearances + structured identity/season cross-check	QF	16-player roster
Molde	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Nice	StatBunker competition-proper appearances + structured identity/season cross-check	QF	16-player roster
Partizan Belgrade	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Pyunik	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Anderlecht	StatBunker competition-proper appearances + structured identity/season cross-check	QF	16-player roster
Shamrock Rovers	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Silkeborg	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Sivasspor	StatBunker competition-proper appearances + structured identity/season cross-check	R16	16-player roster
Slavia Prague	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Slovan Bratislava	StatBunker competition-proper appearances + structured identity/season cross-check	R16	16-player roster
FCSB	StatBunker competition-proper appearances + structured identity/season cross-check	GROUP	16-player roster
Villarreal	StatBunker competition-proper appearances + structured identity/season cross-check	R16	16-player roster
West Ham United	StatBunker competition-proper appearances + structured identity/season cross-check	W	16-player roster

Stage policy
West Ham United is encoded W and Fiorentina RU. AZ Alkmaar and Basel are SF. Gent, Lech Poznań, Nice and Anderlecht are QF. Djurgårdens IF, İstanbul Başakşehir, Sivasspor, Slovan Bratislava and Villarreal are R16. The remaining 19 group-stage clubs are GROUP, including clubs eliminated in the February knockout play-offs because the current Roll XI stage model has no separate play-off code.

Roster and rating release state
The edition contains 512 player slots across 32 full rosters. Every roster has exactly 16 players and at least one goalkeeper. The selection is ordered by competition-proper participation, using appearances then starts where minute data were not present in the captured source snapshot. Close 16th/17th cuts remain visible as Priority B audit signals rather than being silently hidden.
The candidate gameplay-rating mean is 77.66 with a range of 71-86. Ratings are Roll XI gameplay calibration, not externally sourced rating claims. Nearby compatible Roll XI ratings are reused for continuity; otherwise deterministic club/edition baselines provide the first-pass value.
Two Priority A cases were explicitly reviewed before release: replacement of Fiorentina's pre-existing incomplete roster, and the Emerson Palmieri same-name collision. Final matrix status: 0 blockers, 0 unreviewed Priority A, 2 reviewed Priority A.

Crest and canonical naming finalisation
Explicit crest mappings were added for the newly introduced 2022-23 display names that previously fell back to live Wikipedia search. `Basel` and `Partizan Belgrade` are stored using the canonical Roll XI names already present elsewhere in the database, avoiding new same-club spelling variants.

Release gate
Final repository state after applying the matrix:
32/32 2022-23 group-stage participants have full 16-player rosters;
West Ham United's pre-existing winner stub is upgraded to a roster;
Fiorentina's pre-existing roster is replaced by the 16-player competition-proper cut;
no duplicate club-season rows are introduced;
no selected roster lacks a goalkeeper;
`npm run validate` reports 0 errors and 0 warnings, including the collector self-test;
`npm run coverage` reports Conference League at 137/168 known rosters (82%), with 4/5 editions proven complete;
`npm run coverage:next` advances the measured Conference League gap to 2021-22;
`npm run build` cannot run in this sandbox because the uploaded repository has no installed Vite binary (`vite: not found`). This is an environment/dependency state, not a source-validation failure.



Roll XI — rating-model correction before Conference League 2021-22
Date: 2026-08-09

The previous expansion policy forced pack/cycle ratings towards a mean near 78 and the bulk collector used only a +2/+1/0/-1 participation-rank spread around a high club baseline. This produced systematic upward compression, especially for smaller Conference League clubs. Across the 2020s shard before this correction there were no player ratings below 70, and the 2022-23 Conference League edition averaged 77.66 with only one player at 71.

Rating model v2 removes the edition-wide mean target. Club targets are now absolute strength judgements, not values chosen to keep a batch near 78. The 2022-23 manifest is migrated from legacy baselines to explicit `teamRating` targets ranging from 68 to 82. The collector uses a 10-point participation-depth spread across the selected 16 and may reuse only a nearby player's relative standing within his prior Roll XI squad, not the old absolute rating itself. This prevents the compressed legacy scale from propagating into new seasons.

The release gate now flags 16-player squads whose rating range is under 6 or whose standard deviation is under 2. It also flags a below-75 squad with no player below 70 and flags a candidate mean more than two points from an explicit team target. There is no longer a 74-83 club or edition mean band.

The already-built 2022-23 Conference League rosters were recalibrated with the same v2 principles using the captured competition-appearance ordering and the old ratings only as within-squad relative signals. The revised edition mean is 73.87, the range is 62-88, edition standard deviation is 5.31 and 115 of 512 player slots are below 70. This is a deliberate gameplay-scale revision; roster identities, positions, participation cuts, stages and achievements are unchanged.


Roll XI — global absolute-v3 rating migration and shootout-name safeguard
Date: 2026-08-10

Scope
The rating correction is now repository-wide rather than limited to Conference League expansion packs. All eight canonical decade shards were migrated in one deterministic pass. The migration preserves each squad's pre-existing relative player hierarchy where useful, supplements very flat rows with compatible career-relative Roll XI signals, and uses explicit reviewed signals for six recent squads whose legacy values contained too little internal information for a hierarchy-preserving transform.

Absolute-v3 scale
The old playable database contained 14,373 player-season ratings across 902 rosters with a mean of 78.15; only 0.9% of those ratings were below 70. After the v3 migration the same 14,373 player-season records average 75.92 and use a 62-95 realised range. A final neutral tie-dispersion pass breaks up legacy blocks of identical ratings by only ±1-2 points around the same tier; this leaves team strength effectively unchanged while preventing large artificial rating clusters. Team ordering is retained through a non-linear absolute-strength mapping rather than forcing every squad towards a common edition mean. Within-squad differences are then expanded from the existing/career-relative signals.

The repository validator now blocks any playable 12+ player roster with a rating range below 6, standard deviation below 2, fewer than 5 distinct rating values, a single exact rating covering more than 40% of the roster, or an average below 75 without at least one player below 70. Every decade shard also records `meta.ratingModel: "absolute-v3"`; a stale shard therefore fails validation instead of silently mixing rating systems. `npm run ratings:check` performs the same distribution audit independently.

Penalty shootout names
Campaign penalty shootouts now use the full historical roster as the penalty-taker pool whenever the opponent is also a playable squad. The same role/rating ordering used for Your XI is applied to that opponent roster. Stub-only opponents retain the generic Scored/Missed fallback because inventing player names would be less accurate. The scorer integration test now forces a knockout shootout and verifies that every opponent kick is attributed to a name present in the playable roster.


Roll XI — Conference League 2021-22 coverage audit
Date: 2026-08-10

Scope and competition authority
This cycle completes the inaugural 2021-22 UEFA Europa Conference League group-stage field. UEFA's official 27 August 2021 group-stage draw is the participant authority and lists the eight groups of four (32 clubs). UEFA's official 2021-22 results/history pages are the stage authority; Roma are encoded W and Feyenoord RU. The Roll XI stage convention remains unchanged: original group-stage clubs eliminated in the February knockout play-off remain GROUP because the current stage schema has no separate play-off code; clubs reaching the round of 16 or later are encoded R16/QF/SF/RU/W.
UEFA participant source: https://www.uefa.com/uefaconferenceleague/news/026c-131957a86ed7-df0ece5d5736-1000--europa-conference-league-group-stage-draw/
UEFA results source: https://www.uefa.com/uefaconferenceleague/news/026c-131b2b24e6bd-68b0c5aba0dc-1000--all-the-2021-22-europa-conference-league-results/

Roster acquisition and exception-driven finalisation
The expansion uses the bulk-first workflow introduced for 2022-23, with archived ESPN competition squad/statistics tables as the compact player-participation/position/nationality feed and UEFA squad/match records for historical exceptions. Existing Roll XI identities are reused only as cross-checks, not as the authority when a same-name or historical-nationality conflict exists. This avoids the previous one-club-at-a-time model research loop.
The main historical-archive correction was Bodø/Glimt. Later archive maintenance drops several players who left after the group stage. UEFA records Patrick Berg, Fredrik Bjørkan, Erik Botheim and Marius Lode among outgoing winter squad changes, so their autumn participation is retained. Fredrik Bjørkan is included in the 16-player cut; Victor Boniface, whose retained archive appearances were substitute-heavy, falls outside the final cut.

Priority A review
Five Priority A items were explicitly reviewed and no unreviewed Priority A item remains. AS Roma's pre-existing 14-player roster is deliberately replaced by the competition-participation cut. Four nationality conflicts are retained from current-season/historical evidence rather than overwritten by later or same-name Roll XI identities: Ricardo Gomes = Cape Verde (Partizan), Cyriel Dessers = Nigeria (Feyenoord), Kevin Diks = Netherlands for 2021-22 (Copenhagen), and Bernardo Lopes = Portugal for the autumn 2021 Conference League campaign (Lincoln Red Imps; his Gibraltar international debut came in March 2022). Aleksandar Cavric is stored as Serbia for 2021-22; the matrix no longer treats his later Slovak nationality as retrospective.

Priority B audit signals
The final preparation report retains 53 non-blocking Priority B audit signals: 21 detailed-position differences, 19 cross-season rating-identity outliers and 13 broad-position differences. These are intentionally preserved rather than auto-normalised where current-season evidence or the new absolute rating scale differs from another Roll XI season. They do not create missing fields, duplicate identities or release blockers.

Rating release state
The edition contains 512 player slots. Candidate ratings average 73.82, span 62-87, have an edition standard deviation of 5.02, and include 104 players below 70. All 32 rosters satisfy the global absolute-v3 range, dispersion, distinct-value, anti-clustering and lower-tail rules. The ratings are Roll XI gameplay calibration rather than third-party rating claims.

Source-evidence/stage matrix
Club	Deepest Roll XI stage	Finalisation note
LASK	R16	16-player competition-participation roster
Maccabi Tel Aviv	GROUP	16-player competition-participation roster
Alashkert	GROUP	16-player competition-participation roster
HJK Helsinki	GROUP	16-player competition-participation roster
Gent	R16	16-player competition-participation roster
Partizan Belgrade	R16	16-player competition-participation roster
Flora Tallinn	GROUP	16-player competition-participation roster
Anorthosis	GROUP	16-player competition-participation roster
AS Roma	W	16-player competition-participation roster; existing roster replaced (reviewed)
Zorya Luhansk	GROUP	16-player competition-participation roster
CSKA Sofia	GROUP	16-player competition-participation roster
Bodø/Glimt	QF	16-player competition-participation roster
AZ Alkmaar	R16	16-player competition-participation roster
CFR Cluj	GROUP	16-player competition-participation roster
Jablonec	GROUP	16-player competition-participation roster
Randers	GROUP	16-player competition-participation roster
Slavia Prague	QF	16-player competition-participation roster
Feyenoord	RU	16-player competition-participation roster; existing RU stub upgraded
Union Berlin	GROUP	16-player competition-participation roster
Maccabi Haifa	GROUP	16-player competition-participation roster
Copenhagen	R16	16-player competition-participation roster
PAOK	QF	16-player competition-participation roster
Slovan Bratislava	GROUP	16-player competition-participation roster
Lincoln Red Imps	GROUP	16-player competition-participation roster
Tottenham Hotspur	GROUP	16-player competition-participation roster
Rennes	R16	16-player competition-participation roster
Vitesse	R16	16-player competition-participation roster
Mura	GROUP	16-player competition-participation roster
Basel	R16	16-player competition-participation roster
Qarabag	GROUP	16-player competition-participation roster
Kairat Almaty	GROUP	16-player competition-participation roster
Omonia	GROUP	16-player competition-participation roster

Crest and naming finalisation
Explicit Wikipedia page-title mappings were added for Alashkert, Anorthosis, Flora Tallinn, Jablonec, Kairat Almaty, Maccabi Haifa, Mura, Qarabag, Randers, Union Berlin and Vitesse. The validator also records Rangers/Randers as a known distinct pair so their high string similarity does not produce a false same-club warning.

Release gate
Final repository state after applying the matrix:
32/32 2021-22 group-stage participants have full 16-player rosters;
30 new club-season rows are added, Feyenoord's runner-up stub is upgraded, and AS Roma's incomplete roster is replaced;
no selected roster lacks a goalkeeper and no duplicate club-season row is introduced;
`npm run validate` checks 1,238 club-seasons and reports 0 errors and 0 warnings; 933 playable rosters pass the absolute-v3 rating-distribution checks;
`npm run coverage` reports Conference League at 168/168 known rosters (100%), with 5/5 editions proven complete and 0 roster rows missing;
with the Conference League target complete, the next measured repository gap is Serie A 1999-00 (breadth target still to be established);
`npm run build` cannot run in this sandbox because the uploaded repository has no installed Vite binary (`vite: not found`). This is an environment/dependency limitation rather than a source-validation failure.


Roll XI — Serie A 1998-99 sequential coverage expansion
Date: 2026-08-10

Scope and field authority
This cycle continues the Serie A C-series frontier immediately backwards from the proven-complete 1999-00 edition. The 1998-99 field contains 18 clubs: AC Milan, Lazio, Fiorentina, Parma, AS Roma, Udinese, Juventus, Inter, Bologna, Bari, Venezia, Cagliari, Piacenza, Perugia, Salernitana, Sampdoria, Vicenza and Empoli. RSSSF is the competition/table authority and FootballSquads is used as an independent whole-league squad cross-check.
RSSSF: https://www.rsssf.org/tablesi/ital99.html
FootballSquads: https://www.footballsquads.co.uk/italy/1998-1999/seriea.htm

Roster selection and identity finalisation
BDFutbol's 1998-99 club pages provide the season-specific league participation evidence used for the representative 16-player cuts. Selection is led by league minutes/appearances rather than by copying adjacent-season squads. Major historically defining cases curtailed by injury or a January move can remain in the 16 where appropriate, notably Alessandro Del Piero and Thierry Henry at Juventus. Existing Roll XI identity history is reused only where compatible with the season evidence; ambiguous identities are resolved explicitly before packaging.

Three pre-existing rows are upgraded/rebuilt rather than duplicated: Juventus retains its UCL SF achievement, Lazio's Cup Winners' Cup winner stub becomes the full league roster while retaining CWC W, and Parma's UEFA Cup winner stub becomes the full league roster while retaining UEFA W. The legacy Juventus row is corrected by moving Moreno Torricelli to Fiorentina, where the 1998-99 season evidence places him. Piacenza's Alessandro Mazzola is encoded as the Varese-born 1969 midfielder, not the unrelated former Inter forward of the same full name. Sampdoria's Hugo is resolved as Portuguese centre-back Hugo Miguel Fernandes Vieira.

Rating release state
The edition contains 288 player slots across 18 full rosters, exactly 16 players per club and two goalkeepers per roster. Ratings use the repository-wide absolute-v3 model and are calibrated as club-strength judgements rather than to a shared edition mean. The realised team means range from 69.75 (Empoli) to 81.06 (Lazio). Across the full edition the mean is 75.58, standard deviation 5.08, realised range 65-92, and 33 of 288 player slots are below 70. This preserves a meaningful lower tail for weaker squads while retaining elite separation for players such as Ronaldo, Batistuta and Zidane.

Coverage-selector correction
The domestic coverage selector no longer treats an edition as safely skippable merely because one or more European-derived rows already exist. The Serie A scope now declares a backward sequential expansion anchor at 1999-00. From that anchor, the selector walks through the contiguous proven-complete run and advances to the immediately preceding season. Competition scopes whose depth has not been declared retain their breadth-only newest-untouched fallback. After this cycle, 1998-99 and 1999-00 are both explicitly 18/18 and proven complete, and `npm run coverage:next` advances Serie A to 1997-98 rather than jumping to 1990-91 or to unrelated modern partial seasons.

Release gate
Final repository state after this cycle:
18/18 Serie A 1998-99 clubs have full 16-player rosters;
288/288 intended player slots are present, with no duplicate player names within a roster;
Juventus, Lazio and Parma preserve their existing European achievements while becoming/remaining full domestic rosters;
Moreno Torricelli is no longer present in the Juventus 1998-99 roster and is present at Fiorentina;
Piacenza's Alessandro Mazzola is explicitly a midfielder, preventing the legacy same-name identity collision;
`npm run validate` reports no errors across 1,271 club-season rows and confirms 968 playable rosters satisfy absolute-v3 distribution rules;
`npm run coverage:next` advances the sequential Serie A frontier to 1997-98;
`npm run build` cannot run in this sandbox because the uploaded repository has no installed Vite binary (`vite: not found`). This is an environment/dependency state, not a data-validation failure.


Roll XI — Serie A 1997-98 sequential coverage expansion
Date: 2026-08-10

Scope and field authority
This cycle advances the sequential Serie A frontier one season backwards from the proven-complete 1998-99 edition. The 1997-98 field contains 18 clubs: Juventus, Inter, Udinese, AS Roma, Fiorentina, Parma, Lazio, Bologna, Sampdoria, AC Milan, Bari, Empoli, Piacenza, Vicenza, Brescia, Atalanta, Lecce and Napoli. BDFutbol is the competition/table and season-participation authority; FootballSquads is retained as an independent whole-league squad-membership cross-check.
BDFutbol classification: https://www.bdfutbol.com/en/t/tita1997-98.html?tab=stats
FootballSquads: https://www.footballsquads.co.uk/italy/1997-1998/seriea.htm

Roster selection and identity finalisation
Each domestic roster contains exactly 16 players. The normal cut is the two goalkeepers with the most Serie A minutes plus the 14 outfielders with the most Serie A minutes on the linked BDFutbol 1997-98 club page. This keeps the expansion bulk-first and evidence-led rather than copying the following season. Bari illustrates the tie-sensitive goalkeeper rule: Emanuele Gentili's 46 league minutes place him just ahead of Emanuele Indiveri's 44 for the second goalkeeper slot.

The identity pass resolved surname-only or misleading local-history matches before packaging. Lazio's López is Giovanni López, the Italian centre-back, not Claudio López. Piacenza's Marco Rossi is the 1964-born Italian defender who later became Hungary manager, not a younger same-name Roll XI identity. Atalanta's Piacentini is Giovanni Piacentini. Bari's Volpi and Giorgetti are Sergio Volpi and Rodolfo Giorgetti, both midfielders, and Lecce's Casale is Stefano Casale, also a midfielder. Sampdoria's Oumar is Senegalese centre-back Oumar Dieng Samba. Existing Roll XI identities and adjacent-season records remain cross-checks only where they are compatible with the 1997-98 source evidence.

European achievement preservation/correction
Inter's pre-existing UEFA Cup winner stub and Lazio's UEFA Cup runner-up stub are upgraded in place to full Serie A rosters, preserving their European achievements without duplicate club-season rows. Juventus is rebuilt to the 16-player domestic standard and its legacy `EC / MAIN` marker is corrected to `UCL / RU`: UEFA's official 1997-98 record places Juventus in the Champions League final against Real Madrid.
UEFA final record: https://www.uefa.com/uefachampionsleague/match/54859--juventus-vs-real-madrid/

Rating release state
The edition contains 288 player slots across 18 full rosters, exactly 16 players and two goalkeepers per club. Ratings use the repository-wide absolute-v3 model and are calibrated at club level, with adjacent-season Roll XI values used as identity/history anchors rather than copied mechanically. The final team means range from 68.50 (Lecce and Napoli) to 80.06 (Juventus). Across the full edition the mean is 74.48, standard deviation 5.63, realised range 62-94, and 54 of 288 player slots are below 70. Juventus is deliberately recalibrated from its older legacy row to a 68-90 internal range; Empoli's first pass was also widened without changing its 69.50 mean after the validator identified an SD of 1.94, below the 2.00 release threshold.

Coverage state
`public/data/coverage-target.json` now declares 1997-98 as an 18-roster domestic edition alongside 1998-99 and 1999-00. This creates a contiguous three-edition proven-complete run from the 1999-00 anchor. `npm run coverage:next` therefore advances the sequential Serie A frontier to 1996-97 rather than treating the pre-existing European-derived 1996-97 rows as domestic completion.

Release gate
Final repository state after this cycle:
18/18 Serie A 1997-98 clubs have full 16-player rosters;
288/288 intended player slots are present and every roster has exactly two goalkeepers;
Inter and Lazio are upgraded from European stubs without duplicate club-season rows;
Juventus's 1997-98 European achievement is corrected to Champions League runner-up;
`npm run validate` reports no errors across 1,286 club-season rows;
985 playable rosters satisfy the absolute-v3 rating-distribution rules;
Campaign scorer-pool, position-compatibility and coverage-production self-tests all pass;
Serie A measured coverage is now 54/54 across the three researched 18-club editions (1997-98, 1998-99, 1999-00);
`npm run coverage:next` advances to Serie A 1996-97.
