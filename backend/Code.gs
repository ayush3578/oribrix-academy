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
 * To let someone retake the quiz, use "Allow retake" in the admin dashboard (or delete their row in "Results").
 * Admin: the mobiles in ADMIN_MOBILES (Settings) can open the admin dashboard with the ADMIN_PIN (Settings).
 */

const TABS = {
  Learners: ["mobile", "name", "registered_at", "last_seen", "lang"],
  Progress: ["mobile", "module", "lang", "watched_percent", "completed_at"],
  Results: ["submitted_at", "mobile", "name", "score", "total", "percent", "passed", "cert_id", "lang", "answers_json", "same_name_other_mobile"],
  Quiz: ["id", "module", "active", "question_en", "question_hi", "A_en", "B_en", "C_en", "D_en", "A_hi", "B_hi", "C_hi", "D_hi", "correct", "explanation_en", "explanation_hi"],
  Settings: ["key", "value", "notes"],
  Practice: ["at", "mobile", "name", "score", "total", "percent"],
  ResetLog: ["reset_at", "submitted_at", "mobile", "name", "score", "total", "percent", "passed", "cert_id"]
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
    }
    return { error: "unknown_action" };
  } catch (err) {
    return { error: String(err.message || err), code: err.code || "server_error" };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ------------------------------------------------------------------ */
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
function completed(mobile) { return Array.from(new Set(rows("Progress").filter(r => String(r.mobile) === mobile).map(r => Number(r.module)))).sort((a, b) => a - b); }
function resultOf(mobile) { return rows("Results").find(r => String(r.mobile) === mobile); }
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
  const mobile = cleanMobile(p.mobile), l = learner(mobile);
  return { registered: !!l, name: l ? l.name : null, completed: l ? completed(mobile) : [], result: publicResult(resultOf(mobile)), admin: isAdminMobile(mobile) };
}

function progress(p) {
  const mobile = cleanMobile(p.mobile);
  if (!learner(mobile)) fail("not_registered");
  const mod = Number(p.module); const total = Number(setting("TOTAL_MODULES", 8));
  if (!(mod >= 1 && mod <= total)) fail("bad_module");
  if (completed(mobile).indexOf(mod) < 0)
    append("Progress", { mobile: "'" + mobile, module: mod, lang: p.lang || "", watched_percent: Number(p.watched) || "", completed_at: now() });
  return { ok: true, completed: completed(mobile) };
}

/* Deterministic shuffle so a learner always gets the same question set. */
function seeded(seed) { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; }
function pickQuestions(mobile) {
  const per = Number(setting("QUESTIONS_PER_MODULE", 3));
  const all = rows("Quiz").filter(q => q.active === true || String(q.active).toUpperCase() === "TRUE");
  const rnd = seeded(mobile + "|oribrix");
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
function checkEligible(mobile, p) {
  if (!learner(mobile)) fail("not_registered");
  if (resultOf(mobile)) fail("already_submitted");
  if (p && isAdmin(p)) return;                       // admins may skip the videos
  const total = Number(setting("TOTAL_MODULES", 8));
  if (completed(mobile).length < total) fail("modules_incomplete");
}
function quiz(p) {
  const mobile = cleanMobile(p.mobile); checkEligible(mobile, p);
  const lang = p.lang === "hi" ? "hi" : "en";
  const qs = pickQuestions(mobile).map(q => ({
    id: String(q.id), module: Number(q.module),
    q: (lang === "hi" && q.question_hi) ? q.question_hi : q.question_en,
    options: ["A", "B", "C", "D"].map(k => (lang === "hi" && q[k + "_hi"]) ? q[k + "_hi"] : q[k + "_en"]).filter(x => x !== "")
  }));
  return { questions: qs, passPercent: Number(setting("PASS_PERCENT", 80)) };
}

function submit(p) {
  const mobile = cleanMobile(p.mobile); checkEligible(mobile, p);
  const lang = p.lang === "hi" ? "hi" : "en";
  const answers = p.answers || {};
  const qs = pickQuestions(mobile);
  let score = 0;
  const review = qs.map(q => {
    const correct = "ABCD".indexOf(String(q.correct).trim().toUpperCase());
    const chosen = answers[String(q.id)] === undefined ? null : Number(answers[String(q.id)]);
    if (chosen === correct) score++;
    return { id: String(q.id), chosen: chosen, correct: correct, explanation: (lang === "hi" && q.explanation_hi) ? q.explanation_hi : q.explanation_en };
  });
  const total = qs.length, percent = total ? Math.round(100 * score / total) : 0;
  const passed = percent >= Number(setting("PASS_PERCENT", 80));
  const l = learner(mobile);
  const certId = passed ? newCertId() : "";
  const dup = rows("Results").some(r => String(r.name).toLowerCase() === String(l.name).toLowerCase() && String(r.mobile) !== mobile);
  append("Results", { submitted_at: now(), mobile: "'" + mobile, name: l.name, score: score, total: total, percent: percent, passed: passed,
                      cert_id: certId, lang: lang, answers_json: JSON.stringify(answers), same_name_other_mobile: dup ? "CHECK" : "" });
  return { name: l.name, startDate: ymd(l.registered_at), score: score, total: total, percent: percent, passed: passed, certId: certId,
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
  return { valid: true, name: pr.name, startDate: pr.startDate, date: pr.date, percent: pr.percent, course: setting("COURSE_NAME", "Oribrix Vendor Onboarding Academy") };
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
  const st = ss.getSheetByName("Settings");
  const have = st.getDataRange().getValues().map(r => r[0]);
  DEFAULT_SETTINGS.forEach(r => { if (have.indexOf(r[0]) < 0) st.appendRow(r); });
  const pinRow = st.getDataRange().getValues().findIndex(r => r[0] === "ADMIN_PIN");
  if (pinRow >= 0 && !String(st.getDataRange().getValues()[pinRow][1]).trim())
    st.getRange(pinRow + 1, 2).setValue("'" + String(100000 + Math.floor(Math.random() * 900000)));
  const qz = ss.getSheetByName("Quiz");
  if (qz.getLastRow() === 1) SEED_QUESTIONS.forEach(q => qz.appendRow(q));
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
function isAdmin(p) {
  let mobile; try { mobile = cleanMobile(p.mobile); } catch (e) { return false; }
  const pin = String(setting("ADMIN_PIN", "")).replace(/^'/, "").trim();
  return isAdminMobile(mobile) && pin.length >= 4 && String(p.pin || "").trim() === pin;
}
function needAdmin(p) { if (!isAdmin(p)) fail("not_admin"); }
function adminCheck(p) { needAdmin(p); return { ok: true }; }

function practice(p) {
  const mobile = cleanMobile(p.mobile), l = learner(mobile);
  if (!l) fail("not_registered");
  const total = Math.max(1, Math.min(100, Number(p.total) || 0)), score = Math.max(0, Math.min(total, Number(p.score) || 0));
  append("Practice", { at: now(), mobile: "'" + mobile, name: l.name, score: score, total: total, percent: Math.round(100 * score / total) });
  return { ok: true };
}

function adminData(p) {
  needAdmin(p);
  const tz = "Asia/Kolkata", f = d => { try { return d ? Utilities.formatDate(new Date(d), tz, "yyyy-MM-dd HH:mm") : ""; } catch (e) { return ""; } };
  const total = Number(setting("TOTAL_MODULES", 8));
  const prog = {}; rows("Progress").forEach(r => { const m = String(r.mobile); (prog[m] = prog[m] || {})[Number(r.module)] = f(r.completed_at); });
  const res = {}; rows("Results").forEach(r => { res[String(r.mobile)] = r; });
  const pr = {}; rows("Practice").forEach(r => {
    const m = String(r.mobile), x = pr[m] = pr[m] || { attempts: 0, best: 0, last: null, lastAt: "" };
    x.attempts++; x.best = Math.max(x.best, Number(r.percent) || 0); x.last = Number(r.percent) || 0; x.lastAt = f(r.at);
  });
  const learners = rows("Learners").map(l => {
    const m = String(l.mobile), r = res[m], done = prog[m] || {};
    return { mobile: m, name: l.name, registered: f(l.registered_at), lastSeen: f(l.last_seen), lang: l.lang,
      modules: Object.keys(done).map(Number).sort((a, b) => a - b), moduleDates: done,
      result: r ? { score: Number(r.score), total: Number(r.total), percent: Number(r.percent), passed: r.passed === true || r.passed === "TRUE",
                    certId: r.cert_id, at: f(r.submitted_at), lang: r.lang, flag: r.same_name_other_mobile } : null,
      practice: pr[m] || null, admin: isAdminMobile(m) };
  });
  // question statistics from submitted answers
  const key = {}, qs = {};
  rows("Quiz").forEach(q => { key[String(q.id)] = "ABCD".indexOf(String(q.correct).trim().toUpperCase()); qs[String(q.id)] = { id: String(q.id), module: Number(q.module), q: q.question_en, asked: 0, wrong: 0 }; });
  rows("Results").forEach(r => {
    let a = {}; try { a = JSON.parse(r.answers_json || "{}"); } catch (e) {}
    Object.keys(a).forEach(id => { if (qs[id]) { qs[id].asked++; if (Number(a[id]) !== key[id]) qs[id].wrong++; } });
  });
  return { learners: learners, totalModules: total, passPercent: Number(setting("PASS_PERCENT", 80)),
           questions: Object.keys(qs).map(k => qs[k]).filter(q => q.asked > 0).sort((a, b) => b.wrong / b.asked - a.wrong / a.asked) };
}

function adminReset(p) {
  needAdmin(p);
  const target = cleanMobile(p.target), r = resultOf(target);
  if (!r) fail("no_result");
  append("ResetLog", { reset_at: now(), submitted_at: r.submitted_at, mobile: "'" + target, name: r.name, score: r.score, total: r.total,
                       percent: r.percent, passed: r.passed, cert_id: r.cert_id });
  sh("Results").deleteRow(r._row);
  return { ok: true };
}

/* Run ONCE after pasting a new version of this file: replaces the Quiz tab with the
   question bank below and updates the quiz settings. Learner data is not touched. */
function updateQuiz() {
  setup();
  const qz = sh("Quiz");
  if (qz.getLastRow() > 1) qz.getRange(2, 1, qz.getLastRow() - 1, qz.getLastColumn()).clearContent();
  qz.getRange(2, 1, SEED_QUESTIONS.length, TABS.Quiz.length).setValues(SEED_QUESTIONS);
  const st = sh("Settings"), vals = st.getDataRange().getValues();
  DEFAULT_SETTINGS.filter(d => ["QUESTIONS_PER_MODULE", "TOTAL_QUESTIONS"].indexOf(d[0]) >= 0).forEach(d => {
    const i = vals.findIndex(r => r[0] === d[0]);
    if (i >= 0) st.getRange(i + 1, 2).setValue(d[1]); else st.appendRow(d);
  });
  SpreadsheetApp.flush();
  return "Quiz updated: " + SEED_QUESTIONS.length + " questions in the bank. Admin PIN: " + setting("ADMIN_PIN", "");
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
 ["Q405", 4, true, "Why must 'unit weight per quantity' be filled correctly?", "'Unit weight per quantity' sahi bharna kyun zaroori hai?", "It decides the commission", "Wrong weight sends orders by the wrong delivery mode", "It changes the GST rate", "Customers can't search without it", "Isse commission decide hota hai", "Galat weight se order galat delivery mode se jaata hai", "Isse GST rate badalta hai", "Iske bina customer search nahi kar sakta", "B", "Weight decides how an order ships, for example Normal below 500 kg and Cargo above. Missing weight is a common catalog mistake.", "Weight decide karta hai order kaise ship hoga, jaise 500 kg se kam Normal aur upar Cargo. Weight na bharna common catalog mistake hai."],
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
 ["Q802", 8, true, "Which dispute is most likely to be resolved quickly?", "Kaunsa dispute sabse jaldi resolve hoga?", "'STL-1042: expected Rs 8,800, received Rs 8,000. Invoice attached.'", "'My payment is wrong, please check.'", "'Call me urgently about money.'", "'Last month's payouts are all wrong.'", "'STL-1042: Rs 8,800 aana tha, Rs 8,000 aaya. Invoice attached.'", "'Mera payment galat hai, check karo.'", "'Paise ke baare mein urgent call karo.'", "'Pichhle mahine ke saare payouts galat hain.'", "A", "A good dispute has the exact settlement or order ID, what's wrong, expected vs received, and proof attached.", "Achhe dispute mein exact settlement ya order ID, kya galat hai, expected vs received, aur proof attached hota hai."],
 ["Q803", 8, true, "A vendor's accountant needs settlement data for their books. What helps?", "Vendor ke accountant ko books ke liye settlement data chahiye. Kya kaam aayega?", "Screenshots of the dashboard", "A dispute for every settlement", "Asking Shiprocket for a report", "Export Tally XML or CSV from Earnings & Settlements", "Dashboard ke screenshots", "Har settlement ke liye dispute", "Shiprocket se report maangna", "Earnings & Settlements se Tally XML ya CSV export", "D", "The settlements table has Tally XML and CSV export buttons for the vendor's accountant.", "Settlements table mein vendor ke accountant ke liye Tally XML aur CSV export buttons hain."],
 ["Q804", 8, true, "On the 'ready to sell' checklist, which item is optional?", "'Ready to sell' checklist mein kaunsa item optional hai?", "Final vendor approval done", "Warehouse verified in Shiprocket", "Local drivers added as a backup", "SKUs added with real stock", "Final vendor approval hona", "Shiprocket mein warehouse verify hona", "Backup ke liye local drivers add karna", "Real stock ke saath SKUs add hona", "C", "Local drivers are a recommended backup but optional. The rest are required before a vendor can sell.", "Local drivers recommended backup hain par optional. Baaki sab sell karne se pehle zaroori hain."],
 ["Q805", 8, true, "Today, when two vendors near a customer sell the same product, what does the customer app show?", "Aaj, agar customer ke paas do vendors same product bechte hain, toh customer app kya dikhata hai?", "Both vendors' prices side by side", "The nearest vendor's product, with one price per card", "The lowest price from any vendor in UP", "The catalog price only", "Dono vendors ke prices saath mein", "Sabse paas wale vendor ka product, ek card pe ek price", "UP ke kisi bhi vendor ka sabse kam price", "Sirf catalog price", "B", "Today the app shows the nearest vendor's product and price. Showing several vendors' prices is still under discussion.", "Aaj app sabse paas wale vendor ka product aur price dikhata hai. Kai vendors ke prices dikhana abhi discussion mein hai."]
];
