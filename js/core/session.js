// Which lecture is "now" – derived from the timetable. Scanning is only allowed inside a live slot
// (or a manual session the doctor opened deliberately; those records are tagged "خارج الوقت").
import { state, persist } from "./store.js";
import { today, nowHM, mins, hhmm, typeOfGroup } from "./utils.js";
import { PRE_OPEN_MIN } from "./config.js";

export function currentSlot(date = new Date()) {
  const dow = date.getDay(), t = mins(nowHM());
  return state.schedule.find((r) => r.weekday === dow && t >= mins(r.start_time) - PRE_OPEN_MIN && t <= mins(r.end_time)) || null;
}

/** Follow the timetable unless the doctor switched to a manual session. */
export function autoSession(force = false) {
  const s = state.session;
  if (!s.auto && !force) return;
  const r = currentSlot();
  if (r) Object.assign(s, { group: r.group_code, type: r.type || typeOfGroup(r.group_code), subject: r.subject, date: today(), from: hhmm(r.start_time), auto: true, manual: false });
  else if (s.date !== today()) Object.assign(s, { date: today(), from: nowHM() });
  persist();
}

/** True when the selected session equals the timetable slot happening right now. */
export function isLive() {
  const s = state.session, r = currentSlot();
  return !!(s.auto && r && r.group_code === s.group && r.subject === s.subject && s.date === today());
}
