// Tab: المسح – live session, QR scanning, manual entry, absentees.
import { state, student, allRecords, emit } from "../core/store.js";
import { $, esc, today, nowHM, mins, beep, copyText, GROUPS, typeOfGroup, inGroup, studentGroup } from "../core/utils.js";
import { autoSession, isLive } from "../core/session.js";
import { members } from "../core/rules.js";
import { flush } from "../core/api.js";

const FORM = ["fGrp", "fType", "fSub", "fDate", "fFrom", "fGrace"];
const flash = (t, c) => { const f = $("flash"); f.className = "flash " + c; f.textContent = t; };
const sessionRecs = () => { const s = state.session; return allRecords().filter((r) => r.date === s.date && r.subject === s.subject && r.type === s.type && r.group_code === s.group); };

/** QR payload formats: "ATT|B052" (printed cards) or a URL containing ?s=B052 (legacy). */
export function parseId(text) {
  const t = (text || "").trim();
  return (t.match(/[?&]s=([A-Za-z0-9]+)/) || t.match(/^ATT\|([A-Za-z0-9]+)/) || [])[1] || null;
}

/** Core action: add one attendance record for the current session. */
export function record(id, { status = null, manual = false } = {}) {
  const s = student(id), c = state.session;
  if (!s) return false;
  if (!state.subjects.some((x) => x.name === c.subject)) { flash("اختاري المادة من القائمة أول", "f-dup"); beep(400); return false; }
  const live = isLive();
  if (!live && !c.manual) { flash("🔒 المسح مقفول – ماكو محاضرة بالجدول هسة", "f-bad"); beep(200); return false; }
  if (allRecords().some((r) => r.date === c.date && r.student_id === id && r.subject === c.subject && r.type === c.type)) {
    flash("مسجّل مسبقاً: " + s.name, "f-dup"); beep(400); return false;
  }
  const time = nowHM(), own = studentGroup(s, c.type), guest = !inGroup(s, c.group);
  status ||= c.from && c.date === today() && mins(time) > mins(c.from) + (+c.grace || 0) ? "متأخر" : "حاضر";
  const note = [guest && "ضيف من " + own, manual && "يدوي", !live && "خارج الوقت"].filter(Boolean).join(" · ");
  state.pending.push({ date: c.date, time, student_id: id, subject: c.subject, type: c.type, status, group_code: c.group, note });
  flash(`${status === "عذر" ? "ع" : "✓"} ${s.name}${guest ? ` (من ${own})` : ""}${status === "متأخر" ? " – متأخر" : ""}`, guest || status !== "حاضر" ? "f-dup" : "f-ok");
  beep(guest ? 660 : 880);
  emit(); flush().catch(() => {});
  return true;
}

// ---------- scanner ----------
let scanner = null, last = "", lastAt = 0;
function onCode(text) {
  const now = Date.now(); if (text === last && now - lastAt < 3000) return; last = text; lastAt = now;
  const id = parseId(text);
  if (!id || !student(id)) { flash("✗ كود مو من القائمة", "f-bad"); beep(200); return; }
  record(id);
}
function start() {
  if (typeof Html5Qrcode === "undefined") return flash("لحظة، دا يحمّل الكاميرا… اضغطي مرة ثانية", "f-dup");
  scanner ||= new Html5Qrcode("reader");
  if (scanner.isScanning) return;
  scanner.start({ facingMode: "environment" }, { fps: 12, qrbox: { width: 240, height: 240 } }, onCode, () => {})
    .then(() => flash("وجّهي الكاميرا على كود الطالب", "f-ok"))
    .catch(() => flash("الكاميرا ما اشتغلت: اسمحي للموقع باستخدام الكاميرا من إعدادات Safari", "f-bad"));
}

// ---------- form ----------
function fillForm() {
  const c = state.session;
  $("fSub").innerHTML = "<option value=''>— اختاري المادة —</option>" + state.subjects.map((s) => `<option>${esc(s.name)}</option>`).join("");
  Object.assign($("fGrp"), { value: c.group }); $("fType").value = c.type; $("fSub").value = c.subject;
  $("fDate").value = c.date; $("fFrom").value = c.from; $("fGrace").value = c.grace;
  FORM.forEach((i) => ($(i).disabled = !c.manual));
}
function readForm() {
  Object.assign(state.session, { group: $("fGrp").value, type: $("fType").value, subject: $("fSub").value, date: $("fDate").value || today(),
    from: $("fFrom").value, grace: +$("fGrace").value || 0, auto: false, manual: true });
  emit();
}

export function init() {
  $("fGrp").innerHTML = GROUPS.map((g) => `<option value="${g}">${g}${typeOfGroup(g) === "نظري" ? " (الشعبة كاملة)" : ""}</option>`).join("");
  FORM.forEach((i) => $(i).addEventListener("input", readForm));
  $("fGrp").addEventListener("change", () => { $("fType").value = typeOfGroup($("fGrp").value); readForm(); });
  $("manualBtn").onclick = () => { if (confirm("تفتحين محاضرة يدوية خارج الجدول؟ التسجيلات راح تنعلّم \"خارج الوقت\".")) { state.session.manual = true; state.session.auto = false; emit(); } };
  $("autoBtn").onclick = () => { autoSession(true); emit(); };
  $("startBtn").onclick = start;
  $("stopBtn").onclick = () => scanner?.isScanning && scanner.stop();
  $("absent").onclick = (e) => { const b = e.target.closest("button"); if (b) record(b.dataset.id, { status: b.dataset.act === "x" ? "عذر" : null, manual: true }); };
  $("q").addEventListener("input", (e) => {
    const v = e.target.value.trim(), g = state.session.group;
    if (v.length < 2) return ($("qres").innerHTML = "");
    const L = state.students.filter((s) => s.name.includes(v)).sort((a, b) => inGroup(b, g) - inGroup(a, g)).slice(0, 8);
    $("qres").innerHTML = L.map((s) => `<li><span>${esc(s.name)} <span class="tag">${s.subgroup}</span></span><button class="sm" data-id="${s.id}">حاضر</button></li>`).join("") || "<li class='mute'>ماكو نتيجة</li>";
  });
  $("qres").onclick = (e) => { const b = e.target.closest("button"); if (b && record(b.dataset.id, { manual: true })) { $("q").value = ""; $("qres").innerHTML = ""; } };
  $("sumBtn").onclick = () => {
    const c = state.session, R = sessionRecs(), here = new Set(R.map((r) => r.student_id));
    const mem = members(c.group), abs = mem.filter((s) => !here.has(s.id));
    const name = (r) => student(r.student_id)?.name || r.student_id;
    const late = R.filter((r) => r.status === "متأخر"), exc = R.filter((r) => r.status === "عذر");
    let t = `حضور ${c.subject} – ${c.type} ${c.group} – ${c.date}\nالحاضرين: ${R.length - exc.length} من ${mem.length}\n`;
    if (late.length) t += `المتأخرين (${late.length}): ${late.map(name).join("، ")}\n`;
    if (exc.length) t += `بعذر (${exc.length}): ${exc.map(name).join("، ")}\n`;
    copyText(t + `الغايبين (${abs.length}): ${abs.map((s) => s.name).join("، ")}`).then(() => flash("✓ انسخ الملخص", "f-ok"));
  };
}

export function render() {
  const c = state.session, R = sessionRecs(), mem = members(c.group), b = $("banner");
  fillForm();
  if (isLive()) { b.className = "banner"; b.textContent = `📅 حسب الجدول: ${c.type} ${c.group} · ${c.subject}`; }
  else if (c.manual) { b.className = "banner man"; b.textContent = "✎ محاضرة يدوية – التسجيلات تنعلّم خارج الوقت"; }
  else { b.className = "banner lock"; b.textContent = "🔒 ماكو محاضرة بالجدول هسة – المسح مقفول"; }
  $("autoBtn").hidden = c.auto; $("manualBtn").hidden = c.manual;
  const own = R.filter((r) => { const s = student(r.student_id); return s && inGroup(s, c.group) && r.status !== "عذر"; }).length;
  const guests = R.filter((r) => r.note.includes("ضيف")).length;
  $("cnt").textContent = `${own} / ${mem.length}`; $("cntSub").textContent = "حاضر" + (guests ? ` · ${guests} ضيف` : "");
  $("present").innerHTML = R.slice().reverse().map((r) => {
    const cls = r.status === "متأخر" ? "l" : r.status === "عذر" ? "x" : "p";
    return `<li><span><span class="${cls}">${r.status === "عذر" ? "ع" : "✓"}</span> ${esc(student(r.student_id)?.name || r.student_id)}${r.note ? ` <span class="tag">${esc(r.note)}</span>` : ""}</span><span class="mute">${esc(r.time)}${r.status === "متأخر" ? " متأخر" : ""}</span></li>`;
  }).join("") || "<li class='mute'>بعد ماكو أحد</li>";
  const here = new Set(R.map((r) => r.student_id)), abs = mem.filter((s) => !here.has(s.id));
  $("absN").textContent = abs.length;
  $("absent").innerHTML = abs.map((s) => `<li><span>${esc(s.name)}</span><span><button class="sm" data-act="p" data-id="${s.id}">حاضر</button> <button class="sm" data-act="x" data-id="${s.id}">عذر</button></span></li>`).join("");
}
