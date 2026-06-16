import { mulberry32, hashStr, seededShuffle } from "./rng.js";
import { playMatch, teamStrength, oppStrength, goalTimeline, scorerPoolFromXI } from "./match.js";

export const FORMATIONS = {
  // xy: [x%, y%] — x=0 is left side of pitch, x=100 is right.
  // LB/RB and LW/RW must be on the geometrically correct side.
  "4-3-3":   { groups: ["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"], xy: [[50,90],[86,68],[38,72],[62,72],[14,68],[28,46],[50,50],[72,46],[80,18],[50,13],[20,18]], labels:["GK","RB","CB","CB","LB","CM","CM","CM","RW","ST","LW"] },
  "4-4-2":   { groups: ["GK","DF","DF","DF","DF","MF","MF","MF","MF","FW","FW"], xy: [[50,90],[86,68],[38,72],[62,72],[14,68],[14,44],[38,48],[62,48],[86,44],[36,15],[64,15]], labels:["GK","RB","CB","CB","LB","LM","CM","CM","RM","ST","ST"] },
  "4-2-3-1": { groups: ["GK","DF","DF","DF","DF","MF","MF","MF","MF","MF","FW"], xy: [[50,90],[86,68],[38,72],[62,72],[14,68],[36,56],[64,56],[20,34],[50,30],[80,34],[50,13]], labels:["GK","RB","CB","CB","LB","DM","DM","LW","AM","RW","ST"] },
  "3-5-2":   { groups: ["GK","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW"], xy: [[50,90],[28,70],[50,73],[72,70],[10,48],[32,50],[50,54],[68,50],[90,48],[36,15],[64,15]], labels:["GK","CB","CB","CB","LM","CM","CM","CM","RM","ST","ST"] },
  "3-4-3":   { groups: ["GK","DF","DF","DF","MF","MF","MF","MF","FW","FW","FW"], xy: [[50,90],[28,70],[50,73],[72,70],[14,46],[38,50],[62,50],[86,46],[80,16],[50,13],[20,16]], labels:["GK","CB","CB","CB","LM","CM","CM","RM","RW","ST","LW"] }
};
export const FORMATION_NAMES = ["4-3-3","4-4-2","4-2-3-1","3-5-2","3-4-3"];

/* slots for a formation: each carries the broad group + a display label */
export function emptyXI(formation) {
  const f = FORMATIONS[formation];
  return f.groups.map((g, i) => ({ grp: g, label: f.labels[i], name: null, rating: 0, squadId: null, dp: null }));
}

/* sequence of pickable squads to roll through (11 + spares for re-rolls) */
export function rollSequence(seed, squads) {
  const rng = mulberry32(hashStr(seed + "|roll"));
  return seededShuffle(squads.map((s) => s.id), rng);
}

/* ---- league draw: pick 35 opponents, build a single round-robin-ish set of
   8 matchdays (each team plays 8 distinct opponents), Swiss-style like the
   current UCL league phase. We model YOUR 8 fixtures + simulate the rest. ---- */
export function buildLeague(seed, you, oppRows) {
  const rng = mulberry32(hashStr(seed + "|league"));
  const pool = seededShuffle(oppRows, rng);
  const field = pool.slice(0, 35).map((o, i) => ({
    id: o.id, club: o.club, season: o.season, country: o.country,
    rating: o.rating, kit: o.kit, crest: o.crest || null, scorers: o.scorers || [],
    comps: o.comps || [],
    pts: 0, gf: 0, ga: 0, played: 0, seedRank: i
  }));
  const me = { id: "__you", club: you.club, season: you.season, kit: you.kit, crest: you.crest || null,
    rating: you.strength.overall, pts: 0, gf: 0, ga: 0, played: 0, isYou: true };
  const teams = [me].concat(field);

  // YOUR 8 opponents: spread across strength bands for a fair ladder
  const byRating = field.slice().sort((a, b) => a.rating - b.rating);
  const idxs = [2, 6, 11, 16, 21, 26, 30, 33].map((i) => Math.min(i, byRating.length - 1));
  const myOpponents = seededShuffle(idxs.map((i) => byRating[i]), rng);
  const myFixtures = myOpponents.map((opp, md) => ({
    matchday: md + 1, oppId: opp.id, home: md % 2 === 0, played: false, hg: null, ag: null
  }));

  return { teams, myFixtures, seed };
}

/* simulate every other team's matchday so the table moves realistically */
export function simulateOtherResults(league, matchday) {
  const rng = mulberry32(hashStr(league.seed + "|md" + matchday));
  const others = league.teams.filter((t) => !t.isYou);
  const order = seededShuffle(others, rng);
  // pair them up; ignore exact opponent identity for non-you teams (lightweight model)
  for (let i = 0; i + 1 < order.length; i += 2) {
    const a = order[i], b = order[i + 1];
    const r = playMatch(oppStrength(a.rating), oppStrength(b.rating), league.seed + "|o" + matchday + "|" + a.id + b.id);
    applyResult(a, b, r.hg, r.ag);
  }
}

export function applyResult(home, away, hg, ag) {
  home.gf += hg; home.ga += ag; home.played += 1;
  away.gf += ag; away.ga += hg; away.played += 1;
  if (hg > ag) home.pts += 3; else if (hg < ag) away.pts += 3; else { home.pts += 1; away.pts += 1; }
}

export function standings(teams) {
  return teams.slice().sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.club.localeCompare(b.club)
  );
}

/* play YOUR fixture for a matchday, returning result + timeline */
export function playMyFixture(league, you, fixture) {
  const opp = league.teams.find((t) => t.id === fixture.oppId);
  const meStr = you.strength;
  const oppStr = oppStrength(opp.rating);
  const home = fixture.home ? meStr : oppStr;
  const away = fixture.home ? oppStr : meStr;
  const seed = league.seed + "|mymd" + fixture.matchday;
  const r = playMatch(home, away, seed);
  const myG = fixture.home ? r.hg : r.ag;
  const opG = fixture.home ? r.ag : r.hg;
  const myScorers = scorerPoolFromXI(you.xi);
  const opScorers = (opp.scorers || []).map((n) => ({ name: n, weight: 1 }));
  const tl = goalTimeline(
    r.hg, r.ag,
    fixture.home ? myScorers : opScorers,
    fixture.home ? opScorers : myScorers,
    seed
  ).map((e) => ({ ...e, mine: (e.side === "home") === fixture.home }));
  return { myG, opG, opp, home: fixture.home, timeline: tl, hg: r.hg, ag: r.ag };
}
