import React, { useMemo, useState } from "react";
import { load } from "../lib/storage.js";
import { DECADES } from "../lib/date.js";
import { rarityOf } from "../lib/data.js";
import { Sticker } from "../components/KitMark.jsx";

export default function Album({ data }) {
  const unlocked = useMemo(() => new Set(load("album", [])), []);
  const byDecade = useMemo(() => {
    const m = {};
    DECADES.forEach((d) => { m[d] = []; });
    data.players.forEach((p) => { if (m[p.decade]) m[p.decade].push(p); });
    DECADES.forEach((d) => m[d].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)));
    return m;
  }, [data]);

  const present = DECADES.filter((d) => byDecade[d].length > 0);
  const [tab, setTab] = useState(present[0] || DECADES[0]);
  const total = data.players.length;
  const got = data.players.filter((p) => unlocked.has(p.key)).length;
  const pool = byDecade[tab] || [];
  const gotTab = pool.filter((p) => unlocked.has(p.key)).length;

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="tele amber" style={{ fontSize: 12, letterSpacing: 2, margin: 0 }}>STICKER ALBUM</p>
        <span className="tele chalk" style={{ fontSize: 12 }}>{got}/{total} · {total ? Math.round(100 * got / total) : 0}%</span>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
        {present.map((d) => (
          <button key={d} className={tab === d ? "btn" : "ghost"}
            style={{ padding: "7px 12px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={() => setTab(d)}>{d}</button>
        ))}
      </div>
      <p className="dim tele" style={{ fontSize: 11, margin: "4px 0 10px" }}>
        {tab}: {gotTab}/{pool.length} collected · {pool.length ? Math.round(100 * gotTab / pool.length) : 0}%
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pool.map((p) => (
          <Sticker key={p.key} player={p} locked={!unlocked.has(p.key)}
            frameColor={rarityOf(p.rating).color} width={86} />
        ))}
      </div>

      <div className="card" style={{ padding: "10px 12px", marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[["Legend 93+", "var(--gold)"], ["Star 87-92", "var(--silver)"], ["First XI 80-86", "var(--flood)"], ["Squad", "var(--frame)"]].map(([t, c]) => (
          <span key={t} style={{ fontSize: 11 }} className="dim">
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: c, marginRight: 5, verticalAlign: "-1px" }} />{t}
          </span>
        ))}
      </div>
    </div>
  );
}
