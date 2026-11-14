/* Oribrix Vendor Onboarding Academy - single page app (no build step). */
(function () {
  const C = window.ACADEMY_CONFIG, API = window.API;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const LS = "oribrix_academy_v1";
  const NOTES = "notes/Oribrix-Vendor-Onboarding-Notes.pdf";
  const SIGNATURE = "data:image/png;base64,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";
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
  function admUser(u) { u = u || S.user; return !!(u && (u.admin || (C.ADMIN_MOBILES || []).includes(u.mobile))); }
  function isAdm() { return !!(admUser() && S.adminPin); }
  function unlocked(m) { if (isAdm() || !C.SEQUENTIAL || m.n === 1) return true; return doneSet().has(m.n - 1) || doneSet().has(m.n); }
  function allDone() { if (isAdm()) return true; const d = doneSet(); return COURSE.modules.every(m => d.has(m.n)); }

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
      ${admUser(u) ? `<a class="adminlink" href="#admin">&#9881; Admin</a>` : ""}
      ${u ? `<div class="who"><span>${esc(u.name)}</span><button class="link" data-act="logout">${t("not_you")}</button></div>` : ""}
    </div></header>${API.TEST ? `<div class="testbar">${t("test_mode")}</div>` : ""}`;
  }
  function footer() { return `<footer class="foot"><div class="wrap"><img src="assets/img/mark_blue.png" alt=""> ${esc(C.ORG_NAME)} · ${t("footer")}</div></footer>`; }
  function render(html) { app.innerHTML = header() + `<main>${html}</main>` + footer(); window.scrollTo(0, 0); }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-lang],[data-go],[data-act]"); if (!el) return;
    if (el.dataset.lang) { e.preventDefault(); if (S.lang !== el.dataset.lang) { S.lang = el.dataset.lang; persist(); route(); } }
    else if (el.dataset.go) { e.preventDefault(); go(el.dataset.go); }
    else if (el.dataset.act === "logout") { e.preventDefault(); delete S.user; delete S.adminPin; persist(); go("home"); }
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
    if (h === "certificate-download") return viewCertificate(true);
    if (h === "course" || h === "course-vendor-onboarding") return viewHome();
    if (h === "notes") return viewNotes();
    if (h === "practice") return viewPractice();
    if (h === "admin") return viewAdmin();
    return viewCourses();
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
        S.user = { name: r.name, mobile, admin: !!r.admin, startedAt: r.startDate || new Date().toISOString().slice(0, 10) }; persist();
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
      S.user.admin = !!s.admin;
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
    render(`<section class="wrap dash"><a class="back" href="#" data-go="home">&larr; ${t("my_courses")}</a>
      <div class="dhead"><div><h1>${t("hello", { name: esc(me().name) })}</h1><p>${t("progress", { done: d.size, total: n })}</p></div>
        <div class="ring" style="--p:${Math.round(100 * d.size / n)}"><span>${Math.round(100 * d.size / n)}%</span></div></div>
      <div class="mods">${cards}
        <article class="mod card notescard"><div class="num nt">&#128214;</div>
          <div class="mbody"><div class="mtop"><span class="pill on">PDF</span><span class="dur">68 ${t("pages")}</span></div>
          <h3>${t("notes_title")}</h3><p>${t("notes_desc")}</p>
          <div class="nbtns"><a class="btn" href="#notes">${t("notes_open")}</a><a class="btn ghost" href="${NOTES}" download>&#8681; ${t("notes_dl")}</a></div></div></article>
        <article class="mod card practicecard"><div class="num pq">&#9998;</div>
          <div class="mbody"><div class="mtop"><span class="pill on">${t("pr_unlimited")}</span>${S.best != null ? `<span class="dur">${t("pr_best")}: ${S.best}%</span>` : ""}</div>
          <h3>${t("pr_title")}</h3><p>${t("pr_desc")}</p>
          <a class="btn" href="#practice">${t("pr_start")}</a></div></article></div>
      <article class="card quizcard ${allDone() || res ? "" : "locked"}"><div class="num q">?</div><div class="mbody">
        <h3>${res ? t("quiz_done") : t("quiz_title")}</h3>${quiz}</div></article>
    </section>`);
  }

  // ---------------- course hub ----------------
  let COURSES = null;
  async function viewCourses() {
    if (!COURSES) { try { COURSES = await (await fetch("data/courses.json", { cache: "no-cache" })).json(); } catch (e) { COURSES = [{ id: "vendor-onboarding", status: "live", title: { en: C.COURSE_NAME }, desc: { en: "" } }]; } }
    const L = S.lang === "hi" ? "hi" : "en", tx = o => (o && (o[L] || o.en)) || "";
    const cards = COURSES.map(c => {
      if (c.status !== "live") return `<article class="card ccard soon"><div class="ctop"><span class="pill">${t("soon")}</span></div>
        <h2>${esc(tx(c.title))}</h2><p>${esc(tx(c.desc))}</p><div class="bar"><i style="width:0"></i></div><p class="hint">${t("soon_hint")}</p></article>`;
      const d = doneSet(), n = COURSE.modules.length, res = (S.result || {})[me().mobile];
      const passed = res && res.passed, pctDone = passed ? 100 : Math.round(100 * Math.min(d.size, n) / (n + 1)) + (res ? Math.round(100 / (n + 1)) : 0);
      const pill = passed ? `<span class="pill ok">${t("c_completed")}</span>` : res ? `<span class="pill">${t("c_quiz_done", { p: res.percent })}</span>`
        : d.size >= n ? `<span class="pill on">${t("c_quiz_ready")}</span>` : d.size ? `<span class="pill on">${t("c_in_progress")}</span>` : `<span class="pill">${t("status_new")}</span>`;
      const btns = passed ? `<a class="btn" href="#certificate">${t("c_open_cert")}</a><a class="btn ghost" href="#certificate-download">&#8681; ${t("c_dl_cert")}</a><a class="btn ghost" href="#course">${t("c_review")}</a>`
        : `<a class="btn" href="#course">${d.size || res ? t("continue_btn") : t("c_start")}</a>`;
      return `<article class="card ccard ${passed ? "done" : ""}"><div class="ctop">${pill}<span class="dur">${t("c_modules", { d: Math.min(d.size, n), n })}${res ? " · " + t("c_quiz_short", { p: res.percent }) : ""}</span></div>
        <h2>${esc(tx(c.title))}</h2><p>${esc(tx(c.desc))}</p>
        <div class="cprog"><div class="bar"><i style="width:${pctDone}%"></i></div><b>${pctDone}%</b></div>
        <div class="nbtns">${btns}</div></article>`;
    }).join("");
    render(`<section class="wrap hub"><div class="dhead"><div><h1>${t("hello", { name: esc(me().name) })}</h1><p>${t("my_courses_sub")}</p></div></div>
      <div class="ccards">${cards}</div></section>`);
  }

  // ---------------- player ----------------
  let P = null;
  function stopPlayer() {
    if (P) { try { P.save(); P.video.pause(); } catch (e) {} document.removeEventListener("visibilitychange", P.onVis); document.removeEventListener("keydown", P.onKey); P = null; }
  }
  function viewPlayer(n) {
    const m = COURSE.modules.find(x => x.n === n);
    if (!m || !unlocked(m)) return go("course");
    const lang = S.lang, src = m.video[lang], vtt = m.subtitles[lang];
    const next = COURSE.modules.find(x => x.n === n + 1);
    const chapters = (m.chapters && m.chapters[lang]) || [];
    render(`<section class="wrap player-page">
      <a class="back" href="#" data-go="course">&larr; ${t("back")}</a>
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
    const lim = () => isAdm() ? Infinity : max;
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
      document.querySelectorAll("#chap li").forEach(li => li.classList.toggle("off", +li.dataset.t > lim() + 1));
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
      if (v.currentTime > lim() + 1) { v.currentTime = max; toast(t("no_skip")); }
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
      if (target > lim() + 1) { toast(t("no_skip")); v.currentTime = max; } else v.currentTime = target;
    };
    document.querySelectorAll("#chap li").forEach(li => li.onclick = () => { const x = +li.dataset.t; if (x > lim() + 1) toast(t("no_skip")); else { v.currentTime = x; v.play(); } });
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
    if (!allDone()) return go("course");
    render(`<section class="wrap narrow"><p class="hint">${t("loading")}</p></section>`);
    let data;
    try { data = await API.call("quiz", { mobile: me().mobile, lang: S.lang, pin: S.adminPin }); }
    catch (e) {
      if (e.code === "already_submitted") { await sync(); return go("certificate"); }
      if (e.code === "modules_incomplete") { await sync(); return go("course"); }
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
          const r = await API.call("submit", { mobile: me().mobile, lang: S.lang, answers: ans, pin: S.adminPin });
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

  // ---------------- notes ----------------
  function viewNotes() {
    render(`<section class="wrap notes-page"><a class="back" href="#" data-go="course">&larr; ${t("back")}</a>
      <div class="nhead"><div><h1>${t("notes_title")}</h1><p>${t("notes_desc")}</p></div>
        <div class="nbtns"><a class="btn" href="${NOTES}" download>&#8681; ${t("notes_dl")}</a><a class="btn ghost" href="${NOTES}" target="_blank" rel="noopener">${t("notes_newtab")}</a></div></div>
      <div class="pdfwrap"><iframe src="${NOTES}#view=FitH" title="${t("notes_title")}"></iframe></div>
      <p class="hint">${t("notes_hint")}</p></section>`);
  }

  // ---------------- practice quiz ----------------
  let PRACTICE = null;
  async function viewPractice() {
    render(`<section class="wrap narrow"><p class="hint">${t("loading")}</p></section>`);
    if (!PRACTICE) { try { PRACTICE = await (await fetch("data/practice.json", { cache: "no-cache" })).json(); } catch (e) { return render(`<section class="wrap narrow"><p class="err">${t("net_err")}</p></section>`); } }
    const L = S.lang === "hi" ? "hi" : "en";
    const Q = PRACTICE.map(x => {
      const perm = x.o.en.map((_, k) => k).sort(() => Math.random() - .5);
      return { ...x, o: { en: perm.map(k => x.o.en[k]), hi: perm.map(k => x.o.hi[k]) }, a: perm.indexOf(x.a), r: Math.random() };
    }).sort((a, b) => a.r - b.r);
    const picked = []; let i = 0, score = 0;
    function draw() {
      const q = Q[i], ch = picked[i], done = ch !== undefined;
      render(`<section class="wrap narrow quiz practice">
        <a class="back" href="#" data-go="course">&larr; ${t("back")}</a>
        <div class="qtop"><span>${t("pr_title")} · ${t("q_of", { i: i + 1, n: Q.length })}</span><div class="bar"><i style="width:${100 * (i + 1) / Q.length}%"></i></div></div>
        <div class="card qcard"><span class="pill on">${t("module")} ${q.m}</span><h2>${esc(q.q[L])}</h2>
          <div class="opts">${q.o[L].map((o, k) => {
            const cls = !done ? "" : k === q.a ? "right" : k === ch ? "wrong" : "dim";
            return `<button class="opt ${cls}" data-k="${k}" ${done ? "disabled" : ""}><b>${"ABCD"[k]}</b>${esc(o)}</button>`; }).join("")}</div>
          ${done ? `<div class="fb ${ch === q.a ? "ok" : "no"}"><strong>${ch === q.a ? t("pr_correct") : t("pr_wrong")}</strong> ${esc(q.x[L])}</div>` : ""}</div>
        <div class="qnav"><span class="hint">${t("pr_score")}: ${score}/${picked.length}</span>
          ${done ? `<button class="btn" id="pn">${i < Q.length - 1 ? t("next") : t("pr_finish")}</button>` : ""}</div>
      </section>`);
      document.querySelectorAll(".opt").forEach(b => b.onclick = () => { if (picked[i] !== undefined) return; picked[i] = +b.dataset.k; if (picked[i] === q.a) score++; draw(); });
      if ($("#pn")) $("#pn").onclick = () => { if (i < Q.length - 1) { i++; draw(); } else finish(); };
    }
    function finish() {
      const pc = Math.round(100 * score / Q.length);
      if (S.best == null || pc > S.best) { S.best = pc; persist(); }
      API.call("practice", { mobile: me().mobile, score, total: Q.length }).catch(() => {});
      const rev = Q.map((q, k) => `<li class="${picked[k] === q.a ? "ok" : "no"}"><b>${esc(q.q[L])}</b>
        ${picked[k] === q.a ? "" : `<span>${t("right_answer")}: ${esc(q.o[L][q.a])}</span>`}<em>${esc(q.x[L])}</em></li>`).join("");
      render(`<section class="wrap narrow"><div class="card result"><h1>${t("pr_title")}</h1><div class="score">${pc}%</div>
        <p>${t("pr_result", { s: score, n: Q.length })}</p><p class="hint">${t("pr_note")}</p>
        <div class="nbtns" style="justify-content:center"><button class="btn" id="again">${t("pr_again")}</button><a class="btn ghost" href="#" data-go="course">${t("back")}</a></div></div>
        <ol class="review">${rev}</ol></section>`);
      $("#again").onclick = () => viewPractice();
    }
    draw();
  }

  // ---------------- admin ----------------
  async function viewAdmin() {
    if (!me()) return go("home");
    if (!S.adminPin) return adminLogin();
    render(`<section class="wrap"><p class="hint">${t("loading")}</p></section>`);
    let d;
    try { d = await API.call("admin", { mobile: me().mobile, pin: S.adminPin }); }
    catch (e) {
      if (e.code === "not_admin") { delete S.adminPin; persist(); return adminLogin("Wrong or changed PIN. Enter the current Admin PIN."); }
      return render(`<section class="wrap"><p class="err">${t("net_err")}</p></section>`);
    }
    const N = d.totalModules || 8, L = d.learners.filter(x => !x.admin);
    const started = L.filter(x => x.modules.length > 0).length, allDoneN = L.filter(x => x.modules.length >= N).length;
    const taken = L.filter(x => x.result), passed = taken.filter(x => x.result.passed);
    const avg = taken.length ? Math.round(taken.reduce((a, x) => a + x.result.percent, 0) / taken.length) : 0;
    const pAtt = L.reduce((a, x) => a + (x.practice ? x.practice.attempts : 0), 0);
    const modCount = Array.from({ length: N }, (_, i) => L.filter(x => x.modules.includes(i + 1)).length);
    const statusOf = x => x.result ? (x.result.passed ? "passed" : "failed") : x.modules.length >= N ? "ready" : x.modules.length ? "progress" : "new";
    const label = { passed: "Passed", failed: "Failed", ready: "Quiz pending", progress: "In progress", new: "Not started" };
    let q = "", f = "all";
    function rowsHtml() {
      const list = L.filter(x => (f === "all" || statusOf(x) === f) && (!q || (x.name + " " + x.mobile).toLowerCase().includes(q)))
        .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
      if (!list.length) return `<tr><td colspan="7" class="hint" style="text-align:center;padding:24px">No learners match.</td></tr>`;
      return list.map(x => {
        const st = statusOf(x);
        const dots = Array.from({ length: N }, (_, i) => `<i class="${x.modules.includes(i + 1) ? "on" : ""}" title="Module ${i + 1}${x.moduleDates[i + 1] ? ": " + x.moduleDates[i + 1] : ""}"></i>`).join("");
        const quiz = x.result ? `<span class="badge ${x.result.passed ? "ok" : "no"}">${x.result.percent}%</span> <small>${x.result.score}/${x.result.total} · ${esc(x.result.at.slice(0, 10))}</small>
            ${x.result.certId ? `<br><a class="small" href="?verify=${encodeURIComponent(x.result.certId)}" target="_blank" rel="noopener">${esc(x.result.certId)}</a>` : ""}
            ${x.result.flag ? `<br><span class="badge warn" title="Same name used with another mobile">check name</span>` : ""}` : `<span class="hint">—</span>`;
        const pr = x.practice ? `<b>${x.practice.best}%</b> best<br><small>${x.practice.attempts} attempt${x.practice.attempts > 1 ? "s" : ""} · last ${x.practice.last}%</small>` : `<span class="hint">—</span>`;
        return `<tr><td><b>${esc(x.name)}</b><br><small>${esc(x.mobile)} · ${x.lang === "hi" ? "Hinglish" : "English"}</small></td>
          <td><span class="badge s-${st}">${label[st]}</span></td>
          <td><div class="dots">${dots}</div><small>${x.modules.length}/${N}</small></td>
          <td>${quiz}</td><td>${pr}</td>
          <td><small>${esc(x.registered)}<br>seen ${esc(x.lastSeen)}</small></td>
          <td>${x.result ? `<button class="btn ghost sm" data-reset="${esc(x.mobile)}" data-name="${esc(x.name)}">Allow retake</button>` : ""}</td></tr>`;
      }).join("");
    }
    const hard = (d.questions || []).slice(0, 10).map(x => `<li><span class="badge no">${Math.round(100 * x.wrong / x.asked)}% wrong</span>
      <span class="pill">M${x.module}</span> ${esc(x.q)} <small>(${x.wrong}/${x.asked})</small></li>`).join("") || `<li class="hint">No quiz submissions yet.</li>`;
    render(`<section class="wrap admin">
      <div class="ahead"><div><h1>Admin dashboard</h1><p class="hint">Signed in as ${esc(me().name)}. Skip mode is on for you: every module is open and you can jump anywhere in the videos.</p></div>
        <div class="nbtns"><button class="btn ghost" id="a_ref">&#8635; Refresh</button><button class="btn ghost" id="a_csv">&#8681; Export CSV</button><button class="btn ghost" id="a_lock">Lock</button></div></div>
      <div class="stats">
        <div class="stat"><b>${L.length}</b><span>Learners</span></div>
        <div class="stat"><b>${started}</b><span>Started</span></div>
        <div class="stat"><b>${allDoneN}</b><span>All ${N} modules done</span></div>
        <div class="stat"><b>${taken.length}</b><span>Quiz taken</span></div>
        <div class="stat"><b>${passed.length}</b><span>Passed${taken.length ? ` (${Math.round(100 * passed.length / taken.length)}%)` : ""}</span></div>
        <div class="stat"><b>${avg}%</b><span>Avg quiz score</span></div>
        <div class="stat"><b>${pAtt}</b><span>Practice attempts</span></div>
      </div>
      <div class="agrid">
        <div class="card"><h3>Module completion</h3><div class="funnel">${modCount.map((c, i) => `<div><span>Module ${i + 1}</span><div class="bar"><i style="width:${L.length ? 100 * c / L.length : 0}%"></i></div><b>${c}</b></div>`).join("")}</div></div>
        <div class="card"><h3>Hardest questions</h3><ol class="hardq">${hard}</ol></div>
      </div>
      <div class="card">
        <div class="tools"><input id="a_q" placeholder="Search name or mobile"><select id="a_f">
          <option value="all">All learners</option><option value="new">Not started</option><option value="progress">In progress</option>
          <option value="ready">Quiz pending</option><option value="passed">Passed</option><option value="failed">Failed</option></select></div>
        <div class="tablewrap"><table class="atable"><thead><tr><th>Learner</th><th>Status</th><th>Modules</th><th>Final quiz</th><th>Practice quiz</th><th>Registered / last seen</th><th></th></tr></thead>
          <tbody id="a_rows">${rowsHtml()}</tbody></table></div>
      </div></section>`);
    const redraw = () => { $("#a_rows").innerHTML = rowsHtml(); bindReset(); };
    $("#a_q").oninput = e => { q = e.target.value.trim().toLowerCase(); redraw(); };
    $("#a_f").onchange = e => { f = e.target.value; redraw(); };
    $("#a_ref").onclick = () => viewAdmin();
    $("#a_lock").onclick = () => { delete S.adminPin; persist(); go("home"); };
    $("#a_csv").onclick = () => {
      const head = ["Name", "Mobile", "Language", "Registered", "Last seen", "Modules done", ...Array.from({ length: N }, (_, i) => "Module " + (i + 1)),
        "Quiz %", "Quiz score", "Passed", "Certificate ID", "Quiz date", "Practice best %", "Practice attempts", "Practice last %"];
      const lines = [head].concat(L.map(x => [x.name, x.mobile, x.lang, x.registered, x.lastSeen, x.modules.length,
        ...Array.from({ length: N }, (_, i) => x.moduleDates[i + 1] || ""),
        x.result ? x.result.percent : "", x.result ? `${x.result.score}/${x.result.total}` : "", x.result ? (x.result.passed ? "Yes" : "No") : "",
        x.result ? x.result.certId : "", x.result ? x.result.at : "", x.practice ? x.practice.best : "", x.practice ? x.practice.attempts : "", x.practice ? x.practice.last : ""]));
      const csv = lines.map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = `oribrix-academy-learners-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
    };
    function bindReset() {
      document.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
        const ok = await confirmBox(`Allow ${b.dataset.name} to retake the final quiz? Their current result and certificate will be removed (kept in the ResetLog tab).`);
        if (!ok) return;
        b.disabled = true;
        try { await API.call("admin_reset", { mobile: me().mobile, pin: S.adminPin, target: b.dataset.reset }); toast("Retake allowed for " + b.dataset.name, 3000); viewAdmin(); }
        catch (e) { b.disabled = false; toast(t("net_err"), 3000); }
      });
    }
    bindReset();
  }
  function confirmBox(text) {
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = `<div class="card"><p>${esc(text)}</p><div class="qnav"><button class="btn ghost" id="cb_n">Cancel</button><button class="btn" id="cb_y">Yes, allow</button></div></div>`;
      document.body.appendChild(m);
      $("#cb_n", m).onclick = () => { m.remove(); res(false); };
      $("#cb_y", m).onclick = () => { m.remove(); res(true); };
    });
  }
  function adminLogin(msg) {
    render(`<section class="wrap narrow"><div class="card result"><h1>Admin access</h1>
      <p class="hint">Enter the Admin PIN. You'll find it in the <b>Settings</b> tab of the Google Sheet (ADMIN_PIN).</p>
      <input id="a_pin" type="password" inputmode="numeric" autocomplete="off" placeholder="Admin PIN" class="pin">
      <p class="err" id="a_err">${msg ? esc(msg) : ""}</p><button class="btn big" id="a_go">Open dashboard</button></div></section>`);
    const goPin = async () => {
      const pin = $("#a_pin").value.trim(); if (!pin) return;
      $("#a_go").disabled = true; $("#a_err").textContent = "";
      try { await API.call("admin_check", { mobile: me().mobile, pin }); S.adminPin = pin; persist(); viewAdmin(); }
      catch (e) { $("#a_go").disabled = false; $("#a_err").textContent = e.code === "not_admin" ? "That PIN is not correct." : t("net_err"); }
    };
    $("#a_go").onclick = goPin; $("#a_pin").onkeydown = e => { if (e.key === "Enter") goPin(); };
    $("#a_pin").focus();
  }

  // ---------------- certificate ----------------
  async function viewCertificate(autoDownload) {
    let r = (S.result || {})[me().mobile];
    if (!r) { await sync(); r = (S.result || {})[me().mobile]; }
    if (!r) return go("course");
    if (!r.passed) return render(`<section class="wrap narrow"><div class="card result"><h1>${t("result_title")}</h1><div class="score">${r.percent}%</div><p>${t("result_fail")}</p></div></section>`);
    const url = verifyUrl(r.certId);
    render(`<section class="wrap cert-page"><a class="back" href="#" data-go="home">&larr; ${t("my_courses")}</a><h1>${t("cert_title")}</h1>
      <div class="certbtns"><button class="btn" id="pdf">&#8681; ${t("dl_pdf")}</button><button class="btn" id="png">&#8681; ${t("dl_png")}</button>
        <button class="btn ghost" id="cp">${t("copy_link")}</button></div>
      <div class="certwrap"><canvas id="cert" width="2000" height="1414"></canvas></div>
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
    if (autoDownload) $("#pdf").click();
  }
  function verifyUrl(id) {
    const base = (C.SITE_URL || (location.origin + location.pathname)).replace(/[#?].*$/, "");
    return base + "?verify=" + encodeURIComponent(id);
  }
  function img(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  function fmtDate(d) { if (!d) return ""; const t = new Date(String(d).slice(0, 10) + "T00:00:00"); return isNaN(t) ? String(d) : t.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
  function certSideTrace(x, xs, y0, y1, dir) {
    // Thin gold vertical trace with a dog-leg, like the letterhead margins
    const GOLD = "#D9A93A";
    x.save(); x.strokeStyle = GOLD; x.fillStyle = GOLD; x.lineWidth = 2.2;
    const mid = (y0 + y1) / 2, j = 26 * dir;
    x.beginPath(); x.moveTo(xs, y0); x.lineTo(xs, mid - 30); x.lineTo(xs + j, mid); x.lineTo(xs + j, y1); x.stroke();
    x.beginPath(); x.moveTo(xs + 16 * dir, y0 + 40); x.lineTo(xs + 16 * dir, mid - 46); x.lineTo(xs + j + 16 * dir, mid - 16); x.lineTo(xs + j + 16 * dir, y1 - 60); x.stroke();
    [[xs, y0], [xs + j, y1], [xs + 16 * dir, y0 + 40], [xs + j + 16 * dir, y1 - 60]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); });
    x.restore();
  }
  async function drawCert(cv, r, url) {
    try {
      await Promise.race([Promise.all(["800 80px Poppins", "700 40px Poppins", "600 40px Poppins", "400 30px Poppins"].map(f => document.fonts.load(f))),
                          new Promise(r => setTimeout(r, 2500))]);
    } catch (e) {}
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, B = "#0E8FE0", NAVY = "#0F2A3F", INK = "#1C2B38", MUT = "#5F7183", GOLD = "#C9992F";
    const sp = v => { try { x.letterSpacing = v; } catch (e) {} };
    // paper
    let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#F2F8FD");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // faint hex pattern
    x.save(); x.strokeStyle = "rgba(14,143,224,.045)"; x.lineWidth = 2; const R = 46, hw = R * Math.sqrt(3);
    for (let row = 0, y = 0; y < H + R; row++, y += R * 1.5) for (let xx = (row % 2) * hw / 2; xx < W + hw; xx += hw) {
      x.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x[k ? "lineTo" : "moveTo"](xx + R * Math.cos(a), y + R * Math.sin(a)); } x.closePath(); x.stroke(); }
    x.restore();
    // hologram watermark (brand mark, very light)
    const logo = await img("assets/img/mark_blue.png");
    x.save(); x.globalAlpha = .055; x.drawImage(logo, W / 2 - 390, H / 2 - 330, 780, 780); x.restore();
    // gold double frame
    x.strokeStyle = GOLD; x.lineWidth = 5; x.strokeRect(38, 38, W - 76, H - 76);
    x.strokeStyle = "rgba(201,153,47,.55)"; x.lineWidth = 1.8; x.strokeRect(56, 56, W - 112, H - 112);
    // circuit corner ornaments on the free corners (top-left, bottom-right)
    const orn = (cx, cy, sx, sy) => {
      x.save(); x.translate(cx, cy); x.scale(sx, sy); x.strokeStyle = GOLD; x.fillStyle = GOLD; x.lineWidth = 2.6; x.lineJoin = "round";
      const paths = [[[20, 230], [20, 70], [70, 20], [230, 20]], [[40, 170], [40, 95], [95, 40], [170, 40]], [[60, 120], [60, 105], [105, 60], [120, 60]]];
      paths.forEach(p => { x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); });
      [[20, 230], [230, 20], [40, 170], [170, 40]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 6, 0, 7); x.fill(); });
      [[60, 120], [120, 60]].forEach(([a, b]) => { x.fillRect(a - 6, b - 6, 12, 12); });
      x.lineWidth = 2; x.beginPath(); x.arc(20, 20, 9, 0, 7); x.stroke(); x.beginPath(); x.arc(20, 20, 3.5, 0, 7); x.fill();
      x.restore();
    };
    orn(56, 56, 1, 1); orn(W - 56, 56, -1, 1); orn(56, H - 56, 1, -1); orn(W - 56, H - 56, -1, -1);
    certSideTrace(x, 92, 420, 900, 1); certSideTrace(x, W - 92, 520, 1000, -1);
    // header: mark | oribrix
    x.textBaseline = "alphabetic";
    x.font = "700 104px Poppins"; const wm = x.measureText("oribrix").width, hw2 = 118 + 34 + wm, hx = W / 2 - hw2 / 2;
    x.drawImage(logo, hx, 112, 118, 118);
    x.strokeStyle = B; x.lineWidth = 3; x.beginPath(); x.moveTo(hx + 135, 106); x.lineTo(hx + 135, 236); x.stroke();
    x.textAlign = "left"; x.fillStyle = B; x.fillText("oribrix", hx + 152, 206);
    x.textAlign = "center"; sp("3px"); x.fillStyle = B; x.font = "700 33px Poppins"; x.fillText(C.ORG_NAME.toUpperCase(), W / 2, 300); sp("0px");
    x.strokeStyle = GOLD; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 90, 330); x.lineTo(W / 2 + 90, 330); x.stroke();
    x.fillStyle = GOLD; [W / 2 - 98, W / 2 + 98].forEach(a => { x.beginPath(); x.arc(a, 330, 6, 0, 7); x.fill(); });
    // title
    sp("6px"); x.fillStyle = NAVY; x.font = "800 98px Poppins"; x.fillText("CERTIFICATE", W / 2, 445);
    sp("14px"); x.fillStyle = GOLD; x.font = "600 36px Poppins"; x.fillText("OF COMPLETION", W / 2, 500); sp("0px");
    x.fillStyle = MUT; x.font = "400 32px Poppins"; x.fillText("This is to certify that", W / 2, 578);
    let fs = 100; x.font = `700 ${fs}px Poppins`; while (x.measureText(r.name).width > 1300 && fs > 56) { fs -= 6; x.font = `700 ${fs}px Poppins`; }
    x.fillStyle = B; x.fillText(r.name, W / 2, 690);
    g = x.createLinearGradient(W / 2 - 560, 0, W / 2 + 560, 0); g.addColorStop(0, "rgba(201,153,47,0)"); g.addColorStop(.5, GOLD); g.addColorStop(1, "rgba(201,153,47,0)");
    x.strokeStyle = g; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 560, 724); x.lineTo(W / 2 + 560, 724); x.stroke();
    x.fillStyle = INK; x.font = "400 34px Poppins";
    x.fillText(`has successfully completed the ${C.COURSE_NAME},`, W / 2, 792);
    x.fillText(`including all ${COURSE.modules.length} video modules and the final assessment.`, W / 2, 842);
    x.font = "600 36px Poppins"; x.fillStyle = NAVY; x.fillText(`Score: ${r.percent}%`, W / 2, 912);
    // footer — middle: dates + certificate ID
    const start = r.startDate || (me() && me().startedAt) || "";
    const cols = start ? [[W / 2 - 170, "COURSE STARTED", fmtDate(start)], [W / 2 + 170, "COMPLETED ON", fmtDate(r.date)]] : [[W / 2, "COMPLETED ON", fmtDate(r.date)]];
    cols.forEach(([cx, lab, val]) => {
      sp("2px"); x.fillStyle = MUT; x.font = "600 21px Poppins"; x.fillText(lab, cx, 1088); sp("0px");
      x.fillStyle = NAVY; x.font = "600 31px Poppins"; x.fillText(val, cx, 1132);
    });
    if (start) { x.strokeStyle = "rgba(201,153,47,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2, 1066); x.lineTo(W / 2, 1140); x.stroke(); }
    x.strokeStyle = "rgba(201,153,47,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 300, 1172); x.lineTo(W / 2 + 300, 1172); x.stroke();
    sp("2px"); x.fillStyle = MUT; x.font = "600 21px Poppins"; x.fillText("CERTIFICATE ID", W / 2, 1214); sp("1px");
    x.fillStyle = B; x.font = "700 34px Poppins"; x.fillText(r.certId, W / 2, 1260); sp("0px");
    // footer — right: signature
    const SX = W - 400;
    try { const sig = await img(SIGNATURE); const sw = 360, sh = sw * sig.height / sig.width; x.drawImage(sig, SX - sw / 2, 1150 - sh + 14, sw, sh); } catch (e) {}
    x.strokeStyle = NAVY; x.lineWidth = 2; x.beginPath(); x.moveTo(SX - 230, 1152); x.lineTo(SX + 230, 1152); x.stroke();
    x.fillStyle = NAVY; x.font = "700 32px Poppins"; x.fillText(C.SIGNATORY_NAME, SX, 1196);
    x.fillStyle = MUT; x.font = "500 24px Poppins"; x.fillText(C.SIGNATORY_TITLE, SX, 1232);
    x.font = "400 21px Poppins"; x.fillText(C.ORG_NAME, SX, 1264);
    // footer — left: QR
    const QX = 400;
    try {
      const box = document.createElement("div"); new QRCode(box, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
      const q = box.querySelector("canvas");
      x.fillStyle = "#fff"; x.strokeStyle = GOLD; x.lineWidth = 2.5; x.beginPath(); x.roundRect ? x.roundRect(QX - 122, 1002, 244, 244, 16) : x.rect(QX - 122, 1002, 244, 244); x.fill(); x.stroke();
      if (q) x.drawImage(q, QX - 100, 1024, 200, 200);
      sp("2px"); x.fillStyle = MUT; x.font = "600 20px Poppins"; x.fillText("SCAN TO VERIFY", QX, 1280); sp("0px");
    } catch (e) {}
  }

  // ---------------- verify ----------------
  async function viewVerify(id) {
    render(`<section class="wrap narrow"><div class="card result"><h1>${t("verify_title")}</h1><p>${t("loading")}</p></div></section>`);
    let r; try { r = await API.call("verify", { certId: id }); } catch (e) { r = null; }
    const body = !r ? `<p class="err">${t("net_err")}</p>` : r.valid ?
      `<div class="vok">&#10003; ${t("verify_ok")}</div><table class="vt"><tr><th>${t("verify_name")}</th><td>${esc(r.name)}</td></tr>
       ${r.startDate ? `<tr><th>${t("verify_start")}</th><td>${esc(r.startDate)}</td></tr>` : ""}<tr><th>${t("verify_date")}</th><td>${esc(r.date)}</td></tr><tr><th>${t("verify_score")}</th><td>${esc(r.percent)}%</td></tr>
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
