// Data access layer – the ONLY module that talks to Supabase tables.
// Swap/extend here (e.g. RPCs, Edge Functions) without touching views.
import { sb } from "./supabase.js";
import { state, reindex, emit } from "./store.js";

const PAGE = 1000; // PostgREST default max rows per request

async function fetchAll(table, order) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").order(order).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** Full refresh of all reference data + attendance. */
export async function pull() {
  const [students, subjects, schedule, records] = await Promise.all([
    fetchAll("students", "id"), fetchAll("subjects", "sort"), fetchAll("schedule", "id"), fetchAll("attendance", "id"),
  ]);
  Object.assign(state, { students: students.filter((s) => s.active), subjects, schedule, records });
  reindex(); emit();
}

let flushing = false;
/** Send pending scans. Excuses overwrite (upsert); normal scans never overwrite an existing record. */
export async function flush() {
  if (flushing || !state.pending.length) return;
  flushing = true;
  const batch = state.pending.slice();
  try {
    const clean = (r) => ({ date: r.date, time: r.time, student_id: r.student_id, subject: r.subject, type: r.type, status: r.status, group_code: r.group_code, note: r.note || "" });
    const excuses = batch.filter((r) => r.status === "عذر").map(clean);
    const scans = batch.filter((r) => r.status !== "عذر").map(clean);
    const conflict = "date,student_id,subject,type";
    if (scans.length) { const { error } = await sb.from("attendance").upsert(scans, { onConflict: conflict, ignoreDuplicates: true }); if (error) throw error; }
    if (excuses.length) { const { error } = await sb.from("attendance").upsert(excuses, { onConflict: conflict }); if (error) throw error; }
    state.pending = state.pending.filter((p) => !batch.includes(p));
    await pull();
  } finally { flushing = false; }
}

export async function saveSchedule(rows) {
  // Replace-all is fine at this size (tens of rows). Audit trigger logs each change.
  let { error } = await sb.from("schedule").delete().gte("id", 0); if (error) throw error;
  if (rows.length) ({ error } = await sb.from("schedule").insert(rows)); if (error) throw error;
  await pull();
}

export async function saveSubjects(rows) {
  const { error } = await sb.from("subjects").upsert(rows.map((r, i) => ({ ...r, sort: i + 1 })), { onConflict: "name" });
  if (error) throw error;
  const keep = rows.map((r) => r.name);
  const gone = state.subjects.filter((s) => !keep.includes(s.name)).map((s) => s.name);
  // Subjects already used in attendance can't be deleted (FK) – that's intended.
  if (gone.length) await sb.from("subjects").delete().in("name", gone);
  await pull();
}

export async function moveStudent(id, subgroup) {
  const { error } = await sb.from("students").update({ subgroup }).eq("id", id);
  if (error) throw error;
  await pull();
}

/** Live updates from other devices. */
export function subscribe(onRemoteChange) {
  return sb.channel("attendance-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, onRemoteChange)
    .subscribe();
}
