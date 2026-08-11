#!/usr/bin/env node
/*
  Roll XI canonical data validator.

  The production dataset is stored in stable decade shards (clubs-1950s.json,
  clubs-1960s.json, ...). Each club-season must exist exactly once, in the
  shard matching the season start year. Runtime semantics come from `role` and
  `achievements[]`; the old mutually-exclusive `tierType` field is forbidden.

  Run:  node scripts/validate.mjs
        node scripts/validate.mjs --json
*/

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { DETAILED_POSITION_CODES } from "../src/lib/positions.js";

const DATA = path.resolve("public/data");
const args = new Set(process.argv.slice(2));

const CANONICAL_COMPS = new Set(["EC", "UCL", "CWC", "FAIRS", "UEFA", "UEL", "CONFL", "ITC"]);
const CANONICAL_STAGES = new Set(["W", "RU", "SF", "QF", "R16", "GROUP", "MAIN"]);
const DEPRECATED_ALIAS = { UECL: "CONFL", INT: "ITC" };
const DEAD_FIELDS = ["decoys", "tier", "conf", "honour"];
const RATING_MODEL = "absolute-v3";

const CLUB_NAME_ALIASES = new Map([
  ["Olympique Marseille", "Marseille"],
  ["Monaco", "AS Monaco"],
  ["Deportivo La Coruna", "Deportivo La Coruña"],
  ["Deportivo", "Deportivo La Coruña"],
  ["Glasgow Rangers", "Rangers"],
  ["Porto", "FC Porto"],
  ["Girondins Bordeaux", "Bordeaux"],
  ["1.FC Koln", "1. FC Köln"],
  ["Koln", "1. FC Köln"],
  ["SV Hamburg", "Hamburger SV"],
  ["Hamburg", "Hamburger SV"],
  ["Zaragoza", "Real Zaragoza"],
  ["Stuttgart", "VfB Stuttgart"],
  ["Verona", "Hellas Verona"],
  ["Bayern Munich", "Bayern München"],
]);

const KNOWN_DISTINCT_CLUB_PAIRS = new Set([
  ["dundee", "dundee united"].sort().join("|"),
  ["randers", "rangers"].sort().join("|"),
  ["reggiana", "reggina"].sort().join("|"),
]);

const errors = [];
const warnings = [];
const err = (msg, ctx = {}) => errors.push({ msg, ...ctx });
const warn = (msg, ctx = {}) => warnings.push({ msg, ...ctx });

const startYear = (season) => parseInt(String(season || "").slice(0, 4), 10);
const decadeForSeason = (season) => Math.floor(startYear(season) / 10) * 10;
const expectedShardFile = (season) => `clubs-${decadeForSeason(season)}s.json`;

async function loadShards() {
  let index;
  try {
    index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  } catch (e) {
    err(`index.json is not valid JSON: ${e.message}`);
    return { index: null, shards: [] };
  }

  if (index.schema !== "club-season-v2") {
    err(`index.json schema must be "club-season-v2" (got ${JSON.stringify(index.schema)})`);
  }
  if (!Array.isArray(index.shards) || index.shards.length === 0) {
    err(`index.json must contain a non-empty "shards" array`);
    return { index, shards: [] };
  }

  const onDisk = (await readdir(DATA)).filter((f) => /^clubs-\d{4}s\.json$/.test(f));
  const listed = index.shards.map((s) => s.file);

  for (const f of listed) {
    if (!onDisk.includes(f)) err(`index.json lists "${f}" but it does not exist on disk`);
  }
  for (const f of onDisk) {
    if (!listed.includes(f)) err(`"${f}" is on disk but not listed in index.json — it will never load`);
  }

  const seenManifestFiles = new Set();
  for (const shard of index.shards) {
    if (!shard.file) err(`index.json shard entry is missing "file"`);
    if (!shard.name) err(`index.json entry for "${shard.file || "?"}" has no "name"`);
    if (seenManifestFiles.has(shard.file)) err(`index.json lists shard "${shard.file}" more than once`);
    seenManifestFiles.add(shard.file);
    const m = /^clubs-(\d{4})s\.json$/.exec(shard.file || "");
    if (!m) err(`index.json shard filename "${shard.file}" does not follow clubs-YYYYs.json`);
    if (m) {
      const decade = Number(m[1]);
      if (shard.from !== decade || shard.to !== decade + 9) {
        err(`${shard.file} manifest range must be ${decade}-${decade + 9}`);
      }
    }
  }

  const shards = [];
  for (const file of listed) {
    if (!onDisk.includes(file)) continue;
    try {
      const data = JSON.parse(await readFile(path.join(DATA, file), "utf8"));
      shards.push({ file, data });
    } catch (e) {
      err(`"${file}" is not valid JSON: ${e.message}`);
    }
  }
  return { index, shards };
}

function stripAccents(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normaliseClub(v) {
  return stripAccents(v).toLowerCase().replace(/&/g, "and").replace(/\./g, "").replace(/\s+/g, " ").trim();
}

async function loadCrestOverrideKeys() {
  const src = await readFile(path.resolve("src/lib/crestResolver.js"), "utf8");
  const block = src.split("CREST_PAGE_OVERRIDES = {")[1]?.split("\n};")[0] || "";
  return new Set([...block.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]));
}

function validateCompetitionCode(code, context) {
  if (DEPRECATED_ALIAS[code]) {
    err(`${context} uses deprecated competition code "${code}" — should be "${DEPRECATED_ALIAS[code]}"`);
  } else if (code && !CANONICAL_COMPS.has(code)) {
    err(`${context} uses unknown competition code "${code}"`);
  }
}

async function main() {
  const { shards } = await loadShards();
  const crestKeys = await loadCrestOverrideKeys();

  const idOwner = new Map();
  const clubSeasonOwner = new Map();
  const clubNamesByNorm = new Map();
  let rowsChecked = 0;

  for (const { file, data } of shards) {
    const fileDecade = Number(/^clubs-(\d{4})s\.json$/.exec(file)?.[1]);
    if (data?.meta?.schema !== "club-season-v2") {
      err(`${file} meta.schema must be "club-season-v2"`);
    }
    if (data?.meta?.ratingModel !== RATING_MODEL) {
      err(`${file} meta.ratingModel must be "${RATING_MODEL}" — run npm run ratings:recalibrate before release`);
    }
    if (!Array.isArray(data.squads)) {
      err(`${file} must contain a "squads" array`);
      continue;
    }

    for (const row of data.squads) {
      rowsChecked++;
      const ctx = `${row.id || row.club || "unnamed row"} in ${file}`;

      if (row.tierType !== undefined) {
        err(`${ctx} still carries legacy "tierType" — role + achievements[] are the canonical schema`);
      }

      if (!row.id) {
        err(`squad with no "id" in ${file} (club: ${row.club || "?"}, season: ${row.season || "?"})`);
      } else if (idOwner.has(row.id)) {
        err(`duplicate id "${row.id}" in ${file} (first seen in ${idOwner.get(row.id)})`);
      } else {
        idOwner.set(row.id, file);
      }

      const clubSeasonKey = `${row.club || "?"}|${row.season || "?"}`;
      if (clubSeasonOwner.has(clubSeasonKey)) {
        err(`duplicate club-season "${clubSeasonKey}" in ${file} (first seen in ${clubSeasonOwner.get(clubSeasonKey)})`);
      } else {
        clubSeasonOwner.set(clubSeasonKey, file);
      }

      const y = startYear(row.season);
      if (!Number.isFinite(y)) {
        err(`${ctx} has invalid season ${JSON.stringify(row.season)}`);
      } else {
        const expected = expectedShardFile(row.season);
        if (expected !== file || decadeForSeason(row.season) !== fileDecade) {
          err(`${ctx} belongs in ${expected}, not ${file}`);
        }
      }

      if (row.club) {
        const canonical = CLUB_NAME_ALIASES.get(row.club);
        if (canonical) err(`non-canonical club display name "${row.club}" in ${row.id || file} — use "${canonical}"`);
        const n = normaliseClub(row.club);
        if (!clubNamesByNorm.has(n)) clubNamesByNorm.set(n, new Set());
        clubNamesByNorm.get(n).add(row.club);
      }

      if (row.role !== "roster" && row.role !== "stub") {
        err(`${ctx} has invalid "role" ${JSON.stringify(row.role)} — must be "roster" or "stub"`);
      }
      if (!Array.isArray(row.achievements)) {
        err(`${ctx} has no achievements[] array — use [] when there is no European achievement/coverage fact`);
      } else {
        for (const a of row.achievements) {
          validateCompetitionCode(a.comp, `${ctx} achievement`);
          if (!CANONICAL_STAGES.has(a.stage)) err(`${ctx} has achievement with unknown stage "${a.stage}"`);
          if ((a.season || row.season) !== row.season) {
            err(`${ctx} has achievement season ${JSON.stringify(a.season)} that does not match the club-season`);
          }
        }
      }

      if (row.role === "roster") {
        const players = row.players || [];
        if (!Array.isArray(row.players)) err(`${ctx} is role "roster" but has no players[] array`);
        if (players.length < 11) err(`${ctx} has only ${players.length} players (minimum 11)`);
        if (!players.some((p) => p.p === "GK")) err(`${ctx} has no goalkeeper`);
        if (players.length > 0 && (players.length < 12 || players.length > 20)) {
          warn(`${ctx} has ${players.length} players — house standard is 16, outside 12-20 is worth a second look`);
        }
        const ratings = [];
        for (const p of players) {
          if (!Number.isFinite(Number(p.r))) {
            err(`${ctx}: ${p.n || "unnamed player"} has invalid rating ${JSON.stringify(p.r)}`);
          } else {
            const rating = Number(p.r);
            ratings.push(rating);
            if (rating < 62 || rating > 97) err(`${ctx}: ${p.n || "unnamed player"} rating ${rating} is outside the 62-97 scale`);
          }
          if (!Array.isArray(p.dp) || p.dp.length === 0) {
            err(`${ctx}: ${p.n || "unnamed player"} has malformed dp ${JSON.stringify(p.dp)} — detailed positions must be a non-empty array`);
            continue;
          }
          for (const code of p.dp) {
            if (!DETAILED_POSITION_CODES.has(String(code || "").toUpperCase())) {
              err(`${ctx}: ${p.n || "unnamed player"} uses unknown detailed position code ${JSON.stringify(code)}`);
            }
          }
        }
        if (ratings.length >= 12) {
          const rMean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          const rMin = Math.min(...ratings), rMax = Math.max(...ratings);
          const variance = ratings.reduce((sum, r) => sum + (r - rMean) ** 2, 0) / ratings.length;
          const rSd = Math.sqrt(variance);
          const ratingCounts = new Map();
          ratings.forEach((r) => ratingCounts.set(r, (ratingCounts.get(r) || 0) + 1));
          const maxSameRating = Math.max(...ratingCounts.values());
          if (rMax - rMin < 6) err(`${ctx} rating range ${rMin}-${rMax} is too flat for ${ratings.length} players`);
          if (rSd < 2) err(`${ctx} rating SD ${rSd.toFixed(2)} is too flat for ${ratings.length} players`);
          if (ratingCounts.size < 5) err(`${ctx} has only ${ratingCounts.size} distinct player ratings`);
          if (maxSameRating / ratings.length > 0.40) err(`${ctx} has ${maxSameRating}/${ratings.length} players on the same rating`);
          if (rMean < 75 && rMin >= 70) err(`${ctx} averages ${rMean.toFixed(2)} but has no player below 70`);
        }
      } else if (row.role === "stub") {
        if (Array.isArray(row.players) && row.players.length) err(`${ctx} is role "stub" but contains players[]`);
        if (!Number.isFinite(row.rating)) err(`${ctx} is role "stub" but has no numeric rating`);
      }

      for (const e of row.euro || []) validateCompetitionCode(e.comp, `${ctx} euro[]`);
      for (const c of row.comps || []) validateCompetitionCode(c, `${ctx} comps[]`);

      for (const f of DEAD_FIELDS) {
        if (f in row) warn(`${ctx} carries dead field "${f}" (not read anywhere in src/)`);
      }

      if (row.club) {
        const n = normaliseClub(row.club);
        if (!crestKeys.has(n)) {
          warn(`"${row.club}" (in ${row.id || file}) has no entry in CREST_PAGE_OVERRIDES — falls back to live Wikipedia search`);
        }
      }
    }
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }
  const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
  const containsWhole = (a, b) => ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);

  const normList = [...clubNamesByNorm.keys()];
  const reported = new Set();
  for (let i = 0; i < normList.length; i++) {
    const a = normList[i];
    if (reported.has(a)) continue;
    for (let j = i + 1; j < normList.length; j++) {
      const b = normList[j];
      if (reported.has(b) || a === b) continue;
      const pairKey = [a, b].sort().join("|");
      if (KNOWN_DISTINCT_CLUB_PAIRS.has(pairKey)) continue;
      const bothLongEnough = a.length >= 5 && b.length >= 5;
      if (containsWhole(a, b) || (bothLongEnough && similarity(a, b) > 0.82)) {
        const names = [...clubNamesByNorm.get(a), ...clubNamesByNorm.get(b)];
        warn(`possible same-club spelling variants: ${names.map((n) => `"${n}"`).join(" / ")} — confirm same club before merging`);
        reported.add(a); reported.add(b);
      }
    }
  }

  if (args.has("--json")) {
    console.log(JSON.stringify({ errors, warnings, shardsChecked: shards.length, rowsChecked }, null, 2));
  } else {
    console.log("\nROLL XI — DATA VALIDATION\n" + "=".repeat(64));
    console.log(`${shards.length} decade shards, ${rowsChecked} club-seasons checked\n`);
    if (errors.length) {
      console.log(`ERRORS (${errors.length}) — must fix:\n`);
      errors.forEach((e) => console.log("  ✗ " + e.msg));
      console.log();
    } else {
      console.log("No errors.\n");
    }
    if (warnings.length) {
      console.log(`WARNINGS (${warnings.length}) — review, doesn't block:\n`);
      warnings.forEach((w) => console.log("  ! " + w.msg));
      console.log();
    }
  }
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
