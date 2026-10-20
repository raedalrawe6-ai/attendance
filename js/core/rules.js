// Attendance maths (pure functions over records). Keep business rules here, not in views.
import { state, allRecords } from "./store.js";
import { inGroup, studentGroup } from "./utils.js";

export const sessionKey = (r) => `${r.date}|${r.subject}|${r.type}`;

/** Distinct sessions held for a group (optionally one subject), sorted by date. */
export function sessionsOf(group, subject = "", recs = allRecords()) {
  const set = new Set();
  recs.forEach((r) => { if (r.group_code === group && (!subject || r.subject === subject)) set.add(sessionKey(r)); });
  return [...set].sort();
}

/** Index: "studentId|sessionKey" → status, built once per render for O(1) lookups. */
export function statusIndex(recs = allRecords()) {
  const m = new Map();
  recs.forEach((r) => m.set(`${r.student_id}|${sessionKey(r)}`, r.status));
  return m;
}

export function absences(s, type, subject, idx, recs) {
  const g = studentGroup(s, type);
  return sessionsOf(g, subject, recs).filter((k) => !idx.has(`${s.id}|${k}`)).length;
}

export function limitOf(subject, type) {
  const x = state.subjects.find((s) => s.name === subject);
  return x ? (type === "عملي" ? x.limit_practical : x.limit_theory) : 0;
}

/** Students at/over the deprivation limit. margin=1 also returns those one absence away. */
export function atRisk(margin = 0) {
  const recs = allRecords(), idx = statusIndex(recs), out = [];
  state.students.forEach((s) => ["نظري", "عملي"].forEach((t) => state.subjects.forEach(({ name }) => {
    const lim = limitOf(name, t); if (!lim) return;
    const n = absences(s, t, name, idx, recs);
    if (n > 0 && n >= lim - margin) out.push({ s, type: t, subject: name, n, lim, over: n > lim });
  })));
  return out.sort((a, b) => (b.n - b.lim) - (a.n - a.lim));
}

export const members = (g) => state.students.filter((s) => inGroup(s, g));
