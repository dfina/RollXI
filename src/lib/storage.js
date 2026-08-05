/* Namespaced localStorage with JSON encoding and an in-memory fallback
   (private browsing, blocked storage). All keys live under "rollxi:". */
const NS = "rollxi:";
const mem = {};
let usable = null;

function canUse() {
  if (usable !== null) return usable;
  try {
    const k = NS + "__t";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    usable = true;
  } catch (e) { usable = false; }
  return usable;
}
export function storageAvailable() { return canUse(); }
export function load(key, fallback) {
  try {
    if (canUse()) {
      const raw = window.localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    }
    return key in mem ? mem[key] : fallback;
  } catch (e) { return fallback; }
}
export function save(key, value) {
  try {
    if (canUse()) { window.localStorage.setItem(NS + key, JSON.stringify(value)); return true; }
    mem[key] = value; return false;
  } catch (e) { mem[key] = value; return false; }
}
export function wipeAll() {
  try {
    if (canUse()) {
      const dead = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(NS)) dead.push(k);
      }
      dead.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch (e) { /* ignore */ }
  Object.keys(mem).forEach((k) => delete mem[k]);
}
