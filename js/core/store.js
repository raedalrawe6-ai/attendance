// In-memory app state + tiny pub/sub. Server data is cached locally so the app opens offline;
// unsent scans live in `pending` until api.flush() delivers them.
import { storage, today, nowHM } from "./utils.js";
import { DEFAULT_GRACE_MIN } from "./config.js";

const KEY = "att_v5";
const saved = storage.get(KEY, {});

export const state = {
  students: saved.students || [],     // {id,name,section,subgroup}
  subjects: saved.subjects || [],     // {name,limit_theory,limit_practical}
  schedule: saved.schedule || [],     // {id,weekday,start_time,end_time,group_code,type,subject}
  records:  saved.records  || [],     // attendance rows from server
  pending:  saved.pending  || [],     // attendance rows not yet on server
  session:  saved.session  || { group: "B", type: "نظري", subject: "", date: today(), from: nowHM(), grace: DEFAULT_GRACE_MIN, auto: true, manual: false },
  view:     saved.view     || { group: "B", subject: "" },
  user: null,
};

let byId = new Map();
export const student = (id) => byId.get(id);
export const reindex = () => { byId = new Map(state.students.map((s) => [s.id, s])); };
reindex();

export function persist() {
  const { user, ...rest } = state;
  storage.set(KEY, rest);
}

/** Server rows + pending rows (pending wins on the same session key). */
export function allRecords() {
  const k = (r) => `${r.date}|${r.student_id}|${r.subject}|${r.type}`;
  const map = new Map(state.records.map((r) => [k(r), r]));
  state.pending.forEach((r) => map.set(k(r), r));
  return [...map.values()];
}

const subs = new Set();
export const onChange = (fn) => subs.add(fn);
export const emit = () => { persist(); subs.forEach((fn) => fn()); };
