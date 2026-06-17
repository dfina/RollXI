import { mulberry32, hashStr, seededShuffle } from "./rng.js";
import { playMatch, oppStrength, extraTime, penalties, goalTimeline, scorerPoolFromXI } from "./match.js";

/* ---- build the knockout bracket from the final league standings ----
   Modern UCL: 1-8 seeded into R16; 9-24 contest a play-off whose 8 winners
   fill the other R16 slots. 25-36 are eliminated. We model a fixed seeding
   so the ladder is deterministic per campaign. */
export function buildKnockout(standings, seed) {
  const rng = mulberry32(hashStr(seed + "|ko"));
  const top8 = standings.slice(0, 8);       // direct to R16
  const playoff = standings.slice(8, 24);   // 16 teams -> 8 ties
  const out = standings.slice(24);

  // play-off pairings: 9v24, 10v23, ... (higher seed is "home" 2nd leg)
  const poTies = [];
  for (let i = 0; i < 8; i++) {
    poTies.push({ a: playoff[i], b: playoff[15 - i], round: "PO" });
  }
  return {
    seed,
    top8: top8.map(teamRef),
    playoffTies: poTies.map((t, i) => tie(t.a, t.b, "PO", i)),
    out: out.map(teamRef),
    stage: "PO",                 // PO -> R16 -> QF -> SF -> F -> CHAMPION
    ties: null,                  // set when each round is drawn
    championId: null
  };
}

function teamRef(t) {
  return { id: t.id, club: t.club, season: t.season || null, rating: t.rating || (t.strength ? t.strength.overall : 80),
    kit: t.kit, crest: t.crest || null, scorers: t.scorers || [], comps: t.comps || [], euro: t.euro || [],
    isYou: !!t.isYou, seedRank: t.seedRank };
}
function tie(a, b, round, idx) {
  return {
    id: round + "-" + idx, round,
    home: teamRef(a), away: teamRef(b),     // 'home' hosts 2nd leg (higher seed)
    leg1: null, leg2: null, et: null, pens: null,
    aggHome: 0, aggAway: 0, winnerId: null, done: false
  };
}

/* draw the R16 once play-off winners are known (top8 + 8 winners). */
export function drawRound(ko, round, advancers) {
  // advancers: array of teamRefs in a stable order; pair 0v1, 2v3, ...
  const rng = mulberry32(hashStr(ko.seed + "|draw" + round));
  const pool = seededShuffle(advancers, rng);
  const ties = [];
  for (let i = 0; i + 1 < pool.length; i += 2) {
    // higher-rated hosts 2nd leg for a mild reward
    const x = pool[i], y = pool[i + 1];
    const home = (y.rating > x.rating) ? y : x;
    const away = (home === x) ? y : x;
    ties.push(tie(home, away, round, i / 2));
  }
  return ties;
}

/* ---- resolve one leg of a two-legged tie ----
   Returns {hg, ag, timeline} for that leg; caller stores leg1/leg2 and aggregate. */
export function playLeg(you, tieObj, legNo) {
  // leg1: away team hosts; leg2: home team (higher seed) hosts
  const hostRef = legNo === 1 ? tieObj.away : tieObj.home;
  const visitRef = legNo === 1 ? tieObj.home : tieObj.away;
  const hostStr = strengthOf(you, hostRef);
  const visitStr = strengthOf(you, visitRef);
  const seed = tieObj.id + "-leg" + legNo;
  const r = playMatch(hostStr, visitStr, seed);
  const tl = buildTimeline(you, hostRef, visitRef, r.hg, r.ag, seed);
  return { hostId: hostRef.id, visitId: visitRef.id, hg: r.hg, ag: r.ag, timeline: tl };
}

/* aggregate after both legs; if level, signal ET (no away goals rule). */
export function aggregate(tieObj) {
  // home = higher seed (hosted leg2). Compute each side's total goals.
  // leg1: away hosted, so leg1.hg is away's goals, leg1.ag is home's goals.
  // leg2: home hosted, so leg2.hg is home's goals, leg2.ag is away's goals.
  const homeGoals = (tieObj.leg1 ? tieObj.leg1.ag : 0) + (tieObj.leg2 ? tieObj.leg2.hg : 0);
  const awayGoals = (tieObj.leg1 ? tieObj.leg1.hg : 0) + (tieObj.leg2 ? tieObj.leg2.ag : 0);
  return { homeGoals, awayGoals, level: homeGoals === awayGoals };
}

/* extra time + penalties played at the higher seed's ground (after leg2). */
export function resolveLevel(you, tieObj) {
  const homeStr = strengthOf(you, tieObj.home);
  const awayStr = strengthOf(you, tieObj.away);
  const etGoals = extraTime(homeStr, awayStr, tieObj.id + "-et");
  const etTl = buildTimeline(you, tieObj.home, tieObj.away, etGoals.hg, etGoals.ag, tieObj.id + "-et")
    .map((e) => ({ ...e, minute: 90 + Math.max(1, Math.ceil(e.minute * 30 / 92)) }));
  const et = { hg: etGoals.hg, ag: etGoals.ag, timeline: etTl };
  const agg = aggregate(tieObj);
  const homeTotal = agg.homeGoals + et.hg;
  const awayTotal = agg.awayGoals + et.ag;
  if (homeTotal !== awayTotal) {
    return { et, pens: null, winnerId: homeTotal > awayTotal ? tieObj.home.id : tieObj.away.id, etDecided: true };
  }
  const pk = penalties(homeStr, awayStr, tieObj.id);
  return { et, pens: pk, winnerId: pk.winner === "home" ? tieObj.home.id : tieObj.away.id, etDecided: false };
}

/* single-leg final at a neutral venue. */
export function playFinal(you, a, b) {
  const seed = "final-" + a.id + "-" + b.id;
  const sa = strengthOf(you, a), sb = strengthOf(you, b);
  let r = playMatch(sa, sb, seed);
  let et = null, pens = null, winnerId;
  let tl = buildTimeline(you, a, b, r.hg, r.ag, seed);
  if (r.hg === r.ag) {
    const etGoals = extraTime(sa, sb, seed + "-et");
    const etTl = buildTimeline(you, a, b, etGoals.hg, etGoals.ag, seed + "-et")
      .map((e) => ({ ...e, minute: 90 + Math.max(1, Math.ceil(e.minute * 30 / 92)) }));
    et = { hg: etGoals.hg, ag: etGoals.ag, timeline: etTl };
    if (r.hg + et.hg !== r.ag + et.ag) {
      winnerId = (r.hg + et.hg > r.ag + et.ag) ? a.id : b.id;
    } else {
      pens = penalties(sa, sb, seed);
      winnerId = pens.winner === "home" ? a.id : b.id;
    }
  } else {
    winnerId = r.hg > r.ag ? a.id : b.id;
  }
  return { hg: r.hg, ag: r.ag, et, pens, winnerId, timeline: tl, aId: a.id, bId: b.id };
}

/* ---- helpers ---- */
function strengthOf(you, ref) {
  if (ref.isYou) return you.strength;
  return oppStrength(ref.rating);
}
function buildTimeline(you, hostRef, visitRef, hg, ag, seed) {
  const hostScorers = hostRef.isYou ? scorerPoolFromXI(you.xi) : (hostRef.scorers || []).map((n) => ({ name: n, weight: 1 }));
  const visitScorers = visitRef.isYou ? scorerPoolFromXI(you.xi) : (visitRef.scorers || []).map((n) => ({ name: n, weight: 1 }));
  return goalTimeline(hg, ag, hostScorers, visitScorers, seed)
    .map((e) => ({ ...e, mine: (e.side === "home" ? hostRef.isYou : visitRef.isYou) }));
}

export const ROUND_NAMES = { PO: "Knockout play-off", R16: "Round of 16", QF: "Quarter-final", SF: "Semi-final", F: "Final" };
export const NEXT_ROUND = { PO: "R16", R16: "QF", QF: "SF", SF: "F" };
