// Small pure helpers shared by all modules.
import { SECTIONS, SUBGROUPS_PER_SECTION, TYPE } from "./config.js";

export const $ = (id) => document.getElementById(id);
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd();
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const hhmm = (t) => { if (!t) return ""; const [h, m] = String(t).split(":"); return `${pad(+h)}:${pad(+m || 0)}`; };
export const mins = (t) => { const [h, m] = String(t || "0:0").split(":"); return +h * 60 + (+m || 0); };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** All group codes in display order: A, A1, A2, A3, B, ... */
export const GROUPS = SECTIONS.flatMap((s) => [s, ...Array.from({ length: SUBGROUPS_PER_SECTION }, (_, i) => s + (i + 1))]);
export const typeOfGroup = (g) => (/\d$/.test(g) ? TYPE.PRACTICAL : TYPE.THEORY);
export const studentGroup = (s, type) => (type === TYPE.PRACTICAL ? s.subgroup : s.section);
export const inGroup = (s, g) => (/\d$/.test(g) ? s.subgroup === g : s.section === g);

export function copyText(text) {
  return (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(() => prompt("انسخ:", text));
}
export function beep(hz) {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator();
    o.frequency.value = hz; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.12); } catch {}
  navigator.vibrate?.(60);
}
/** Safe localStorage JSON (private mode / blocked storage must not crash the app). */
export const storage = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
