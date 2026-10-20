// Tab: الإعدادات – timetable, subjects/limits, move student, backup, logout.
import { state } from "../core/store.js";
import { $, esc, hhmm, today, GROUPS, typeOfGroup } from "../core/utils.js";
import { SUBGROUPS_PER_SECTION } from "../core/config.js";
import { saveSchedule, saveSubjects, moveStudent } from "../core/api.js";
import { sessionsOf } from "../core/rules.js";
import { exportBook } from "../core/excel.js";
import { sb } from "../core/supabase.js";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const opts = (arr, sel) => arr.map((v, i) => { const [val, lab] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}"${String(val) === String(sel) ? " selected" : ""}>${esc(lab)}</option>`; }).join("");

const schRow = (r = { weekday: 0, start_time: "08:30", end_time: "09:50", group_code: "B", subject: state.subjects[0]?.name }) =>
  `<div class="card sch"><div class="row tight"><select class="sd">${opts(DAYS.map((d, i) => [i, d]), r.weekday)}</select>` +
  `<input class="sf" type="time" value="${hhmm(r.start_time)}"><input class="st" type="time" value="${hhmm(r.end_time)}"></div>` +
  `<div class="row"><select class="sg">${opts(GROUPS, r.group_code)}</select><select class="ss">${opts(state.subjects.map((s) => s.name), r.subject)}</select><button class="sm grow0 sx">✕</button></div></div>`;

const subRow = (x = { name: "", limit_theory: 3, limit_practical: 3 }) =>
  `<div class="row sr"><input class="sn" placeholder="اسم المادة" value="${esc(x.name)}">` +
  `<input class="s1" type="number" min="0" value="${x.limit_theory}" style="flex:0 0 64px"><input class="s2" type="number" min="0" value="${x.limit_practical}" style="flex:0 0 64px"><button class="sm grow0 sx">✕</button></div>`;

const dirty = (el) => (el.dataset.dirty = 1);
const run = (p, ok) => p.then(() => alert(ok)).catch((e) => alert("ما انحفظ: " + e.message));

export function init() {
  ["schList", "subList"].forEach((id) => {
    $(id).addEventListener("input", (e) => dirty(e.currentTarget));
    $(id).addEventListener("click", (e) => { if (e.target.classList.contains("sx")) { e.target.closest(".sch,.sr").remove(); dirty($(id)); } });
  });
  $("schAdd").onclick = () => { $("schList").insertAdjacentHTML("beforeend", schRow()); dirty($("schList")); };
  $("subAdd").onclick = () => { $("subList").insertAdjacentHTML("beforeend", subRow()); dirty($("subList")); };
  $("schSave").onclick = () => {
    const rows = [...document.querySelectorAll("#schList .sch")].map((c) => {
      const g = c.querySelector(".sg").value;
      return { weekday: +c.querySelector(".sd").value, start_time: c.querySelector(".sf").value, end_time: c.querySelector(".st").value, group_code: g, type: typeOfGroup(g), subject: c.querySelector(".ss").value };
    }).filter((r) => r.start_time && r.end_time && r.subject);
    delete $("schList").dataset.dirty;
    run(saveSchedule(rows), `✓ انحفظ الجدول (${rows.length} محاضرة)`);
  };
  $("subSave").onclick = () => {
    const rows = [...document.querySelectorAll("#subList .sr")].map((r) => ({ name: r.querySelector(".sn").value.trim(), limit_theory: +r.querySelector(".s1").value || 0, limit_practical: +r.querySelector(".s2").value || 0 })).filter((x) => x.name);
    if (!rows.length) return;
    delete $("subList").dataset.dirty;
    run(saveSubjects(rows), `✓ انحفظت المواد (${rows.length})`);
  };
  $("mvQ").addEventListener("input", (e) => {
    const v = e.target.value.trim();
    $("mvRes").innerHTML = v.length < 2 ? "" : state.students.filter((s) => s.name.includes(v)).slice(0, 6).map((s) =>
      `<li><span>${esc(s.name)}</span><select class="sm" data-id="${s.id}" style="width:auto">${opts(Array.from({ length: SUBGROUPS_PER_SECTION }, (_, i) => s.section + (i + 1)), s.subgroup)}</select></li>`).join("");
  });
  $("mvRes").onchange = (e) => run(moveStudent(e.target.dataset.id, e.target.value), "✓ انتقل الطالب إلى " + e.target.value);
  $("backupBtn").onclick = () => exportBook(GROUPS.filter((g) => sessionsOf(g).length), `نسخة-حضور-كاملة-${today()}.xlsx`);
  $("logoutBtn").onclick = () => sb.auth.signOut();
}

export function render() {
  if (!$("schList").dataset.dirty) $("schList").innerHTML = state.schedule.map(schRow).join("");
  if (!$("subList").dataset.dirty) $("subList").innerHTML = state.subjects.map(subRow).join("");
  $("who").textContent = state.user?.email || "";
}
