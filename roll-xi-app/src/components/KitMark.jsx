import React, { useState } from "react";

/* Crest with guaranteed fallback: shows the real crest image when a URL is
   present and loads; otherwise a two-tone kit shield with initials. */
export function Crest({ kit, crest, name, size = 28 }) {
  const [failed, setFailed] = useState(false);
  if (crest && !failed) {
    return (
      <img src={crest} alt={name + " crest"} width={size} height={size}
        style={{ objectFit: "contain", flexShrink: 0 }}
        onError={() => setFailed(true)} />
    );
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: "26% 26% 50% 50%",
      background: "linear-gradient(135deg, " + kit[0] + " 50%, " + kit[1] + " 50%)",
      border: "1px solid rgba(232,243,228,.6)", flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.max(8, size * 0.3), fontWeight: 900,
      color: "#08130C", textShadow: "0 0 2px rgba(255,255,255,.55)"
    }}>{initials}</span>
  );
}

/* Player sticker: photo when available, else kit shield + initials.
   frameColor encodes rarity. */
export function Sticker({ player, locked, frameColor, width = 92 }) {
  const [failed, setFailed] = useState(false);
  const h = Math.round(width * 1.3);
  const initials = player.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width, borderRadius: 8, overflow: "hidden",
      border: "2px solid " + (locked ? "rgba(232,243,228,.15)" : frameColor),
      background: locked ? "rgba(8,19,12,.6)" : "var(--panel)",
      opacity: locked ? 0.55 : 1
    }}>
      <div style={{
        height: h - 34, display: "flex", alignItems: "center", justifyContent: "center",
        background: locked
          ? "repeating-linear-gradient(45deg, rgba(232,243,228,.05) 0 6px, transparent 6px 12px)"
          : "linear-gradient(160deg, " + player.kit[0] + " 55%, " + player.kit[1] + " 55%)"
      }}>
        {locked ? (
          <span className="dim" style={{ fontSize: 22, fontWeight: 900 }}>?</span>
        ) : player.photo && !failed ? (
          <img src={player.photo} alt={player.name} width={width - 4} height={h - 38}
            style={{ objectFit: "cover" }} onError={() => setFailed(true)} />
        ) : (
          <span style={{
            fontSize: 26, fontWeight: 900, color: "#08130C",
            textShadow: "0 0 3px rgba(255,255,255,.6)"
          }}>{initials}</span>
        )}
      </div>
      <div style={{ padding: "4px 6px", background: "var(--night)" }}>
        <div className="chalk" style={{ fontSize: 9, fontWeight: 800, lineHeight: 1.2, textTransform: "uppercase" }}>
          {locked ? "Locked" : player.name}
        </div>
        <div className="dim tele" style={{ fontSize: 8, marginTop: 1 }}>
          {locked ? "\u00A0" : player.club + " " + player.season}
        </div>
      </div>
    </div>
  );
}
