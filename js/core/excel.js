// Excel export (SheetJS global `XLSX`, loaded in index.html).
import { allRecords } from "./store.js";
import { sessionsOf, statusIndex, members } from "./rules.js";

function groupSheet(g, recs, idx) {
  const K = sessionsOf(g, "", recs);
  const rows = [["ت", "الرقم", "الاسم", "الكروب", ...K.map((k) => { const [d, sub] = k.split("|"); return `${sub} · ${d}`; }), "عدد الغياب"]];
  members(g).forEach((s, i) => {
    let ab = 0;
    const cells = K.map((k) => { const v = idx.get(`${s.id}|${k}`); if (!v) { ab++; return "غ"; } return v === "حاضر" ? "✓" : v; });
    rows.push([i + 1, s.id, s.name, s.subgroup, ...cells, ab]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = [{ wch: 4 }, { wch: 6 }, { wch: 30 }, { wch: 5 }];
  return ws;
}

export function exportBook(groups, filename) {
  if (typeof XLSX === "undefined") return alert("لحظة وجربي مرة ثانية");
  const recs = allRecords(), idx = statusIndex(recs), wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  groups.forEach((g) => XLSX.utils.book_append_sheet(wb, groupSheet(g, recs, idx), g));
  const raw = [["التاريخ", "الوقت", "الرقم", "المادة", "النوع", "الحالة", "المجموعة", "ملاحظة"],
    ...recs.map((r) => [r.date, r.time, r.student_id, r.subject, r.type, r.status, r.group_code, r.note])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), "السجل الكامل");
  XLSX.writeFile(wb, filename);
}
