import React, { useMemo, useState } from "react";
import { Check, X, Share2 } from "lucide-react";
import { hashStr, mulberry32, seededShuffle } from "../lib/rng.js";
import { load, save } from "../lib/storage.js";
import { todayKey, dayNumber } from "../lib/date.js";
import { dailySet, distractorsFor } from "../lib/data.js";
import { Sticker } from "../components/KitMark.jsx";
import { shareText, dailyTriviaShare } from "../lib/share.js";

const N = 6;

const POSITION_LABELS = {
  GK: "Goalkeeper",
  SW: "Sweeper",
  DF: "Defender",
  CB: "Centre-back",
  LB: "Left-back",
  RB: "Right-back",
  LWB: "Left wing-back",
  RWB: "Right wing-back",
  MF: "Midfielder",
  DM: "Defensive midfielder",
  CM: "Central midfielder",
  AM: "Attacking midfielder",
  LM: "Left midfielder",
  RM: "Right midfielder",
  FW: "Forward",
  CF: "Centre-forward",
  ST: "Striker",
  LW: "Left winger",
  RW: "Right winger"
};

function fullPositionLabel(code) {
  if (!code) return "Unknown position";
  const parts = String(code).split(/[\/,-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return parts.map(fullPositionLabel).join(" / ");
  const clean = parts[0] || String(code).trim();
  return POSITION_LABELS[clean] || clean;
}

function fullPositionList(player) {
  const raw = player?.dp && player.dp.length ? player.dp : [player?.pos];
  const seen = new Set();
  const labels = [];
  raw.forEach((code) => {
    const label = fullPositionLabel(code);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  });
  return labels.join(" / ");
}

export default function Daily({ data, onAlbum }) {
  const dateKey = todayKey();
  const dayNum = dayNumber(dateKey);
  const questions = useMemo(() => dailySet(dateKey, data.players, N), [dateKey, data]);

  const [state, setState] = useState(() => load("daily:" + dateKey, { answers: {} }));
  const [shareMsg, setShareMsg] = useState(null);
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const answered = Object.keys(state.answers).length;
  const idx = Math.min(answered - (pendingAdvance ? 1 : 0), N - 1);
  const done = answered >= N && !pendingAdvance;
  const q = questions[idx];

  async function doShare() {
    const score = questions.filter((qq, i) => state.answers[i] === qq.name).length;
    const status = await shareText("Roll XI", dailyTriviaShare(dayNum, score, N));
    if (status === "copied") setShareMsg("Copied!");
    else if (status === "shared") setShareMsg("Shared!");
    else if (status === "failed") setShareMsg("Couldn't share");
    if (status !== "cancelled") setTimeout(() => setShareMsg(null), 2000);
  }

  const options = useMemo(() => {
    if (!q) return [];
    const rng = mulberry32(hashStr(dateKey + "|q" + idx + "|" + q.key));
    return seededShuffle([q.name].concat(distractorsFor(q, data.players, rng)), rng);
  }, [q, idx, dateKey, data]);

  const picked = state.answers[idx];
  const revealed = picked !== undefined;

  function pick(name) {
    if (state.answers[idx] !== undefined || done) return;
    const next = { answers: { ...state.answers, [idx]: name } };
    save("daily:" + dateKey, next);
    if (name === q.name) {
      const alb = load("album", []);
      if (!alb.includes(q.key)) { alb.push(q.key); save("album", alb); }
    }
    if (Object.keys(next.answers).length >= N) {
      const hist = load("daily:hist", {});
      hist[dateKey] = questions.filter((qq, i) => next.answers[i] === qq.name).length;
      save("daily:hist", hist);
    }
    setState(next);
    setPendingAdvance(true);
  }

  function advanceQuestion() { setPendingAdvance(false); }

  function next() { setState({ ...state }); }

  if (done) {
    const score = questions.filter((qq, i) => state.answers[i] === qq.name).length;
    const earned = questions.filter((qq, i) => state.answers[i] === qq.name);
    return (
      <div className="fade">
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2 }}>DAILY #{dayNum} · COMPLETE</p>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div className="tele amber" style={{ fontSize: 44, fontWeight: 700 }}>{score}/{N}</div>
          <p className="chalk" style={{ fontWeight: 700, margin: "6px 0 0", fontSize: 14 }}>
            {score === N ? "Full set. A collector's day." : score >= 4 ? "Strong haul of stickers." : score >= 2 ? "A few for the album." : "The album stays hungry. Tomorrow."}
          </p>
        </div>
        {earned.length > 0 && (
          <div className="card" style={{ padding: 12, marginTop: 10 }}>
            <p className="dim tele" style={{ fontSize: 11, letterSpacing: 1.5, margin: "0 0 8px" }}>STICKERS EARNED</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {earned.map((p) => <Sticker key={p.key} player={p} width={92} />)}
            </div>
          </div>
        )}
        <button className="btn" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }} onClick={doShare}>
          <Share2 size={16} /> {shareMsg || "Share result"}
        </button>
        <button className="ghost" style={{ width: "100%", padding: 13, fontSize: 14, marginTop: 8 }} onClick={onAlbum}>
          Open the album
        </button>
        <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 12 }}>
          Six new stickers at midnight.
        </p>
      </div>
    );
  }

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0 }}>DAILY #{dayNum}</p>
        <span style={{ letterSpacing: 3, fontSize: 12 }} aria-label={answered + " of " + N + " answered"}>
          {questions.map((_, i) => {
            const a = state.answers[i];
            const c = a === undefined ? "var(--hair)" : a === questions[i].name ? "var(--green)" : "var(--flame)";
            return <span key={i} style={{ color: c }}>●</span>;
          })}
        </span>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 10 }}>
        <p className="tele amber" style={{ fontSize: 11, letterSpacing: 1.5, margin: 0 }}>WHO IS THIS PLAYER?</p>
        <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center" }}>
          <Sticker player={q} locked width={92} />
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <div><span className="dim tele" style={{ fontSize: 10 }}>NATIONALITY </span><span className="chalk" style={{ fontWeight: 700 }}>{q.nat}</span></div>
            <div><span className="dim tele" style={{ fontSize: 10 }}>POSITION </span><span className="chalk" style={{ fontWeight: 700 }}>{fullPositionList(q)}</span></div>
            <div><span className="dim tele" style={{ fontSize: 10 }}>CLUB </span><span className="chalk" style={{ fontWeight: 700 }}>{q.club}</span></div>
            <div><span className="dim tele" style={{ fontSize: 10 }}>SEASON </span><span className="chalk" style={{ fontWeight: 700 }}>{q.season}</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
        {options.map((name) => {
          const isAnswer = name === q.name;
          const isPickedWrong = name === picked && picked !== q.name;
          let cls = "opt";
          if (pendingAdvance && isAnswer) cls += " right";
          if (pendingAdvance && isPickedWrong) cls += " wrong";
          return (
            <button key={name} className={cls} disabled={pendingAdvance}
              style={{ padding: "13px 14px", fontSize: 15, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
              onClick={() => pick(name)}>
              <span>{name}</span>
              {pendingAdvance && isAnswer && <Check size={18} style={{ color: "var(--green)", flexShrink: 0 }} aria-label="correct" />}
              {pendingAdvance && isPickedWrong && <X size={18} style={{ color: "var(--flame)", flexShrink: 0 }} aria-label="your wrong pick" />}
            </button>
          );
        })}
      </div>

      {pendingAdvance && (
        <div className="fade" style={{ marginTop: 12 }}>
          <p style={{ textAlign: "center", fontSize: 13, margin: "0 0 10px", color: picked === q.name ? "var(--green)" : "var(--flame)", fontWeight: 700 }}>
            {picked === q.name ? "Sticker unlocked: " + q.name + "." : "It was " + q.name + ". One attempt, gone."}
          </p>
          <button className="btn" style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={advanceQuestion}>
            {answered >= N ? "See results →" : "Next player →"}
          </button>
        </div>
      )}
    </div>
  );
}
