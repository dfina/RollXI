#!/usr/bin/env node
/*
  Roll XI coverage report.

  Reads public/data/coverage-target.json (the goal) and every decade shard
  listed in public/data/index.json (the reality), then reports both breadth and, where the
  target declares expected roster counts, real depth/completeness.

  Run:  node scripts/coverage.mjs
        node scripts/coverage.mjs --json     machine-readable output
        node scripts/coverage.mjs --next     next recommended edition to work on

  Important: an edition being "touched" only means at least one row exists.
  Treat an edition as complete only where expectedRostersPerEdition is defined
  and the required number of roster rows is present.
*/

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DATA = path.resolve("public/data");
const args = new Set(process.argv.slice(2));

/* ---------- season helpers ---------- */

// "1998-99" -> 1998 ; "1995" -> 1995 ; "1955-58" -> 1955
const startYear = (s) => parseInt(String(s).slice(0, 4), 10);
const shardForSeason = (s) => `clubs-${Math.floor(startYear(s) / 10) * 10}s.json`;

// Build the list of season strings between two bounds, in the same style as the
// bounds themselves. Single-year style ("1995") is used for the Intertoto Cup.
function expandSeasons(from, to, exclude = []) {
  const singleYear = !String(from).includes("-");
  const out = [];
  for (let y = startYear(from); y <= startYear(to); y++) {
    const label = singleYear ? String(y) : `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    if (!exclude.includes(label)) out.push(label);
  }
  return out;
}

function expectedRostersFor(scope, season) {
  const spec = scope.expectedRostersPerEdition ?? null;
  if (spec == null) return null;
  if (typeof spec === "number") return spec;
  if (typeof spec === "object" && !Array.isArray(spec)) {
    const value = spec[season];
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/* ---------- load ---------- */

async function loadShards() {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  const listed = new Set(index.shards.map((s) => s.file));

  const onDisk = (await readdir(DATA)).filter(
    (f) => /^clubs-\d{4}s\.json$/.test(f)
  );
  const unlisted = onDisk.filter((f) => !listed.has(f));
  const missing = [...listed].filter((f) => !onDisk.includes(f));

  const rows = [];
  for (const file of listed) {
    if (!onDisk.includes(file)) continue;
    const shard = JSON.parse(await readFile(path.join(DATA, file), "utf8"));
    for (const s of shard.squads || []) rows.push({ ...s, _file: file });
  }
  return { rows, unlisted, missing };
}

/* ---------- normalise a club-season into (comp, season, role) facts ---------- */

const ALIAS = { UECL: "CONFL", INT: "ITC" };
const canon = (c) => ALIAS[c] || c;

function factsFor(row) {
  const entries = (row.achievements || []).map((a) => ({
    comp: canon(a.comp),
    season: a.season || row.season,
    stage: a.stage || "MAIN"
  }));
  return { role: row.role, league: row.league || null, season: row.season, entries };
}

/* ---------- report ---------- */

async function main() {
  const target = JSON.parse(await readFile(path.join(DATA, "coverage-target.json"), "utf8"));
  const { rows, unlisted, missing } = await loadShards();

  // actual[compOrLeague][season] = { roster: n, stub: n }
  const actual = {};
  const bump = (key, season, role) => {
    actual[key] ??= {};
    actual[key][season] ??= { roster: 0, stub: 0 };
    actual[key][season][role]++;
  };

  for (const row of rows) {
    const f = factsFor(row);
    if (f.league) bump("league:" + f.league, f.season, f.role);
    for (const e of f.entries) bump("comp:" + e.comp, e.season, f.role);
  }

  const report = [];
  for (const scope of [...target.scopes].sort((a, b) => a.priority - b.priority)) {
    const seasons = scope.seasons
      ? scope.seasons
      : expandSeasons(scope.seasonFrom, scope.seasonTo, scope.excludeSeasons || []);
    const keys =
      scope.kind === "domestic"
        ? ["league:" + scope.league]
        : (scope.comps || []).map((c) => "comp:" + canon(c));

    const editions = seasons.map((season) => {
      const rosters = keys.reduce((n, k) => n + (actual[k]?.[season]?.roster || 0), 0);
      const stubs = keys.reduce((n, k) => n + (actual[k]?.[season]?.stub || 0), 0);
      const expectedRosters = expectedRostersFor(scope, season);
      const touched = rosters + stubs > 0;
      const completenessKnown = expectedRosters != null;
      const complete = completenessKnown ? rosters >= expectedRosters : null;
      return {
        season,
        rosters,
        stubs,
        expectedRosters,
        touched,
        completenessKnown,
        complete,
        missingRosters: completenessKnown ? Math.max(0, expectedRosters - rosters) : null
      };
    });

    const known = editions.filter((e) => e.completenessKnown);
    const unknown = editions.filter((e) => !e.completenessKnown);
    const incompleteKnown = known.filter((e) => !e.complete);
    const completeKnown = known.filter((e) => e.complete);
    const untouched = editions.filter((e) => !e.touched);
    const touched = editions.filter((e) => e.touched);

    const expectedRostersKnown = known.reduce((n, e) => n + e.expectedRosters, 0);
    const rostersBuiltKnown = known.reduce((n, e) => n + Math.min(e.rosters, e.expectedRosters), 0);
    const missingRostersKnown = known.reduce((n, e) => n + e.missingRosters, 0);

    // Prefer a measured depth gap. For domestic full-history production, advance
    // the established completed frontier one season backwards. This prevents a
    // partially covered season (often touched via European competition data)
    // from being skipped, without jumping to unrelated modern seasons whose
    // domestic depth has never been declared. Competition scopes without depth
    // targets retain the breadth-only "newest untouched" fallback.
    const nextKnownIncomplete = incompleteKnown[incompleteKnown.length - 1] || null;
    let nextDomesticFrontier = null;
    const seq = scope.sequentialExpansion ?? null;
    if (scope.kind === "domestic" && seq?.direction === "backward" && seq.anchorSeason) {
      let i = editions.findIndex((e) => e.season === seq.anchorSeason);
      if (i >= 0) {
        // Walk backwards through the contiguous proven-complete run from the
        // declared production anchor. The first unproven edition is the next
        // domestic production target, even if it already contains one roster.
        while (i >= 0 && editions[i].complete === true) i--;
        if (i >= 0) nextDomesticFrontier = editions[i];
      }
    } else if (scope.kind === "domestic" && completeKnown.length) {
      const oldestComplete = completeKnown[0];
      const i = editions.findIndex((e) => e.season === oldestComplete.season);
      if (i > 0 && editions[i - 1].complete !== true) nextDomesticFrontier = editions[i - 1];
    }
    const nextUntouched = untouched[untouched.length - 1] || null;
    const nextEdition = nextKnownIncomplete || nextDomesticFrontier || nextUntouched;
    const nextReason = nextEdition
      ? nextEdition.completenessKnown
        ? "known-incomplete"
        : nextEdition.touched
          ? "touched-depth-unknown"
          : "untouched"
      : null;

    report.push({
      id: scope.id,
      label: scope.label,
      priority: scope.priority,
      editionsInScope: editions.length,
      editionsTouched: touched.length,
      editionsUntouched: untouched.length,
      editionsCompletenessKnown: known.length,
      editionsCompletenessUnknown: unknown.length,
      editionsCompleteKnown: completeKnown.length,
      editionsIncompleteKnown: incompleteKnown.length,
      rostersBuilt: editions.reduce((n, e) => n + e.rosters, 0),
      stubsBuilt: editions.reduce((n, e) => n + e.stubs, 0),
      expectedRostersKnown,
      rostersBuiltKnown,
      missingRostersKnown,
      nextSeason: nextEdition?.season || null,
      nextReason,
      editions
    });
  }

  if (args.has("--json")) {
    console.log(JSON.stringify({ report, unlistedShards: unlisted, missingShards: missing }, null, 2));
    return;
  }

  const next = report.find((r) => r.nextSeason);
  if (args.has("--next")) {
    if (!next) {
      console.log("No provable remaining gap. Any scope with unknown depth still needs expected roster counts before it can be declared complete.");
    } else {
      const suffix =
        next.nextReason === "known-incomplete"
          ? " (known incomplete)"
          : next.nextReason === "touched-depth-unknown"
            ? " (partially touched; depth target unknown)"
            : " (untouched; depth target unknown)";
      console.log(`${next.label} — ${next.nextSeason}${suffix} — edit ${shardForSeason(next.nextSeason)}`);
    }
    return;
  }

  console.log("\nROLL XI — CONTENT COVERAGE\n" + "=".repeat(64));
  console.log(`target v${target.version} (updated ${target.updated})`);
  console.log(`${rows.length} club-season rows across ${new Set(rows.map((r) => r._file)).size} non-empty decade shards\n`);

  for (const r of report) {
    console.log(`${r.label}`);

    if (r.editionsCompletenessKnown > 0) {
      const pct = r.expectedRostersKnown
        ? Math.round((100 * r.rostersBuiltKnown) / r.expectedRostersKnown)
        : 0;
      const bar = "#".repeat(Math.round(pct / 5)).padEnd(20, ".");
      console.log(`  [${bar}] ${pct}% of known roster target  ${r.rostersBuiltKnown}/${r.expectedRostersKnown}`);
      console.log(`  ${r.editionsCompleteKnown}/${r.editionsCompletenessKnown} editions proven complete; ${r.missingRostersKnown} roster rows missing`);
    } else {
      const touchedPct = Math.round((100 * r.editionsTouched) / r.editionsInScope);
      const bar = "#".repeat(Math.round(touchedPct / 5)).padEnd(20, ".");
      console.log(`  [${bar}] ${touchedPct}% breadth only  ${r.editionsTouched}/${r.editionsInScope} editions touched`);
    }

    console.log(`  ${r.rostersBuilt} rosters, ${r.stubsBuilt} stubs`);
    if (r.editionsCompletenessUnknown > 0) {
      console.log(`  !! DEPTH UNKNOWN for ${r.editionsCompletenessUnknown}/${r.editionsInScope} editions.`);
      console.log(`     "Touched" is not completion. Populate expectedRostersPerEdition before declaring them done.`);
    }
    if (r.nextSeason) {
      const why =
        r.nextReason === "known-incomplete"
          ? "known incomplete"
          : r.nextReason === "touched-depth-unknown"
            ? "partially touched; depth target unknown"
            : "untouched; depth target unknown";
      console.log(`  next gap: ${r.nextSeason} (${why}); shard ${shardForSeason(r.nextSeason)}`);
    }
    console.log();
  }

  if (next) {
    console.log("-".repeat(64));
    console.log(`NEXT EDITION TO WORK ON:  ${next.label} ${next.nextSeason}`);
    console.log(`TARGET SHARD:             ${shardForSeason(next.nextSeason)}`);
    if (next.nextReason === "known-incomplete") {
      console.log("This is a measured depth gap, not merely an untouched season.");
    } else if (next.nextReason === "touched-depth-unknown") {
      console.log("This season already has partial content, but its domestic depth is unproven. Establish the expected roster count and complete it before moving further back.");
    } else {
      console.log("This is a breadth gap only; establish expected roster counts before calling the edition complete.");
    }
    console.log("See docs/CONTENT-TARGET.md section 8 for the coverage-production workflow.");
  } else {
    console.log("No provable remaining gap from the counts currently declared.");
    console.log("Scopes with unknown depth still require expected roster counts before the target can be declared complete.");
  }

  if (unlisted.length) console.log(`\nWARNING: shard on disk but not in index.json: ${unlisted.join(", ")}`);
  if (missing.length) console.log(`\nWARNING: shard in index.json but not on disk: ${missing.join(", ")}`);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
