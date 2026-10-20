// Tab: التقرير – weekly (or any range) summary the doctor can copy & send.
import { student, allRecords } from "../core/store.js";
import { $, esc, today, daysAgo, copyText, studentGroup } from "../core/utils.js";
import { statusIndex, atRisk, members } from "../core/rules.js";
import { bar } from "./dash.js";

let text = "";
const list = (title, rows, cls) => `<div class="card"><b>${title} (${rows.length})</b><ul>${rows.map((r) =>
  `<li><span>${esc(r.s.name)} <span class="tag">${studentGroup(r.s, r.type)}</span></span><span class="${cls}">${esc(r.subject)} ${r.type}: ${r.n}/${r.lim}</span></li>`).join("") || "<li class='mute'>ماكو</li>"}</ul></div>`;

export function init() {
  $("rFrom").value = daysAgo(6); $("rTo").value = today();
  ["rFrom", "rTo"].forEach((i) => $(i).addEventListener("input", render));
  $("rCopy").onclick = () => copyText(text).then(() => alert("✓ انسخ التقرير"));
}

export function render() {
  const a = $("rFrom").value, b = $("rTo").value, all = allRecords(), idx = statusIndex(all);
  const inR = all.filter((r) => r.date >= a && r.date <= b);
  const sessions = [...new Set(inR.map((r) => `${r.group_code}|${r.date}|${r.subject}|${r.type}`))];
  const groups = {};
  sessions.forEach((k) => {
    const [g, ...rest] = k.split("|"), sk = rest.join("|"), mem = members(g), x = (groups[g] ||= { n: 0, p: 0, t: 0 });
    x.n++; x.t += mem.length; x.p += mem.filter((s) => idx.has(`${s.id}|${sk}`)).length;
  });
  const pc = (x) => (x.t ? Math.round((x.p * 100) / x.t) : 0);
  const count = (st) => inR.filter((r) => r.status === st).length;
  const lateBy = {}; inR.forEach((r) => r.status === "متأخر" && (lateBy[r.student_id] = (lateBy[r.student_id] || 0) + 1));
  const late = Object.entries(lateBy).sort((x, y) => y[1] - x[1]).slice(0, 10);
  const risk = atRisk(1), over = risk.filter((r) => r.over), near = risk.filter((r) => !r.over);
  const G = Object.keys(groups).sort();

  $("rOut").innerHTML =
    `<div class="card"><b>الملخص</b><p>${sessions.length} محاضرة · ${inR.length - count("عذر")} حضور · ${count("متأخر")} تأخير · ${count("عذر")} عذر</p></div>` +
    `<div class="card"><b>نسبة الحضور لكل مجموعة</b>${G.map((g) => bar(g, groups[g].n + " محاضرة", pc(groups[g]))).join("") || "<p class='mute'>ماكو محاضرات بهالفترة</p>"}</div>` +
    list("تجاوزوا حد الغياب (مفصولين)", over, "a") + list("قريبين من الفصل", near, "l") +
    `<div class="card"><b>أكثر المتأخرين</b><ul>${late.map(([id, n]) => `<li><span>${esc(student(id)?.name || id)}</span><span class="l">${n}</span></li>`).join("") || "<li class='mute'>ماكو</li>"}</ul></div>`;

  const line = (r) => `${r.s.name} – ${r.subject} ${r.type} ${r.n}/${r.lim}`;
  text = `تقرير الحضور ${a} → ${b}\n${sessions.length} محاضرة\n\nنسبة الحضور:\n${G.map((g) => `${g}: ${pc(groups[g])}%`).join("\n")}` +
    `\n\nتجاوزوا الحد (${over.length}):\n${over.map(line).join("\n")}\n\nقريبين من الفصل (${near.length}):\n${near.map(line).join("\n")}`;
}
