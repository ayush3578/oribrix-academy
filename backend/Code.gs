/**
 * ORIBRIX VENDOR ONBOARDING ACADEMY - Google Sheets backend (Google Apps Script)
 *
 * Setup (details in README.md):
 *  1. Create a Google Sheet. Extensions > Apps Script. Paste this whole file. Save.
 *  2. Run the function `setup` once (Run button). Allow the permissions it asks for.
 *     It creates the tabs: Learners, Progress, Results, Quiz, Settings.
 *  3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *  4. Copy the Web app URL into assets/js/config.js (API_URL).
 *
 * Maintenance: edit questions in the "Quiz" tab and rules in the "Settings" tab.
 * Learners who fail can retake the quiz themselves (a new question set each time); a pass ends it.
 * Earlier attempts are kept in the "ResetLog" tab. Admins can also use "Allow retake".
 * Admin: the mobiles in ADMIN_MOBILES (Settings) can open the admin dashboard with the ADMIN_PIN (Settings).
 * Several courses share this sheet: the "course" column tells them apart (empty = vendor-onboarding).
 */

const COURSES = {
  "vendor-onboarding": { modules: 8, name: "Oribrix Vendor Onboarding Academy" },
  "vendor-portal": { modules: 6, name: "Oribrix Vendor Portal Academy" },
  // Open-for-all vs needs-approval is switched per course in the admin dashboard (see isRestricted below)
  "whatsapp-care": { modules: 4, name: "Oribrix WhatsApp Customer Care Academy" }
};
const DEFAULT_COURSE = "vendor-onboarding";

const TABS = {
  Learners: ["mobile", "name", "registered_at", "last_seen", "lang"],
  Progress: ["mobile", "module", "lang", "watched_percent", "completed_at", "course"],
  Results: ["submitted_at", "mobile", "name", "score", "total", "percent", "passed", "cert_id", "lang", "answers_json", "same_name_other_mobile", "course"],
  Quiz: ["id", "module", "active", "question_en", "question_hi", "A_en", "B_en", "C_en", "D_en", "A_hi", "B_hi", "C_hi", "D_hi", "correct", "explanation_en", "explanation_hi", "course"],
  Settings: ["key", "value", "notes"],
  Practice: ["at", "mobile", "name", "score", "total", "percent", "course"],
  ResetLog: ["reset_at", "submitted_at", "mobile", "name", "score", "total", "percent", "passed", "cert_id", "reason", "course"],
  Access: ["mobile", "name", "course", "status", "requested_at", "decided_at", "decided_by"]
};
const DEFAULT_SETTINGS = [
  ["TOTAL_MODULES", 8, "Number of video modules a learner must complete before the quiz"],
  ["QUESTIONS_PER_MODULE", 3, "Questions picked per module for each learner (random, fixed per learner)"],
  ["TOTAL_QUESTIONS", 25, "Total questions per learner; extra ones are filled at random from the rest of the bank"],
  ["PASS_PERCENT", 80, "Minimum score (%) to get a certificate. 0 = certificate for everyone who submits"],
  ["COURSE_NAME", "Oribrix Vendor Onboarding Academy", "Shown on verification"],
  ["ADMIN_MOBILES", "7398832290", "Admin mobile numbers, comma separated"],
  ["ADMIN_NAME", "Ayush Rai", "Fixed name for the first admin mobile"],
  ["ADMIN_PIN", "", "Secret PIN for the admin dashboard. Created automatically; change it here any time"]
];

/* ------------------------------------------------------------------ */
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents || "{}"); } catch (x) { return out({ error: "bad_json" }); }
  return out(handle(p));
}
function doGet(e) {
  const p = e.parameter || {};
  if (!p.action) return out({ ok: true, service: "Oribrix Academy backend" });
  if (["verify", "status"].indexOf(p.action) < 0) return out({ error: "use_post" });
  return out(handle(p));
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    ensureColumns();
    switch (p.action) {
      case "register": return register(p);
      case "status": return status(p);
      case "progress": return progress(p);
      case "quiz": return quiz(p);
      case "submit": return submit(p);
      case "verify": return verify(p);
      case "practice": return practice(p);
      case "admin_check": return adminCheck(p);
      case "admin": return adminData(p);
      case "admin_reset": return adminReset(p);
      case "request_access": return requestAccess(p);
      case "admin_access": return adminAccess(p);
      case "admin_course_mode": return adminCourseMode(p);
      case "meta": return { modes: courseModes(Object.keys(COURSES)) };
    }
    return { error: "unknown_action" };
  } catch (err) {
    return { error: String(err.message || err), code: err.code || "server_error" };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ------------------------------------------------------------------ */
function courseOf(p) { const c = String((p && p.course) || DEFAULT_COURSE); if (!COURSES[c]) fail("bad_course"); return c; }
function rc(r) { return String(r.course || "").trim() || DEFAULT_COURSE; }
function totalModules(c) { return c === DEFAULT_COURSE ? Number(setting("TOTAL_MODULES", 8)) : COURSES[c].modules; }
/* Per-course access mode, switchable from the admin dashboard (Settings key COURSE_ACCESS, JSON {"course-id": "open" | "approval"}).
   Courses without an entry: "open" if listed in OPEN_BY_DEFAULT, otherwise "approval" (so new courses start locked). */
const OPEN_BY_DEFAULT = ["vendor-onboarding", "vendor-portal"];
let _accessMap = null;
function accessMap() {
  if (_accessMap) return _accessMap;
  try { _accessMap = JSON.parse(String(setting("COURSE_ACCESS", "{}")) || "{}"); } catch (e) { _accessMap = {}; }
  return _accessMap;
}
function isRestricted(c) { const m = accessMap()[c]; return m ? m === "approval" : OPEN_BY_DEFAULT.indexOf(c) < 0; }
function courseModes(ids) { const out = {}; ids.forEach(c => { out[c] = isRestricted(c) ? "approval" : "open"; }); return out; }
/* "open" (no permission needed), "granted", "requested", "rejected" or "none". Admins always have access. */
function accessOf(mobile, course, accRows) {
  if (!isRestricted(course) || isAdminMobile(mobile)) return "open";
  const mine = (accRows || rows("Access")).filter(r => String(r.mobile) === mobile && String(r.course) === course);
  return mine.length ? String(mine[mine.length - 1].status || "none") : "none";
}
function needAccess(mobile, course) { const a = accessOf(mobile, course); if (a !== "open" && a !== "granted") fail("no_access"); }
function courseName(c) { return c === DEFAULT_COURSE ? setting("COURSE_NAME", COURSES[c].name) : COURSES[c].name; }
/* Adds header cells that newer versions of this file need (e.g. "course") to sheets made by older versions. */
function ensureColumns(force) {
  const props = PropertiesService.getScriptProperties();
  if (!force && props.getProperty("schema") === "3") return;
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(name => {
    let s = ss.getSheetByName(name);
    if (!s) { s = ss.insertSheet(name); s.appendRow(TABS[name]); s.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold").setBackground("#00A4FF").setFontColor("#ffffff"); s.setFrozenRows(1); s.getRange("A:A").setNumberFormat("@"); return; }
    if (s.getLastRow() === 0) return;
    const have = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(String);
    TABS[name].forEach(h => { if (have.indexOf(h) < 0) { have.push(h); s.getRange(1, have.length).setValue(h).setFontWeight("bold").setBackground("#00A4FF").setFontColor("#ffffff"); } });
  });
  props.setProperty("schema", "3");
}
function sh(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function rows(name) {
  const s = sh(name), v = s.getDataRange().getValues(), head = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, j) => o[h] = r[j]); return o; });
}
function append(name, obj) { const head = TABS[name]; sh(name).appendRow(head.map(h => obj[h] === undefined ? "" : obj[h])); }
function setting(key, dflt) { const r = rows("Settings").find(x => x.key === key); return r && r.value !== "" ? r.value : dflt; }
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function cleanMobile(m) { m = String(m || "").replace(/\D/g, ""); if (!/^[6-9]\d{9}$/.test(m)) fail("bad_mobile"); return m; }
function now() { return new Date(); }
function learner(mobile) { return rows("Learners").find(r => String(r.mobile) === mobile); }
function completed(mobile, course) { course = course || DEFAULT_COURSE; return Array.from(new Set(rows("Progress").filter(r => String(r.mobile) === mobile && rc(r) === course).map(r => Number(r.module)))).sort((a, b) => a - b); }
function resultOf(mobile, course) { course = course || DEFAULT_COURSE; return rows("Results").find(r => String(r.mobile) === mobile && rc(r) === course); }
function ymd(d) { try { return d ? Utilities.formatDate(new Date(d), "Asia/Kolkata", "yyyy-MM-dd") : ""; } catch (e) { return ""; } }
function startOf(mobile) { const l = learner(String(mobile).replace(/^'/, "")); return l ? ymd(l.registered_at) : ""; }
function publicResult(r) {
  return r ? { startDate: startOf(r.mobile), name: r.name, score: Number(r.score), total: Number(r.total), percent: Number(r.percent), passed: r.passed === true || r.passed === "TRUE",
               certId: r.cert_id, date: Utilities.formatDate(new Date(r.submitted_at), "Asia/Kolkata", "yyyy-MM-dd") } : null;
}

function register(p) {
  const mobile = cleanMobile(p.mobile);
  let name = String(p.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (name.length < 3) fail("bad_name");
  const ex = learner(mobile), adm = isAdminMobile(mobile), fixed = adminName(mobile);
  if (ex) {
    sh("Learners").getRange(ex._row, 4).setValue(now());
    if (fixed && ex.name !== fixed) { sh("Learners").getRange(ex._row, 2).setValue(fixed); ex.name = fixed; }
    return { name: ex.name, existing: true, startDate: ymd(ex.registered_at), admin: adm };
  }
  if (fixed) name = fixed;
  // Mobile column is stored as text so leading digits are kept exactly
  append("Learners", { mobile: "'" + mobile, name: name, registered_at: now(), last_seen: now(), lang: p.lang || "en" });
  return { name: name, existing: false, startDate: ymd(now()), admin: adm };
}

function status(p) {
  const mobile = cleanMobile(p.mobile), l = learner(mobile), course = courseOf(p);
  const all = {};
  if (l) {
    const prog = rows("Progress").filter(r => String(r.mobile) === mobile), res = rows("Results").filter(r => String(r.mobile) === mobile), acc = rows("Access");
    Object.keys(COURSES).forEach(c => {
      all[c] = { completed: Array.from(new Set(prog.filter(r => rc(r) === c).map(r => Number(r.module)))).sort((a, b) => a - b),
                 result: publicResult(res.find(r => rc(r) === c)), access: accessOf(mobile, c, acc) };
    });
  }
  return { registered: !!l, name: l ? l.name : null, completed: l ? all[course].completed : [], result: l ? all[course].result : null,
           courses: all, modes: courseModes(Object.keys(COURSES)), admin: isAdminMobile(mobile) };
}

function progress(p) {
  const mobile = cleanMobile(p.mobile);
  if (!learner(mobile)) fail("not_registered");
  const course = courseOf(p), mod = Number(p.module), total = totalModules(course);
  needAccess(mobile, course);
  if (!(mod >= 1 && mod <= total)) fail("bad_module");
  if (completed(mobile, course).indexOf(mod) < 0)
    append("Progress", { mobile: "'" + mobile, module: mod, lang: p.lang || "", watched_percent: Number(p.watched) || "", completed_at: now(), course: course });
  return { ok: true, completed: completed(mobile, course) };
}

function isPassed(r) { return !!r && (r.passed === true || String(r.passed).toUpperCase() === "TRUE"); }
function archivedCount(mobile, course) { return rows("ResetLog").filter(r => String(r.mobile) === mobile && rc(r) === course).length; }
/* 0 for the first attempt, 1 for the first retake, ... (same value in quiz() and submit()). */
function attemptNo(mobile, course) { return archivedCount(mobile, course) + (resultOf(mobile, course) ? 1 : 0); }
function archiveResult(r, reason) {
  append("ResetLog", { reset_at: now(), submitted_at: r.submitted_at, mobile: "'" + String(r.mobile), name: r.name, score: r.score, total: r.total,
                       percent: r.percent, passed: r.passed, cert_id: r.cert_id, reason: reason, course: rc(r) });
  sh("Results").deleteRow(r._row);
}

/* Deterministic shuffle so a learner always gets the same question set. */
function seeded(seed) { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; }
function pickQuestions(mobile, attempt, course) {
  course = course || DEFAULT_COURSE;
  const per = Number(setting("QUESTIONS_PER_MODULE", 3));
  const all = rows("Quiz").filter(q => (q.active === true || String(q.active).toUpperCase() === "TRUE") && rc(q) === course);
  const rnd = seeded(mobile + (course === DEFAULT_COURSE ? "" : "|" + course) + "|oribrix" + (attempt ? "|" + attempt : ""));
  const byMod = {};
  all.forEach(q => (byMod[q.module] = byMod[q.module] || []).push(q));
  let set = [], rest = [];
  Object.keys(byMod).sort((a, b) => a - b).forEach(m => {
    const list = byMod[m].slice().sort(() => rnd() - 0.5);
    set = set.concat(per > 0 ? list.slice(0, per) : list);
    rest = rest.concat(per > 0 ? list.slice(per) : []);
  });
  const total = Number(setting("TOTAL_QUESTIONS", 0));
  if (total > set.length) set = set.concat(rest.sort(() => rnd() - 0.5).slice(0, total - set.length));
  return set.sort(() => rnd() - 0.5);
}
function checkEligible(mobile, p, course) {
  if (!learner(mobile)) fail("not_registered");
  if (!(p && isAdmin(p))) needAccess(mobile, course);
  if (isPassed(resultOf(mobile, course))) fail("already_submitted");     // failed learners may retake
  if (p && isAdmin(p)) return;                       // admins may skip the videos
  if (completed(mobile, course).length < totalModules(course)) fail("modules_incomplete");
}
/* Option order is shuffled per learner, per attempt and per question (same order in quiz() and submit()). */
function optionOrder(mobile, attempt, q) {
  const n = ["A", "B", "C", "D"].filter(k => String(q[k + "_en"] || "") !== "").length;
  const rnd = seeded(mobile + "|opt|" + attempt + "|" + q.id), idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return idx;                                   // idx[shownPosition] = original option index
}
function quiz(p) {
  const mobile = cleanMobile(p.mobile), course = courseOf(p); checkEligible(mobile, p, course);
  const lang = p.lang === "hi" ? "hi" : "en", attempt = attemptNo(mobile, course);
  const qs = pickQuestions(mobile, attempt, course).map(q => {
    const opts = ["A", "B", "C", "D"].map(k => (lang === "hi" && q[k + "_hi"]) ? q[k + "_hi"] : q[k + "_en"]);
    return { id: String(q.id), module: Number(q.module), q: (lang === "hi" && q.question_hi) ? q.question_hi : q.question_en,
             options: optionOrder(mobile, attempt, q).map(i => opts[i]) };
  });
  return { questions: qs, passPercent: Number(setting("PASS_PERCENT", 80)) };
}

function submit(p) {
  const mobile = cleanMobile(p.mobile), course = courseOf(p); checkEligible(mobile, p, course);
  const lang = p.lang === "hi" ? "hi" : "en";
  const answers = p.answers || {};
  const attempt = attemptNo(mobile, course), qs = pickQuestions(mobile, attempt, course);
  const prev = resultOf(mobile, course); if (prev) archiveResult(prev, "retake");
  let score = 0; const stored = {};
  const review = qs.map(q => {
    const order = optionOrder(mobile, attempt, q);
    const correctOrig = "ABCD".indexOf(String(q.correct).trim().toUpperCase());
    const shown = answers[String(q.id)] === undefined ? null : Number(answers[String(q.id)]);
    const chosenOrig = shown === null || order[shown] === undefined ? null : order[shown];
    if (chosenOrig !== null) stored[String(q.id)] = chosenOrig;   // saved as original A-D index
    if (chosenOrig === correctOrig) score++;
    return { id: String(q.id), chosen: shown, correct: order.indexOf(correctOrig), explanation: (lang === "hi" && q.explanation_hi) ? q.explanation_hi : q.explanation_en };
  });
  const total = qs.length, percent = total ? Math.round(100 * score / total) : 0;
  const passed = percent >= Number(setting("PASS_PERCENT", 80));
  const l = learner(mobile);
  const certId = passed ? newCertId() : "";
  const dup = rows("Results").some(r => String(r.name).toLowerCase() === String(l.name).toLowerCase() && String(r.mobile) !== mobile);
  append("Results", { submitted_at: now(), mobile: "'" + mobile, name: l.name, score: score, total: total, percent: percent, passed: passed,
                      cert_id: certId, lang: lang, answers_json: JSON.stringify(stored), same_name_other_mobile: dup ? "CHECK" : "", course: course });
  return { name: l.name, startDate: ymd(l.registered_at), attempt: attempt + 1, score: score, total: total, percent: percent, passed: passed, certId: certId,
           date: Utilities.formatDate(now(), "Asia/Kolkata", "yyyy-MM-dd"), review: review };
}
function newCertId() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", ids = rows("Results").map(r => r.cert_id);
  let id;
  do {
    let s = ""; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    id = "ORX-" + Utilities.formatDate(now(), "Asia/Kolkata", "yyyyMM") + "-" + s;
  } while (ids.indexOf(id) >= 0);
  return id;
}

function verify(p) {
  const id = String(p.certId || "").trim().toUpperCase();
  const r = rows("Results").find(x => String(x.cert_id).toUpperCase() === id && id);
  if (!r) return { valid: false };
  const pr = publicResult(r);
  return { valid: true, name: pr.name, startDate: pr.startDate, date: pr.date, percent: pr.percent, course: courseName(rc(r)), courseId: rc(r) };
}

/* ------------------------------------------------------------------ */
/* Run once. Safe to run again: it never deletes data, only adds missing tabs/headers/questions. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(name => {
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    if (s.getLastRow() === 0) {
      s.appendRow(TABS[name]);
      s.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold").setBackground("#00A4FF").setFontColor("#ffffff");
      s.setFrozenRows(1);
    }
  });
  ensureColumns(true);
  const st = ss.getSheetByName("Settings");
  const have = st.getDataRange().getValues().map(r => r[0]);
  DEFAULT_SETTINGS.forEach(r => { if (have.indexOf(r[0]) < 0) st.appendRow(r); });
  const pinRow = st.getDataRange().getValues().findIndex(r => r[0] === "ADMIN_PIN");
  if (pinRow >= 0 && !String(st.getDataRange().getValues()[pinRow][1]).trim())
    st.getRange(pinRow + 1, 2).setValue("'" + String(100000 + Math.floor(Math.random() * 900000)));
  const qz = ss.getSheetByName("Quiz");
  if (qz.getLastRow() === 1) allQuestions().forEach(q => qz.appendRow(q));
  ss.getSheetByName("Learners").getRange("A:A").setNumberFormat("@");
  ss.getSheetByName("Progress").getRange("A:A").setNumberFormat("@");
  ss.getSheetByName("Results").getRange("B:B").setNumberFormat("@");
  const def = ss.getSheetByName("Sheet1"); if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  SpreadsheetApp.flush();
  return "Setup complete. Admin PIN: " + setting("ADMIN_PIN", "");
}

/* ---------------------------- admin ---------------------------- */
function adminMobiles() { return String(setting("ADMIN_MOBILES", "")).split(/[,\s]+/).map(x => x.replace(/\D/g, "").slice(-10)).filter(Boolean); }
function isAdminMobile(mobile) { return adminMobiles().indexOf(String(mobile)) >= 0; }
function adminName(mobile) { const list = adminMobiles(); return list.length && list[0] === String(mobile) ? String(setting("ADMIN_NAME", "")).trim() : ""; }
function normPin(v) { return String(v == null ? "" : v).replace(/^'/, "").replace(/\.0+$/, "").replace(/\s+/g, ""); }
function adminProblem(p) {
  let mobile; try { mobile = cleanMobile(p.mobile); } catch (e) { return "bad_mobile"; }
  if (!isAdminMobile(mobile)) return "mobile_not_admin";
  const pin = normPin(setting("ADMIN_PIN", ""));
  if (pin.length < 4) return "pin_not_set";
  return normPin(p.pin) === pin ? "" : "pin_mismatch";
}
function isAdmin(p) { return adminProblem(p) === ""; }
function needAdmin(p) { if (!isAdmin(p)) fail("not_admin"); }
function adminCheck(p) {
  const why = adminProblem(p);
  if (why) return { error: "not_admin", code: "not_admin", reason: why, pinLength: normPin(setting("ADMIN_PIN", "")).length };
  return { ok: true };
}

function practice(p) {
  const mobile = cleanMobile(p.mobile), l = learner(mobile);
  if (!l) fail("not_registered");
  needAccess(mobile, courseOf(p));
  const total = Math.max(1, Math.min(100, Number(p.total) || 0)), score = Math.max(0, Math.min(total, Number(p.score) || 0));
  append("Practice", { at: now(), mobile: "'" + mobile, name: l.name, score: score, total: total, percent: Math.round(100 * score / total), course: courseOf(p) });
  return { ok: true };
}

function adminData(p) {
  needAdmin(p);
  const course = courseOf(p), mine = r => rc(r) === course;
  const tz = "Asia/Kolkata", f = d => { try { return d ? Utilities.formatDate(new Date(d), tz, "yyyy-MM-dd HH:mm") : ""; } catch (e) { return ""; } };
  const total = totalModules(course);
  const prog = {}; rows("Progress").filter(mine).forEach(r => { const m = String(r.mobile); (prog[m] = prog[m] || {})[Number(r.module)] = f(r.completed_at); });
  const res = {}; rows("Results").filter(mine).forEach(r => { res[String(r.mobile)] = r; });
  const att = {}; rows("ResetLog").filter(mine).forEach(r => { const m = String(r.mobile); att[m] = (att[m] || 0) + 1; });
  const pr = {}; rows("Practice").filter(mine).forEach(r => {
    const m = String(r.mobile), x = pr[m] = pr[m] || { attempts: 0, best: 0, last: null, lastAt: "" };
    x.attempts++; x.best = Math.max(x.best, Number(r.percent) || 0); x.last = Number(r.percent) || 0; x.lastAt = f(r.at);
  });
  const acc = rows("Access");
  const learners = rows("Learners").map(l => {
    const m = String(l.mobile), r = res[m], done = prog[m] || {};
    return { mobile: m, name: l.name, registered: f(l.registered_at), lastSeen: f(l.last_seen), lang: l.lang,
      modules: Object.keys(done).map(Number).sort((a, b) => a - b), moduleDates: done,
      result: r ? { score: Number(r.score), total: Number(r.total), percent: Number(r.percent), passed: r.passed === true || r.passed === "TRUE",
                    certId: r.cert_id, at: f(r.submitted_at), lang: r.lang, flag: r.same_name_other_mobile } : null,
      attempts: (att[m] || 0) + (r ? 1 : 0), practice: pr[m] || null, admin: isAdminMobile(m), access: accessOf(m, course, acc) };
  });
  // question statistics from submitted answers
  const key = {}, qs = {};
  rows("Quiz").filter(mine).forEach(q => { key[String(q.id)] = "ABCD".indexOf(String(q.correct).trim().toUpperCase()); qs[String(q.id)] = { id: String(q.id), module: Number(q.module), q: q.question_en, asked: 0, wrong: 0 }; });
  rows("Results").filter(mine).forEach(r => {
    let a = {}; try { a = JSON.parse(r.answers_json || "{}"); } catch (e) {}
    Object.keys(a).forEach(id => { if (qs[id]) { qs[id].asked++; if (Number(a[id]) !== key[id]) qs[id].wrong++; } });
  });
  const latest = {}; acc.forEach(a => { latest[String(a.mobile) + "|" + a.course] = a; });
  const requests = Object.keys(latest).map(k => latest[k]).filter(a => String(a.status) === "requested" && COURSES[a.course])
    .map(a => ({ mobile: String(a.mobile), name: a.name, course: String(a.course), courseName: courseName(String(a.course)), at: f(a.requested_at) }));
  const allIds = Object.keys(COURSES).concat(Object.keys(accessMap())).filter((c, i, a) => a.indexOf(c) === i);
  return { course: course, restricted: isRestricted(course), requests: requests, modes: courseModes(allIds),
           courses: Object.keys(COURSES).map(c => ({ id: c, name: courseName(c), modules: totalModules(c), restricted: isRestricted(c) })),
           learners: learners, totalModules: total, passPercent: Number(setting("PASS_PERCENT", 80)),
           questions: Object.keys(qs).map(k => qs[k]).filter(q => q.asked > 0).sort((a, b) => b.wrong / b.asked - a.wrong / a.asked) };
}

function requestAccess(p) {
  const mobile = cleanMobile(p.mobile), l = learner(mobile), course = courseOf(p);
  if (!l) fail("not_registered");
  const a = accessOf(mobile, course);
  if (a === "open" || a === "granted" || a === "requested") return { ok: true, access: a };
  append("Access", { mobile: "'" + mobile, name: l.name, course: course, status: "requested", requested_at: now() });
  return { ok: true, access: "requested" };
}

function adminAccess(p) {
  needAdmin(p);
  const target = cleanMobile(p.target), l = learner(target), course = courseOf(p);
  if (!l) fail("not_registered");
  const status = p.grant === true || p.grant === "true" ? "granted" : (p.reject ? "rejected" : "revoked");
  append("Access", { mobile: "'" + target, name: l.name, course: course, status: status, decided_at: now(), decided_by: cleanMobile(p.mobile) });
  return { ok: true, access: status };
}

/* Switch a course between "open" (everyone) and "approval" (admin must allow each learner). Works for upcoming course ids too. */
function adminCourseMode(p) {
  needAdmin(p);
  const id = String(p.course || "").trim(), mode = p.mode === "open" ? "open" : "approval";
  if (!/^[a-z0-9-]{2,40}$/.test(id)) fail("bad_course");
  const map = accessMap(); map[id] = mode;
  const st = sh("Settings"), vals = st.getDataRange().getValues(), i = vals.findIndex(r => r[0] === "COURSE_ACCESS"), json = JSON.stringify(map);
  if (i >= 0) st.getRange(i + 1, 2).setValue(json); else st.appendRow(["COURSE_ACCESS", json, "Course access set from the admin dashboard: open = everyone, approval = admin must allow"]);
  _accessMap = map;
  return { ok: true, modes: map };
}

function adminReset(p) {
  needAdmin(p);
  const target = cleanMobile(p.target), r = resultOf(target, courseOf(p));
  if (!r) fail("no_result");
  archiveResult(r, "admin");
  return { ok: true };
}

/* Run ONCE after pasting a new version of this file: replaces the Quiz tab with the
   question bank below and updates the quiz settings. Learner data is not touched. */
function updateQuiz() {
  setup();
  const qz = sh("Quiz");
  if (qz.getLastRow() > 1) qz.getRange(2, 1, qz.getLastRow() - 1, qz.getLastColumn()).clearContent();
  const bank = allQuestions();
  qz.getRange(2, 1, bank.length, TABS.Quiz.length).setValues(bank);
  const st = sh("Settings"), vals = st.getDataRange().getValues();
  DEFAULT_SETTINGS.filter(d => ["QUESTIONS_PER_MODULE", "TOTAL_QUESTIONS"].indexOf(d[0]) >= 0).forEach(d => {
    const i = vals.findIndex(r => r[0] === d[0]);
    if (i >= 0) st.getRange(i + 1, 2).setValue(d[1]); else st.appendRow(d);
  });
  SpreadsheetApp.flush();
  return "Quiz updated: " + bank.length + " questions in the bank (all courses). Admin PIN: " + setting("ADMIN_PIN", "");
}
/* Every course's questions, each row ending with its course id. */
function allQuestions() {
  return SEED_QUESTIONS.map(r => r.concat([DEFAULT_COURSE])).concat(VP_QUESTIONS.map(r => r.concat(["vendor-portal"])))
    .concat(WA_QUESTIONS.map(r => r.concat(["whatsapp-care"])));
}

/* id, module, active, question_en, question_hi, A_en, B_en, C_en, D_en, A_hi, B_hi, C_hi, D_hi, correct, explanation_en, explanation_hi */
const SEED_QUESTIONS = [
 ["Q101", 1, true, "Which of these is NOT a job of the admin (Oribrix team)?", "Inmein se kaunsa kaam admin (Oribrix team) ka NAHI hai?", "Approving price changes", "Verifying pickup addresses in Shiprocket", "Approving warehouses", "Setting stock and minimum order quantity", "Price changes approve karna", "Shiprocket mein pickup address verify karna", "Warehouses approve karna", "Stock aur minimum order quantity set karna", "D", "Stock and minimum order quantity are set by the vendor. The admin approves KYC, warehouses and prices, creates products and verifies pickups.", "Stock aur minimum order quantity vendor set karta hai. Admin KYC, warehouses aur prices approve karta hai, products banata hai aur pickup verify karta hai."],
 ["Q102", 1, true, "A vendor stocks the same cement bag in a Lucknow warehouse and a Kanpur warehouse. How many SKUs is that?", "Vendor same cement bag Lucknow aur Kanpur ke do warehouses mein rakhta hai. Yeh kitne SKUs hue?", "1", "0 until an order comes", "2", "It depends on the price", "1", "Order aane tak 0", "2", "Price pe depend karta hai", "C", "An SKU is one product in one warehouse with stock, so one product in two warehouses is two SKUs.", "SKU matlab ek product, ek warehouse mein, stock ke saath. Ek product do warehouses mein = do SKUs."],
 ["Q103", 1, true, "In the life of one order, what happens right after the vendor accepts and packs it?", "Ek order ki journey mein, vendor ke accept aur pack karne ke turant baad kya hota hai?", "The vendor gets paid", "Shiprocket picks it up", "The admin approves the order", "The customer confirms the price", "Vendor ko payment milta hai", "Shiprocket pick up karta hai", "Admin order approve karta hai", "Customer price confirm karta hai", "B", "Order flow: customer orders, nearest vendor accepts and packs, Shiprocket picks up, it is delivered, and the vendor is paid later in a settlement.", "Flow: customer order karta hai, nearest vendor accept aur pack karta hai, Shiprocket pick up karta hai, delivery hoti hai, aur vendor ko baad mein settlement mein payment milta hai."],
 ["Q104", 1, true, "At what level is Cash on Delivery (COD) allowed?", "Cash on Delivery (COD) kis level pe allow hota hai?", "Per SKU, by the vendor", "For the whole vendor account only", "Per city, by Shiprocket", "Only by the customer at checkout", "Har SKU pe, vendor dwara", "Sirf poore vendor account ke liye", "Har city ke liye, Shiprocket dwara", "Sirf customer checkout pe", "A", "COD is a checkbox on each listing (SKU), so a vendor can allow it for some products and not others.", "COD har listing (SKU) pe ek checkbox hai, isliye vendor kuch products pe allow kar sakta hai aur kuch pe nahi."],
 ["Q105", 1, true, "A customer in Lucknow opens the app. Whose products does she see?", "Lucknow ki ek customer app kholti hai. Use kiske products dikhte hain?", "Every product in the master catalog", "Only products with a price change", "Products from all vendors in Uttar Pradesh", "Products stocked by vendors near her location", "Master catalog ke saare products", "Sirf price change wale products", "Poore UP ke saare vendors ke products", "Uske paas ke vendors ke stocked products", "D", "Customers only see products that a nearby vendor has stocked in an approved warehouse.", "Customers ko sirf woh products dikhte hain jo paas ke vendor ne approved warehouse mein stock kiye hain."],
 ["Q201", 2, true, "Which GSTIN has the correct format?", "Kaunsa GSTIN sahi format mein hai?", "22AAAAA0000A1Z", "22AAAAA0000A1Z5", "AAAAA0000A", "22-AAAAA-0000-A1Z5", "22AAAAA0000A1Z", "22AAAAA0000A1Z5", "AAAAA0000A", "22-AAAAA-0000-A1Z5", "B", "A GSTIN has exactly 15 characters, like 22AAAAA0000A1Z5. AAAAA0000A is a PAN, not a GSTIN.", "GSTIN mein exactly 15 characters hote hain, jaise 22AAAAA0000A1Z5. AAAAA0000A PAN hai, GSTIN nahi."],
 ["Q202", 2, true, "A vendor enters a 12-digit Bank of Baroda account number. What happens?", "Vendor Bank of Baroda ka 12-digit account number daalta hai. Kya hoga?", "It is rejected: Bank of Baroda needs exactly 14 digits", "It is accepted: anything from 9 to 18 digits works", "It is accepted, and the admin fixes it later", "The IFSC field is cleared", "Reject hoga: Bank of Baroda ko exactly 14 digits chahiye", "Accept hoga: 9 se 18 digit kuch bhi chalega", "Accept hoga, admin baad mein theek karega", "IFSC field clear ho jaayega", "A", "Account numbers are 9 to 18 digits, but some banks have a fixed length. Bank of Baroda must be 14.", "Account number 9 se 18 digit ka hota hai, par kuch banks ki fixed length hoti hai. Bank of Baroda 14 digit ka hona chahiye."],
 ["Q203", 2, true, "The form says the business name is 'Sharma Traders' but the GST certificate says 'Sharma Trading Co.' What is the problem?", "Form mein business name 'Sharma Traders' hai par GST certificate pe 'Sharma Trading Co.' likha hai. Problem kya hai?", "Nothing; small differences are fine", "Only the GSTIN needs to match", "The name must match the Aadhaar", "The legal business name must match the GST certificate", "Kuch nahi; chhota farq chalta hai", "Sirf GSTIN match hona chahiye", "Naam Aadhaar se match hona chahiye", "Legal business name GST certificate se match hona chahiye", "D", "The legal business name must be exactly as on the GST certificate. A mismatch is one of the most common reasons for rejection.", "Legal business name bilkul GST certificate jaisa hona chahiye. Mismatch rejection ki sabse common wajah hai."],
 ["Q204", 2, true, "Which pair of documents is BOTH mandatory?", "Kaunsi jodi ke DONO documents mandatory hain?", "Trade licence and business PAN", "ISO 9001 certificate and cancelled cheque", "GST certificate and owner Aadhaar", "MSME / Udyam and GST certificate", "Trade licence aur business PAN", "ISO 9001 certificate aur cancelled cheque", "GST certificate aur owner Aadhaar", "MSME / Udyam aur GST certificate", "C", "The four mandatory documents are GST certificate, business PAN, cancelled cheque and owner Aadhaar. Trade licence, ISO and MSME are optional.", "Chaar mandatory documents: GST certificate, business PAN, cancelled cheque aur owner Aadhaar. Trade licence, ISO aur MSME optional hain."],
 ["Q205", 2, true, "Every email a vendor tries for the signatory gives an error. What is the most likely reason?", "Vendor signatory ke liye jo bhi email try karta hai, error aata hai. Sabse likely wajah?", "Emails must be Gmail", "Those emails are already used as a login on Oribrix", "The mobile number is wrong", "The GSTIN is not verified yet", "Email sirf Gmail ka hona chahiye", "Woh emails Oribrix pe pehle se login ke liye use ho chuke hain", "Mobile number galat hai", "GSTIN abhi verify nahi hua", "B", "The signatory email becomes the vendor's login, so it must not already be used on Oribrix. In the demo the team had to try several emails.", "Signatory email vendor ka login banta hai, isliye woh Oribrix pe pehle se use nahi hona chahiye. Demo mein team ko kai emails try karne pade."],
 ["Q301", 3, true, "While reviewing the cancelled cheque, what are you checking?", "Cancelled cheque review karte waqt aap kya check karte ho?", "The name matches the signatory's Aadhaar", "The GSTIN is printed on it", "The cheque is signed by the admin", "Account number and IFSC match the banking step", "Naam signatory ke Aadhaar se match karta hai", "GSTIN us pe printed hai", "Cheque admin ne sign kiya hai", "Account number aur IFSC banking step se match karte hain", "D", "The cheque proves the bank details. Wrong bank details mean payouts go to the wrong account.", "Cheque bank details ka proof hai. Galat bank details matlab payout galat account mein jaayega."],
 ["Q302", 3, true, "A vendor was approved last week, but you now find serious problems with them. What should you use?", "Ek vendor pichhle hafte approve hua, par ab usme serious problem mili. Kya use karoge?", "Reject a document", "Delete the vendor's products", "Suspend vendor", "Change their password", "Ek document reject karna", "Vendor ke products delete karna", "Suspend vendor", "Unka password badalna", "C", "Suspend is for after approval: it blocks the vendor. Use it with care.", "Suspend approval ke baad ke liye hai: yeh vendor ko block karta hai. Soch samajh ke use karein."],
 ["Q303", 3, true, "Exactly when does the vendor receive their login email?", "Vendor ko login email theek kab milta hai?", "As soon as all documents are approved", "After Vendor action is set to Approved and Update status is clicked", "When they press Confirm KYC", "After the first order", "Jaise hi saare documents approve hote hain", "Jab Vendor action Approved karke Update status dabaya jaata hai", "Jab woh Confirm KYC dabate hain", "Pehle order ke baad", "B", "Approving documents is not enough. The final vendor approval is a separate step, and only then is the login emailed.", "Documents approve karna kaafi nahi hai. Final vendor approval alag step hai, aur tabhi login email jaata hai."],
 ["Q304", 3, true, "The warehouse address says Lucknow, but the map pin is in Bengaluru. What should the reviewer do?", "Warehouse address Lucknow ka hai par map pin Bengaluru mein hai. Reviewer ko kya karna chahiye?", "Not approve it; ask the vendor to move the pin, with a clear remark", "Approve it; the address is what matters", "Approve it and fix the pin later", "Delete the warehouse", "Approve na kare; clear remark ke saath vendor ko pin move karne bole", "Approve kare; address hi important hai", "Approve kare aur pin baad mein theek kare", "Warehouse delete kare", "A", "A wrong pin means customers in the wrong area see the vendor, and the right customers don't. Check that the pin matches the address before approving.", "Galat pin matlab galat area ke customers ko vendor dikhega, aur sahi ko nahi. Approve se pehle pin aur address match karein."],
 ["Q305", 3, true, "Which is the right way to reject a blurry Aadhaar scan?", "Blurry Aadhaar scan ko reject karne ka sahi tareeka kaunsa hai?", "Reject it without a remark, the vendor will understand", "Approve it if the number is visible", "Suspend the vendor", "Set it to Rejected with a remark like 'Image is blurry; please upload a clear scan'", "Bina remark reject karo, vendor samajh jaayega", "Number dikh raha ho toh approve karo", "Vendor ko suspend karo", "Rejected karo aur remark likho 'Image blurry hai; clear scan upload karein'", "D", "Always reject with a clear remark, never silently, so the vendor knows exactly what to re-upload.", "Hamesha clear remark ke saath reject karein, chupchaap nahi, taaki vendor ko pata ho kya dobara upload karna hai."],
 ["Q401", 4, true, "A product is priced EXCLUSIVE of GST: base price Rs 200, GST 18%. What does the customer pay?", "Product ka price GST EXCLUSIVE hai: base Rs 200, GST 18%. Customer kitna dega?", "Rs 200", "Rs 236", "Rs 169.49", "Rs 218", "Rs 200", "Rs 236", "Rs 169.49", "Rs 218", "B", "Exclusive means GST is added on top: 200 + 18% of 200 = 236. (Rs 169.49 would be the base if 200 were inclusive.)", "Exclusive matlab GST upar se judta hai: 200 + 200 ka 18% = 236. (Agar 200 inclusive hota toh base Rs 169.49 hota.)"],
 ["Q402", 4, true, "Which column is NOT one of the four mandatory columns in the bulk CSV?", "Bulk CSV ke chaar mandatory columns mein se kaunsa NAHI hai?", "HSN code", "ProductName", "BrandName", "Unit", "HSN code", "ProductName", "BrandName", "Unit", "A", "The four mandatory columns are ProductName, CategoryName, BrandName and Unit.", "Chaar mandatory columns hain: ProductName, CategoryName, BrandName aur Unit."],
 ["Q403", 4, true, "A bulk upload has 50 rows. Row 3 is a product that already exists in the catalog. What happens?", "Bulk upload mein 50 rows hain. Row 3 ka product catalog mein pehle se hai. Kya hoga?", "The whole upload fails", "A second copy of the product is created", "The existing product is deleted and replaced", "Row 3 is skipped as a duplicate; the other rows are processed", "Poora upload fail hoga", "Product ki doosri copy ban jaayegi", "Purana product delete hokar replace hoga", "Row 3 duplicate maanke skip hogi; baaki rows process hongi", "D", "Duplicates are reported as 'already exists' and skipped. The rest of the file still uploads.", "Duplicates 'already exists' dikhte hain aur skip hote hain. Baaki file upload ho jaati hai."],
 ["Q404", 4, true, "Bulk pricing for a tile: 10+ units at Rs 85 each, 15+ units at Rs 80 each. A builder orders 12 units. What does he pay per unit?", "Tile ki bulk pricing: 10+ units pe Rs 85, 15+ units pe Rs 80. Builder 12 units order karta hai. Per unit kitna dega?", "Rs 80", "The normal price", "Rs 85", "Rs 82.50", "Rs 80", "Normal price", "Rs 85", "Rs 82.50", "C", "12 units qualifies for the 10+ tier (Rs 85) but not yet the 15+ tier (Rs 80).", "12 units 10+ wale tier (Rs 85) mein aata hai, 15+ wale (Rs 80) mein nahi."],
 ["Q405", 4, true, "Why must 'unit weight per quantity' be filled correctly?", "“Unit weight per quantity” sahi bharna kyun zaroori hai?", "It decides the commission", "Wrong weight sends orders by the wrong delivery mode", "It changes the GST rate", "Customers can't search without it", "Isse commission decide hota hai", "Galat weight se order galat delivery mode se jaata hai", "Isse GST rate badalta hai", "Iske bina customer search nahi kar sakta", "B", "Weight decides how an order ships, for example Normal below 500 kg and Cargo above. Missing weight is a common catalog mistake.", "Weight decide karta hai order kaise ship hoga, jaise 500 kg se kam Normal aur upar Cargo. Weight na bharna common catalog mistake hai."],
 ["Q501", 5, true, "While adding an SKU, which products can a vendor choose from?", "SKU add karte waqt vendor kaunse products choose kar sakta hai?", "Any product they type in", "All products in every category", "Only products other vendors already sell", "Master-catalog products in their approved categories", "Jo bhi product woh type karein", "Har category ke saare products", "Sirf woh products jo doosre vendors bechte hain", "Apni approved categories ke master-catalog products", "D", "Only the vendor's approved categories appear, and products always come from the admin's master catalog.", "Sirf vendor ki approved categories dikhti hain, aur products hamesha admin ke master catalog se aate hain."],
 ["Q502", 5, true, "A helmet SKU has stock 50, the product is Active and the warehouse shows Approved, but a Lucknow customer can't see it. What is the most likely cause?", "Helmet SKU ka stock 50 hai, product Active hai aur warehouse Approved hai, par Lucknow ke customer ko nahi dikh raha. Sabse likely wajah?", "The price is too low", "COD is switched off", "The warehouse pin is in another city", "The helmet needs a price change request", "Price bahut kam hai", "COD band hai", "Warehouse ka pin doosre city mein hai", "Helmet ko price change request chahiye", "C", "In the demo the Central City warehouse was pinned in Bengaluru, so Lucknow customers couldn't see the helmet until the pin was fixed and re-approved.", "Demo mein Central City warehouse Bengaluru mein pinned tha, isliye Lucknow ke customers ko helmet tab tak nahi dikha jab tak pin theek hokar dobara approve nahi hua."],
 ["Q503", 5, true, "A vendor sets the minimum order quantity of a cement SKU to 10. A customer wants 5 bags. What happens?", "Vendor ne cement SKU ki minimum order quantity 10 rakhi. Customer 5 bags chahta hai. Kya hoga?", "She gets 5 bags at the bulk price", "She can't order fewer than 10 from that SKU", "The order goes to the admin for approval", "The vendor gets a price change request", "Use 5 bags bulk price pe milenge", "Woh us SKU se 10 se kam order nahi kar sakti", "Order admin approval ke liye jaayega", "Vendor ko price change request milegi", "B", "Minimum order quantity is the smallest quantity a customer can buy for that SKU.", "Minimum order quantity us SKU ki sabse kam quantity hai jo customer khareed sakta hai."],
 ["Q504", 5, true, "A vendor wants a longer return policy than the master listing. What is the process?", "Vendor master listing se lambi return policy chahta hai. Process kya hai?", "Request a policy change with a reason; the admin must approve it", "Edit the policy directly in the SKU", "Create a new product with the new policy", "Raise a dispute", "Reason ke saath policy change request bhejo; admin approve karega", "SKU mein seedha policy edit karo", "Nayi policy ke saath naya product banao", "Dispute raise karo", "A", "Warranty and return policy come from the master listing. Changes need a reason and admin approval.", "Warranty aur return policy master listing se aati hai. Change ke liye reason aur admin approval chahiye."],
 ["Q505", 5, true, "The admin must hide a product from everyone right now, but it has an ongoing order. What is the right action?", "Admin ko ek product abhi sabse chhupana hai, par uska ek order chal raha hai. Sahi action kya hai?", "Delete it", "Set its stock to zero in every warehouse", "Suspend the vendor", "Switch it to Inactive", "Delete kar do", "Har warehouse mein stock zero kar do", "Vendor ko suspend kar do", "Inactive kar do", "D", "Delete is blocked while an order is ongoing. Inactive hides the product from vendors and customers and can be switched back any time.", "Order chalte waqt delete block hota hai. Inactive product ko vendors aur customers dono se chhupata hai aur kabhi bhi wapas on ho sakta hai."],
 ["Q601", 6, true, "A vendor has two warehouses in Lucknow and wants a lower price in only one of them. Is that allowed?", "Vendor ke Lucknow mein do warehouses hain aur woh sirf ek mein kam price chahta hai. Kya yeh allowed hai?", "Yes, any warehouse can have any price", "No: warehouses in the same city must have the same price", "Yes, if the reason is 'promotional offer'", "Only for COD orders", "Haan, har warehouse ka alag price ho sakta hai", "Nahi: same city ke warehouses ka price same hona chahiye", "Haan, agar reason 'promotional offer' ho", "Sirf COD orders ke liye", "B", "Same city = same price. Different prices in one city confuse customers. Different cities, like Lucknow and Bangalore, can differ.", "Same city = same price. Ek city mein alag prices customers ko confuse karte hain. Alag cities, jaise Lucknow aur Bangalore, mein farq ho sakta hai."],
 ["Q602", 6, true, "Vendor A got Rs 550 approved at her Bangalore warehouse. She adds the same tile at her new Lucknow warehouse without a request. What is the Lucknow price?", "Vendor A ka Rs 550 uske Bangalore warehouse pe approve hua. Woh same tile apne naye Lucknow warehouse mein bina request add karti hai. Lucknow mein price kya hoga?", "The catalog price", "Rs 550", "The average of both", "Nothing until approved", "Catalog price", "Rs 550", "Dono ka average", "Approval tak kuch nahi", "A", "An approved price belongs to one vendor AND one warehouse. Her other warehouse still uses the catalog price.", "Approved price ek vendor AUR ek warehouse ka hota hai. Uske doosre warehouse pe catalog price hi chalega."],
 ["Q603", 6, true, "In the vendor change requests window, which prices does the admin compare?", "Vendor change requests window mein admin kaunse prices compare karta hai?", "MRP and GST only", "Only the requested price", "Prices of all vendors in the state", "Catalog price, current price and requested price", "Sirf MRP aur GST", "Sirf requested price", "State ke saare vendors ke prices", "Catalog price, current price aur requested price", "D", "The window shows the catalog price, the vendor's current price and the requested price, with the vendor's reason.", "Window mein catalog price, vendor ka current price aur requested price dikhte hain, vendor ke reason ke saath."],
 ["Q604", 6, true, "A vendor requests a price HIGHER than the catalog price. What happens?", "Vendor catalog price se ZYADA price request karta hai. Kya hoga?", "The system blocks it automatically", "It is approved automatically", "It is a valid request; the admin accepts or rejects it", "Only lower prices can be requested", "System apne aap block karega", "Apne aap approve ho jaayega", "Valid request hai; admin accept ya reject karega", "Sirf kam price request ho sakta hai", "C", "Vendors can request higher prices too. In the session one such request was rejected by the admin.", "Vendors zyada price bhi request kar sakte hain. Session mein aisi ek request admin ne reject ki thi."],
 ["Q605", 6, true, "Before accepting a price request, which check is NOT on the admin's list?", "Price request accept karne se pehle, kaunsa check admin ki list mein NAHI hai?", "Read the vendor's reason", "Ask the customer to approve the price", "Compare with the catalog price and nearby vendors", "Check the same-city rule", "Vendor ka reason padhna", "Customer se price approve karwana", "Catalog price aur nearby vendors se compare karna", "Same-city rule check karna", "B", "Read the reason, compare prices, check same city = same price, and remember it applies to this vendor and warehouse only. Customers are not part of it.", "Reason padho, prices compare karo, same city = same price check karo, aur yaad rakho ki yeh sirf is vendor aur warehouse ke liye hai. Customer is process mein nahi hota."],
 ["Q701", 7, true, "An order weighs 480 kg. Which Shiprocket service is used?", "Order 480 kg ka hai. Kaunsi Shiprocket service use hogi?", "Cargo", "Express", "Local driver only", "Normal", "Cargo", "Express", "Sirf local driver", "Normal", "D", "Normal is for orders under 500 kg; Cargo is for orders over 500 kg.", "500 kg se kam ke liye Normal; 500 kg se upar ke liye Cargo."],
 ["Q702", 7, true, "A customer orders 3 items. The vendor has stock of only 2. What should the vendor do?", "Customer 3 items order karta hai. Vendor ke paas sirf 2 ka stock hai. Vendor ko kya karna chahiye?", "Accept all 3 and arrange the third later", "Reject the whole order", "Tick only the 2 items; the third goes to another nearby vendor", "Call the admin to cancel the third item", "Teeno accept karo aur teesra baad mein arrange karo", "Poora order reject karo", "Sirf 2 items tick karo; teesra doosre nearby vendor ke paas jaayega", "Teesra item cancel karne admin ko call karo", "C", "Vendors verify and accept item by item. Unticked items look for another vendor, and the customer sees two shipments.", "Vendors item-by-item verify aur accept karte hain. Bina tick wale items doosre vendor ke paas jaate hain, aur customer ko do shipments dikhte hain."],
 ["Q703", 7, true, "A customer chose Express delivery. Following the current process, what does the team do?", "Customer ne Express delivery chuni. Abhi ke process ke hisaab se team kya karti hai?", "Nothing; the Express API handles it", "Copy the order ID and create the order manually in the Shiprocket portal", "Send it by Cargo", "Cancel and ask the customer to re-order", "Kuch nahi; Express API sambhal leta hai", "Order ID copy karke Shiprocket portal mein manually order banate hain", "Cargo se bhejte hain", "Cancel karke customer ko dobara order karne bolte hain", "B", "There is no Express API yet. Copy the order ID, create it manually in the Shiprocket portal, and update the customer.", "Abhi Express API nahi hai. Order ID copy karo, Shiprocket portal mein manually banao, aur customer ko update karo."],
 ["Q704", 7, true, "While verifying a new warehouse in the Shiprocket portal, when is an OTP needed?", "Shiprocket portal mein naya warehouse verify karte waqt OTP kab chahiye?", "Once, for a new phone number; the same number later doesn't need it", "Every time a warehouse is added", "Only for Cargo orders", "Never", "Ek baar, naye phone number ke liye; wahi number baad mein OTP nahi maangta", "Har baar warehouse add karne pe", "Sirf Cargo orders ke liye", "Kabhi nahi", "A", "A new phone number needs OTP once in Shiprocket. Every warehouse must be verified before it can dispatch.", "Naye phone number pe Shiprocket mein ek baar OTP aata hai. Har warehouse dispatch se pehle verify hona chahiye."],
 ["Q705", 7, true, "With a local / in-house driver, which detail does the customer receive?", "Local / in-house driver ke saath customer ko kya milta hai?", "A Shiprocket tracking SMS", "An AWB tracking number", "Nothing at all", "The driver's phone number, to coordinate delivery", "Shiprocket tracking SMS", "AWB tracking number", "Kuch bhi nahi", "Driver ka phone number, delivery coordinate karne ke liye", "D", "The customer gets the driver's number but no Shiprocket tracking SMS, so support must keep them updated.", "Customer ko driver ka number milta hai par Shiprocket tracking SMS nahi, isliye support ko update dete rehna hai."],
 ["Q801", 8, true, "A settlement shows GMV Rs 10,000 and deductions of Rs 1,200. What is the payout?", "Settlement mein GMV Rs 10,000 aur deductions Rs 1,200 hain. Payout kitna hoga?", "Rs 10,000", "Rs 8,800", "Rs 11,200", "Rs 1,200", "Rs 10,000", "Rs 8,800", "Rs 11,200", "Rs 1,200", "B", "Payout = GMV minus deductions (logistics + commission): 10,000 - 1,200 = 8,800.", "Payout = GMV minus deductions (logistics + commission): 10,000 - 1,200 = 8,800."],
 ["Q802", 8, true, "Which dispute is most likely to be resolved quickly?", "Kaunsa dispute sabse jaldi resolve hoga?", "“STL-1042: expected Rs 8,800, received Rs 8,000. Invoice attached.”", "“My payment is wrong, please check.”", "“Call me urgently about money.”", "“Last month's payouts are all wrong.”", "“STL-1042: Rs 8,800 aana tha, Rs 8,000 aaya. Invoice attached.”", "“Mera payment galat hai, check karo.”", "“Paise ke baare mein urgent call karo.”", "“Pichhle mahine ke saare payouts galat hain.”", "A", "A good dispute has the exact settlement or order ID, what's wrong, expected vs received, and proof attached.", "Achhe dispute mein exact settlement ya order ID, kya galat hai, expected vs received, aur proof attached hota hai."],
 ["Q803", 8, true, "A vendor's accountant needs settlement data for their books. What helps?", "Vendor ke accountant ko books ke liye settlement data chahiye. Kya kaam aayega?", "Screenshots of the dashboard", "A dispute for every settlement", "Asking Shiprocket for a report", "Export Tally XML or CSV from Earnings & Settlements", "Dashboard ke screenshots", "Har settlement ke liye dispute", "Shiprocket se report maangna", "Earnings & Settlements se Tally XML ya CSV export", "D", "The settlements table has Tally XML and CSV export buttons for the vendor's accountant.", "Settlements table mein vendor ke accountant ke liye Tally XML aur CSV export buttons hain."],
 ["Q804", 8, true, "On the 'ready to sell' checklist, which item is optional?", "“Ready to sell” checklist mein kaunsa item optional hai?", "Final vendor approval done", "Warehouse verified in Shiprocket", "Local drivers added as a backup", "SKUs added with real stock", "Final vendor approval hona", "Shiprocket mein warehouse verify hona", "Backup ke liye local drivers add karna", "Real stock ke saath SKUs add hona", "C", "Local drivers are a recommended backup but optional. The rest are required before a vendor can sell.", "Local drivers recommended backup hain par optional. Baaki sab sell karne se pehle zaroori hain."],
 ["Q805", 8, true, "Today, when two vendors near a customer sell the same product, what does the customer app show?", "Aaj, agar customer ke paas do vendors same product bechte hain, toh customer app kya dikhata hai?", "Both vendors' prices side by side", "The nearest vendor's product, with one price per card", "The lowest price from any vendor in UP", "The catalog price only", "Dono vendors ke prices saath mein", "Sabse paas wale vendor ka product, ek card pe ek price", "UP ke kisi bhi vendor ka sabse kam price", "Sirf catalog price", "B", "Today the app shows the nearest vendor's product and price. Showing several vendors' prices is still under discussion.", "Aaj app sabse paas wale vendor ka product aur price dikhata hai. Kai vendors ke prices dikhana abhi discussion mein hai."]
];

/* Vendor Portal course: id, module, active, question_en, question_hi, A_en..D_en, A_hi..D_hi, correct, explanation_en, explanation_hi */
const VP_QUESTIONS = [
 ["V101", 1, true, "A vendor's dashboard shows GMV ₹1,20,000 from 30 orders. What is the AOV?", "Vendor ke dashboard pe 30 orders se GMV ₹1,20,000 hai. AOV kitna hai?", "₹3,600", "₹4,000", "₹40,000", "₹1,20,000", "₹3,600", "₹4,000", "₹40,000", "₹1,20,000", "B", "AOV = GMV ÷ number of orders = 1,20,000 ÷ 30 = ₹4,000.", "AOV = GMV ÷ orders = 1,20,000 ÷ 30 = ₹4,000."],
 ["V102", 1, true, "Which of these does a vendor's main login NOT do?", "Inmein se kaunsa kaam vendor ka main login NAHI karta?", "Create staff logins", "Upload e-way bills", "Approve its own new warehouse", "Accept and dispatch orders", "Staff logins banana", "E-way bills upload karna", "Apna naya warehouse khud approve karna", "Orders accept aur dispatch karna", "C", "Warehouses are approved by the admin (after verifying the pickup address in Shiprocket). Vendor proposes, admin approves.", "Warehouse admin approve karta hai (Shiprocket mein pickup address verify karke). Vendor propose karta hai, admin approve karta hai."],
 ["V103", 1, true, "What does the SLA rate on the dashboard measure?", "Dashboard pe SLA rate kya measure karta hai?", "Share of orders handled within the promised time", "Total value sold", "Average stock per SKU", "Number of returns", "Kitne percent orders promised time ke andar handle hue", "Total bikri ki value", "Har SKU ka average stock", "Returns ki ginti", "A", "SLA rate is the percentage of orders handled within the promised time. Slow accepts pull it down.", "SLA rate woh percent hai jitne orders promised time mein handle hue. Late accept se yeh girta hai."],
 ["V104", 1, true, "A vendor stocks the same cement bag in two warehouses. How many SKUs is that for this vendor?", "Vendor same cement bag do warehouses mein rakhta hai. Is vendor ke liye yeh kitne SKUs hain?", "1", "2", "0 until approved", "Depends on the price", "1", "2", "Approval tak 0", "Price pe depend karta hai", "B", "One SKU = one product in one warehouse with its stock and price. Two warehouses means two SKUs.", "Ek SKU = ek product, ek warehouse mein, stock aur price ke saath. Do warehouses = do SKUs."],
 ["V105", 1, true, "A vendor says: “I changed my price yesterday but customers still see the old one.” What do you check first?", "Vendor bolta hai: “Maine kal price badla par customers ko purana dikh raha hai.” Pehle kya check karoge?", "Whether the admin has approved the request", "Whether the app needs reinstalling", "Whether COD is on", "Whether the warehouse is paused", "Kya admin ne request approve ki hai", "Kya app reinstall karna padega", "Kya COD on hai", "Kya warehouse paused hai", "A", "Vendor proposes, admin approves. A price change stays pending (selling at the admin's price) until approved.", "Vendor propose karta hai, admin approve karta hai. Approval tak price change pending rehta hai aur admin ke price pe bikta hai."],
 ["V106", 1, true, "Which document is legally needed to move goods worth ₹50,000 or more?", "₹50,000 ya usse zyada ka maal move karne ke liye kaunsa document zaroori hai?", "AWB", "E-way bill", "Settlement statement", "Tally XML", "AWB", "E-way bill", "Settlement statement", "Tally XML", "B", "An e-way bill is the government transport document for goods worth ₹50,000 or more. The AWB is only the courier tracking number.", "E-way bill ₹50,000 ya zyada ke maal ka government transport document hai. AWB sirf courier tracking number hai."],
 ["V107", 1, true, "Which pair is correct?", "Kaunsi jodi sahi hai?", "AWB = payout cycle; Settlement = tracking number", "AWB = courier tracking number; Settlement = payout cycle", "AWB = e-way bill number; Settlement = GST return", "AWB = SKU code; Settlement = stock count", "AWB = payout cycle; Settlement = tracking number", "AWB = courier tracking number; Settlement = payout cycle", "AWB = e-way bill number; Settlement = GST return", "AWB = SKU code; Settlement = stock count", "B", "AWB (air waybill) is the courier's tracking number. A settlement is one payout cycle to the vendor.", "AWB (air waybill) courier ka tracking number hai. Settlement vendor ka ek payout cycle hai."],
 ["V201", 2, true, "While adding an SKU, a vendor can't find the 'Paint' category. Why?", "SKU add karte waqt vendor ko 'Paint' category nahi mil rahi. Kyun?", "Paint is not one of the vendor's approved categories", "The warehouse is paused", "COD is switched off", "The price request is pending", "Paint vendor ki approved categories mein nahi hai", "Warehouse paused hai", "COD band hai", "Price request pending hai", "A", "The category filter shows only categories approved for that vendor. A missing category must be requested.", "Category filter mein sirf vendor ki approved categories dikhti hain. Missing category request karni padti hai."],
 ["V202", 2, true, "Admin price is ₹390. The vendor requested ₹400 and the admin rejected it. What happens?", "Admin price ₹390 hai. Vendor ne ₹400 maanga aur admin ne reject kiya. Kya hoga?", "The SKU is hidden", "It sells at ₹400", "It keeps selling at ₹390 and shows Rejected", "The SKU is deleted", "SKU chhup jaata hai", "₹400 pe bikta hai", "₹390 pe bikta rehta hai aur Rejected dikhta hai", "SKU delete ho jaata hai", "C", "A rejected request falls back to the admin's catalog price. The SKU keeps selling.", "Rejected request admin ke catalog price pe wapas aati hai. SKU bikta rehta hai."],
 ["V203", 2, true, "What is required with every price or policy change request?", "Har price ya policy change request ke saath kya zaroori hai?", "A reason", "A GST invoice", "The customer's approval", "A new warehouse", "Reason", "GST invoice", "Customer ka approval", "Naya warehouse", "A", "Every change request needs a reason. The admin reads it when deciding.", "Har change request ke saath reason chahiye. Admin decide karte waqt use padhta hai."],
 ["V204", 2, true, "A cement SKU is priced 'exclusive of GST' at ₹390. What does that mean?", "Cement SKU ka price ₹390 'exclusive of GST' hai. Iska matlab?", "₹390 already includes GST", "GST is added on top of ₹390", "No GST applies", "The vendor pays the GST", "₹390 mein GST shaamil hai", "GST ₹390 ke upar add hota hai", "GST lagta hi nahi", "GST vendor bharta hai", "B", "Exclusive of GST means GST is added on top of the selling price.", "Exclusive of GST ka matlab GST selling price ke upar add hota hai."],
 ["V205", 2, true, "A vendor wants a 2-year warranty instead of the catalog's 1 year. What should they do?", "Vendor catalog ke 1 saal ki jagah 2 saal warranty chahta hai. Kya kare?", "Edit the product name", "Request a warranty change with a reason; admin approves", "Create a new product", "Raise a return", "Product ka naam edit kare", "Reason ke saath warranty change request kare; admin approve karega", "Naya product banaye", "Return raise kare", "B", "Warranty and return policy come from the master listing. Changes need a reason and admin approval (Warranty / Return tab).", "Warranty aur return policy master listing se aati hai. Change ke liye reason aur admin approval chahiye (Warranty / Return tab)."],
 ["V206", 2, true, "Minimum order quantity for an SKU is 10. A customer wants 6. What happens?", "SKU ki minimum order quantity 10 hai. Customer 6 chahta hai. Kya hoga?", "The order goes through", "She can't order fewer than 10 of that SKU", "The admin approves it", "It ships by local driver", "Order ho jaayega", "Woh us SKU ke 10 se kam order nahi kar sakti", "Admin approve karega", "Local driver se jaayega", "B", "Minimum order quantity is the smallest quantity a customer can buy for that SKU.", "Minimum order quantity us SKU ki sabse kam quantity hai jo customer khareed sakta hai."],
 ["V207", 2, true, "Where does the admin accept or reject a vendor's price request?", "Admin vendor ki price request kahan accept ya reject karta hai?", "Orders page", "Vendor Change Requests (from Warehouses & Vendors)", "Shiprocket settings", "Earnings & Settlements", "Orders page", "Vendor Change Requests (Warehouses & Vendors se)", "Shiprocket settings", "Earnings & Settlements", "B", "In the admin panel, Warehouses & Vendors has a change-requests action that opens the Price and Warranty / Return tabs.", "Admin panel mein Warehouses & Vendors ke change-requests action se Price aur Warranty / Return tabs khulte hain."],
 ["V301", 3, true, "Under the agreed process, what must the admin do BEFORE approving a new warehouse?", "Agreed process ke hisaab se, naya warehouse approve karne se PEHLE admin ko kya karna hai?", "Ask the vendor to add SKUs", "Verify the pickup address in Shiprocket", "Upload an e-way bill", "Create a staff login", "Vendor se SKUs add karwana", "Shiprocket mein pickup address verify karna", "E-way bill upload karna", "Staff login banana", "B", "Verify first, approve second. Otherwise the vendor later sees a dispatch error.", "Pehle verify, phir approve. Warna vendor ko baad mein dispatch error dikhta hai."],
 ["V302", 3, true, "Where in Shiprocket are pickup addresses verified?", "Shiprocket mein pickup address kahan verify hote hain?", "Orders > New", "Settings > Company Setup > Pick Up Addresses", "Billing > Wallet", "Channels > Add Channel", "Orders > New", "Settings > Company Setup > Pick Up Addresses", "Billing > Wallet", "Channels > Add Channel", "B", "Settings > Company Setup > Pick Up Addresses, then verify with the OTP sent to the registered phone.", "Settings > Company Setup > Pick Up Addresses, phir registered phone pe aaye OTP se verify."],
 ["V303", 3, true, "A vendor edits the address of an approved warehouse. What is its status after saving?", "Vendor ek approved warehouse ka address edit karta hai. Save ke baad status kya hoga?", "Still approved", "Pending, for the admin to check again", "Deleted", "Paused", "Approved hi rahega", "Pending, admin dobara check karega", "Delete", "Paused", "B", "A new or edited warehouse goes to pending until the admin checks and approves it.", "Naya ya edit kiya hua warehouse admin approval tak pending rehta hai."],
 ["V304", 3, true, "A vendor is doing a stock count and doesn't want orders from one warehouse for two days. Best option?", "Vendor stock count kar raha hai aur do din ek warehouse se orders nahi chahta. Best option?", "Delete the warehouse", "Pause Intake on that warehouse", "Set every SKU price to zero", "Ask the admin to block the vendor", "Warehouse delete karna", "Us warehouse pe Pause Intake", "Har SKU ka price zero karna", "Admin se vendor block karwana", "B", "Pause Intake temporarily hides that warehouse's items from customers. It can be resumed any time.", "Pause Intake us warehouse ke items ko temporarily customers se chhupata hai. Kabhi bhi wapas on ho sakta hai."],
 ["V305", 3, true, "When the admin verifies a pickup address in Shiprocket, where does the OTP go?", "Admin Shiprocket mein pickup address verify kare, toh OTP kahan jaata hai?", "The customer's phone", "The phone number registered for that pickup address", "The admin's email", "No OTP is needed", "Customer ke phone pe", "Us pickup address ke registered phone number pe", "Admin ke email pe", "OTP nahi chahiye", "B", "The OTP goes to the phone number registered for that pickup address, so it must be a real, working number.", "OTP us pickup address ke registered phone number pe jaata hai, isliye woh asli aur chaalu number hona chahiye."],
 ["V306", 3, true, "Which detail on the add-warehouse form decides when pickups can be scheduled?", "Add-warehouse form ki kaunsi detail decide karti hai ki pickup kab schedule ho sakta hai?", "Capacity", "Opening and closing time", "Vehicle types", "Warehouse photos", "Capacity", "Opening aur closing time", "Vehicle types", "Warehouse photos", "B", "Pickups are only scheduled inside the warehouse's opening and closing hours.", "Pickups sirf warehouse ke opening aur closing hours ke andar schedule hote hain."],
 ["V307", 3, true, "A product is in stock and active, but a nearby customer can't see it. The warehouse card shows 'Pending'. Why?", "Product stock mein hai aur active hai, par paas ke customer ko nahi dikh raha. Warehouse card pe 'Pending' hai. Kyun?", "Pending warehouses can't sell until the admin approves them", "The price is too high", "COD is off", "The customer must request it", "Pending warehouse admin approval tak nahi bech sakta", "Price zyada hai", "COD band hai", "Customer ko request karna hoga", "A", "Only approved warehouses can sell. A pending one waits for the admin (who first verifies the pickup in Shiprocket).", "Sirf approved warehouse bech sakta hai. Pending wala admin ka wait karta hai (jo pehle Shiprocket mein pickup verify karta hai)."],
 ["V401", 4, true, "A vendor clicked Dismiss on the new-order alert. What happened to the order?", "Vendor ne new-order alert pe Dismiss dabaya. Order ka kya hua?", "It was cancelled", "It's still waiting in Orders under Awaiting action", "It moved to another vendor at once", "It was auto-accepted", "Cancel ho gaya", "Abhi bhi Orders mein Awaiting action mein hai", "Turant doosre vendor ke paas gaya", "Apne aap accept ho gaya", "B", "Dismiss only silences the alert. To refuse, open the order and click Cancel order.", "Dismiss sirf alert chup karta hai. Mana karne ke liye order kholke Cancel order dabaiye."],
 ["V402", 4, true, "What is the correct order of stages after accepting?", "Accept ke baad stages ka sahi order kya hai?", "Pack, pick, hand over", "Pick, pack, hand over", "Hand over, pick, pack", "Pick, hand over, pack", "Pack, pick, hand over", "Pick, pack, hand over", "Hand over, pick, pack", "Pick, hand over, pack", "B", "Verify & pick, then verify & pack, then hand over to Shiprocket or a local driver.", "Verify & pick, phir verify & pack, phir Shiprocket ya local driver ko hand over."],
 ["V403", 4, true, "A vendor dispatches with their own local driver. What does the customer NOT get?", "Vendor apne local driver se dispatch karta hai. Customer ko kya NAHI milta?", "The goods", "An SMS update (SMS comes from Shiprocket)", "An order ID", "An invoice", "Maal", "SMS update (SMS Shiprocket se aata hai)", "Order ID", "Invoice", "B", "Customer SMS updates are sent by Shiprocket, so a local-driver dispatch sends no SMS. Inform the customer yourself.", "Customer SMS Shiprocket bhejta hai, isliye local-driver dispatch pe SMS nahi jaata. Customer ko khud batayein."],
 ["V404", 4, true, "A vendor sees: “Shiprocket did not assign an AWB with any available courier.” Most likely cause from the session?", "Vendor ko dikhta hai: “Shiprocket did not assign an AWB with any available courier.” Session ke hisaab se sabse likely wajah?", "The customer cancelled", "The warehouse pickup address was not verified in Shiprocket", "The price was rejected", "The vendor is suspended", "Customer ne cancel kiya", "Warehouse ka pickup address Shiprocket mein verified nahi tha", "Price reject hua", "Vendor suspended hai", "B", "In the demo the pickup address was unverified. That's why addresses are now verified before approving warehouses.", "Demo mein pickup address unverified tha. Isliye ab warehouse approve karne se pehle address verify hota hai."],
 ["V405", 4, true, "After Shiprocket assigns a courier, how does the vendor confirm the pickup slot?", "Shiprocket courier assign kare, toh vendor pickup slot kaise confirm karta hai?", "By email to the admin", "In a WhatsApp message on the registered phone", "By calling the customer", "In Tally", "Admin ko email karke", "Registered phone pe WhatsApp message mein", "Customer ko call karke", "Tally mein", "B", "A WhatsApp message with the pickup time slot goes to the vendor's registered phone. The vendor can confirm or change it there.", "Pickup time slot ke saath WhatsApp message vendor ke registered phone pe aata hai. Wahin confirm ya change kar sakte hain."],
 ["V406", 4, true, "With Shiprocket today, roughly how long can courier assignment take?", "Aaj Shiprocket ke saath courier assign hone mein lagbhag kitna time lag sakta hai?", "5 to 10 minutes", "1 to 2 hours", "About 12 to 24 hours", "7 days", "5 se 10 minute", "1 se 2 ghante", "Lagbhag 12 se 24 ghante", "7 din", "C", "Assignment can take about 12 to 24 hours. That's why instant-delivery options like Porter are being explored.", "Assign hone mein lagbhag 12 se 24 ghante lag sakte hain. Isliye Porter jaise instant-delivery options dekhe ja rahe hain."],
 ["V407", 4, true, "Why can't Porter alone solve bulk instant delivery for Oribrix?", "Sirf Porter Oribrix ki bulk instant delivery kyun solve nahi kar sakta?", "It has no API at all", "Its express service is two-wheelers only, in select cities", "It only delivers at night", "It needs an e-way bill for every order", "Uska koi API hi nahi hai", "Uski express service sirf two-wheelers pe, kuch cities mein", "Woh sirf raat mein deliver karta hai", "Har order pe e-way bill chahiye", "B", "Porter's express option is two-wheelers only and city-dependent, so it can't carry bulk loads.", "Porter ka express option sirf two-wheelers aur city pe depend, isliye bulk load nahi le ja sakta."],
 ["V501", 5, true, "Which order needs an e-way bill upload?", "Kis order ke liye e-way bill upload chahiye?", "₹49,999", "₹50,000", "₹25,000 with COD", "Any order over 500 kg", "₹49,999", "₹50,000", "₹25,000 COD ke saath", "500 kg se upar ka koi bhi order", "B", "The rule is ₹50,000 or more, so exactly ₹50,000 qualifies and ₹49,999 does not.", "Rule hai ₹50,000 ya usse zyada, isliye exactly ₹50,000 aata hai aur ₹49,999 nahi."],
 ["V502", 5, true, "After the vendor submits an e-way bill, who approves it, and what can they then do?", "Vendor e-way bill submit kare, toh kaun approve karta hai, aur phir kya kar sakta hai?", "Shiprocket; print a label", "The admin; email it to the customer", "The customer; pay online", "The vendor's staff; edit the GSTIN", "Shiprocket; label print", "Admin; customer ko email", "Customer; online pay", "Vendor ka staff; GSTIN edit", "B", "The admin reviews the PDF, approves or rejects, and can then email it straight to the customer.", "Admin PDF review karke approve ya reject karta hai, aur phir seedha customer ko email kar sakta hai."],
 ["V503", 5, true, "In the e-way bill upload window, why is the order drop-down sometimes empty?", "E-way bill upload window mein order drop-down kabhi kabhi khaali kyun hota hai?", "No accepted order of ₹50,000+ is waiting for a bill", "Shiprocket is down", "The vendor is a staff login", "Tally is not synced", "₹50,000+ ka koi accepted order bill ka wait nahi kar raha", "Shiprocket down hai", "Vendor staff login hai", "Tally sync nahi hai", "A", "Only eligible orders (₹50,000 or more, accepted) appear in the drop-down.", "Drop-down mein sirf eligible orders (₹50,000 ya zyada, accepted) aate hain."],
 ["V504", 5, true, "A return shows 'Refunded'. Where does that status come from?", "Return pe 'Refunded' dikh raha hai. Yeh status kahan se aata hai?", "Shiprocket", "Razorpay, after admin approval", "Tally", "The vendor types it", "Shiprocket", "Razorpay, admin approval ke baad", "Tally", "Vendor khud type karta hai", "B", "Refunded comes from Razorpay after the admin approves. Picked up comes from Shiprocket; Escalated is set by the admin.", "Refunded Razorpay se aata hai admin approval ke baad. Picked up Shiprocket se; Escalated admin set karta hai."],
 ["V505", 5, true, "A settlement shows Gross GMV ₹1,440 and total deductions ₹480. What is the net payout?", "Settlement mein Gross GMV ₹1,440 aur total deductions ₹480 hain. Net payout?", "₹1,920", "₹1,440", "₹960", "₹480", "₹1,920", "₹1,440", "₹960", "₹480", "C", "Net payout = GMV − deductions = 1,440 − 480 = ₹960.", "Net payout = GMV − deductions = 1,440 − 480 = ₹960."],
 ["V506", 5, true, "A vendor wants to match a payout with their bank statement. Which field helps?", "Vendor payout ko bank statement se match karna chahta hai. Kaunsa field kaam aayega?", "AWB", "Bank reference (UTR)", "SKU code", "HSN code", "AWB", "Bank reference (UTR)", "SKU code", "HSN code", "B", "The UTR is the bank reference of the transfer. 'Copy UTR' makes matching easy.", "UTR transfer ka bank reference hai. 'Copy UTR' se match karna aasaan hai."],
 ["V601", 6, true, "A vendor's documents expired; renewal takes 2 weeks. Which admin action fits?", "Vendor ke documents expire ho gaye; renew mein 2 hafte lagenge. Kaunsa admin action sahi hai?", "Delete", "Block", "Suspend", "Do nothing", "Delete", "Block", "Suspend", "Kuch nahi", "C", "Suspend is reversible: read-only, listings hidden, no new orders. Re-approve after renewal.", "Suspend reversible hai: read-only, listings chhupi, naye orders nahi. Renew ke baad re-approve."],
 ["V602", 6, true, "What can a SUSPENDED vendor still do?", "SUSPENDED vendor ab bhi kya kar sakta hai?", "Add SKUs", "Receive new orders", "Log in, view and export data", "Change prices", "SKUs add karna", "Naye orders lena", "Login karke data dekhna aur export karna", "Prices badalna", "C", "Suspended = read-only: login, view and export only.", "Suspended = read-only: sirf login, dekhna aur export."],
 ["V603", 6, true, "What is the difference between Block and Suspend?", "Block aur Suspend mein kya farq hai?", "Block stops login completely; Suspend keeps read-only login", "They are the same", "Suspend deletes data; Block doesn't", "Block hides only prices", "Block login poora rokta hai; Suspend mein read-only login rehta hai", "Dono same hain", "Suspend data delete karta hai; Block nahi", "Block sirf prices chhupata hai", "A", "Block = no login at all. Suspend = read-only access with export.", "Block = login bilkul nahi. Suspend = export ke saath read-only access."],
 ["V604", 6, true, "Who can create staff (sub-admin) logins for a vendor?", "Vendor ke staff (sub-admin) logins kaun bana sakta hai?", "Any staff member", "Only the vendor's main login", "Customers", "Shiprocket", "Koi bhi staff member", "Sirf vendor ka main login", "Customers", "Shiprocket", "B", "Only the main login can create users. Staff cannot create other staff.", "Sirf main login users bana sakta hai. Staff doosre staff nahi bana sakte."],
 ["V605", 6, true, "A staff login must handle orders only at the Gorakhpur warehouse. What should be set?", "Staff login ko sirf Gorakhpur warehouse ke orders sambhalne hain. Kya set karein?", "Order Management + Selected Warehouses: Gorakhpur", "All permissions + All Warehouses", "Inventory only + All Warehouses", "Nothing; staff see everything", "Order Management + Selected Warehouses: Gorakhpur", "Saari permissions + All Warehouses", "Sirf Inventory + All Warehouses", "Kuch nahi; staff sab dekhte hain", "A", "Tick only the needed permission and limit the warehouse scope to the selected warehouse.", "Sirf zaroori permission tick karein aur warehouse scope selected warehouse tak rakhein."],
 ["V606", 6, true, "Which profile field can a vendor edit after KYC approval?", "KYC approval ke baad vendor profile ka kaunsa field edit kar sakta hai?", "Entity name", "GSTIN", "Phone number", "Legal name", "Entity name", "GSTIN", "Phone number", "Legal name", "C", "Name, entity name and GSTIN are locked by KYC. Address, email and phone are editable.", "Name, entity name aur GSTIN KYC se locked hain. Address, email aur phone edit ho sakte hain."]
];

/* WhatsApp Customer Care course */
const WA_QUESTIONS = [
 ["W101", 1, true, "Which number can be connected to the WhatsApp Business API?", "WhatsApp Business API se kaunsa number connect ho sakta hai?", "Any number already on WhatsApp Business app", "A number that is not on any WhatsApp app", "Only a landline", "The owner's personal WhatsApp number", "Koi bhi number jo WhatsApp Business app pe hai", "Aisa number jo kisi bhi WhatsApp app pe nahi hai", "Sirf landline", "Owner ka personal WhatsApp number", "B", "The API number must not be registered on the WhatsApp or WhatsApp Business app; remove WhatsApp first or use a fresh number.", "API number kisi WhatsApp ya WhatsApp Business app pe registered nahi hona chahiye; pehle WhatsApp hataiye ya naya number lijiye."],
 ["W102", 1, true, "Which is NOT required for onboarding?", "Onboarding ke liye inmein se kya zaroori NAHI hai?", "A Facebook page or website", "A Facebook account at least 6 months old", "GST, MSME or similar documents", "10,000 existing WhatsApp followers", "Facebook page ya website", "Kam se kam 6 mahine purana Facebook account", "GST, MSME jaise documents", "10,000 existing WhatsApp followers", "D", "You need a fresh number, a Facebook page or website, a 6-month-old Facebook account and business documents. Followers are not required.", "Fresh number, Facebook page ya website, 6 mahine purana Facebook account aur business documents chahiye. Followers zaroori nahi."],
 ["W103", 1, true, "Roughly what is the daily messaging limit when a new account starts?", "Naye account ki shuruaati daily messaging limit lagbhag kitni hoti hai?", "About 2,000 people a day", "Unlimited", "100 people a day", "1,00,000 people a day", "Lagbhag 2,000 log roz", "Unlimited", "100 log roz", "1,00,000 log roz", "A", "It starts around 2,000 a day and can grow to 10,000 and up to 1,00,000 with good use.", "Shuru mein lagbhag 2,000 roz; achhe use ke saath 10,000 aur 1,00,000 tak badh sakti hai."],
 ["W104", 1, true, "What makes Meta raise the daily limit over time?", "Meta daily limit kis wajah se badhata hai?", "Sending as many messages as possible", "Good campaigns with few blocks and reports", "Paying an extra fee", "Using more agents", "Jitne ho sake utne messages bhejna", "Achhe campaigns jinmein kam blocks aur reports hon", "Extra fee dena", "Zyada agents use karna", "B", "Meta looks at quality. Messages people want, with few blocks or reports, help the limit grow.", "Meta quality dekhta hai. Log jo messages chahte hain aur kam blocks/reports, limit badhate hain."],
 ["W105", 1, true, "What is the WhatsApp link and QR option on the dashboard used for?", "Dashboard pe WhatsApp link aur QR option kis kaam aata hai?", "Paying the wallet", "Letting customers open a chat with you from a link or QR code", "Approving templates", "Adding agents", "Wallet pay karna", "Customers ko link ya QR se aapke saath chat kholne dena", "Templates approve karna", "Agents add karna", "B", "It creates a link or QR code that opens a WhatsApp chat with the business; useful on invoices and posters.", "Yeh link ya QR banata hai jo business ke saath chat kholta hai; invoices aur posters pe kaam aata hai."],
 ["W106", 1, true, "Which use of the API lets up to 15 agents answer customers on one number?", "API ka kaunsa use ek number pe 15 tak agents ko customers ko jawab dene deta hai?", "Marketing", "Live chat and shared inbox", "Authentication", "Website widget", "Marketing", "Live chat aur shared inbox", "Authentication", "Website widget", "B", "Live chat with a shared inbox lets up to 15 agents chat with customers in real time.", "Shared inbox wala live chat 15 tak agents ko real time chat karne deta hai."],
 ["W107", 1, true, "What does BSP mean here?", "Yahan BSP ka matlab kya hai?", "Bulk SMS Package", "Business Solution Provider: the platform company you use", "Basic Support Plan", "Business Sender Profile", "Bulk SMS Package", "Business Solution Provider: woh platform company jise aap use karte hain", "Basic Support Plan", "Business Sender Profile", "B", "A BSP is the company whose platform you use to run the WhatsApp Business API.", "BSP woh company hai jiska platform WhatsApp Business API chalane ke liye use hota hai."],
 ["W108", 1, true, "Where is money for sending messages taken from?", "Messages bhejne ka paisa kahan se katta hai?", "The customer's account", "The platform wallet credit", "The agent's salary", "It is always free", "Customer ke account se", "Platform ke wallet credit se", "Agent ki salary se", "Hamesha free hai", "B", "Messages are paid from the wallet credit; check and recharge it before big campaigns.", "Messages wallet credit se pay hote hain; bade campaign se pehle check aur recharge kijiye."],
 ["W201", 2, true, "Why must the first message to a customer use a template?", "Customer ko pehla message template se kyun bhejna zaroori hai?", "Templates look prettier", "Meta must pre-approve business-initiated messages to stop spam", "Templates are free", "Agents can't type", "Templates sundar dikhte hain", "Spam rokne ke liye Meta business ki taraf se shuru hone wale messages pehle approve karta hai", "Templates free hain", "Agents type nahi kar sakte", "B", "Business-initiated messages need Meta-approved templates. This protects customers and the number.", "Business ki taraf se shuru hone wale messages ke liye Meta-approved template chahiye. Isse customers aur number dono bachte hain."],
 ["W202", 2, true, "'Your refund of ₹1,250 has been processed.' Which category?", "'Aapka ₹1,250 ka refund process ho gaya hai.' Kaunsi category?", "Marketing", "Utility", "Authentication", "Any of them", "Marketing", "Utility", "Authentication", "Koi bhi", "B", "It's an important update the customer expects, so utility.", "Yeh customer ka expected zaroori update hai, isliye utility."],
 ["W203", 2, true, "What happens if a template's category changes in the middle of a campaign?", "Campaign ke beech template ki category badal jaaye toh kya hota hai?", "Nothing", "The campaign stops", "Messages become free", "The template is deleted", "Kuch nahi", "Campaign ruk jaata hai", "Messages free ho jaate hain", "Template delete ho jaata hai", "B", "Campaign safety stops the campaign so messages don't go out under the wrong category.", "Campaign safety campaign rok deti hai taaki galat category mein messages na jaayein."],
 ["W204", 2, true, "What is the maximum length of a template body?", "Template body ki maximum length kitni hai?", "160 characters", "1,024 characters", "5,000 characters", "No limit", "160 characters", "1,024 characters", "5,000 characters", "Koi limit nahi", "B", "The body can be up to 1,024 characters.", "Body 1,024 characters tak ho sakti hai."],
 ["W205", 2, true, "Why do you enter sample values for variables like {{1}}?", "{{1}} jaise variables ke liye sample values kyun daalte hain?", "They are sent to every customer", "So Meta's reviewer understands the message", "To set the price", "They replace the footer", "Woh har customer ko jaati hain", "Taaki Meta ka reviewer message samjhe", "Price set karne ke liye", "Footer ki jagah", "B", "Sample values are examples for Meta's review. Real values are filled per customer at send time.", "Sample values Meta review ke examples hain. Asli values bhejte waqt har customer ke liye bharti hain."],
 ["W206", 2, true, "Who sees the template name, e.g. 'order_dispatched'?", "Template ka naam, jaise 'order_dispatched', kaun dekhta hai?", "Every customer", "Only your team", "Meta only", "Nobody, it's random", "Har customer", "Sirf aapki team", "Sirf Meta", "Koi nahi, random hai", "B", "The name is for internal reference; customers never see it.", "Naam internal reference ke liye hai; customers ise kabhi nahi dekhte."],
 ["W207", 2, true, "Which button type opens a link like 'Track order'?", "Kaunsa button type 'Track order' jaisa link kholta hai?", "Quick reply", "Visit website (URL)", "Call phone", "Footer", "Quick reply", "Visit website (URL)", "Call phone", "Footer", "B", "A URL button opens a website link.", "URL button website link kholta hai."],
 ["W208", 2, true, "A template was rejected. What should you do?", "Template reject ho gaya. Kya karna chahiye?", "Send it anyway", "Read the reason, fix it and submit again", "Change it to authentication", "Wait 30 days", "Phir bhi bhej do", "Reason padhiye, theek kijiye aur dobara submit kijiye", "Authentication mein badal do", "30 din wait", "B", "Fix the cause (category, samples, misleading text) and resubmit.", "Wajah theek kijiye (category, samples, misleading text) aur dobara submit kijiye."],
 ["W301", 3, true, "Which two CSV columns are mandatory for a CSV broadcast?", "CSV broadcast ke liye kaunse do columns zaroori hain?", "Name and phone number", "Email and city", "Order ID and amount", "Phone number and GSTIN", "Name aur phone number", "Email aur city", "Order ID aur amount", "Phone number aur GSTIN", "A", "Name and phone number are mandatory; other columns are optional.", "Name aur phone number zaroori hain; baaki columns optional."],
 ["W302", 3, true, "A CSV cell for {{1}} (name) is empty. What is sent?", "{{1}} (name) ka CSV cell khaali hai. Kya jaayega?", "Nothing; the message fails", "The fallback value you set", "The phone number", "A random name", "Kuch nahi; message fail", "Aapki set ki hui fallback value", "Phone number", "Koi random naam", "B", "The fallback value is used when a cell is empty, so set a sensible one like 'customer'.", "Cell khaali ho toh fallback value jaati hai, isliye 'customer' jaisi samajhdaar value rakhiye."],
 ["W303", 3, true, "Which messages are you charged for?", "Kin messages ka charge lagta hai?", "All rows in the CSV", "Sent and delivered messages, not failed ones", "Only read messages", "Only replies", "CSV ki saari rows", "Sent aur delivered messages, failed nahi", "Sirf read messages", "Sirf replies", "B", "Charges apply to sent/delivered messages; failed ones aren't charged.", "Charge sent/delivered pe lagta hai; failed ka nahi."],
 ["W304", 3, true, "Where should you check the estimated cost before sending?", "Bhejne se pehle estimated cost kahan check karni chahiye?", "After the campaign ends", "On the last screen, next to the wallet balance", "In the chatbot builder", "In Contacts", "Campaign khatam hone ke baad", "Aakhri screen pe, wallet balance ke saath", "Chatbot builder mein", "Contacts mein", "B", "The final step shows estimated cost, balance and per-message price before Send now.", "Aakhri step pe Send now se pehle estimated cost, balance aur per-message price dikhta hai."],
 ["W305", 3, true, "For an API campaign, what name should the campaign have?", "API campaign ka naam kya hona chahiye?", "Any random name", "The same as the template name", "The customer's name", "The API key", "Koi bhi random naam", "Template ke naam jaisa", "Customer ka naam", "API key", "B", "Using the template's name makes each API campaign easy to identify.", "Template jaisa naam rakhne se har API campaign pehchanna aasaan hota hai."],
 ["W306", 3, true, "What must you do to send a new template through the API?", "Naya template API se bhejne ke liye kya karna hoga?", "Nothing", "Create an API campaign for it and Set live", "Print it", "Add it to the chatbot", "Kuch nahi", "Uske liye API campaign banakar Set live karna", "Print karna", "Chatbot mein daalna", "B", "Each new template sent via API must be set live through an API campaign.", "API se bhejne wala har naya template API campaign se set live karna padta hai."],
 ["W307", 3, true, "Why must the API key be kept secret?", "API key secret kyun rakhni chahiye?", "It expires if seen", "Anyone with it can send messages as Oribrix", "It shows the wallet balance", "Meta asks for it daily", "Dekhne se expire ho jaati hai", "Jiske paas hai woh Oribrix banke messages bhej sakta hai", "Wallet balance dikhati hai", "Meta roz maangta hai", "B", "The key authorises sending; a leaked key can be misused and cost money or reputation.", "Key se bhejne ki permission milti hai; leak hone pe misuse ho sakta hai."],
 ["W308", 3, true, "From a campaign's analytics, you want to message only people who did not read it. What do you use?", "Campaign analytics se sirf un logon ko message karna hai jinhone nahi padha. Kya use karein?", "Delete the campaign", "Select that group and re-broadcast a template", "Chatbot", "Opt-out management", "Campaign delete", "Woh group select karke template re-broadcast", "Chatbot", "Opt-out management", "B", "You can select a filtered group in the campaign and re-broadcast a new template to them.", "Campaign mein filtered group select karke naya template re-broadcast kar sakte hain."],
 ["W401", 4, true, "A customer wrote 30 hours ago and got no reply. How can you contact them?", "Customer ne 30 ghante pehle likha aur jawab nahi mila. Ab kaise contact karein?", "Type any reply", "Only with an approved template", "Not at all", "Through the chatbot only", "Koi bhi reply type", "Sirf approved template se", "Bilkul nahi", "Sirf chatbot se", "B", "The 24-hour window has closed, so only an approved template can restart the chat.", "24 ghante ki window band ho gayi, isliye sirf approved template se chat dobara shuru hogi."],
 ["W402", 4, true, "Which role should most customer care staff get?", "Zyada tar customer care staff ko kaunsa role milna chahiye?", "Owner", "Manager", "Agent", "No login, share the owner's", "Owner", "Manager", "Agent", "Login nahi, owner ka share karo", "C", "Agents get live chat and campaigns only. Each person needs their own login.", "Agent ko sirf live chat aur campaigns milte hain. Har insaan ka apna login ho."],
 ["W403", 4, true, "A customer replies 'STOP'. What happens?", "Customer 'STOP' reply karta hai. Kya hota hai?", "Nothing", "They are marked opted out and skipped in future campaigns", "The number is banned", "An agent must call them", "Kuch nahi", "Woh opted out mark hote hain aur aage ke campaigns mein skip hote hain", "Number ban ho jaata hai", "Agent ko call karna padega", "B", "Opt-out management automatically excludes them from future campaigns.", "Opt-out management unhe aage ke campaigns se apne aap hata deta hai."],
 ["W404", 4, true, "Where do chats older than 24 hours go?", "24 ghante se purani chats kahan jaati hain?", "They are deleted", "History", "Wallet", "Templates", "Delete ho jaati hain", "History", "Wallet", "Templates", "B", "They move to History, where you can still filter them by tags and attributes.", "Woh History mein jaati hain, jahan tags aur attributes se filter kar sakte hain."],
 ["W405", 4, true, "How many chatbot flows can you build on this platform?", "Is platform pe kitne chatbot flows bana sakte hain?", "1", "Up to 5", "Up to 50", "Unlimited", "1", "5 tak", "50 tak", "Unlimited", "B", "Up to five flows can be built with the drag-and-drop builder.", "Drag-and-drop builder se 5 tak flows bana sakte hain."],
 ["W406", 4, true, "What should every chatbot flow include?", "Har chatbot flow mein kya hona chahiye?", "Only text", "A 'talk to support' option to reach a person", "A payment link", "The API key", "Sirf text", "Insaan tak pahunchne ke liye 'talk to support' option", "Payment link", "API key", "B", "Customers must never get stuck with the bot; always offer a human option.", "Customer bot ke saath kabhi atakna nahi chahiye; hamesha insaan ka option dijiye."],
 ["W407", 4, true, "What is an away (off-hours) message for?", "Away (off-hours) message kis liye hai?", "Advertising", "Telling customers the team is unavailable and when to expect a reply", "Blocking customers", "Sending OTPs", "Advertising", "Customers ko batana ki team abhi available nahi aur reply kab aayega", "Customers block karna", "OTP bhejna", "B", "It sets expectations outside working hours.", "Yeh working hours ke bahar expectations set karta hai."],
 ["W408", 4, true, "Which is against Oribrix customer care standards?", "Inmein se kya Oribrix customer care standards ke khilaaf hai?", "Tagging every chat", "Replying the same day", "Sharing an OTP in chat to help a customer", "Escalating a refund the same day", "Har chat tag karna", "Usi din reply karna", "Customer ki madad ke liye chat mein OTP share karna", "Refund usi din escalate karna", "C", "Never share OTPs, passwords or the API key.", "OTP, password ya API key kabhi share mat kijiye."]
];
