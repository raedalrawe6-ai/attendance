// Tab: الأيام – pick a date → that day's groups → who attended / was absent / guests.
// Stats are always computed against each student's OWN group, so a student who
// attended with another group still counts for his group (and is listed as "راح لـ").
import { state, student, allRecords } from "../core/store.js";
import { $, esc, studentGroup, inGroup } from "../core/utils.js";
import { members } from "../core/rules.js";
import { bar } from "./dash.js";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
let selDate = "", selKey = "";                       // selKey = "group|subject|type"

const dayName = (d) => DAYS[new Date(d + "T12:00").getDay()];
const pc = (a, b) => (b ? Math.round((a * 100) / b) : 0);

/** All sessions held on a date, with per-group stats. */
function sessionsOn(date) {
  const recs = allRecords().filter((r) => r.date === date);
  const keys = [...new Set(recs.map((r) => `${r.group_code}|${r.subject}|${r.type}`))].sort();
  return keys.map((key) => {
    const [g, subject, type] = key.split("|");
    const sameLecture = recs.filter((r) => r.subject === subject && r.type === type); // any group, same subject/type that day
    const byStudent = new Map(sameLecture.map((r) => [r.student_id, r]));
    const mem = members(g);
    const here = mem.map((s) => [s, byStudent.get(s.id)]).filter(([, r]) => r);
    const attended = here.filter(([, r]) => r.status !== "عذر");
    return {
      key, g, subject, type, mem,
      present: attended.filter(([, r]) => r.group_code === g),
      late: attended.filter(([, r]) => r.status === "متأخر"),
      excused: here.filter(([, r]) => r.status === "عذر"),
      wentElsewhere: attended.filter(([, r]) => r.group_code !== g),
      absent: mem.filter((s) => !byStudent.has(s.id)),
      guests: sameLecture.filter((r) => r.group_code === g && !inGroup(student(r.student_id) || {}, g)),
      rate: pc(attended.length, mem.length),
      attendedN: attended.length,
    };
  });
}

const list = (title, rows, cls, fmt) =>
  `<details class="card" ${rows.length && rows.length < 15 ? "open" : ""}><summary>${title} <span class="tag">${rows.length}</span></summary><ul>${rows.map(fmt).join("") || "<li class='mute'>ماكو</li>"}</ul></details>`;

function renderDetail(x) {
  const nm = (s) => esc(s.name);
  return `<button class="sm" id="dBack">→ رجوع لـ ${esc(dayName(selDate))}</button>
  <div class="card"><b>${x.g} · ${esc(x.subject)} · ${x.type}</b><div class="mute">${selDate}</div>
    <div class="stats"><div><b>${x.attendedN}</b><span>حضر</span></div><div><b>${x.absent.length}</b><span>غاب</span></div><div><b>${x.late.length}</b><span>متأخر</span></div><div><b>${x.excused.length}</b><span>عذر</span></div></div>
    ${bar("الحضور", `${x.attendedN} من ${x.mem.length}`, x.rate)}</div>` +
    list("✓ حضروا ويه كروبهم", x.present, "p", ([s, r]) => `<li><span>${nm(s)}</span><span class="${r.status === "متأخر" ? "l" : "mute"}">${esc(r.time)}${r.status === "متأخر" ? " متأخر" : ""}</span></li>`) +
    list("↗ حضروا ويه كروب ثاني", x.wentElsewhere, "x", ([s, r]) => `<li><span>${nm(s)}</span><span class="tag">راح لـ ${esc(r.group_code)}</span></li>`) +
    list("✗ غابوا", x.absent, "a", (s) => `<li><span>${nm(s)}</span></li>`) +
    list("ع بعذر", x.excused, "x", ([s]) => `<li><span>${nm(s)}</span></li>`) +
    list("↙ ضيوف من كروبات ثانية", x.guests, "x", (r) => { const s = student(r.student_id); return `<li><span>${esc(s?.name || r.student_id)}</span><span class="tag">من ${esc(s ? studentGroup(s, r.type) : "?")}</span></li>`; });
}

export function init() {
  $("tab-days").addEventListener("click", (e) => {
    const t = e.target.closest("[data-date],[data-key],#dBack"); if (!t) return;
    if (t.id === "dBack") selKey = "";
    else if (t.dataset.date) { selDate = t.dataset.date; selKey = ""; }
    else selKey = t.dataset.key;
    render();
  });
}

export function render() {
  const dates = [...new Set(allRecords().map((r) => r.date))].sort().reverse();
  if (!selDate || !dates.includes(selDate)) selDate = dates[0] || "";
  $("dayChips").innerHTML = dates.map((d) => `<button class="chip${d === selDate ? " on" : ""}" data-date="${d}">${dayName(d)}<small>${d.slice(5)}</small></button>`).join("") || "<p class='mute'>بعد ماكو أيام مسجلة</p>";
  if (!selDate) return ($("dayBody").innerHTML = "");
  const S = sessionsOn(selDate);
  const x = S.find((s) => s.key === selKey);
  if (x) return ($("dayBody").innerHTML = renderDetail(x));

  // Section roll-up (useful on practical days: A = A1+A2+A3 held that day)
  const sec = {};
  S.forEach((s) => { const k = s.g[0]; const o = (sec[k] ||= { a: 0, t: 0 }); o.a += s.attendedN; o.t += s.mem.length; });
  const totA = S.reduce((n, s) => n + s.attendedN, 0), totT = S.reduce((n, s) => n + s.mem.length, 0);
  const best = S.slice().sort((a, b) => b.rate - a.rate);
  $("dayBody").innerHTML =
    `<div class="card"><b>${dayName(selDate)} ${selDate}</b><div class="stats"><div><b>${S.length}</b><span>محاضرة</span></div><div><b>${totA}</b><span>حضر</span></div><div><b>${totT - totA}</b><span>غاب</span></div><div><b>${pc(totA, totT)}%</b><span>النسبة</span></div></div>` +
    (best.length > 1 ? `<p class="mute">الأعلى حضوراً: <b>${best[0].g}</b> (${best[0].rate}%) · الأقل: <b>${best.at(-1).g}</b> (${best.at(-1).rate}%)</p>` : "") + `</div>` +
    `<div class="card"><b>الكروبات</b><p class="mute">اضغط على أي كروب حتى تشوف منو حضر ومنو غاب.</p>${S.map((s) =>
      `<button class="grp" data-key="${esc(s.key)}">${bar(s.g, `${esc(s.subject)} · ${s.type} · ${s.attendedN}/${s.mem.length}${s.guests.length ? ` · ${s.guests.length} ضيف` : ""}`, s.rate)}</button>`).join("")}</div>` +
    (Object.keys(sec).length && S.some((s) => /\d$/.test(s.g)) ? `<div class="card"><b>حسب الشعبة</b>${Object.keys(sec).sort().map((k) => bar(k, `${sec[k].a}/${sec[k].t}`, pc(sec[k].a, sec[k].t))).join("")}</div>` : "");
}
