/* Talks to the Google Apps Script backend. With no API_URL it runs a local test mode. */
(function () {
  const C = window.ACADEMY_CONFIG;
  const TEST = !C.API_URL;
  const LS = "oribrix_academy_test_db";

  function db() { try { return JSON.parse(localStorage.getItem(LS)) || { learners: {}, progress: {}, results: {} }; } catch (e) { return { learners: {}, progress: {}, results: {} }; } }
  function save(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }

  async function call(action, payload) {
    if (TEST) return testCall(action, payload || {});
    const res = await fetch(C.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // simple request: no CORS preflight
      body: JSON.stringify(Object.assign({ action }, payload || {}))
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.error) { const e = new Error(data.error); e.code = data.code; e.data = data; throw e; }
    return data;
  }

  // ---------- local test mode (mirrors the backend rules) ----------
  let sampleQuiz = null;
  async function loadSample() {
    if (!sampleQuiz) sampleQuiz = await (await fetch("data/quiz-sample.json")).json();
    return sampleQuiz;
  }
  function certId() {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
    for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    const d = new Date(); return `ORX-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${s}`;
  }
  async function testCall(action, p) {
    const d = db();
    switch (action) {
      case "register": {
        const ex = d.learners[p.mobile];
        if (!ex) { d.learners[p.mobile] = { name: p.name, at: new Date().toISOString() }; save(d); }
        const L = ex || d.learners[p.mobile]; return { name: L.name, existing: !!ex, startDate: (L.at || "").slice(0, 10) };
      }
      case "status": {
        const l = d.learners[p.mobile];
        return { registered: !!l, name: l && l.name, completed: Object.keys(d.progress[p.mobile] || {}).map(Number), result: d.results[p.mobile] || null };
      }
      case "progress": {
        d.progress[p.mobile] = d.progress[p.mobile] || {}; d.progress[p.mobile][p.module] = p.lang; save(d);
        return { ok: true, completed: Object.keys(d.progress[p.mobile]).map(Number) };
      }
      case "quiz": {
        if (d.results[p.mobile] && d.results[p.mobile].passed) { const e = new Error("already_submitted"); e.code = "already_submitted"; throw e; }
        const q = await loadSample();
        return { questions: q.map(x => ({ id: x.id, module: x.module, q: x["q_" + p.lang] || x.q_en, options: x["options_" + p.lang] || x.options_en })), passPercent: 80 };
      }
      case "submit": {
        if (d.results[p.mobile] && d.results[p.mobile].passed) { const e = new Error("already_submitted"); e.code = "already_submitted"; throw e; }
        const q = await loadSample(); let s = 0;
        const review = q.map(x => { const ok = p.answers[x.id] === x.answer; if (ok) s++; return { id: x.id, chosen: p.answers[x.id] ?? null, correct: x.answer, explanation: x["exp_" + p.lang] || x.exp_en }; });
        const pc = Math.round(100 * s / q.length), ok = pc >= 80;
        const r = { name: d.learners[p.mobile].name, startDate: (d.learners[p.mobile].at || "").slice(0, 10), score: s, total: q.length, percent: pc, passed: ok,
                    certId: ok ? certId() : "", date: new Date().toISOString().slice(0, 10), review };
        d.results[p.mobile] = r; save(d); return r;
      }
      case "verify": {
        const r = Object.values(d.results).find(x => x.certId === p.certId);
        return r ? { valid: true, name: r.name, startDate: r.startDate, date: r.date, percent: r.percent } : { valid: false };
      }
    }
    throw new Error("unknown action");
  }

  window.API = { call, TEST };
})();
