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
 * To let someone retake the quiz, delete their row in "Results".
 */

const TABS = {
  Learners: ["mobile", "name", "registered_at", "last_seen", "lang"],
  Progress: ["mobile", "module", "lang", "watched_percent", "completed_at"],
  Results: ["submitted_at", "mobile", "name", "score", "total", "percent", "passed", "cert_id", "lang", "answers_json", "same_name_other_mobile"],
  Quiz: ["id", "module", "active", "question_en", "question_hi", "A_en", "B_en", "C_en", "D_en", "A_hi", "B_hi", "C_hi", "D_hi", "correct", "explanation_en", "explanation_hi"],
  Settings: ["key", "value", "notes"]
};
const DEFAULT_SETTINGS = [
  ["TOTAL_MODULES", 8, "Number of video modules a learner must complete before the quiz"],
  ["QUESTIONS_PER_MODULE", 2, "Questions picked per module for each learner (random, fixed per learner)"],
  ["PASS_PERCENT", 80, "Minimum score (%) to get a certificate. 0 = certificate for everyone who submits"],
  ["COURSE_NAME", "Oribrix Vendor Onboarding Academy", "Shown on verification"]
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
  const name = String(p.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (name.length < 3) fail("bad_name");
  const ex = learner(mobile);
  if (ex) { sh("Learners").getRange(ex._row, 4).setValue(now()); return { name: ex.name, existing: true, startDate: ymd(ex.registered_at) }; }
  // Mobile column is stored as text so leading digits are kept exactly
  append("Learners", { mobile: "'" + mobile, name: name, registered_at: now(), last_seen: now(), lang: p.lang || "en" });
  return { name: name, existing: false, startDate: ymd(now()) };
}

function status(p) {
  const mobile = cleanMobile(p.mobile), l = learner(mobile);
  return { registered: !!l, name: l ? l.name : null, completed: l ? completed(mobile) : [], result: publicResult(resultOf(mobile)) };
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
  const per = Number(setting("QUESTIONS_PER_MODULE", 2));
  const all = rows("Quiz").filter(q => q.active === true || String(q.active).toUpperCase() === "TRUE");
  const rnd = seeded(mobile + "|oribrix");
  const byMod = {};
  all.forEach(q => (byMod[q.module] = byMod[q.module] || []).push(q));
  let set = [];
  Object.keys(byMod).sort((a, b) => a - b).forEach(m => {
    const list = byMod[m].slice().sort(() => rnd() - 0.5);
    set = set.concat(per > 0 ? list.slice(0, per) : list);
  });
  return set.sort(() => rnd() - 0.5);
}
function checkEligible(mobile) {
  if (!learner(mobile)) fail("not_registered");
  if (resultOf(mobile)) fail("already_submitted");
  const total = Number(setting("TOTAL_MODULES", 8));
  if (completed(mobile).length < total) fail("modules_incomplete");
}
function quiz(p) {
  const mobile = cleanMobile(p.mobile); checkEligible(mobile);
  const lang = p.lang === "hi" ? "hi" : "en";
  const qs = pickQuestions(mobile).map(q => ({
    id: String(q.id), module: Number(q.module),
    q: (lang === "hi" && q.question_hi) ? q.question_hi : q.question_en,
    options: ["A", "B", "C", "D"].map(k => (lang === "hi" && q[k + "_hi"]) ? q[k + "_hi"] : q[k + "_en"]).filter(x => x !== "")
  }));
  return { questions: qs, passPercent: Number(setting("PASS_PERCENT", 80)) };
}

function submit(p) {
  const mobile = cleanMobile(p.mobile); checkEligible(mobile);
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
  if (st.getLastRow() === 1) DEFAULT_SETTINGS.forEach(r => st.appendRow(r));
  const qz = ss.getSheetByName("Quiz");
  if (qz.getLastRow() === 1) SEED_QUESTIONS.forEach(q => qz.appendRow(q));
  ss.getSheetByName("Learners").getRange("A:A").setNumberFormat("@");
  ss.getSheetByName("Progress").getRange("A:A").setNumberFormat("@");
  ss.getSheetByName("Results").getRange("B:B").setNumberFormat("@");
  const def = ss.getSheetByName("Sheet1"); if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  SpreadsheetApp.flush();
  return "Setup complete";
}

/* id, module, active, question_en, question_hi, A_en, B_en, C_en, D_en, A_hi, B_hi, C_hi, D_hi, correct, explanation_en, explanation_hi */
const SEED_QUESTIONS = [
 ["Q101", 1, true, "Who creates products in the Oribrix master catalog?", "Oribrix master catalog mein products kaun banata hai?",
  "Each vendor, for their own shop", "Only the admin (Oribrix team)", "Customers, by request", "Shiprocket",
  "Har vendor, apni shop ke liye", "Sirf admin (Oribrix team)", "Customers, request karke", "Shiprocket",
  "B", "Golden rule: only the admin creates products. Vendors pick from the master catalog and add stock.", "Golden rule: products sirf admin banata hai. Vendor master catalog se chunta hai aur stock add karta hai."],
 ["Q102", 1, true, "What is an SKU on Oribrix?", "Oribrix pe SKU kya hota hai?",
  "A vendor's GST number", "One product, in one warehouse, with a stock quantity", "A delivery partner", "A type of dispute",
  "Vendor ka GST number", "Ek product, ek warehouse mein, stock quantity ke saath", "Ek delivery partner", "Ek type ka dispute",
  "B", "The same cement bag in two warehouses means two SKUs.", "Same cement bag do warehouses mein ho, toh wo do SKUs hain."],
 ["Q103", 1, true, "Which app does the Oribrix team use for approvals and pricing?", "Approvals aur pricing ke liye Oribrix team kaunsa app use karti hai?",
  "Customer app", "Vendor console", "Admin panel", "Shiprocket app",
  "Customer app", "Vendor console", "Admin panel", "Shiprocket app",
  "C", "The admin panel is for approvals, the catalog and pricing. Vendors use the vendor console.", "Admin panel approvals, catalog aur pricing ke liye hai. Vendors vendor console use karte hain."],
 ["Q201", 2, true, "How many steps does the 'Apply to sell' form have?", "'Apply to sell' form mein kitne steps hain?",
  "3", "4", "6", "8", "3", "4", "6", "8",
  "C", "Business, Authorised signatory, Banking, Warehouse, Categories, Documents.", "Business, Authorised signatory, Banking, Warehouse, Categories, Documents."],
 ["Q202", 2, true, "A vendor sees 'A vendor with this GSTIN is already registered'. What does it mean?", "Vendor ko 'A vendor with this GSTIN is already registered' dikhta hai. Iska matlab?",
  "The GSTIN format is wrong", "One GSTIN can be used only once; they may have applied before", "GST is not required", "The server is down",
  "GSTIN ka format galat hai", "Ek GSTIN sirf ek baar use ho sakta hai; shayad pehle apply kiya ho", "GST zaroori nahi hai", "Server down hai",
  "B", "Each GSTIN can register only once. Check the admin panel for an existing application.", "Har GSTIN sirf ek baar register hota hai. Admin panel mein purani application check kijiye."],
 ["Q203", 2, true, "Which of these is a MANDATORY KYC document?", "Inmein se kaunsa KYC document MANDATORY hai?",
  "ISO 9001 certificate", "Trade licence", "Cancelled cheque", "MSME / Udyam",
  "ISO 9001 certificate", "Trade licence", "Cancelled cheque", "MSME / Udyam",
  "C", "Mandatory: GST certificate, business PAN, cancelled cheque, owner Aadhaar. The others are optional.", "Mandatory: GST certificate, business PAN, cancelled cheque, owner Aadhaar. Baaki optional hain."],
 ["Q204", 2, true, "In an IFSC code, the 5th character must be...", "IFSC code ka 5th character hona chahiye...",
  "The letter O", "Zero (0)", "Any digit", "The same as the bank's first letter",
  "Letter O", "Zero (0)", "Koi bhi digit", "Bank ke pehle letter jaisa",
  "B", "IFSC has 11 characters and the 5th is always zero.", "IFSC 11 characters ka hota hai aur 5th hamesha zero hota hai."],
 ["Q301", 3, true, "All documents are approved but the vendor can't log in. What was most likely missed?", "Saare documents approved hain par vendor login nahi kar pa raha. Kya miss hua hoga?",
  "Vendor action: Approved + Update status", "The vendor's password", "A Shiprocket OTP", "Bulk pricing",
  "Vendor action: Approved + Update status", "Vendor ka password", "Shiprocket OTP", "Bulk pricing",
  "A", "Final vendor approval is a separate step. Only then is the login email sent.", "Final vendor approval alag step hai. Tabhi login email jaata hai."],
 ["Q302", 3, true, "What should you always do when you reject a document?", "Document reject karte waqt hamesha kya karna chahiye?",
  "Suspend the vendor", "Add a clear remark saying what to fix", "Delete the application", "Nothing, the vendor will understand",
  "Vendor ko suspend karna", "Saaf remark likhna ki kya theek karna hai", "Application delete karna", "Kuch nahi, vendor samajh jayega",
  "B", "A clear remark tells the vendor exactly what to re-upload.", "Saaf remark se vendor ko pata chalta hai ki kya dobara upload karna hai."],
 ["Q303", 3, true, "On the cancelled cheque, what must you match?", "Cancelled cheque pe kya match karna zaroori hai?",
  "The warehouse address", "Account number and IFSC with the banking step", "The GSTIN", "The product list",
  "Warehouse address", "Account number aur IFSC, banking step se", "GSTIN", "Product list",
  "B", "Matching the cheque protects the vendor's payouts.", "Cheque match karne se vendor ke payouts safe rehte hain."],
 ["Q401", 4, true, "A CSV upload fails because 'unit' is missing. What do you do?", "CSV upload 'unit' missing hone se fail hua. Aap kya karenge?",
  "Ask vendors to add units", "Add the Unit column to every row and re-upload", "Turn off auto-create", "Upload it again unchanged",
  "Vendors ko units add karne bolna", "Har row mein Unit column bharke dobara upload karna", "Auto-create band karna", "Same file dobara upload karna",
  "B", "ProductName, CategoryName, BrandName and Unit are mandatory in every row.", "ProductName, CategoryName, BrandName aur Unit har row mein mandatory hain."],
 ["Q402", 4, true, "A price of Rs 100 is 'inclusive of GST'. What does the customer pay?", "Rs 100 ka price 'inclusive of GST' hai. Customer kitna pay karega?",
  "Rs 100", "Rs 100 + GST", "Rs 90", "It depends on the vendor",
  "Rs 100", "Rs 100 + GST", "Rs 90", "Vendor pe depend karta hai",
  "A", "Inclusive means GST is already inside the price.", "Inclusive ka matlab GST price ke andar hi hai."],
 ["Q403", 4, true, "Bulk pricing in the demo: Rs 100 normally, 10+ units Rs 85, 15+ units Rs 80. Price per unit for 12 units?", "Demo ka bulk pricing: normal Rs 100, 10+ units Rs 85, 15+ units Rs 80. 12 units pe per unit price?",
  "Rs 100", "Rs 85", "Rs 80", "Rs 90", "Rs 100", "Rs 85", "Rs 80", "Rs 90",
  "B", "12 units falls in the 10+ tier.", "12 units 10+ wale tier mein aata hai."],
 ["Q501", 5, true, "A product exists in the catalog but customers can't see it. What's the most likely reason?", "Product catalog mein hai par customers ko nahi dikh raha. Sabse likely reason?",
  "No vendor has added it to an approved warehouse nearby", "The MRP is too high", "It has a long name", "The admin is offline",
  "Kisi vendor ne ise paas ke approved warehouse mein add nahi kiya", "MRP bahut zyada hai", "Naam lamba hai", "Admin offline hai",
  "A", "No seller in an approved warehouse = no listing.", "Approved warehouse mein seller nahi, toh listing nahi."],
 ["Q502", 5, true, "A vendor edits a warehouse's location. What happens?", "Vendor warehouse ki location edit karta hai. Kya hota hai?",
  "Nothing changes", "The warehouse goes back to Pending until admin approves", "All SKUs are deleted", "The vendor is suspended",
  "Kuch nahi badalta", "Admin approval tak warehouse wapas Pending ho jaata hai", "Saare SKUs delete ho jaate hain", "Vendor suspend ho jaata hai",
  "B", "Products in that warehouse are hidden until it's approved again.", "Dobara approve hone tak us warehouse ke products chhupe rehte hain."],
 ["Q503", 5, true, "Can a product with an ongoing order be deleted?", "Kya chalu order wale product ko delete kar sakte hain?",
  "Yes, any time", "No, only after the orders complete; use Inactive meanwhile", "Only by the vendor", "Only on Sundays",
  "Haan, kabhi bhi", "Nahi, orders complete hone ke baad; tab tak Inactive use karein", "Sirf vendor kar sakta hai", "Sirf Sunday ko",
  "B", "Delete is blocked during ongoing orders. Inactive hides the product safely.", "Chalu orders ke dauran delete block rehta hai. Inactive product ko safely chhupata hai."],
 ["Q601", 6, true, "Admin approves Rs 550 for Vendor A. What does Vendor B see for the same product?", "Admin ne Vendor A ke liye Rs 550 approve kiya. Same product ke liye Vendor B ko kya dikhega?",
  "Rs 550", "The catalog price", "Nothing", "Rs 550 minus commission",
  "Rs 550", "Catalog price", "Kuch nahi", "Rs 550 minus commission",
  "B", "Approved prices apply only to the requesting vendor and warehouse.", "Approved price sirf request karne wale vendor aur warehouse pe lagta hai."],
 ["Q602", 6, true, "Two warehouses of the same vendor are in Lucknow. Can they have different prices?", "Ek vendor ke do warehouses Lucknow mein hain. Kya alag prices ho sakte hain?",
  "Yes, always", "No: same city, same price", "Only on weekends", "Only for cement",
  "Haan, hamesha", "Nahi: same city, same price", "Sirf weekends pe", "Sirf cement ke liye",
  "B", "The same-city rule was agreed in the session. Different cities can differ.", "Same-city rule session mein decide hua. Alag cities mein alag ho sakta hai."],
 ["Q603", 6, true, "When a vendor requests a price change, what does the admin see?", "Vendor price change request kare toh admin ko kya dikhta hai?",
  "Only the new price", "Catalog price, current price, requested price and the reason", "The vendor's bank balance", "Nothing until next week",
  "Sirf naya price", "Catalog price, current price, requested price aur reason", "Vendor ka bank balance", "Agle hafte tak kuch nahi",
  "B", "The vendor change requests window shows all of these, with Accept and Reject.", "Vendor change requests window mein ye sab Accept aur Reject ke saath dikhta hai."],
 ["Q701", 7, true, "An order weighs 650 kg. Which Shiprocket service is used?", "Order 650 kg ka hai. Kaunsi Shiprocket service use hogi?",
  "Normal", "Cargo", "Express", "Local driver only", "Normal", "Cargo", "Express", "Sirf local driver",
  "B", "Normal is under 500 kg; Cargo is over 500 kg.", "500 kg se kam Normal; 500 kg se zyada Cargo."],
 ["Q702", 7, true, "What must the admin do before approving a vendor's warehouse?", "Vendor ka warehouse approve karne se pehle admin ko kya karna chahiye?",
  "Verify its pickup address in the Shiprocket portal", "Call the customer", "Delete old SKUs", "Change the vendor's password",
  "Shiprocket portal mein pickup address verify karna", "Customer ko call karna", "Purane SKUs delete karna", "Vendor ka password badalna",
  "A", "A new phone number needs OTP once in Shiprocket.", "Shiprocket mein naye phone number pe ek baar OTP aata hai."],
 ["Q703", 7, true, "What's the limitation of dispatching with a local driver?", "Local driver se dispatch karne ki limitation kya hai?",
  "It costs more", "The customer gets no Shiprocket tracking SMS", "It needs admin approval", "It only works for cement",
  "Mehenga padta hai", "Customer ko Shiprocket tracking SMS nahi milta", "Admin approval chahiye", "Sirf cement ke liye chalta hai",
  "B", "Support must keep the customer updated manually.", "Support ko customer ko manually update rakhna padta hai."],
 ["Q801", 8, true, "A vendor thinks a payout is wrong. What's the right first step?", "Vendor ko lagta hai payout galat hai. Sahi pehla step kya hai?",
  "Stop sending orders", "Raise a dispute with the settlement ID and proof", "Post on social media", "Change bank details",
  "Orders bhejna band karna", "Settlement ID aur proof ke saath dispute raise karna", "Social media pe post karna", "Bank details badalna",
  "B", "Disputes are handled between vendor and admin in Earnings & Settlements.", "Disputes Earnings & Settlements mein vendor aur admin ke beech handle hote hain."],
 ["Q802", 8, true, "In a settlement, 'Deductions' are...", "Settlement mein 'Deductions' hote hain...",
  "GST only", "Logistics + commission", "Customer discounts only", "Bank charges only",
  "Sirf GST", "Logistics + commission", "Sirf customer discounts", "Sirf bank charges",
  "B", "The Earnings page shows deductions as logistics plus commission.", "Earnings page pe deductions logistics plus commission dikhte hain."]
];
