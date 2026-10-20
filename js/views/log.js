// Tab: السجل – per-group grid of sessions × students, excuse editing, deprivation list.
import { state, student, emit } from "../core/store.js";
import { $, esc, today, GROUPS, typeOfGroup, studentGroup } from "../core/utils.js";
import { sessionsOf, statusIndex, absences, limitOf, atRisk, members } from "../core/rules.js";
import { allRecords } from "../core/store.js";
import { exportBook } from "../core/excel.js";
import { flush } from "../core/api.js";

const CELL = { "متأخر": "<td class='l'>م</td>", "عذر": "<td class='x'>ع</td>", "حاضر": "<td class='p'>✓</td>" };

export function init() {
  $("vGrp").innerHTML = GROUPS.map((g) => `<option>${g}</option>`).join("");
  $("vGrp").onchange = (e) => { state.view.group = e.target.value; $("riskBox").hidden = true; emit(); };
  $("vSub").onchange = (e) => { state.view.subject = e.target.value; emit(); };
  $("xlsBtn").onclick = () => exportBook([state.view.group], `حضور-${state.view.group}-${today()}.xlsx`);
  $("tbl").onclick = (e) => {
    const td = e.target.closest("td[data-id]"); if (!td) return;
    const s = student(td.dataset.id), [date, subject, type] = td.dataset.k.split("|");
    if (!confirm(`تسجيل غياب ${s.name} يوم ${date} كـ عذر؟`)) return;
    state.pending.push({ date, time: "--:--", student_id: s.id, subject, type, status: "عذر", group_code: state.view.group, note: "عذر" });
    emit(); flush().catch(() => {});
  };
  $("riskBtn").onclick = () => {
    const out = atRisk(0), box = $("riskBox"); box.hidden = false;
    box.innerHTML = `<b>المهددين بالحرمان (${out.length})</b><ul>${out.map((o) => `<li><span>${esc(o.s.name)} <span class="tag">${studentGroup(o.s, o.type)}</span></span><span class="${o.over ? "a" : "l"}">${esc(o.subject)} ${o.type}: ${o.n}/${o.lim}</span></li>`).join("") || "<li class='mute'>ماكو أحد</li>"}</ul>`;
  };
}

export function render() {
  const g = state.view.group, sub = state.view.subject, type = typeOfGroup(g);
  $("vGrp").value = g;
  $("vSub").innerHTML = "<option value=''>كل المواد</option>" + state.subjects.map((s) => `<option>${esc(s.name)}</option>`).join("");
  $("vSub").value = sub;
  const recs = allRecords(), idx = statusIndex(recs), K = sessionsOf(g, sub, recs), subs = sub ? [sub] : state.subjects.map((s) => s.name);
  if (!K.length) return ($("tbl").innerHTML = "<tr><td class='mute'>ماكو محاضرات مسجلة لهذي المجموعة بعد</td></tr>");
  let h = "<tr><th>الطالب</th>" + K.map((k, i) => { const [d, s] = k.split("|"); return `<th>م${i + 1}<div class="mute">${esc(s)}<br>${d.slice(5)}</div></th>`; }).join("") + "<th>غياب</th></tr>";
  h += members(g).map((s) => {
    let ab = 0;
    const cells = K.map((k) => CELL[idx.get(`${s.id}|${k}`)] || (ab++, `<td class="a" data-id="${s.id}" data-k="${esc(k)}">غ</td>`)).join("");
    let cls = "";
    subs.forEach((x) => { const l = limitOf(x, type); if (!l) return; const n = absences(s, type, x, idx, recs); if (n > l) cls = "over"; else if (n === l && !cls) cls = "warn"; });
    return `<tr class="${cls}"><td>${esc(s.name)}</td>${cells}<td>${ab}</td></tr>`;
  }).join("");
  $("tbl").innerHTML = h;
}
