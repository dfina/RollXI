/*
  Detailed-position to Campaign-slot compatibility.

  Player data should stay historically faithful. Draft compatibility is a
  separate gameplay layer, so neighbouring tactical roles can be accepted as
  conservative proxies without rewriting the player's recorded positions.

  Proxy policy approved 2026-08-07:
  - CM may cover DM and AM, as well as CM.
  - RB may cover RM, and LB may cover LM, only in 3-5-2 / 3-4-3 where those
    wide midfield slots function as wing-back/wide roles.
  - Do not infer DM -> CB, full-back -> CB, AM <-> winger, or ST/CF -> winger.
*/

const BASE_DETAIL_TO_TACTIC = {
  GK: ["GK"],
  RB: ["RB"], RWB: ["RB", "RM"],
  LB: ["LB"], LWB: ["LB", "LM"],
  CB: ["CB"], SW: ["CB"], DF: ["RB", "CB", "LB"],
  DM: ["DM", "CM"], CM: ["CM", "DM", "AM"], AM: ["AM", "CM"], MF: ["DM", "CM", "AM", "LM", "RM", "LW", "RW"],
  RM: ["RM", "RW"], LM: ["LM", "LW"],
  RW: ["RW", "RM"], LW: ["LW", "LM"],
  SS: ["AM", "ST"], CF: ["ST"], ST: ["ST"], FW: ["ST", "LW", "RW"]
};

const THREE_AT_BACK = new Set(["3-5-2", "3-4-3"]);

export const DETAILED_POSITION_CODES = new Set(Object.keys(BASE_DETAIL_TO_TACTIC));

export function normaliseDetailedPositions(dp, fallback = null) {
  let raw = [];
  if (Array.isArray(dp)) raw = dp;
  else if (typeof dp === "string") raw = dp.split("/");
  else if (fallback) raw = [fallback];

  const out = [];
  for (const value of raw) {
    const code = String(value || "").trim().toUpperCase();
    if (code && !out.includes(code)) out.push(code);
  }
  if (!out.length && fallback) out.push(String(fallback).trim().toUpperCase());
  return out;
}

export function playerPossibleTacticLabels(player, formation = null) {
  const positions = normaliseDetailedPositions(player?.dp, player?.p);
  const labels = [];

  for (const code of positions) {
    const mapped = BASE_DETAIL_TO_TACTIC[code] || BASE_DETAIL_TO_TACTIC[player?.p] || [];
    for (const label of mapped) {
      if (!labels.includes(label)) labels.push(label);
    }

    // Formation-specific proxy: in a three-at-the-back shape, the LM/RM
    // slots are deliberately treated as wing-back/wide roles. A conventional
    // full-back can therefore fill them without becoming a universal winger.
    if (THREE_AT_BACK.has(formation)) {
      if (code === "LB" && !labels.includes("LM")) labels.push("LM");
      if (code === "RB" && !labels.includes("RM")) labels.push("RM");
    }
  }

  return labels;
}

export function playerTacticLabels(player, xi, formation, openOnly = false) {
  const possible = new Set(playerPossibleTacticLabels(player, formation));
  const labels = [];
  xi.forEach((slot) => {
    if (openOnly && slot.name) return;
    if (possible.has(slot.label) && !labels.includes(slot.label)) labels.push(slot.label);
  });
  return labels;
}

export function playerOpenSlots(player, xi, formation) {
  const possible = new Set(playerPossibleTacticLabels(player, formation));
  return xi
    .map((slot, i) => ({ ...slot, i }))
    .filter((slot) => !slot.name && possible.has(slot.label));
}

export function squadHasSignablePlayer(squad, xi, usedKeys, formation) {
  if (!squad || !squad.players || !squad.players.length) return false;
  return squad.players.some((p) =>
    !usedKeys.has(squad.id + "|" + p.n) && playerOpenSlots(p, xi, formation).length > 0
  );
}
