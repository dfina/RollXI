#!/usr/bin/env node
import { FORMATIONS, emptyXI } from "../src/lib/campaign.js";
import { playerOpenSlots, playerPossibleTacticLabels, nextSignableSquadIndex, squadHasSignablePlayer, rerollCostForSquad } from "../src/lib/positions.js";

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const labels = (player, formation) => playerPossibleTacticLabels(player, formation);
const openLabels = (player, formation) => playerOpenSlots(player, emptyXI(formation), formation).map((s) => s.label);

const cm = { n: "Hidetoshi Nakata", p: "MF", dp: ["CM"] };
const dm = { n: "Test DM", p: "MF", dp: ["DM"] };
const lb = { n: "Test LB", p: "DF", dp: ["LB"] };
const rb = { n: "Test RB", p: "DF", dp: ["RB"] };
const am = { n: "Test AM", p: "MF", dp: ["AM"] };
const lw = { n: "Test LW", p: "FW", dp: ["LW"] };
const cf = { n: "Test CF", p: "FW", dp: ["CF"] };

// Approved central-midfield proxies.
check(labels(cm, "4-2-3-1").includes("CM"), "CM must retain CM compatibility");
check(labels(cm, "4-2-3-1").includes("DM"), "CM must proxy to DM");
check(labels(cm, "4-2-3-1").includes("AM"), "CM must proxy to AM");
const nakataSlots = openLabels(cm, "4-2-3-1");
check(nakataSlots.filter((x) => x === "DM").length === 2, "CM must be selectable in both empty DM slots of 4-2-3-1");
check(nakataSlots.includes("AM"), "CM must be selectable in the empty AM slot of 4-2-3-1");
check(!nakataSlots.includes("LW") && !nakataSlots.includes("RW") && !nakataSlots.includes("ST"), "CM proxy must not spill into attack/wide-forward slots");

// Existing DM -> CM compatibility stays, but approved policy does not add CB/AM.
check(labels(dm, "4-2-3-1").includes("DM") && labels(dm, "4-2-3-1").includes("CM"), "DM must retain DM/CM compatibility");
check(!labels(dm, "3-5-2").includes("CB"), "DM must not proxy to CB");
check(!labels(dm, "4-2-3-1").includes("AM"), "DM must not proxy to AM");

// Full-backs proxy to wide midfield only in the two three-at-the-back shapes.
for (const formation of ["3-5-2", "3-4-3"]) {
  check(labels(lb, formation).includes("LM"), `LB must proxy to LM in ${formation}`);
  check(labels(rb, formation).includes("RM"), `RB must proxy to RM in ${formation}`);
  check(openLabels(lb, formation).includes("LM"), `LB must be pickable at LM in ${formation}`);
  check(openLabels(rb, formation).includes("RM"), `RB must be pickable at RM in ${formation}`);
  check(!labels(lb, formation).includes("CB") && !labels(rb, formation).includes("CB"), `full-backs must not proxy to CB in ${formation}`);
}
for (const formation of ["4-3-3", "4-4-2", "4-2-3-1"]) {
  check(!labels(lb, formation).includes("LM"), `LB must not proxy to LM in ${formation}`);
  check(!labels(rb, formation).includes("RM"), `RB must not proxy to RM in ${formation}`);
}

// Explicitly rejected blanket proxies remain rejected.
check(!labels(am, "4-2-3-1").includes("LW") && !labels(am, "4-2-3-1").includes("RW"), "AM must not proxy to winger");
check(!labels(lw, "4-2-3-1").includes("AM"), "LW must not proxy to AM");
check(!labels(cf, "4-3-3").includes("LW") && !labels(cf, "4-3-3").includes("RW"), "CF must not proxy to wide forward");


// Dead-roll regression: an incompatible rolled squad must be skipped without
// touching the manual re-roll allowance. The helper must also skip consecutive
// dead squads and stop at the first squad with a valid signing.
const xi4231 = emptyXI("4-2-3-1");
// Fill every slot except the striker slot so only ST-compatible players can sign.
for (let i = 0; i < xi4231.length; i += 1) {
  if (xi4231[i].label !== "ST") xi4231[i] = { ...xi4231[i], name: `Filled ${i}`, pickKey: `filled|${i}` };
}
const dead1 = { id: "dead-1", players: [{ n: "Midfielder One", p: "MF", dp: ["CM"] }] };
const dead2 = { id: "dead-2", players: [{ n: "Defender One", p: "DF", dp: ["CB"] }] };
const fit = { id: "fit", players: [{ n: "Striker One", p: "FW", dp: ["ST"] }] };
const squadById = { "dead-1": dead1, "dead-2": dead2, fit };
const seq = ["dead-1", "dead-2", "fit"];
const noUsed = new Set();
check(!squadHasSignablePlayer(dead1, xi4231, noUsed, "4-2-3-1"), "dead-roll fixture must really be incompatible");
check(squadHasSignablePlayer(fit, xi4231, noUsed, "4-2-3-1"), "dead-roll regression needs a later compatible squad");
check(rerollCostForSquad(dead1, xi4231, noUsed, "4-2-3-1") === 0, "incompatible squad must consume zero manual re-rolls");
check(rerollCostForSquad(fit, xi4231, noUsed, "4-2-3-1") === 1, "compatible squad must consume one manual re-roll when skipped");
check(nextSignableSquadIndex(seq, 0, squadById, xi4231, noUsed, "4-2-3-1") === 2, "dead rolls must skip to the first later compatible squad");
check(nextSignableSquadIndex(["dead-1", "dead-2"], 0, squadById, xi4231, noUsed, "4-2-3-1") === -1, "dead-roll search must return -1 when no later squad fits");

// Every declared formation should still resolve to exactly 11 slots.
for (const formation of Object.keys(FORMATIONS)) {
  check(emptyXI(formation).length === 11, `${formation} must contain 11 slots`);
}

if (failures.length) {
  console.error(`POSITION COMPATIBILITY CHECK FAILED (${failures.length})`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

console.log("POSITION COMPATIBILITY CHECK");
console.log("  ✓ CM -> DM and CM -> AM proxies active");
console.log("  ✓ LB/RB -> LM/RM limited to 3-5-2 and 3-4-3");
console.log("  ✓ rejected blanket proxies remain disabled");
console.log("  ✓ incompatible dead rolls skip forward without consuming manual re-rolls");
console.log(`  ✓ Nakata-style CM in 4-2-3-1 has ${nakataSlots.length} compatible open slots (${nakataSlots.join(", ")})`);
