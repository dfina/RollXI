/* Namespaced localStorage with JSON encoding and an in-memory fallback
   (private browsing, blocked storage, quota exceeded). All keys live under "rollxi:".
   IMPORTANT: when a write fails and falls back to mem, subsequent reads for that key
   also come from mem — otherwise load() would find stale/null data in localStorage
   while the live state is sitting in mem. */
const NS = "rollxi:";
const mem = {};
const memKeys = new Set(); // keys whose last successful write was to mem, not localStorage
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
    // If the last write for this key fell back to mem, use mem even if localStorage is available.
    if (memKeys.has(key)) return key in mem ? mem[key] : fallback;
    if (canUse()) {
      const raw = window.localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    }
    return key in mem ? mem[key] : fallback;
  } catch (e) { return fallback; }
}
export function save(key, value) {
  try {
    if (canUse()) {
      window.localStorage.setItem(NS + key, JSON.stringify(value));
      memKeys.delete(key); // successfully persisted — reads can come from localStorage again
      return true;
    }
    mem[key] = value; memKeys.add(key); return false;
  } catch (e) {
    // QuotaExceededError or other write failure — keep in mem so load() finds it
    mem[key] = value; memKeys.add(key); return false;
  }
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
  memKeys.clear();
}
