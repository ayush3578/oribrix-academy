/* Oribrix Vendor Onboarding Academy - single page app (no build step). */
(function () {
  const C = window.ACADEMY_CONFIG, API = window.API;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const LS = "oribrix_academy_v1";
  let COURSE = null;

  // ---------------- state ----------------
  const S = load();
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function persist() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
  S.lang = S.lang || C.DEFAULT_LANG;
  S.prog = S.prog || {};        // prog[mobile][lang][module] = {max, ranges:[[a,b],...]}
  S.done = S.done || {};        // done[mobile] = [module numbers]

  const t = (k, vars) => {
    let s = (window.I18N[S.lang] || window.I18N.en)[k] || window.I18N.en[k] || k;
    if (vars) for (const v in vars) s = s.split("{" + v + "}").join(vars[v]);
    return s;
  };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = sec => { sec = Math.max(0, Math.floor(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + String(s).padStart(2, "0"); };
  function toast(msg, ms = 2600) {
    let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), ms);
  }
  function me() { return S.user || null; }
  function doneSet() { return new Set((S.done[me()?.mobile] || []).map(Number)); }
  function progOf(n, lang = S.lang) { return ((S.prog[me()?.mobile] || {})[lang] || {})[n] || { max: 0, ranges: [] }; }
  function setProg(n, p, lang = S.lang) {
    const m = me().mobile; S.prog[m] = S.prog[m] || {}; S.prog[m][lang] = S.prog[m][lang] || {}; S.prog[m][lang][n] = p; persist();
  }
  function covered(ranges) { return ranges.reduce((a, r) => a + Math.max(0, r[1] - r[0]), 0); }
  function addRange(ranges, a, b) {
    ranges.push([a, b]); ranges.sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const r of ranges) { if (out.length && r[0] <= out[out.length - 1][1] + 0.6) out[out.length - 1][1] = Math.max(out[out.length - 1][1], r[1]); else out.push([r[0], r[1]]); }
    return out;
  }
  function modDuration(m, lang = S.lang) { return (m.duration && m.duration[lang]) || 600; }
  function pct(m, lang = S.lang) { const p = progOf(m.n, lang); return Math.min(100, Math.round(100 * covered(p.ranges) / modDuration(m, lang))); }
  function unlocked(m) { if (!C.SEQUENTIAL || m.n === 1) return true; return doneSet().has(m.n - 1) || doneSet().has(m.n); }
  function allDone() { const d = doneSet(); return COURSE.modules.every(m => d.has(m.n)); }

  // ---------------- layout ----------------
  function header() {
    const u = me();
    return `<header class="top"><div class="wrap row">
      <a class="brand" href="#" data-go="home"><img src="assets/img/mark_white.png" alt=""><span>oribrix</span><em>Academy</em></a>
      <div class="sp"></div>
      <div class="lang" role="group" aria-label="Language">
        <button class="${S.lang === "en" ? "on" : ""}" data-lang="en">English</button>
        <button class="${S.lang === "hi" ? "on" : ""}" data-lang="hi">Hinglish</button>
      </div>
      ${u ? `<div class="who"><span>${esc(u.name)}</span><button class="link" data-act="logout">${t("not_you")}</button></div>` : ""}
    </div></header>${API.TEST ? `<div class="testbar">${t("test_mode")}</div>` : ""}`;
  }
  function footer() { return `<footer class="foot"><div class="wrap"><img src="assets/img/mark_blue.png" alt=""> ${esc(C.ORG_NAME)} · ${t("footer")}</div></footer>`; }
  function render(html) { app.innerHTML = header() + `<main>${html}</main>` + footer(); window.scrollTo(0, 0); }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-lang],[data-go],[data-act]"); if (!el) return;
    if (el.dataset.lang) { e.preventDefault(); if (S.lang !== el.dataset.lang) { S.lang = el.dataset.lang; persist(); route(); } }
    else if (el.dataset.go) { e.preventDefault(); go(el.dataset.go); }
    else if (el.dataset.act === "logout") { e.preventDefault(); delete S.user; persist(); go("home"); }
  });

  // ---------------- routing (hash) ----------------
  function go(r) { if (location.hash === "#" + r) route(); else location.hash = r; }
  window.addEventListener("hashchange", route);
  function route() {
    stopPlayer();
    const qs = new URLSearchParams(location.search);
    if (qs.get("verify")) return viewVerify(qs.get("verify"));
    const h = location.hash.replace("#", "");
    if (!me()) return viewRegister();
    if (h.startsWith("module-")) return viewPlayer(parseInt(h.split("-")[1], 10));
    if (h === "quiz") return viewQuiz();
    if (h === "certificate") return viewCertificate();
    return viewHome();
  }

  // ---------------- register ----------------
  function viewRegister() {
    const total = COURSE.modules.reduce((a, m) => a + modDuration(m), 0);
    render(`<section class="hero"><div class="wrap hero-in">
      <div class="hero-txt">
        <img class="hero-mark" src="assets/img/mark_white.png" alt="">
        <h1>${esc(C.COURSE_NAME)}</h1><p>${t("tagline")}</p>
        <div class="stats">
          <div><b>${COURSE.modules.length}</b><span>${t("stat_modules")}</span></div>
          <div><b>~${Math.round(total / 60)}</b><span>${t("stat_minutes")}</span></div>
          <div><b>1</b><span>${t("stat_quiz")}</span></div>
          <div><b>1</b><span>${t("stat_cert")}</span></div>
        </div>
      </div>
      <form class="card reg" id="reg" novalidate>
        <h2>${t("reg_title")}</h2>
        <label>${t("reg_name")}<input id="r_name" autocomplete="name" maxlength="60" required></label>
        <label>${t("reg_mobile")}<div class="tel"><span>+91</span><input id="r_mob" inputmode="numeric" autocomplete="tel-national" maxlength="10" required></div></label>
        <label>${t("reg_lang")}<div class="seg"><button type="button" data-l="en" class="${S.lang === "en" ? "on" : ""}">English</button><button type="button" data-l="hi" class="${S.lang === "hi" ? "on" : ""}">Hinglish</button></div></label>
        <p class="err" id="r_err"></p>
        <button class="btn big" id="r_btn">${t("reg_btn")}</button>
        <p class="note">${t("reg_note")}</p>
      </form></div></section>
      <section class="wrap mods-preview">${COURSE.modules.map(m => `<div class="mp"><span>${m.n}</span>${esc(m.title[S.lang] || m.title.en)}</div>`).join("")}</section>`);
    $("#reg").querySelectorAll(".seg button").forEach(b => b.onclick = () => { S.lang = b.dataset.l; persist(); route(); });
    $("#reg").onsubmit = async e => {
      e.preventDefault();
      const name = $("#r_name").value.replace(/\s+/g, " ").trim(), mobile = $("#r_mob").value.replace(/\D/g, "");
      const err = $("#r_err"); err.textContent = "";
      if (name.length < 3 || !/[a-zA-Zऀ-ॿ]/.test(name)) return err.textContent = t("reg_err_name");
      if (!/^[6-9]\d{9}$/.test(mobile)) return err.textContent = t("reg_err_mobile");
      const btn = $("#r_btn"); btn.disabled = true; btn.textContent = t("loading");
      try {
        const r = await API.call("register", { name, mobile, lang: S.lang });
        S.user = { name: r.name, mobile }; persist();
        await sync();
        if (r.name.toLowerCase() !== name.toLowerCase()) toast(t("reg_locked", { name: r.name }), 6000);
        go("home");
      } catch (x) { err.textContent = t("net_err"); btn.disabled = false; btn.textContent = t("reg_btn"); }
    };
  }

  async function sync() {
    try {
      const s = await API.call("status", { mobile: me().mobile });
      if (s.name) S.user.name = s.name;
      const set = new Set([...(S.done[me().mobile] || []), ...(s.completed || [])].map(Number));
      S.done[me().mobile] = [...set].sort((a, b) => a - b);
      S.result = S.result || {}; if (s.result) S.result[me().mobile] = s.result;
      persist(); return s;
    } catch (e) { return null; }
  }

  // ---------------- home ----------------
  function viewHome() {
    const d = doneSet(), n = COURSE.modules.length, res = (S.result || {})[me().mobile];
    const cards = COURSE.modules.map(m => {
      const isDone = d.has(m.n), open = unlocked(m), p = pct(m);
      const status = isDone ? `<span class="pill ok">${t("status_done")}</span>` : !open ? `<span class="pill">${t("status_locked")}</span>` :
        p > 0 ? `<span class="pill on">${t("status_progress", { p })}</span>` : `<span class="pill">${t("status_new")}</span>`;
      const btn = !open ? `<span class="hint">${t("locked_hint")}</span>` :
        `<a class="btn ${isDone ? "ghost" : ""}" href="#module-${m.n}">${isDone ? t("rewatch") : p > 0 ? t("continue_btn") : t("watch")}</a>`;
      return `<article class="mod card ${open ? "" : "locked"} ${isDone ? "done" : ""}">
        <div class="num">${isDone ? "&#10003;" : m.n}</div>
        <div class="mbody"><div class="mtop">${status}<span class="dur">${Math.round(modDuration(m) / 60)} ${t("min")}</span></div>
          <h3>${t("module")} ${m.n}: ${esc(m.title[S.lang] || m.title.en)}</h3><p>${esc(m.desc[S.lang] || m.desc.en)}</p>
          <div class="bar"><i style="width:${isDone ? 100 : p}%"></i></div>${btn}</div></article>`;
    }).join("");
    const quiz = res ? `<a class="btn" href="#certificate">${t("cert_view")}</a>` :
      allDone() ? `<a class="btn" href="#quiz">${t("quiz_start")}</a><p class="hint">${t("quiz_ready")}</p>` : `<p class="hint">${t("quiz_locked")}</p>`;
    render(`<section class="wrap dash">
      <div class="dhead"><div><h1>${t("hello", { name: esc(me().name) })}</h1><p>${t("progress", { done: d.size, total: n })}</p></div>
        <div class="ring" style="--p:${Math.round(100 * d.size / n)}"><span>${Math.round(100 * d.size / n)}%</span></div></div>
      <div class="mods">${cards}</div>
      <article class="card quizcard ${allDone() || res ? "" : "locked"}"><div class="num q">?</div><div class="mbody">
        <h3>${res ? t("quiz_done") : t("quiz_title")}</h3>${quiz}</div></article>
    </section>`);
  }

  // ---------------- player ----------------
  let P = null;
  function stopPlayer() {
    if (P) { try { P.save(); P.video.pause(); } catch (e) {} document.removeEventListener("visibilitychange", P.onVis); document.removeEventListener("keydown", P.onKey); P = null; }
  }
  function viewPlayer(n) {
    const m = COURSE.modules.find(x => x.n === n);
    if (!m || !unlocked(m)) return go("home");
    const lang = S.lang, src = m.video[lang], vtt = m.subtitles[lang];
    const next = COURSE.modules.find(x => x.n === n + 1);
    const chapters = (m.chapters && m.chapters[lang]) || [];
    render(`<section class="wrap player-page">
      <a class="back" href="#" data-go="home">&larr; ${t("back")}</a>
      <h1>${t("module")} ${m.n}: ${esc(m.title[lang] || m.title.en)}</h1>
      <div class="player" id="pl">
        <video id="vid" playsinline preload="metadata" disablepictureinpicture disableremoteplayback controlslist="nodownload noplaybackrate" crossorigin="anonymous">
          <source src="${esc(src)}" type="video/mp4">
          <track kind="subtitles" srclang="${lang === "hi" ? "hi-Latn" : "en"}" label="${lang === "hi" ? "Hinglish" : "English"}" src="${esc(vtt)}" default>
        </video>
        <div class="subs" id="subs" aria-live="off"></div>
        <button class="bigplay" id="bigplay" aria-label="Play">&#9654;</button>
        <div class="ctrl">
          <button id="pp" aria-label="Play/Pause">&#9654;</button>
          <span class="time" id="tm">0:00 / 0:00</span>
          <div class="seek" id="seek"><div class="watched" id="sw"></div><div class="played" id="sp"></div><div class="knob" id="sk"></div></div>
          <button id="cc" aria-label="${t("subtitles")}">CC</button>
          <button id="mute" aria-label="Mute">&#128266;</button>
          <button id="fs" aria-label="Fullscreen">&#x26F6;</button>
        </div>
      </div>
      <div class="pbar">
        <div class="speeds"><span>${t("speed")}</span>${C.SPEEDS.map(s => `<button data-speed="${s}" class="${s === 1 ? "on" : ""}">${s}x</button>`).join("")}</div>
        <div class="wstat"><span>${t("watched_label")}</span><b id="wp">0%</b></div>
      </div>
      <p class="hint">${t("no_skip")} ${t("lang_switch_note")}</p>
      ${chapters.length ? `<div class="card chapters"><h3>${t("chapters")}</h3><ol id="chap">${chapters.map(c => `<li data-t="${c.t}"><span>${fmt(c.t)}</span>${esc(c.title)}</li>`).join("")}</ol></div>` : ""}
      <div class="after" id="after" hidden>
        <p class="okmsg">${t("complete_msg")}</p>
        ${next ? `<a class="btn" href="#module-${next.n}">${t("next_module")}: ${esc(next.title[lang] || next.title.en)} &rarr;</a>` :
                 `<a class="btn" href="#quiz">${t("quiz_start")} &rarr;</a>`}
      </div>
    </section>`);

    const v = $("#vid"), pl = $("#pl");
    const st = progOf(n, lang); let max = st.max || 0, ranges = st.ranges || [], last = null, dur = modDuration(m, lang), completed = doneSet().has(n);
    const track = v.textTracks && v.textTracks[0];
    let ccOn = S.cc !== false;
    const subs = $("#subs");
    function showCue() {
      const c = track && track.activeCues && track.activeCues[0];
      subs.textContent = ccOn && c ? c.text : ""; subs.hidden = !subs.textContent;
    }
    if (track) { track.mode = "hidden"; track.addEventListener("cuechange", showCue); }
    $("#cc").classList.toggle("on", ccOn);
    v.addEventListener("loadedmetadata", () => { dur = v.duration || dur; if (max > 2 && max < dur - 2) v.currentTime = max; paint(); });

    function cov() { return covered(ranges) / (dur || 1); }
    function paint() {
      const c = v.currentTime || 0;
      $("#tm").textContent = fmt(c) + " / " + fmt(dur);
      $("#sw").style.width = (100 * max / dur) + "%";
      $("#sp").style.width = (100 * c / dur) + "%"; $("#sk").style.left = (100 * c / dur) + "%";
      $("#wp").textContent = Math.min(100, Math.floor(100 * cov())) + "%";
      $("#pp").innerHTML = v.paused ? "&#9654;" : "&#10074;&#10074;"; $("#bigplay").hidden = !v.paused;
      document.querySelectorAll("#chap li").forEach(li => li.classList.toggle("off", +li.dataset.t > max + 1));
    }
    function save() { setProg(n, { max, ranges }, lang); }
    async function complete() {
      if (completed) return; completed = true;
      const mob = me().mobile; const set = new Set(S.done[mob] || []); set.add(n); S.done[mob] = [...set].sort((a, b) => a - b); persist();
      $("#after").hidden = false; toast(t("complete_msg"));
      try { await API.call("progress", { mobile: mob, module: n, lang, watched: Math.round(cov() * 100) }); } catch (e) {}
    }
    v.addEventListener("timeupdate", () => {
      const c = v.currentTime;
      if (!v.seeking && !v.paused && last !== null) {
        const dt = c - last;
        if (dt > 0 && dt <= 1.5 * v.playbackRate + 1) { ranges = addRange(ranges, last, c); if (c > max) max = c; }
      }
      last = c; paint();
      if (Math.floor(c) % 5 === 0) save();
    });
    v.addEventListener("seeking", () => {
      if (v.currentTime > max + 1) { v.currentTime = max; toast(t("no_skip")); }
      last = null;
    });
    v.addEventListener("seeked", () => { last = v.currentTime; });
    v.addEventListener("play", () => { last = v.currentTime; paint(); });
    v.addEventListener("pause", () => { save(); paint(); });
    v.addEventListener("ended", () => {
      if (last !== null && dur - last <= 1.5 * v.playbackRate + 1) { ranges = addRange(ranges, last, dur); max = dur; }
      save(); paint(); if (cov() >= C.COMPLETE_THRESHOLD) complete(); else toast(t("no_skip"), 4000); });
    v.addEventListener("ratechange", () => { last = v.currentTime; });
    if (completed) $("#after").hidden = false;

    const toggle = () => { v.paused ? v.play() : v.pause(); };
    $("#pp").onclick = toggle; $("#bigplay").onclick = toggle; v.onclick = toggle;
    $("#seek").onclick = e => {
      const r = e.currentTarget.getBoundingClientRect(); const target = dur * (e.clientX - r.left) / r.width;
      if (target > max + 1) { toast(t("no_skip")); v.currentTime = max; } else v.currentTime = target;
    };
    document.querySelectorAll("#chap li").forEach(li => li.onclick = () => { const x = +li.dataset.t; if (x > max + 1) toast(t("no_skip")); else { v.currentTime = x; v.play(); } });
    document.querySelectorAll("[data-speed]").forEach(b => b.onclick = () => {
      v.playbackRate = +b.dataset.speed; document.querySelectorAll("[data-speed]").forEach(x => x.classList.toggle("on", x === b));
    });
    $("#cc").onclick = e => { ccOn = !ccOn; S.cc = ccOn; persist(); e.currentTarget.classList.toggle("on", ccOn); showCue(); };
    $("#mute").onclick = e => { v.muted = !v.muted; e.currentTarget.innerHTML = v.muted ? "&#128263;" : "&#128266;"; };
    $("#fs").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else (pl.requestFullscreen || pl.webkitRequestFullscreen || (() => {})).call(pl); };
    const onVis = () => { if (document.hidden && !v.paused) { v.pause(); P && (P.pausedByTab = true); } else if (!document.hidden && P && P.pausedByTab) { P.pausedByTab = false; toast(t("tab_paused")); } };
    const onKey = e => { if (e.target.tagName === "INPUT") return; if (e.code === "Space") { e.preventDefault(); toggle(); } if (e.code === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 10); };
    document.addEventListener("visibilitychange", onVis); document.addEventListener("keydown", onKey);
    P = { video: v, save, onVis, onKey };
    paint();
  }

  // ---------------- quiz ----------------
  async function viewQuiz() {
    if ((S.result || {})[me().mobile]) return go("certificate");
    if (!allDone()) return go("home");
    render(`<section class="wrap narrow"><p class="hint">${t("loading")}</p></section>`);
    let data;
    try { data = await API.call("quiz", { mobile: me().mobile, lang: S.lang }); }
    catch (e) {
      if (e.code === "already_submitted") { await sync(); return go("certificate"); }
      if (e.code === "modules_incomplete") { await sync(); return go("home"); }
      return render(`<section class="wrap narrow"><p class="err">${t("net_err")}</p></section>`);
    }
    const Q = data.questions, ans = {}; let i = 0;
    function draw() {
      const q = Q[i];
      render(`<section class="wrap narrow quiz">
        <div class="qtop"><span>${t("q_of", { i: i + 1, n: Q.length })}</span><div class="bar"><i style="width:${100 * (i + 1) / Q.length}%"></i></div></div>
        <div class="card qcard"><span class="pill on">${t("module")} ${q.module}</span><h2>${esc(q.q)}</h2>
          <div class="opts">${q.options.map((o, k) => `<button class="opt ${ans[q.id] === k ? "on" : ""}" data-k="${k}"><b>${"ABCD"[k]}</b>${esc(o)}</button>`).join("")}</div></div>
        <div class="qnav"><button class="btn ghost" id="qp" ${i === 0 ? "disabled" : ""}>${t("prev")}</button>
          ${i < Q.length - 1 ? `<button class="btn" id="qn" ${ans[q.id] === undefined ? "disabled" : ""}>${t("next")}</button>` : `<button class="btn" id="qs" ${ans[q.id] === undefined ? "disabled" : ""}>${t("submit")}</button>`}</div>
      </section>`);
      document.querySelectorAll(".opt").forEach(b => b.onclick = () => { ans[q.id] = +b.dataset.k; draw(); });
      $("#qp").onclick = () => { i--; draw(); };
      if ($("#qn")) $("#qn").onclick = () => { i++; draw(); };
      if ($("#qs")) $("#qs").onclick = confirmSubmit;
    }
    function confirmSubmit() {
      const a = Object.keys(ans).length;
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = `<div class="card"><h2>${t("confirm_title")}</h2><p>${t("confirm_text", { a, n: Q.length })}</p>
        <div class="qnav"><button class="btn ghost" id="cn">${t("confirm_no")}</button><button class="btn" id="cy">${t("confirm_yes")}</button></div></div>`;
      document.body.appendChild(m);
      $("#cn", m).onclick = () => m.remove();
      $("#cy", m).onclick = async () => {
        $("#cy", m).disabled = true; $("#cy", m).textContent = t("loading");
        try {
          const r = await API.call("submit", { mobile: me().mobile, lang: S.lang, answers: ans });
          S.result = S.result || {}; S.result[me().mobile] = r; persist(); m.remove(); showResult(r, Q);
        } catch (e) {
          m.remove();
          if (e.code === "already_submitted") { await sync(); return go("certificate"); }
          toast(t("net_err"), 4000);
        }
      };
    }
    draw();
  }
  function showResult(r, Q) {
    const rev = (r.review || []).map(x => {
      const q = Q.find(y => y.id === x.id); if (!q) return "";
      const ok = x.chosen === x.correct;
      return `<li class="${ok ? "ok" : "no"}"><b>${esc(q.q)}</b>
        <span>${t("your_answer")}: ${x.chosen == null ? "-" : esc(q.options[x.chosen])} ${ok ? "&#10003;" : "&#10007;"}</span>
        ${ok ? "" : `<span>${t("right_answer")}: ${esc(q.options[x.correct])}</span>`}
        ${x.explanation ? `<em>${esc(x.explanation)}</em>` : ""}</li>`;
    }).join("");
    render(`<section class="wrap narrow">
      <div class="card result"><h1>${t("result_title")}</h1><div class="score">${r.percent}%</div>
        <p>${t("result_score", { s: r.score, n: r.total, p: r.percent })}</p><p>${r.passed ? t("result_pass") : t("result_fail")}</p>
        ${r.passed ? `<a class="btn big" href="#certificate">${t("get_cert")}</a>` : ""}</div>
      <ol class="review">${rev}</ol></section>`);
  }

  // ---------------- certificate ----------------
  async function viewCertificate() {
    let r = (S.result || {})[me().mobile];
    if (!r) { await sync(); r = (S.result || {})[me().mobile]; }
    if (!r) return go("home");
    if (!r.passed) return render(`<section class="wrap narrow"><div class="card result"><h1>${t("result_title")}</h1><div class="score">${r.percent}%</div><p>${t("result_fail")}</p></div></section>`);
    const url = verifyUrl(r.certId);
    render(`<section class="wrap cert-page"><h1>${t("cert_title")}</h1>
      <div class="certwrap"><canvas id="cert" width="2000" height="1414"></canvas></div>
      <div class="certbtns"><button class="btn" id="png">${t("dl_png")}</button><button class="btn" id="pdf">${t("dl_pdf")}</button>
        <button class="btn ghost" id="cp">${t("copy_link")}</button></div>
      <p class="hint">${esc(url)}</p></section>`);
    const cv = $("#cert"); await drawCert(cv, r, url);
    const fname = `Oribrix-Certificate-${r.name.replace(/[^a-z0-9]+/gi, "-")}`;
    $("#png").onclick = () => cv.toBlob(b => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fname + ".png";
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, "image/png");
    $("#pdf").onclick = () => {
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [2000, 1414], hotfixes: ["px_scaling"] });
      doc.addImage(cv.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 2000, 1414); doc.save(fname + ".pdf");
    };
    $("#cp").onclick = async e => { try { await navigator.clipboard.writeText(url); e.target.textContent = t("copied"); } catch (x) { prompt("Copy", url); } };
  }
  function verifyUrl(id) {
    const base = (C.SITE_URL || (location.origin + location.pathname)).replace(/[#?].*$/, "");
    return base + "?verify=" + encodeURIComponent(id);
  }
  function img(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  async function drawCert(cv, r, url) {
    try {
      await Promise.race([Promise.all(["700 80px Poppins", "600 40px Poppins", "400 30px Poppins"].map(f => document.fonts.load(f))),
                          new Promise(r => setTimeout(r, 2500))]);
    } catch (e) {}
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, B = "#00A4FF", INK = "#18242F", MUT = "#607080";
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    // border
    x.strokeStyle = B; x.lineWidth = 14; x.strokeRect(50, 50, W - 100, H - 100);
    x.strokeStyle = "#cfe9fb"; x.lineWidth = 3; x.strokeRect(80, 80, W - 160, H - 160);
    // corner accents
    x.fillStyle = B; [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 26, 0, 7); x.fill(); });
    const logo = await img("assets/img/mark_blue.png");
    x.drawImage(logo, W / 2 - 75, 140, 150, 150);
    x.textAlign = "center"; x.fillStyle = B; x.font = "700 46px Poppins"; x.fillText("oribrix", W / 2, 345);
    x.fillStyle = INK; x.font = "700 78px Poppins"; x.fillText("CERTIFICATE OF COMPLETION", W / 2, 480);
    x.fillStyle = MUT; x.font = "400 34px Poppins"; x.fillText("This is to certify that", W / 2, 570);
    let fs = 110; x.font = `700 ${fs}px Poppins`; while (x.measureText(r.name).width > 1500 && fs > 60) { fs -= 6; x.font = `700 ${fs}px Poppins`; }
    x.fillStyle = B; x.fillText(r.name, W / 2, 700);
    x.strokeStyle = "#cfe9fb"; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 600, 735); x.lineTo(W / 2 + 600, 735); x.stroke();
    x.fillStyle = INK; x.font = "400 36px Poppins";
    x.fillText(`has successfully completed the ${C.COURSE_NAME},`, W / 2, 810);
    x.fillText(`including all ${COURSE.modules.length} video modules and the final assessment.`, W / 2, 862);
    x.font = "600 40px Poppins"; x.fillText(`Score: ${r.score} / ${r.total}  (${r.percent}%)`, W / 2, 950);
    // footer: date, signature, id
    x.textAlign = "left"; x.fillStyle = MUT; x.font = "400 28px Poppins"; x.fillText("Date", 200, 1110);
    x.fillStyle = INK; x.font = "600 36px Poppins"; x.fillText(new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), 200, 1160);
    x.fillStyle = MUT; x.font = "400 28px Poppins"; x.fillText("Certificate ID", 200, 1225);
    x.fillStyle = INK; x.font = "600 32px Poppins"; x.fillText(r.certId, 200, 1268);
    x.textAlign = "center"; x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 230, 1150); x.lineTo(W / 2 + 230, 1150); x.stroke();
    x.fillStyle = INK; x.font = "600 34px Poppins"; x.fillText(C.SIGNATORY_NAME, W / 2, 1200);
    x.fillStyle = MUT; x.font = "400 28px Poppins"; x.fillText(C.SIGNATORY_TITLE, W / 2, 1242);
    // QR
    try {
      const box = document.createElement("div"); new QRCode(box, { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
      const q = box.querySelector("canvas"); if (q) x.drawImage(q, W - 420, 1050, 220, 220);
      x.fillStyle = MUT; x.font = "400 22px Poppins"; x.fillText("Scan to verify", W - 310, 1300);
    } catch (e) {}
  }

  // ---------------- verify ----------------
  async function viewVerify(id) {
    render(`<section class="wrap narrow"><div class="card result"><h1>${t("verify_title")}</h1><p>${t("loading")}</p></div></section>`);
    let r; try { r = await API.call("verify", { certId: id }); } catch (e) { r = null; }
    const body = !r ? `<p class="err">${t("net_err")}</p>` : r.valid ?
      `<div class="vok">&#10003; ${t("verify_ok")}</div><table class="vt"><tr><th>${t("verify_name")}</th><td>${esc(r.name)}</td></tr>
       <tr><th>${t("verify_date")}</th><td>${esc(r.date)}</td></tr><tr><th>${t("verify_score")}</th><td>${esc(r.percent)}%</td></tr>
       <tr><th>${t("verify_id")}</th><td>${esc(id)}</td></tr></table>` : `<div class="vbad">&#10007; ${t("verify_bad")}</div>`;
    render(`<section class="wrap narrow"><div class="card result"><h1>${t("verify_title")}</h1>${body}</div></section>`);
  }

  // ---------------- boot ----------------
  (async function boot() {
    try { COURSE = await (await fetch("data/course.json", { cache: "no-cache" })).json(); }
    catch (e) { app.innerHTML = "<p style='padding:40px'>Could not load data/course.json</p>"; return; }
    document.documentElement.lang = S.lang === "hi" ? "hi-Latn" : "en";
    if (me()) sync().then(() => { if (!location.hash || location.hash === "#home") route(); });
    route();
  })();
})();
