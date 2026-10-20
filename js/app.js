// Entry point: auth gate → load data → wire tabs → keep in sync.
import { sb } from "./core/supabase.js";
import { state, onChange, emit } from "./core/store.js";
import { $ } from "./core/utils.js";
import { autoSession } from "./core/session.js";
import { pull, flush, subscribe } from "./core/api.js";
import * as scan from "./views/scan.js";
import * as log from "./views/log.js";
import * as dash from "./views/dash.js";
import * as report from "./views/report.js";
import * as settings from "./views/settings.js";

// Register new tabs here (key must match data-tab in index.html and section id="tab-<key>").
const VIEWS = { scan, log, dash, report, settings };
let active = "scan", started = false;

const status = (t, ok) => { const s = $("sync"); s.textContent = t; s.className = "pill " + (ok ? "ok" : "warn"); };
const renderActive = () => VIEWS[active].render();

function showTab(key) {
  active = key;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === key));
  document.querySelectorAll("main section").forEach((s) => s.classList.toggle("on", s.id === "tab-" + key));
  renderActive();
}

async function sync() {
  try {
    await flush(); if (!state.pending.length) await pull();
    status(state.pending.length ? `⟳ ${state.pending.length} بالانتظار` : "✓ محفوظ", !state.pending.length);
  } catch { status(state.pending.length ? `بدون نت – ${state.pending.length} بالانتظار` : "بدون نت"); }
}

function startApp() {
  if (started) return; started = true;
  Object.values(VIEWS).forEach((v) => v.init());
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  onChange(renderActive);
  autoSession(); showTab("scan"); sync();
  subscribe(() => pull().catch(() => {}));                    // other devices' scans appear live
  setInterval(() => { autoSession(); emit(); sync(); }, 30000); // follow the timetable clock
  addEventListener("online", sync);
}

function setScreen(session) {
  state.user = session?.user || null;
  $("login").hidden = !!session; $("app").hidden = !session;
  if (session) startApp(); else status("مو داخل");
}

$("loginForm").onsubmit = async (e) => {
  e.preventDefault(); $("loginMsg").textContent = "لحظة…";
  const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  $("loginMsg").textContent = error ? "✗ الإيميل أو كلمة السر غلط" : "";
};

sb.auth.onAuthStateChange((_evt, session) => { setScreen(session); if (!session && started) location.reload(); });
sb.auth.getSession().then(({ data }) => setScreen(data.session));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
