#!/usr/bin/env node
/*
  Roll XI coverage-production helper.

  Purpose: turn a researched, machine-readable source matrix into a consistent
  16-player candidate edition, while concentrating human review on exceptions.
  It does not browse the web and it does not replace historical judgement.

  Usage:
    node scripts/prepare-coverage.mjs --input path/to/matrix.json
    node scripts/prepare-coverage.mjs --input path/to/matrix.json --apply
    node scripts/prepare-coverage.mjs --self-test

  Default output is written to coverage-work/ (gitignored). --apply writes the
  finalised rows into the canonical decade shard only when release blockers and
  unreviewed Priority A exceptions are clear.
*/

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(".");
const DATA = path.join(ROOT, "public/data");
const WORK = path.join(ROOT, "coverage-work");
const VALID_STAGES = new Set(["W", "RU", "SF", "QF", "R16", "GROUP", "MAIN"]);
const BROAD_POS = new Set(["GK", "DF", "MF", "FW"]);
function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const args = new Set(process.argv.slice(2));
const normaliseText = (v) => String(v ?? "").trim();
const stripAccents = (v) => normaliseText(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normaliseName = (v) => stripAccents(v).toLowerCase().replace(/[.’'`-]/g, " ").replace(/\s+/g, " ").trim();
const normaliseClub = normaliseName;
const normaliseNationality = (v) => {
  const k = normaliseName(v);
  const aliases = new Map([
    ["czech republic", "czechia"], ["republic of ireland", "ireland"],
    ["turkiye", "turkey"], ["bosnia herzegovina", "bosnia and herzegovina"],
    ["cabo verde", "cape verde"]
  ]);
  return aliases.get(k) || k;
};
const startYear = (season) => parseInt(String(season || "").slice(0, 4), 10);
const shardForSeason = (season) => `clubs-${Math.floor(startYear(season) / 10) * 10}s.json`;
const seasonToken = (season) => String(season).replace(/[^0-9]/g, "").slice(-4);
const slug = (v) => stripAccents(v).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
const generatedId = (edition, club) => `${String(edition.competition).toLowerCase()}-${slug(club)}-${seasonToken(edition.season)}`;
const finite = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

function broadPosition(player) {
  const direct = normaliseText(player.p).toUpperCase();
  if (BROAD_POS.has(direct)) return direct;
  const raw = normaliseText(player.position || player.pos).toUpperCase();
  if (/GOAL|\bGK\b/.test(raw)) return "GK";
  if (/DEF|BACK|\bDF\b/.test(raw)) return "DF";
  if (/MID|\bMF\b/.test(raw)) return "MF";
  if (/FORW|STRIK|WING|\bFW\b/.test(raw)) return "FW";
  return "";
}

function statBlock(player, key) {
  const block = player[key] || {};
  return {
    minutes: finite(block.minutes),
    apps: finite(block.apps ?? block.appearances),
    starts: finite(block.starts)
  };
}

function participated(player) {
  const c = statBlock(player, "competition");
  return c.minutes > 0 || c.apps > 0 || c.starts > 0;
}

function rankingTuple(player, useSeason = false) {
  const s = statBlock(player, useSeason ? "season" : "competition");
  return [s.minutes, s.apps, s.starts];
}

function comparePlayers(a, b, useSeason = false) {
  const aa = rankingTuple(a, useSeason);
  const bb = rankingTuple(b, useSeason);
  for (let i = 0; i < aa.length; i++) if (bb[i] !== aa[i]) return bb[i] - aa[i];
  return normaliseText(a.n || a.name).localeCompare(normaliseText(b.n || b.name), "en");
}

function sameDetailedPosition(a, b) {
  const x = [...(a || [])].map(String).map((v) => v.toUpperCase()).sort();
  const y = [...(b || [])].map(String).map((v) => v.toUpperCase()).sort();
  return JSON.stringify(x) === JSON.stringify(y);
}

function addFlag(flags, severity, code, message, club = null, player = null, reviewable = false) {
  flags.push({ severity, code, message, club, player, reviewable });
}

async function loadDatabase() {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  const shards = new Map();
  const rows = [];
  for (const entry of index.shards) {
    const file = entry.file;
    const json = JSON.parse(await readFile(path.join(DATA, file), "utf8"));
    shards.set(file, json);
    for (const row of json.squads || []) rows.push({ ...row, _file: file });
  }
  const target = JSON.parse(await readFile(path.join(DATA, "coverage-target.json"), "utf8"));
  return { index, shards, rows, target };
}

function buildIdentityIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    for (const p of row.players || []) {
      const key = normaliseName(p.n);
      if (!key) continue;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({
        n: p.n,
        nat: p.nat,
        p: p.p,
        dp: p.dp,
        club: row.club,
        season: row.season,
        rating: p.r
      });
    }
  }
  return index;
}

function consensus(values, keyFn = (v) => v) {
  const clean = values.filter((v) => v !== undefined && v !== null && v !== "");
  if (!clean.length) return { value: null, unanimous: false };
  const keys = new Map();
  for (const value of clean) {
    const key = keyFn(value);
    if (!keys.has(key)) keys.set(key, { value, n: 0 });
    keys.get(key).n++;
  }
  const sorted = [...keys.values()].sort((a, b) => b.n - a.n);
  return { value: sorted[0].value, unanimous: sorted.length === 1, variants: sorted };
}

function enrichPlayer(raw, identityIndex, flags, clubName) {
  const p = structuredClone(raw);
  p.n = normaliseText(p.n || p.name);
  const matches = identityIndex.get(normaliseName(p.n)) || [];
  const natConsensus = consensus(matches.map((x) => x.nat), normaliseNationality);
  const broadConsensus = consensus(matches.map((x) => x.p), (v) => String(v).toUpperCase());
  const dpConsensus = consensus(matches.map((x) => x.dp), (v) => JSON.stringify([...(v || [])].map(String).map((x) => x.toUpperCase()).sort()));

  if (!p.nat && natConsensus.unanimous) p.nat = natConsensus.value;
  if (!p.p && broadConsensus.unanimous) p.p = broadConsensus.value;

  if (p.nat && natConsensus.value && !natConsensus.unanimous) {
    addFlag(flags, "A", "NATIONALITY_CONFLICT", `${p.n} has multiple nationalities in existing Roll XI records; source value is ${p.nat}.`, clubName, p.n, true);
  } else if (p.nat && natConsensus.unanimous && normaliseNationality(p.nat) !== normaliseNationality(natConsensus.value)) {
    addFlag(flags, "A", "NATIONALITY_CONFLICT", `${p.n} nationality ${p.nat} conflicts with existing consensus ${natConsensus.value}.`, clubName, p.n, true);
  }

  const broad = broadPosition(p);
  if (broad) p.p = broad;
  if ((!Array.isArray(p.dp) || !p.dp.length) && p.p) p.dp = [p.p];
  if (p.p && broadConsensus.value && !broadConsensus.unanimous) {
    addFlag(flags, "B", "BROAD_POSITION_CONFLICT", `${p.n} has multiple broad positions in existing Roll XI records; current source says ${p.p}.`, clubName, p.n);
  } else if (p.p && broadConsensus.unanimous && p.p !== broadConsensus.value) {
    addFlag(flags, "B", "BROAD_POSITION_CONFLICT", `${p.n} broad position ${p.p} conflicts with existing consensus ${broadConsensus.value}.`, clubName, p.n);
  }

  if (Array.isArray(p.dp) && p.dp.length && dpConsensus.value && !dpConsensus.unanimous) {
    addFlag(flags, "B", "DETAIL_POSITION_CONFLICT", `${p.n} has differing detailed positions across existing Roll XI records; current-season source is retained for review.`, clubName, p.n);
  } else if (Array.isArray(p.dp) && p.dp.length && dpConsensus.unanimous && !sameDetailedPosition(p.dp, dpConsensus.value)) {
    addFlag(flags, "B", "DETAIL_POSITION_CONFLICT", `${p.n} detailed position ${JSON.stringify(p.dp)} differs from existing consensus ${JSON.stringify(dpConsensus.value)}.`, clubName, p.n);
  }

  const priorRatings = matches.map((x) => Number(x.rating)).filter(Number.isFinite).sort((a, b) => a - b);
  if (Number.isFinite(Number(p.r)) && priorRatings.length) {
    const mid = Math.floor(priorRatings.length / 2);
    const median = priorRatings.length % 2 ? priorRatings[mid] : (priorRatings[mid - 1] + priorRatings[mid]) / 2;
    if (Math.abs(Number(p.r) - median) >= 8) {
      addFlag(flags, "B", "RATING_IDENTITY_OUTLIER", `${p.n} rating ${Number(p.r)} is ${Math.abs(Number(p.r) - median)} points from the median ${median} in existing Roll XI records.`, clubName, p.n);
    }
  }

  p._identityMatches = matches.length;
  return p;
}

function selectRoster(rawPlayers, flags, clubName) {
  const unique = [];
  const seen = new Set();
  for (const player of rawPlayers) {
    const key = normaliseName(player.n || player.name);
    if (!key) continue;
    if (seen.has(key)) {
      addFlag(flags, "BLOCK", "DUPLICATE_PLAYER", `Duplicate player identity ${player.n || player.name} in source matrix.`, clubName, player.n || player.name);
      continue;
    }
    seen.add(key);
    unique.push(player);
  }

  for (const p of unique) {
    if (p.selection !== undefined && !["include", "exclude"].includes(p.selection)) {
      addFlag(flags, "BLOCK", "INVALID_SELECTION_OVERRIDE", `${clubName}: ${p.n} has invalid selection override ${JSON.stringify(p.selection)}; use "include" or "exclude".`, clubName, p.n);
    }
  }

  const includedPool = unique.filter((p) => p.selection !== "exclude");
  const comp = includedPool.filter(participated).sort((a, b) => comparePlayers(a, b, false));
  const registeredFallback = includedPool
    .filter((p) => !participated(p) && p.registered === true)
    .sort((a, b) => comparePlayers(a, b, true));

  if (comp.length < 16) {
    addFlag(flags, "A", "UNDER_16_COMPETITION_PARTICIPANTS", `${clubName} has only ${comp.length} players with recorded competition-proper participation; verified registered/season squad depth is required for the remainder.`, clubName, null, true);
  }

  const pool = [...comp, ...registeredFallback];
  const forced = pool.filter((p) => p.selection === "include");
  const invalidForced = includedPool.filter((p) => p.selection === "include" && !pool.includes(p));
  if (invalidForced.length) {
    addFlag(flags, "BLOCK", "INVALID_FORCED_SELECTION", `${clubName} force-includes ${invalidForced.map((p) => p.n).join(", ")} without competition participation or registered fallback evidence.`, clubName);
  }
  if (forced.length > 16) {
    addFlag(flags, "BLOCK", "TOO_MANY_FORCED_SELECTIONS", `${clubName} force-includes ${forced.length} players; maximum roster size is 16.`, clubName);
  }
  if (pool.length < 16) {
    addFlag(flags, "BLOCK", "UNDER_16_ELIGIBLE_PLAYERS", `${clubName} has only ${pool.length} eligible players after registered fallbacks; cannot build a 16-player roster.`, clubName);
    return { selected: pool, comp, fallbackUsed: Math.max(0, pool.length - comp.length) };
  }

  const forcedKeys = new Set(forced.map((p) => normaliseName(p.n)));
  let selected = [...forced, ...pool.filter((p) => !forcedKeys.has(normaliseName(p.n)))].slice(0, 16);
  const selectedHasGK = selected.some((p) => broadPosition(p) === "GK");
  if (!selectedHasGK) {
    const bestGK = pool.find((p) => broadPosition(p) === "GK");
    if (!bestGK) {
      addFlag(flags, "BLOCK", "NO_GOALKEEPER", `${clubName} has no eligible goalkeeper in the source matrix.`, clubName);
    } else {
      const replaceAt = [...selected].map((p, i) => ({ p, i })).reverse().find(({ p }) => p.selection !== "include")?.i;
      if (replaceAt === undefined) {
        addFlag(flags, "BLOCK", "FORCED_SELECTION_EXCLUDES_GOALKEEPER", `${clubName} force-includes 16 outfield players, leaving no slot for an eligible goalkeeper.`, clubName);
      } else {
        selected[replaceAt] = bestGK;
        addFlag(flags, "B", "GOALKEEPER_FORCED_IN", `${clubName}'s highest-ranked goalkeeper fell outside the initial top 16 and was forced into the game roster.`, clubName);
      }
    }
  }

  if (comp.length > 16) {
    const p16 = comp[15];
    const p17 = comp[16];
    const a = statBlock(p16, "competition");
    const b = statBlock(p17, "competition");
    if (Math.abs(a.minutes - b.minutes) <= 90 || Math.abs(a.apps - b.apps) <= 1) {
      addFlag(flags, "B", "CUTOFF_AMBIGUITY", `${clubName}: 16th/17th competition-participation cut-off is close (${p16.n}: ${a.minutes} min/${a.apps} apps; ${p17.n}: ${b.minutes} min/${b.apps} apps).`, clubName);
    }
  }

  return { selected, comp, fallbackUsed: selected.filter((p) => !participated(p)).length };
}

function releaseFieldChecks(selected, flags, clubName, status) {
  if (status !== "final") return;
  for (const p of selected) {
    if (!p.n) addFlag(flags, "BLOCK", "MISSING_PLAYER_NAME", `${clubName} has a selected player without a name.`, clubName);
    if (!p.nat) addFlag(flags, "BLOCK", "MISSING_NATIONALITY", `${clubName}: ${p.n || "unknown player"} has no nationality.`, clubName, p.n);
    if (!BROAD_POS.has(p.p)) addFlag(flags, "BLOCK", "MISSING_BROAD_POSITION", `${clubName}: ${p.n || "unknown player"} has no valid broad position.`, clubName, p.n);
    if (!Array.isArray(p.dp) || !p.dp.length) addFlag(flags, "BLOCK", "MISSING_DETAILED_POSITION", `${clubName}: ${p.n || "unknown player"} has no detailed position array.`, clubName, p.n);
    if (!Number.isFinite(Number(p.r)) || Number(p.r) < 62 || Number(p.r) > 97) addFlag(flags, "BLOCK", "MISSING_OR_INVALID_RATING", `${clubName}: ${p.n || "unknown player"} needs a final Roll XI rating between 62 and 97.`, clubName, p.n);
  }
}

function playerForGame(p) {
  return {
    n: p.n,
    p: p.p || "",
    r: Number.isFinite(Number(p.r)) ? Number(p.r) : null,
    nat: p.nat || "",
    dp: Array.isArray(p.dp) ? [...p.dp] : []
  };
}

function achievementFor(edition, stage) {
  return { comp: edition.competition, season: edition.season, stage };
}

function prepareClub(clubInput, edition, db, identityIndex, globalFlags, status) {
  const clubFlags = [];
  const club = normaliseText(clubInput.club);
  const existing = db.rows.find((r) => r.season === edition.season && normaliseClub(r.club) === normaliseClub(club));
  const reviewed = new Set(clubInput.reviewedExceptions || []);

  if (!club) addFlag(clubFlags, "BLOCK", "MISSING_CLUB_NAME", `Edition contains a club without a name.`);
  if (!VALID_STAGES.has(clubInput.stage)) addFlag(clubFlags, "BLOCK", "INVALID_STAGE", `${club || "Unknown club"} has invalid stage ${JSON.stringify(clubInput.stage)}.`, club);
  if (existing?.role === "roster") {
    addFlag(clubFlags, "A", "EXISTING_ROSTER_REPLACEMENT", `${club} ${edition.season} already has a roster (${existing.id}); applying this matrix would replace its player list.`, club, null, true);
  }

  if (status === "final") {
    if (!clubInput.sources?.appearances) addFlag(clubFlags, "BLOCK", "MISSING_APPEARANCE_SOURCE", `${club} has no competition-specific appearance source recorded in the matrix.`, club);
    if (!clubInput.sources?.identity) addFlag(clubFlags, "BLOCK", "MISSING_IDENTITY_SOURCE", `${club} has no identity/nationality/position cross-check source recorded in the matrix.`, club);
  }

  const enriched = (clubInput.players || []).map((p) => enrichPlayer(p, identityIndex, clubFlags, club));
  const { selected, comp, fallbackUsed } = selectRoster(enriched, clubFlags, club);
  releaseFieldChecks(selected, clubFlags, club, status);

  const ratings = selected.map((p) => Number(p.r)).filter(Number.isFinite);
  if (ratings.length === 16) {
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    if (mean < 74 || mean > 83) addFlag(clubFlags, "B", "RATING_MEAN_OUTLIER", `${club} candidate rating mean is ${mean.toFixed(2)}, outside the usual 74-83 release review band.`, club);
  }

  for (const flag of clubFlags) {
    flag.reviewed = flag.reviewable && reviewed.has(flag.code);
    if (flag.reviewable && reviewed.has(flag.code)) flag.severity = "A-REVIEWED";
    globalFlags.push(flag);
  }

  const base = existing ? structuredClone(existing) : {};
  delete base._file;
  const id = existing?.id || clubInput.id || generatedId(edition, club);
  const achievements = (base.achievements || []).filter((a) => !(a.comp === edition.competition && (a.season || base.season) === edition.season));
  achievements.push(achievementFor(edition, clubInput.stage));
  const euro = (base.euro || []).filter((a) => !(a.comp === edition.competition && (a.season || base.season) === edition.season));
  euro.push({ comp: edition.competition, season: edition.season });

  const row = {
    ...base,
    id,
    club,
    country: clubInput.country || base.country,
    ...(clubInput.league || base.league ? { league: clubInput.league || base.league } : {}),
    season: edition.season,
    kit: clubInput.kit || base.kit,
    crest: clubInput.crest !== undefined ? clubInput.crest : (base.crest ?? null),
    players: selected.map(playerForGame),
    euro,
    role: "roster",
    achievements
  };
  delete row.rating;
  delete row.scorers;

  if (status === "final") {
    if (!row.country) addFlag(globalFlags, "BLOCK", "MISSING_COUNTRY", `${club} has no country.`, club);
    if (!Array.isArray(row.kit) || row.kit.length < 2) addFlag(globalFlags, "BLOCK", "MISSING_KIT", `${club} needs a two-colour kit array before release.`, club);
  }

  return {
    club,
    existing: existing ? { id: existing.id, role: existing.role, file: existing._file } : null,
    action: existing ? (existing.role === "stub" ? "upgrade-stub" : "replace-roster") : "add",
    competitionParticipants: comp.length,
    fallbackUsed,
    selectedNames: selected.map((p) => p.n),
    row
  };
}

function editionReleaseChecks(matrix, clubs, db, flags) {
  const edition = matrix.edition;
  const reviewed = new Set(matrix.reviewedExceptions || []);
  if (matrix.status === "final") {
    if (!matrix.sources?.participants) addFlag(flags, "BLOCK", "MISSING_PARTICIPANT_SOURCE", `Final matrix must record the authoritative main-draw participant source.`);
    if (!matrix.sources?.results) addFlag(flags, "BLOCK", "MISSING_RESULTS_SOURCE", `Final matrix must record the authoritative results/stage source.`);
  }
  const expected = Number(edition.expectedParticipants);
  if (!Number.isFinite(expected) || expected <= 0) {
    addFlag(flags, "BLOCK", "MISSING_EXPECTED_PARTICIPANTS", `edition.expectedParticipants must be a positive researched number.`);
  } else if (clubs.length !== expected) {
    addFlag(flags, "BLOCK", "PARTICIPANT_COUNT_MISMATCH", `Matrix contains ${clubs.length} clubs but edition expects ${expected}.`);
  }

  const seenClub = new Set();
  const seenId = new Map();
  for (const c of clubs) {
    const ck = normaliseClub(c.club);
    if (seenClub.has(ck)) addFlag(flags, "BLOCK", "DUPLICATE_CLUB", `Edition contains ${c.club} more than once.`, c.club);
    seenClub.add(ck);
    if (seenId.has(c.row.id) && seenId.get(c.row.id) !== c.club) addFlag(flags, "BLOCK", "GENERATED_ID_COLLISION", `ID ${c.row.id} is shared by ${seenId.get(c.row.id)} and ${c.club}.`);
    seenId.set(c.row.id, c.club);
    const dbCollision = db.rows.find((r) => r.id === c.row.id && !(r.season === edition.season && normaliseClub(r.club) === ck));
    if (dbCollision) addFlag(flags, "BLOCK", "GENERATED_ID_COLLISION", `ID ${c.row.id} already belongs to ${dbCollision.club} ${dbCollision.season}.`, c.club);
  }

  for (const flag of flags) {
    if (!flag.club && flag.reviewable && reviewed.has(flag.code) && !flag.reviewed) {
      flag.reviewed = true;
      flag.severity = "A-REVIEWED";
    }
  }
}

function editionRatingChecks(clubs, flags) {
  const ratings = clubs.flatMap((c) => c.row.players.map((p) => Number(p.r)).filter(Number.isFinite));
  if (!ratings.length) return { count: 0, mean: null, min: null, max: null };
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const stats = { count: ratings.length, mean, min: Math.min(...ratings), max: Math.max(...ratings) };
  if (ratings.length === clubs.length * 16 && (mean < 74 || mean > 83)) {
    addFlag(flags, "B", "EDITION_RATING_MEAN_OUTLIER", `Edition candidate rating mean is ${mean.toFixed(2)}, outside the usual 74-83 release review band.`);
  }
  return stats;
}

function coverageDelta(matrix, clubs, db) {
  const { competition, season, expectedParticipants } = matrix.edition;
  const current = db.rows.filter((r) => (r.achievements || []).some((a) => a.comp === competition && (a.season || r.season) === season));
  const currentRosters = current.filter((r) => r.role === "roster").length;
  const currentStubs = current.filter((r) => r.role === "stub").length;
  const afterMap = new Map(current.map((r) => [normaliseClub(r.club), r.role]));
  for (const c of clubs) afterMap.set(normaliseClub(c.club), "roster");
  const afterRosters = [...afterMap.values()].filter((role) => role === "roster").length;
  return {
    currentRosters,
    currentStubs,
    candidateRosters: clubs.length,
    afterRosters,
    expectedParticipants: Number(expectedParticipants),
    missingAfter: Math.max(0, Number(expectedParticipants) - afterRosters),
    newRows: clubs.filter((c) => c.action === "add").length,
    stubUpgrades: clubs.filter((c) => c.action === "upgrade-stub").length,
    rosterReplacements: clubs.filter((c) => c.action === "replace-roster").length
  };
}

function markdownReport(result) {
  const { matrix, summary, flags, clubs } = result;
  const lines = [];
  lines.push(`# Coverage production report — ${matrix.edition.competition} ${matrix.edition.season}`, "");
  lines.push(`Status: **${matrix.status || "draft"}**`, "");
  lines.push(`Participants in matrix: ${clubs.length}/${matrix.edition.expectedParticipants}`);
  lines.push(`Current pickable rosters: ${summary.coverage.currentRosters}`);
  lines.push(`Projected pickable rosters after apply: ${summary.coverage.afterRosters}/${summary.coverage.expectedParticipants}`);
  lines.push(`New rows: ${summary.coverage.newRows}; stub upgrades: ${summary.coverage.stubUpgrades}; roster replacements: ${summary.coverage.rosterReplacements}`);
  if (summary.rating.count) lines.push(`Candidate ratings: mean ${summary.rating.mean.toFixed(2)}, range ${summary.rating.min}-${summary.rating.max} (${summary.rating.count} players)`);
  lines.push("");
  lines.push(`Blocking flags: ${summary.blockers}; unreviewed Priority A: ${summary.unreviewedPriorityA}; reviewed Priority A: ${summary.reviewedPriorityA}; Priority B: ${summary.priorityB}`, "");

  lines.push("## Exception report", "");
  if (!flags.length) lines.push("No exceptions detected.", "");
  else {
    for (const f of flags) {
      const where = [f.club, f.player].filter(Boolean).join(" / ");
      lines.push(`- **${f.severity} ${f.code}**${where ? ` — ${where}` : ""}: ${f.message}`);
    }
    lines.push("");
  }

  lines.push("## Club candidates", "");
  for (const c of clubs) {
    lines.push(`### ${c.club}`);
    lines.push(`Action: ${c.action}; competition participants available: ${c.competitionParticipants}; registered fallback selected: ${c.fallbackUsed}.`);
    lines.push("");
    c.row.players.forEach((p, i) => lines.push(`${i + 1}. ${p.n} — ${p.p}/${p.dp.join("+")} — ${p.nat} — ${p.r}`));
    lines.push("");
  }

  lines.push("## Audit block", "");
  lines.push("Copy or adapt this section into `docs/COVERAGE-AUDIT.md` after human review and release:", "");
  lines.push("```markdown");
  lines.push(`## ${new Date().toISOString().slice(0, 10)} — ${matrix.edition.competition} ${matrix.edition.season} coverage`);
  lines.push("");
  lines.push(`- Main-draw participants: ${clubs.length}/${matrix.edition.expectedParticipants}.`);
  lines.push(`- Candidate-generation rule: competition-proper minutes, then appearances/starts; goalkeeper enforced; verified registered fallbacks used only where participation evidence supplied fewer than 16 players.`);
  lines.push(`- Storage target: \`${shardForSeason(matrix.edition.season)}\`.`);
  lines.push(`- Stub upgrades: ${summary.coverage.stubUpgrades}; new club-seasons: ${summary.coverage.newRows}; replacements reviewed: ${summary.coverage.rosterReplacements}.`);
  lines.push(`- Priority A exceptions reviewed: ${summary.reviewedPriorityA}; unresolved: ${summary.unreviewedPriorityA}; blockers: ${summary.blockers}.`);
  lines.push(`- Release gate: run \`npm run validate\`, \`npm run coverage\` and \`npm run build\` before release.`);
  lines.push("```");
  return lines.join("\n") + "\n";
}

function summarise(flags, coverage) {
  return {
    coverage,
    blockers: flags.filter((f) => f.severity === "BLOCK").length,
    unreviewedPriorityA: flags.filter((f) => f.severity === "A").length,
    reviewedPriorityA: flags.filter((f) => f.severity === "A-REVIEWED").length,
    priorityB: flags.filter((f) => f.severity === "B").length
  };
}

function expectedFromTarget(matrix, db) {
  const season = matrix.edition?.season;
  const comp = matrix.edition?.competition;
  const scope = matrix.edition?.scopeId
    ? db.target?.scopes?.find((s) => s.id === matrix.edition.scopeId)
    : db.target?.scopes?.find((s) => (s.comps || []).includes(comp));
  const spec = scope?.expectedRostersPerEdition;
  if (typeof spec === "number") return spec;
  if (spec && typeof spec === "object" && Number.isFinite(Number(spec[season]))) return Number(spec[season]);
  return null;
}

async function prepare(matrix, db) {
  if (matrix.schema !== "rollxi-coverage-matrix-v1") throw new Error(`Matrix schema must be "rollxi-coverage-matrix-v1".`);
  const edition = matrix.edition || {};
  if (!edition.competition || !edition.season) throw new Error(`Matrix edition must contain competition and season.`);
  const flags = [];
  const explicitExpected = Number.isFinite(Number(edition.expectedParticipants)) ? Number(edition.expectedParticipants) : null;
  const targetExpected = expectedFromTarget(matrix, db);
  if (targetExpected != null) {
    if (explicitExpected != null && explicitExpected !== targetExpected) {
      addFlag(flags, "BLOCK", "EXPECTED_PARTICIPANTS_CONFLICT", `Matrix expectedParticipants=${explicitExpected} conflicts with the researched coverage target ${targetExpected} for ${edition.season}.`);
    }
    edition.expectedParticipants = targetExpected;
  } else if (explicitExpected != null) {
    edition.expectedParticipants = explicitExpected;
  }
  const identityIndex = buildIdentityIndex(db.rows);
  const clubs = (matrix.clubs || []).map((c) => prepareClub(c, edition, db, identityIndex, flags, matrix.status || "draft"));
  editionReleaseChecks(matrix, clubs, db, flags);
  const rating = editionRatingChecks(clubs, flags);
  const coverage = coverageDelta(matrix, clubs, db);
  const summary = { ...summarise(flags, coverage), rating };
  return { matrix, clubs, flags, summary };
}

async function writeOutputs(result, inputPath) {
  await mkdir(WORK, { recursive: true });
  const base = `${String(result.matrix.edition.competition).toLowerCase()}-${result.matrix.edition.season}`;
  const draftFile = path.join(WORK, `${base}.draft.json`);
  const reportFile = path.join(WORK, `${base}.report.md`);
  const draft = {
    schema: "rollxi-coverage-draft-v1",
    sourceMatrix: path.relative(ROOT, inputPath),
    edition: result.matrix.edition,
    summary: result.summary,
    shard: shardForSeason(result.matrix.edition.season),
    rows: result.clubs.map((c) => ({ action: c.action, existing: c.existing, row: c.row })),
    flags: result.flags
  };
  await writeFile(draftFile, JSON.stringify(draft, null, 2) + "\n");
  await writeFile(reportFile, markdownReport(result));
  return { draftFile, reportFile };
}

async function applyResult(result, db) {
  if (result.matrix.status !== "final") throw new Error(`--apply requires matrix.status = "final".`);
  if (result.summary.blockers) throw new Error(`--apply blocked by ${result.summary.blockers} release blocker(s).`);
  if (result.summary.unreviewedPriorityA) throw new Error(`--apply blocked by ${result.summary.unreviewedPriorityA} unreviewed Priority A exception(s). Add the relevant code to reviewedExceptions only after human review.`);

  const byShard = new Map();
  for (const c of result.clubs) {
    const file = shardForSeason(c.row.season);
    if (!byShard.has(file)) byShard.set(file, []);
    byShard.get(file).push(c.row);
  }

  for (const [file, rows] of byShard) {
    const shard = db.shards.get(file);
    if (!shard) throw new Error(`Required shard ${file} does not exist. Create/register the decade shard first.`);
    for (const newRow of rows) {
      const idx = shard.squads.findIndex((r) => r.season === newRow.season && normaliseClub(r.club) === normaliseClub(newRow.club));
      if (idx >= 0) shard.squads[idx] = newRow;
      else shard.squads.push(newRow);
    }
    shard.squads.sort((a, b) => startYear(b.season) - startYear(a.season) || b.season.localeCompare(a.season) || a.club.localeCompare(b.club, "en"));
    await writeFile(path.join(DATA, file), JSON.stringify(shard, null, 2) + "\n");
  }
}

async function selfTest() {
  const fakeRows = [{
    id: "existing-2324",
    club: "Existing FC",
    season: "2023-24",
    role: "roster",
    players: [{ n: "Known Player", nat: "Italy", p: "MF", dp: ["CM"], r: 78 }],
    achievements: []
  }];
  const fakeDb = { rows: fakeRows, shards: new Map(), target: { scopes: [] } };
  const players = [];
  players.push({ n: "Keeper", nat: "England", p: "GK", dp: ["GK"], r: 78, competition: { minutes: 90, apps: 1, starts: 1 } });
  for (let i = 1; i <= 16; i++) players.push({ n: `Player ${i}`, nat: "England", p: i < 6 ? "DF" : i < 12 ? "MF" : "FW", dp: [i < 6 ? "DF" : i < 12 ? "MF" : "FW"], r: 77 + (i % 3), competition: { minutes: 1000 - i * 20, apps: 10, starts: 8 } });
  const matrix = {
    schema: "rollxi-coverage-matrix-v1",
    status: "final",
    edition: { competition: "CONFL", season: "2024-25", expectedParticipants: 1 },
    sources: { participants: "https://example.test/participants", results: "https://example.test/results" },
    clubs: [{ club: "Test FC", country: "England", league: "ENG", stage: "MAIN", kit: ["#000000", "#ffffff"], sources: { appearances: "https://example.test/apps", identity: "https://example.test/squad" }, players }]
  };
  const result = await prepare(matrix, fakeDb);
  assert.equal(result.clubs[0].row.players.length, 16);
  assert.equal(result.clubs[0].row.players.some((p) => p.p === "GK"), true);
  assert.equal(result.summary.blockers, 0);
  assert.equal(result.summary.unreviewedPriorityA, 0);

  const shortMatrix = structuredClone(matrix);
  shortMatrix.clubs[0].players = shortMatrix.clubs[0].players.slice(0, 12);
  shortMatrix.clubs[0].reviewedExceptions = ["UNDER_16_COMPETITION_PARTICIPANTS"];
  const short = await prepare(shortMatrix, fakeDb);
  assert.ok(short.flags.some((f) => f.code === "UNDER_16_ELIGIBLE_PLAYERS" && f.severity === "BLOCK"));

  const reuseMatrix = structuredClone(matrix);
  reuseMatrix.clubs[0].players[1].n = "Known Player";
  delete reuseMatrix.clubs[0].players[1].nat;
  delete reuseMatrix.clubs[0].players[1].p;
  delete reuseMatrix.clubs[0].players[1].dp;
  const reused = await prepare(reuseMatrix, fakeDb);
  const known = reused.clubs[0].row.players.find((p) => p.n === "Known Player");
  assert.equal(known.nat, "Italy");
  assert.equal(known.p, "MF");
  assert.deepEqual(known.dp, ["MF"]);

  const overrideMatrix = structuredClone(matrix);
  overrideMatrix.clubs[0].players.at(-1).selection = "include";
  const overridden = await prepare(overrideMatrix, fakeDb);
  assert.equal(overridden.clubs[0].row.players.some((p) => p.n === "Keeper"), true);
  assert.equal(overridden.clubs[0].row.players.some((p) => p.n === "Player 16"), true);

  const fallbackMatrix = structuredClone(matrix);
  fallbackMatrix.clubs[0].players.at(-1).competition = { minutes: 0, apps: 0, starts: 0 };
  fallbackMatrix.clubs[0].players.at(-1).registered = true;
  fallbackMatrix.clubs[0].players.at(-2).competition = { minutes: 0, apps: 0, starts: 0 };
  fallbackMatrix.clubs[0].players.at(-2).registered = true;
  fallbackMatrix.clubs[0].reviewedExceptions = ["UNDER_16_COMPETITION_PARTICIPANTS"];
  const fallback = await prepare(fallbackMatrix, fakeDb);
  assert.equal(fallback.summary.blockers, 0);
  assert.equal(fallback.summary.unreviewedPriorityA, 0);
  assert.equal(fallback.summary.reviewedPriorityA, 1);
  assert.equal(fallback.clubs[0].row.players.length, 16);
  assert.equal(fallback.clubs[0].fallbackUsed, 1);

  const targetDb = { ...fakeDb, target: { scopes: [{ id: "euro-confl", comps: ["CONFL"], expectedRostersPerEdition: { "2024-25": 36 } }] } };
  const conflictMatrix = structuredClone(matrix);
  conflictMatrix.edition.scopeId = "euro-confl";
  const conflict = await prepare(conflictMatrix, targetDb);
  assert.equal(conflict.matrix.edition.expectedParticipants, 36);
  assert.equal(conflict.flags.some((f) => f.code === "EXPECTED_PARTICIPANTS_CONFLICT" && f.severity === "BLOCK"), true);
  console.log("Coverage-production self-test passed.");
}

async function main() {
  if (args.has("--self-test")) return selfTest();
  const input = argValue("--input");
  if (!input) {
    console.error("Usage: node scripts/prepare-coverage.mjs --input <matrix.json> [--apply]\n       node scripts/prepare-coverage.mjs --self-test");
    process.exit(2);
  }
  const inputPath = path.resolve(input);
  const matrix = JSON.parse(await readFile(inputPath, "utf8"));
  const db = await loadDatabase();
  const result = await prepare(matrix, db);
  const output = await writeOutputs(result, inputPath);

  if (args.has("--apply")) await applyResult(result, db);

  const s = result.summary;
  console.log(`${matrix.edition.competition} ${matrix.edition.season}: ${result.clubs.length}/${matrix.edition.expectedParticipants} clubs`);
  console.log(`Projected coverage: ${s.coverage.afterRosters}/${s.coverage.expectedParticipants}; new ${s.coverage.newRows}, stub upgrades ${s.coverage.stubUpgrades}, replacements ${s.coverage.rosterReplacements}`);
  console.log(`Exceptions: ${s.blockers} blockers, ${s.unreviewedPriorityA} unreviewed Priority A, ${s.reviewedPriorityA} reviewed Priority A, ${s.priorityB} Priority B`);
  console.log(`Draft: ${path.relative(ROOT, output.draftFile)}`);
  console.log(`Report: ${path.relative(ROOT, output.reportFile)}`);
  if (args.has("--apply")) console.log(`Applied final rows to ${shardForSeason(matrix.edition.season)}.`);

  if (s.blockers || s.unreviewedPriorityA) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
