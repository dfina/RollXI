import { hashStr, mulberry32, seededShuffle } from "./rng.js";
import { decadeOf } from "./date.js";

/* Loads the pack manifest and merges all packs into one dataset.
   P-tier squads contribute players; O-tier rows are opposition-only. */
export async function loadData() {
  const idx = await fetch("data/index.json").then((r) => r.json());
  const packs = await Promise.all(
    idx.packs.map((p) => fetch("data/" + p.file).then((r) => r.json()))
  );
  const squads = [];   // P-tier
  const oppRows = [];  // O-tier
  for (const pack of packs) {
    for (const row of pack.squads || []) {
      if (row.tierType === "O") oppRows.push(row); else squads.push(row);
    }
  }
  const squadById = {};
  squads.forEach((s) => { squadById[s.id] = s; });

  /* flat player-season list for trivia, album and chains */
  const players = [];
  squads.forEach((s) => {
    s.players.forEach((p) => {
      players.push({
        name: p.n, pos: p.p, dp: p.dp && p.dp.length ? p.dp : [p.p], rating: p.r, nat: p.nat,
        photo: p.photo || null, seasonPhoto: p.seasonPhoto || p.clubSeasonPhoto || null, canonicalPhoto: p.canonicalPhoto || null,
        squadId: s.id, club: s.club, season: s.season,
        league: s.league, country: s.country || null, euro: s.euro || null,
        kit: s.kit, crest: s.crest || null,
        decade: decadeOf(s.season),
        key: s.id + "|" + p.n
      });
    });
  });
  return { squads, oppRows, squadById, players, packNames: idx.packs.map((p) => p.name) };
}

export function rarityOf(rating) {
  if (rating >= 93) return { id: "legend", label: "Legend", color: "var(--gold)" };
  if (rating >= 87) return { id: "star", label: "Star", color: "var(--silver)" };
  if (rating >= 80) return { id: "first", label: "First XI", color: "var(--gold)" };
  return { id: "squad", label: "Squad", color: "var(--silver)" };
}

/* Daily set: n distinct player-seasons (no repeated player name), seeded by date. */
export function dailySet(dateKey, players, n) {
  const rng = mulberry32(hashStr("rollxi-daily-" + dateKey));
  const order = seededShuffle(players, rng);
  const out = [];
  const seen = new Set();
  for (const p of order) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}

/* Three distractor names: same nationality first, then same decade, then anyone.
   Never the answer's own name; no duplicate names among options. */
export function distractorsFor(answer, players, rng) {
  const used = new Set([answer.name]);
  const pickFrom = (pool, want, out) => {
    for (const p of seededShuffle(pool, rng)) {
      if (out.length >= want) break;
      if (used.has(p.name)) continue;
      used.add(p.name); out.push(p.name);
    }
  };
  const out = [];
  pickFrom(players.filter((p) => p.nat === answer.nat), 3, out);
  if (out.length < 3) pickFrom(players.filter((p) => p.decade === answer.decade), 3, out);
  if (out.length < 3) pickFrom(players, 3, out);
  return out;
}
