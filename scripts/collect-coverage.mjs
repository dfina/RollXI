#!/usr/bin/env node
/*
  Roll XI bulk coverage collector.

  Fetches one season's competition appearance tables plus club squad pages,
  filters to an authoritative manifest of main-draw clubs, resolves broad
  positions, reuses existing Roll XI identities/ratings, fetches nationality
  only for still-unresolved selected players, and writes a coverage matrix for
  prepare-coverage.mjs.

  Network responses are cached under coverage-work/cache so reruns avoid the
  expensive/repetitive acquisition step.

  Usage:
    node scripts/collect-coverage.mjs --manifest scripts/coverage-manifests/confl-2022-23.json
    node scripts/collect-coverage.mjs --manifest ... --refresh
    node scripts/collect-coverage.mjs --self-test
*/

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = path.resolve(".");
const DATA = path.join(ROOT, "public/data");
const WORK = path.join(ROOT, "coverage-work");
const CACHE = path.join(WORK, "cache");
const args = new Set(process.argv.slice(2));

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const text = (v) => String(v ?? "").trim();
const stripAccents = (v) => text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
const startYear = (season) => Number(String(season || "").slice(0, 4));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeEntities = (s) => text(s)
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function rowsFromHtml(html) {
  return [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => {
    const rowHtml = m[1];
    const cells = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripTags(x[1]));
    const playerMatch = rowHtml.match(/href=["'][^"']*player_id=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    return { cells, playerId: playerMatch?.[1] || null, playerName: playerMatch ? stripTags(playerMatch[2]) : null };
  });
}

function numberCell(v) {
  const n = Number(text(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(textValue) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const src = String(textValue || "");
  for (let i = 0; i <= src.length; i++) {
    const ch = src[i] ?? "\n";
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ""; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, "")); if (row.some((v) => v !== "")) rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function datasetBroadPosition(v) {
  const x = text(v).toLowerCase();
  if (/goal/.test(x)) return "GK";
  if (/defen/.test(x)) return "DF";
  if (/mid/.test(x)) return "MF";
  if (/attack|forward|striker|winger/.test(x)) return "FW";
  return "";
}

function datasetDetailedPosition(row, broad) {
  const sub = text(row.sub_position).toLowerCase();
  const map = [
    [/goal/, "GK"], [/centre-back|center-back/, "CB"], [/left-back/, "LB"], [/right-back/, "RB"],
    [/defensive midfield/, "DM"], [/central midfield/, "CM"], [/attacking midfield/, "AM"],
    [/left midfield/, "LM"], [/right midfield/, "RM"], [/left winger/, "LW"], [/right winger/, "RW"],
    [/centre-forward|center-forward|second striker/, "CF"]
  ];
  const hit = map.find(([re]) => re.test(sub));
  return [hit?.[1] || broad].filter(Boolean);
}

function identityDatasetIndex(csvText) {
  const map = new Map();
  for (const row of parseCsv(csvText)) {
    const n = row.name || [row.first_name, row.last_name].filter(Boolean).join(" ");
    const k = normaliseName(n);
    if (!k) continue;
    const item = {
      nat: text(row.country_of_citizenship),
      p: datasetBroadPosition(row.position || row.sub_position),
      dp: datasetDetailedPosition(row, datasetBroadPosition(row.position || row.sub_position))
    };
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export function parseAppearances(html) {
  const rows = [];
  for (const row of rowsFromHtml(html)) {
    if (!row.playerName || row.cells.length < 3) continue;
    const name = row.playerName;
    const first = row.cells.findIndex((c) => normaliseName(c) === normaliseName(name));
    const offset = first >= 0 ? first : 0;
    const apps = numberCell(row.cells[offset + 1]);
    const starts = numberCell(row.cells[offset + 2]);
    if (!apps && !starts) continue;
    rows.push({ n: name, playerId: row.playerId, competition: { apps, starts } });
  }
  rows.sort((a, b) => b.competition.apps - a.competition.apps || b.competition.starts - a.competition.starts || a.n.localeCompare(b.n, "en"));
  return rows;
}

function sectionSlice(html, label, nextLabels) {
  const lower = String(html).toLowerCase();
  const start = lower.indexOf(label.toLowerCase());
  if (start < 0) return "";
  let end = html.length;
  for (const next of nextLabels) {
    const idx = lower.indexOf(next.toLowerCase(), start + label.length);
    if (idx >= 0 && idx < end) end = idx;
  }
  return String(html).slice(start, end);
}

function namesInSection(html) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["'][^"']*(?:player_id=|\/players\/)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const n = stripTags(m[1]);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function parseSquadPositions(html) {
  const labels = ["Forwards", "Midfielders", "Defenders", "Goalkeepers"];
  const map = new Map();
  const broad = { Forwards: "FW", Midfielders: "MF", Defenders: "DF", Goalkeepers: "GK" };
  labels.forEach((label, i) => {
    const slice = sectionSlice(html, label, labels.slice(i + 1));
    for (const n of namesInSection(slice)) map.set(normaliseName(n), broad[label]);
  });
  return map;
}

export function parsePlayerNationality(html) {
  for (const row of rowsFromHtml(html)) {
    const cells = row.cells.map(text);
    if (cells.length >= 3 && cells.some((c) => /nationality/i.test(c))) continue;
    if (cells.length >= 3 && cells[0] && cells[2] && !/name/i.test(cells[0])) return cells[2];
  }
  const m = String(html).match(/Nationality[\s\S]{0,500}?<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/i);
  return m ? stripTags(m[1]) : "";
}

async function loadDatabase() {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  const rows = [];
  for (const shard of index.shards) {
    const json = JSON.parse(await readFile(path.join(DATA, shard.file), "utf8"));
    rows.push(...(json.squads || []));
  }
  return rows;
}

function identityIndex(rows) {
  const index = new Map();
  for (const row of rows) for (const p of row.players || []) {
    const k = normaliseName(p.n);
    if (!k) continue;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push({ ...p, club: row.club, season: row.season });
  }
  return index;
}

function consensus(values, key = (v) => JSON.stringify(v)) {
  const clean = values.filter((v) => v !== undefined && v !== null && v !== "");
  if (!clean.length) return null;
  const counts = new Map();
  for (const v of clean) {
    const k = key(v);
    if (!counts.has(k)) counts.set(k, { v, n: 0 });
    counts.get(k).n++;
  }
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n);
  return sorted.length === 1 ? sorted[0].v : null;
}

function nearestRating(matches, season, player = {}) {
  const year = startYear(season);
  const nat = normaliseNationality(player.nat);
  const pos = text(player.p).toUpperCase();
  const compatible = matches.filter((m) => {
    if (!Number.isFinite(Number(m.r))) return false;
    if (nat && m.nat && normaliseNationality(m.nat) !== nat) return false;
    if (pos && m.p && text(m.p).toUpperCase() !== pos) return false;
    return true;
  });
  compatible.sort((a, b) => Math.abs(startYear(a.season) - year) - Math.abs(startYear(b.season) - year));
  if (!compatible.length) return null;
  const nearest = compatible[0];
  // Ratings age faster than identity metadata. Very old name matches are a
  // weak gameplay anchor, so fall back to the club/edition baseline instead.
  return Math.abs(startYear(nearest.season) - year) <= 2 ? Number(nearest.r) : null;
}

function nearestClubRow(rows, club, season) {
  const year = startYear(season);
  return rows
    .filter((r) => normaliseClub(r.club) === normaliseClub(club) && r.role === "roster" && (r.players || []).length)
    .sort((a, b) => Math.abs(startYear(a.season) - year) - Math.abs(startYear(b.season) - year))[0] || null;
}

function median(values) {
  const a = values.map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}

function draftRating(player, rank, matches, clubBase, manifestBase) {
  const reused = nearestRating(matches, player._season, player);
  if (reused != null) return reused;
  const base = Number.isFinite(clubBase) ? clubBase : Number(manifestBase || 76);
  const delta = rank < 4 ? 2 : rank < 8 ? 1 : rank < 12 ? 0 : -1;
  return Math.max(62, Math.min(97, Math.round(base + delta)));
}

function safeFile(v) {
  return stripAccents(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function cachedFetch(url, key, refresh = false) {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, `${safeFile(key)}.html`);
  if (!refresh) {
    try { return await readFile(file, "utf8"); } catch {}
  }
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "RollXI coverage collector/1.0" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = await res.text();
      await writeFile(file, body);
      return body;
    } catch (e) {
      last = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${last?.message || last}`);
}

async function cachedFetchBytes(url, key, refresh = false) {
  await mkdir(CACHE, { recursive: true });
  const ext = url.endsWith(".gz") ? ".csv.gz" : ".bin";
  const file = path.join(CACHE, `${safeFile(key)}${ext}`);
  if (!refresh) {
    try { return await readFile(file); } catch {}
  }
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "RollXI coverage collector/1.0" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = Buffer.from(await res.arrayBuffer());
      await writeFile(file, body);
      return body;
    } catch (e) {
      last = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${last?.message || last}`);
}

async function loadExternalIdentityIndex(manifest, refresh) {
  const url = manifest.provider?.identityDatasetUrl;
  if (!url) return new Map();
  const bytes = await cachedFetchBytes(url, `${manifest.edition.competition}-${manifest.edition.season}-identity-dataset`, refresh);
  const plain = url.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
  return identityDatasetIndex(plain);
}

function mergeOverride(player, override = {}) {
  const p = { ...player, ...override };
  delete p._season;
  return p;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function collectClub(spec, manifest, rows, ids, externalIds, refresh) {
  const compId = manifest.provider.compId;
  const base = manifest.provider.baseUrl || "https://statbunker.com";
  const appearanceUrl = `${base}/competitions/SeasonAppearances?club_id=${spec.providerId}&comp_id=${compId}`;
  const squadUrl = `${base}/competitions/getCompClubSquad?club_id=${spec.providerId}&comp_id=${compId}`;
  const [appearanceHtml, squadHtml] = await Promise.all([
    cachedFetch(appearanceUrl, `${manifest.edition.competition}-${manifest.edition.season}-${spec.club}-appearances`, refresh),
    cachedFetch(squadUrl, `${manifest.edition.competition}-${manifest.edition.season}-${spec.club}-squad`, refresh)
  ]);
  const appearances = parseAppearances(appearanceHtml);
  const positions = parseSquadPositions(squadHtml);
  const overrides = spec.playerOverrides || {};

  for (const p of appearances) {
    p._season = manifest.edition.season;
    const matches = ids.get(normaliseName(p.n)) || [];
    const extMatches = externalIds.get(normaliseName(p.n)) || [];
    const sourcePos = positions.get(normaliseName(p.n));
    const extOne = extMatches.length === 1 ? extMatches[0] : null;
    const ext = extOne && (!sourcePos || !extOne.p || extOne.p === sourcePos) ? extOne : null;
    const knownP = consensus(matches.map((m) => m.p), (v) => String(v).toUpperCase());
    const knownNat = consensus(matches.map((m) => m.nat), normaliseNationality);
    const knownDp = consensus(matches.map((m) => m.dp), (v) => JSON.stringify(v));
    const knownCompatible = !sourcePos || !knownP || knownP === sourcePos;

    // Current competition/squad evidence and a unique structured identity match
    // outrank name-only reuse from older Roll XI rows. This is important for
    // same-name collisions such as Emerson and Ibrahim Cissé.
    p.p = overrides[p.n]?.p || sourcePos || ext?.p || knownP || "";
    p.dp = overrides[p.n]?.dp || ext?.dp || (knownCompatible ? knownDp : null) || (p.p ? [p.p] : []);
    p.nat = overrides[p.n]?.nat || ext?.nat || (knownCompatible ? knownNat : null) || "";
  }

  const eligible = appearances.filter((p) => p.competition.apps > 0 || p.competition.starts > 0);
  let selected = eligible.slice(0, 16);
  if (!selected.some((p) => p.p === "GK")) {
    const gk = eligible.find((p) => p.p === "GK");
    if (gk) selected = [...selected.slice(0, 15), gk];
  }

  const unresolved = selected.filter((p) => !p.nat && p.playerId);
  await mapLimit(unresolved, manifest.provider.identityConcurrency || 8, async (p) => {
    const url = `${base}/players/getPlayerDetails?player_id=${p.playerId}`;
    const html = await cachedFetch(url, `${manifest.edition.competition}-${manifest.edition.season}-player-${p.playerId}`, refresh);
    p.nat = parsePlayerNationality(html) || p.nat;
  });

  const near = nearestClubRow(rows, spec.club, manifest.edition.season);
  const clubMedian = median((near?.players || []).map((p) => p.r));
  for (let i = 0; i < appearances.length; i++) {
    const p = appearances[i];
    const matches = ids.get(normaliseName(p.n)) || [];
    const ov = overrides[p.n] || {};
    p.r = ov.r ?? draftRating(p, i, matches, clubMedian, spec.baselineRating);
  }

  return {
    club: spec.club,
    country: spec.country,
    ...(spec.league ? { league: spec.league } : {}),
    stage: spec.stage,
    kit: spec.kit,
    ...(spec.id ? { id: spec.id } : {}),
    reviewedExceptions: spec.reviewedExceptions || [],
    sources: { appearances: appearanceUrl, identity: [squadUrl, manifest.provider.identityDatasetUrl].filter(Boolean) },
    players: appearances.map((p) => mergeOverride(p, overrides[p.n]))
  };
}

async function collect(manifest, refresh = false) {
  const rows = await loadDatabase();
  const ids = identityIndex(rows);
  const externalIds = await loadExternalIdentityIndex(manifest, refresh);
  const clubs = await mapLimit(manifest.clubs, manifest.provider.clubConcurrency || 4, (spec) => collectClub(spec, manifest, rows, ids, externalIds, refresh));
  return {
    schema: "rollxi-coverage-matrix-v1",
    status: manifest.status || "draft",
    edition: manifest.edition,
    sources: manifest.sources,
    reviewedExceptions: manifest.reviewedExceptions || [],
    clubs
  };
}

async function selfTest() {
  const appearanceHtml = `<table><tr><th>Players</th><th>Total</th><th>Start</th></tr><tr><td><a href='/players/GetHistoryStats?player_id=10'>Alpha One</a></td><td>6</td><td>5</td></tr><tr><td><a href='/players/GetHistoryStats?player_id=11'>Keeper Two</a></td><td>5</td><td>5</td></tr></table>`;
  const squadHtml = `<h3>Forwards</h3><ul><li><a href='/players/GetHistoryStats?player_id=10'>Alpha One</a></li></ul><h3>Midfielders</h3><h3>Defenders</h3><h3>Goalkeepers</h3><ul><li><a href='/players/GetHistoryStats?player_id=11'>Keeper Two</a></li></ul>`;
  const detailHtml = `<table><tr><th>Name</th><th>Height</th><th>Nationality</th></tr><tr><td>Keeper Two</td><td>190</td><td>Italy</td></tr></table>`;
  const apps = parseAppearances(appearanceHtml);
  assert.equal(apps.length, 2);
  assert.equal(apps[0].n, "Alpha One");
  assert.equal(apps[0].competition.apps, 6);
  const pos = parseSquadPositions(squadHtml);
  assert.equal(pos.get(normaliseName("Alpha One")), "FW");
  assert.equal(pos.get(normaliseName("Keeper Two")), "GK");
  assert.equal(parsePlayerNationality(detailHtml), "Italy");
  const csv = 'name,country_of_citizenship,position,sub_position\n"Alpha One",France,Attack,Right Winger\n"Keeper Two",Italy,Goalkeeper,Goalkeeper\n';
  const ext = identityDatasetIndex(csv);
  assert.equal(ext.get(normaliseName("Alpha One"))[0].nat, "France");
  assert.equal(ext.get(normaliseName("Alpha One"))[0].p, "FW");
  assert.deepEqual(ext.get(normaliseName("Alpha One"))[0].dp, ["RW"]);
  assert.equal(ext.get(normaliseName("Keeper Two"))[0].p, "GK");
  console.log("Coverage collector self-test passed.");
}

async function main() {
  if (args.has("--self-test")) return selfTest();
  const manifestPath = argValue("--manifest");
  if (!manifestPath) {
    console.error("Usage: node scripts/collect-coverage.mjs --manifest <manifest.json> [--refresh]\n       node scripts/collect-coverage.mjs --self-test");
    process.exit(2);
  }
  const file = path.resolve(manifestPath);
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (manifest.schema !== "rollxi-coverage-collector-v1") throw new Error('Manifest schema must be "rollxi-coverage-collector-v1".');
  if (!manifest.provider?.compId) throw new Error("Manifest provider.compId is required.");
  if (!Array.isArray(manifest.clubs) || !manifest.clubs.length) throw new Error("Manifest clubs[] is required.");
  const matrix = await collect(manifest, args.has("--refresh"));
  await mkdir(WORK, { recursive: true });
  const out = path.join(WORK, `${String(matrix.edition.competition).toLowerCase()}-${matrix.edition.season}.matrix.json`);
  await writeFile(out, JSON.stringify(matrix, null, 2) + "\n");
  console.log(`Collected ${matrix.clubs.length} clubs -> ${path.relative(ROOT, out)}`);
  console.log(`Next: npm run coverage:prepare -- --input ${path.relative(ROOT, out)}`);
}

main().catch((e) => { console.error(e.stack || e.message || String(e)); process.exit(1); });
