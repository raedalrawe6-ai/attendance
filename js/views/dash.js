// Tab: اللوحة – attendance % per group + most-absent students.
import { state, allRecords } from "../core/store.js";
import { $, esc, GROUPS } from "../core/utils.js";
import { sessionsOf, statusIndex, absences, members } from "../core/rules.js";

export const bar = (label, sub, pc) =>
  `<div class="barrow"><div class="row tight"><b class="grow0">${label}</b><span class="mute">${sub}</span><b style="text-align:left">${pc}%</b></div><div class="bar"><i style="width:${pc}%"></i></div></div>`;

export function init() {}

export function render() {
  const recs = allRecords(), idx = statusIndex(recs);
  $("dGrp").innerHTML = GROUPS.map((g) => {
    const K = sessionsOf(g, "", recs); if (!K.length) return "";
    const mem = members(g), tot = K.length * mem.length;
    const pres = mem.reduce((n, s) => n + K.filter((k) => idx.has(`${s.id}|${k}`)).length, 0);
    return bar(g, `${K.length} محاضرة`, tot ? Math.round((pres * 100) / tot) : 0);
  }).join("") || "<p class='mute'>بعد ماكو محاضرات مسجلة</p>";
  const top = state.students.map((s) => [s, absences(s, "نظري", "", idx, recs) + absences(s, "عملي", "", idx, recs)])
    .filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 15);
  $("dTop").innerHTML = top.map(([s, n]) => `<li><span>${esc(s.name)} <span class="tag">${s.subgroup}</span></span><span class="a">${n}</span></li>`).join("") || "<li class='mute'>ماكو غياب</li>";
}
