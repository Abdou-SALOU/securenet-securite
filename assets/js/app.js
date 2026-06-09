/* ===================================================================
   SecureNet — application engine (SPA router + rendering + state)
   Moteur dérivé de NetMaster, enrichi gamification (window.NMGame).
   =================================================================== */
(function () {
  "use strict";

  const NM = window.NM;
  const G  = window.NMGame;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // Date d'examen : ajustable. null si inconnue → badge motivation/série.
  const EXAM_DATE = new Date("2026-06-10T09:00:00");

  /* ---------------- persistent state ---------------- */
  const STORE = "sn_state_v1";
  const state = loadState();
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; }
    catch { return {}; }
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(state)); }
  state.theme    = state.theme || "dark";
  state.progress = state.progress || {};   // {modId:{sec:{id:true}, quiz:0-100}}
  state.awarded  = state.awarded  || {};    // anti-farm XP : sections déjà récompensées
  state.navCollapsed = state.navCollapsed || false; // sidebar réduite (desktop)
  function mp(id) { return (state.progress[id] = state.progress[id] || { sec: {}, quiz: 0 }); }

  /* ---------------- progress maths ---------------- */
  function modPct(m) {
    const tot = m.sections.length || 1;
    const done = Object.keys(mp(m.id).sec).length;
    return Math.round((done / tot) * 100);
  }
  function globalPct() {
    let tot = 0, done = 0;
    NM.modules.forEach(m => { tot += m.sections.length; done += Object.keys(mp(m.id).sec).length; });
    return tot ? Math.round((done / tot) * 100) : 0;
  }

  /* ---------------- toast ---------------- */
  let toT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toT); toT = setTimeout(() => t.classList.remove("show"), 1900);
  }

  /* ===================================================================
     THEME
     =================================================================== */
  function applyTheme() { document.documentElement.setAttribute("data-theme", state.theme); }
  $("#themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark"; applyTheme(); save();
  });

  /* ===================================================================
     SIDEBAR
     =================================================================== */
  function buildNav() {
    const nav = $("#nav");
    let html = `<div class="nav-group-label">Accueil</div>
      <div class="nav-item" data-nav="home"><span class="nav-ico">🏠</span>Tableau de bord</div>`;
    html += sideCarousel("Cours", NM.modules.filter(m => m.kind !== "tp"));
    html += sideCarousel("Travaux pratiques", NM.modules.filter(m => m.kind === "tp"));
    nav.innerHTML = html;
    $$("[data-nav]", nav).forEach(bindNav);
    initCarousels(nav);
  }
  // carrousel compact de la barre latérale (une carte module à la fois)
  function sideCarousel(label, mods) {
    if (!mods.length) return "";
    const slides = mods.map(m => `<div class="carousel-slide"><div class="snav-card" data-nav="m/${m.id}" style="--mc:var(--r-${m.color})">
      <div class="snav-top"><span class="snav-ico">${m.icon}</span><span class="snav-title">${m.title}</span></div>
      <div class="snav-prog"><i data-bar="${m.id}"></i></div>
      <div class="snav-meta"><span class="snav-sec">${m.sections.length} sections</span><span class="nav-pct" data-pct="${m.id}"></span><span class="nav-dot" data-dot="${m.id}"></span></div>
    </div></div>`).join("");
    return `<div class="carousel carousel-side" data-carousel>
      <div class="carousel-head"><span class="nav-group-label nav-group-inline">${label}</span>
        <div class="carousel-nav"><button class="carousel-arrow" data-dir="-1" aria-label="Précédent">‹</button><button class="carousel-arrow" data-dir="1" aria-label="Suivant">›</button></div></div>
      <div class="carousel-track">${slides}</div>
      <div class="carousel-dots"></div></div>`;
  }
  // carrousel du tableau de bord (plusieurs cartes visibles)
  function carousel(label, sub, cards) {
    return `<div class="carousel carousel-dash" data-carousel>
      <div class="carousel-head"><div class="carousel-head-l"><h2 class="carousel-title">${label}</h2>${sub ? `<span class="carousel-sub">${sub}</span>` : ""}</div>
        <div class="carousel-nav"><button class="carousel-arrow" data-dir="-1" aria-label="Précédent">‹</button><button class="carousel-arrow" data-dir="1" aria-label="Suivant">›</button></div></div>
      <div class="carousel-track">${cards.map(h => `<div class="carousel-slide">${h}</div>`).join("")}</div>
      <div class="carousel-dots"></div></div>`;
  }
  // moteur de carrousel : flèches + points + swipe natif (scroll-snap)
  function initCarousels(root) {
    $$(".carousel[data-carousel]", root).forEach(c => {
      const track = $(".carousel-track", c), dotsWrap = $(".carousel-dots", c);
      const slides = $$(".carousel-slide", track), arrows = $$(".carousel-arrow", c);
      const slideLeft = s => track.scrollLeft + (s.getBoundingClientRect().left - track.getBoundingClientRect().left);
      arrows.forEach(a => a.addEventListener("click", () => track.scrollBy({ left: (+a.dataset.dir) * track.clientWidth * 0.9, behavior: "smooth" })));
      if (dotsWrap) dotsWrap.innerHTML = slides.map((_, i) => `<button class="carousel-dot" data-i="${i}" aria-label="Aller à ${i + 1}"></button>`).join("");
      const dots = $$(".carousel-dot", c);
      dots.forEach(d => d.addEventListener("click", () => track.scrollTo({ left: slideLeft(slides[+d.dataset.i]), behavior: "smooth" })));
      function update() {
        c.classList.toggle("no-scroll", track.scrollWidth <= track.clientWidth + 2);
        let idx = 0, best = 1e9;
        slides.forEach((s, i) => { const d = Math.abs(slideLeft(s) - track.scrollLeft); if (d < best) { best = d; idx = i; } });
        dots.forEach((d, i) => d.classList.toggle("on", i === idx));
        const max = track.scrollWidth - track.clientWidth - 2;
        arrows.forEach(a => { a.disabled = (+a.dataset.dir < 0) ? track.scrollLeft <= 1 : track.scrollLeft >= max; });
      }
      track.addEventListener("scroll", () => requestAnimationFrame(update));
      c._update = update; update();
    });
  }
  function snavScrollToActive(key) {
    const card = document.querySelector(`.snav-card[data-nav="${key}"]`);
    if (!card) return;
    const slide = card.closest(".carousel-slide"), track = card.closest(".carousel-track");
    if (slide && track) track.scrollTo({ left: track.scrollLeft + (slide.getBoundingClientRect().left - track.getBoundingClientRect().left), behavior: "smooth" });
  }
  function refreshNavProgress() {
    NM.modules.forEach(m => {
      const p = modPct(m);
      const pe = $(`[data-pct="${m.id}"]`); if (pe) pe.textContent = p ? p + "%" : "";
      const de = $(`[data-dot="${m.id}"]`); if (de) de.classList.toggle("done", p === 100);
      const be = $(`[data-bar="${m.id}"]`); if (be) be.style.width = p + "%";
    });
    const g = globalPct();
    $("#gpText").textContent = g + "%";
    $("#gpFill").style.strokeDashoffset = (97.4 * (1 - g / 100)).toFixed(1);
  }
  function bindNav(el) {
    el.addEventListener("click", () => { location.hash = "#/" + el.dataset.nav; closeSidebar(); });
  }
  $$("[data-nav]").forEach(bindNav);
  const mqDesktop = window.matchMedia("(min-width:901px)");
  $("#menuToggle").addEventListener("click", () => {
    if (mqDesktop.matches) {
      // grand écran : réduire / rouvrir la sidebar (état mémorisé)
      state.navCollapsed = !state.navCollapsed; save();
      $("#app").classList.toggle("nav-collapsed", state.navCollapsed);
    } else {
      // mobile : tiroir + voile
      const open = !$("#sidebar").classList.contains("open");
      $("#sidebar").classList.toggle("open", open);
      $("#scrim").classList.toggle("show", open);
    }
  });
  $("#scrim").addEventListener("click", closeSidebar);
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); }
  // applique l'état réduit mémorisé (n'a d'effet visuel que sur desktop via la media query)
  function applyNavCollapsed() { $("#app").classList.toggle("nav-collapsed", !!state.navCollapsed); }

  function setActiveNav(key) {
    $$("[data-nav]").forEach(n => n.classList.toggle("active", n.dataset.nav === key));
    if (key && key.startsWith("m/")) snavScrollToActive(key);
  }

  function examBadge() {
    const b = $("#examBadge");
    if (!b) return;
    let head = "";
    if (EXAM_DATE) {
      const days = Math.ceil((EXAM_DATE - new Date()) / 86400000);
      if (days >= 0) head = `<div class="exam-line"><span class="pulse"></span> Examen dans <b>${days} j</b> · révise 💪</div>`;
    }
    b.classList.add("player-card");
    b.innerHTML = `<div id="xpHud" class="xp-hud">${G ? G.hudHTML() : ""}</div>${head}`;
    b.style.cursor = "pointer";
    b.onclick = () => { location.hash = "#/home"; };
  }

  /* ===================================================================
     CLI / helper highlight (re-export so data uses same)
     =================================================================== */
  // window.cli/note/key defined in diagrams.js (loaded first)

  /* ===================================================================
     ROUTER
     =================================================================== */
  function router() {
    const h = location.hash.replace(/^#\/?/, "") || "";
    const parts = h.split("/").filter(Boolean);
    const view = $("#view");
    window.scrollTo(0, 0);
    if (window.__obs) { window.__obs.disconnect(); window.__obs = null; }

    if (!parts.length || parts[0] === "home") { setActiveNav("home"); renderHome(view); crumb([["Accueil", ""]]); }
    else if (parts[0] === "m")          { renderModule(view, parts[1], parts[2]); }
    else if (parts[0] === "quiz")       { renderQuiz(view, parts[1]); }
    else if (parts[0] === "exam")       { setActiveNav("exam"); renderExam(view, parts[1]); }
    else if (parts[0] === "lab")        { setActiveNav("lab"); window.NMLab.render(view, parts[1]); }
    else if (parts[0] === "cdc")        { setActiveNav("cdc"); window.NMCDC.render(view, parts[1]); }
    else if (parts[0] === "flashcards") { setActiveNav("flashcards"); renderFlash(view, parts[1]); }
    else if (parts[0] === "cheatsheet") { setActiveNav("cheatsheet"); renderCheat(view); }
    else { setActiveNav("home"); renderHome(view); }
    refreshNavProgress();
  }
  function crumb(arr) {
    $("#crumbs").innerHTML = arr.map((p, i) =>
      (i ? `<span class="sep">/</span>` : "") +
      (p[1] !== undefined && i < arr.length - 1
        ? `<span style="cursor:pointer" onclick="location.hash='#/${p[1]}'">${p[0]}</span>`
        : `<b>${p[0]}</b>`)
    ).join(" ");
  }

  /* ===================================================================
     HOME
     =================================================================== */
  function renderHome(view) {
    const courses = NM.modules.filter(m => m.kind !== "tp");
    const tps = NM.modules.filter(m => m.kind === "tp");
    const totalSec = NM.modules.reduce((a, m) => a + m.sections.length, 0);
    const totalQuiz = NM.modules.reduce((a, m) => a + (m.quiz ? m.quiz.length : 0), 0) + (NM.examExtra ? NM.examExtra.length : 0);
    const g = globalPct();

    const cdcCount = (window.NMCDC && window.NMCDC.LIST) ? window.NMCDC.LIST.length : 0;

    view.innerHTML = `
      <section class="hero">
        <div class="chip" style="display:inline-block;margin-bottom:12px">Sécurité des Systèmes &amp; Réseaux · 2CI-ISI · examen pratique</div>
        <h1>Réussis l'examen <span>en pratiquant</span>,<br>pas en récitant.</h1>
        <p>Tout le programme du prof — <strong>NAT/PAT, GRE, ACL &amp; CBAC, architecture de sécurité</strong> —
        sur un <strong>terminal Cisco simulé</strong>, avec des <strong>cahiers des charges guidés pas-à-pas</strong>,
        des labs validés automatiquement, XP et badges.</p>
        <div class="hero-stats">
          <div class="hero-stat"><b>${courses.length}</b><span>MODULES</span></div>
          <div class="hero-stat"><b>${cdcCount}</b><span>CAHIERS DES CHARGES</span></div>
          <div class="hero-stat"><b>${(window.NMLab && window.NMLab.LABS) ? window.NMLab.LABS.length : 0}</b><span>LABS CLI</span></div>
          <div class="hero-stat"><b>${g}%</b><span>PROGRESSION</span></div>
        </div>
        <div class="hero-cta">
          <button class="btn btn-primary" onclick="location.hash='#/cdc'">📋 Cahier des charges guidé</button>
          <button class="btn btn-ghost" onclick="location.hash='#/m/${continueTarget()}'">▶ ${g ? "Continuer" : "Commencer"} le cours</button>
        </div>
      </section>

      ${rewardsPanel()}

      ${carousel("Le programme de l'examen", "Les 3 parties annoncées par le prof", courses.map(card))}
      ${tps.length ? carousel("Ateliers pratiques", "Cahiers des charges & TP guidés", tps.map(card)) : ""}
      ${carousel("Outils de révision", "Pratique d'abord", [
        toolCard("📋", "Cahiers des charges guidés", "Le cœur de l'examen : on t'amène pas-à-pas à identifier les ACL, interfaces et sens, puis à construire chaque règle — avec validation.", "cdc", "cdc"),
        toolCard("🖥️", "Labs CLI — Console Cisco", "Tape de vraies commandes IOS dans un terminal simulé : NAT, ACL, GRE, CBAC. Objectifs validés + XP.", "lab", "nat"),
        toolCard("🎯", "Mode Examen", "Questions aléatoires sur tout le programme, chrono, score et correction détaillée.", "exam", "ctx"),
        toolCard("🃏", "Flashcards", "Ports, mots-clés (established, overload, inspect), wildcard masks…", "flashcards", "gre"),
        toolCard("⌨️", "Mémo commandes", "Toutes les commandes Cisco de sécurité regroupées par thème.", "cheatsheet", "archi")
      ])}`;

    $$("[data-go]", view).forEach(c => c.addEventListener("click", () => location.hash = "#/" + c.dataset.go));
    requestAnimationFrame(() => $$(".mod-progress i", view).forEach(b => b.style.width = b.dataset.w + "%"));
    initCarousels(view);
  }

  /* panneau récompenses (dopamine) : niveau + badges */
  function rewardsPanel() {
    if (!G) return "";
    const li = G.levelInfo();
    const badges = G.badgeList();
    return `<section class="rewards">
      <div class="rewards-head">
        <div class="rw-level">
          <div class="rw-ring" style="--p:${li.pct}"><span>${li.level}</span></div>
          <div><div class="rw-title">${li.title}</div><div class="rw-xp">${li.total} XP · 🔥 série ${G.state.streak.count} j (record ${G.state.streak.best || G.state.streak.count})</div></div>
        </div>
        <div class="rw-next">${li.cur}/${li.need} XP → niveau ${li.level + 1}</div>
      </div>
      <div class="rw-bar"><i style="width:${li.pct}%"></i></div>
      <div class="rewards-badges">
        ${badges.map(b => `<div class="rw-badge ${b.owned ? "on" : ""}" title="${b.desc}"><span class="rw-bico">${b.icon}</span><span class="rw-bname">${b.name}</span></div>`).join("")}
      </div>
    </section>`;
  }
  function continueTarget() {
    const next = NM.modules.find(m => modPct(m) < 100);
    return (next || NM.modules[0]).id;
  }
  function card(m) {
    const p = modPct(m);
    return `<article class="mod-card" data-go="m/${m.id}" style="--mc:var(--r-${m.color});--mc2:var(--r-${m.color}-2)">
      <div class="mod-glow"></div>
      <div class="mod-top">
        <div class="mod-ico">${m.icon}</div>
        <div><div class="mod-title">${m.title}</div><div class="mod-kic">${m.kicker}</div></div>
      </div>
      <div class="mod-desc">${m.desc}</div>
      <div class="mod-chips">${(m.chips || []).map(c => `<span class="chip">${c}</span>`).join("")}</div>
      <div class="mod-progress"><i data-w="${p}"></i></div>
      <div class="mod-meta"><span>${m.sections.length} sections · ${m.est || ""}</span><span>${p}%</span></div>
    </article>`;
  }
  function toolCard(ico, title, desc, go, color) {
    return `<article class="mod-card" data-go="${go}" style="--mc:var(--r-${color});--mc2:var(--r-${color}-2)">
      <div class="mod-glow"></div>
      <div class="mod-top"><div class="mod-ico">${ico}</div><div><div class="mod-title">${title}</div></div></div>
      <div class="mod-desc">${desc}</div>
      <div class="mod-meta" style="margin-top:18px"><span>Ouvrir →</span></div>
    </article>`;
  }

  /* ===================================================================
     MODULE / LESSON
     =================================================================== */
  function renderModule(view, id, scrollSec) {
    const m = NM.byId(id);
    if (!m) { location.hash = "#/"; return; }
    setActiveNav("m/" + id);
    crumb([["Accueil", ""], [m.kind === "tp" ? "TP" : "Cours", ""], [m.title, ""]]);
    document.documentElement.style.setProperty("--mc", `var(--r-${m.color})`);

    const toc = m.sections.map((s, i) =>
      `<div class="toc-link" data-toc="${s.id}"><span class="tn">${i + 1}</span>${s.title}</div>`).join("");

    const body = m.sections.map((s, i) => {
      const done = mp(m.id).sec[s.id];
      return `<section class="lesson-sec" id="sec-${s.id}" data-sec="${s.id}" style="--mc:var(--r-${m.color});--mc2:var(--r-${m.color}-2);animation-delay:${i * 40}ms">
        <h2><span class="secnum">${i + 1}</span>${s.title}</h2>
        ${s.html}
        <div class="sec-done">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.88rem">
            <input type="checkbox" data-check="${s.id}" ${done ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--mc)">
            <span>J'ai compris cette section</span>
          </label>
          <span style="color:var(--text-3);font-size:.8rem">Section ${i + 1} / ${m.sections.length}</span>
        </div>
      </section>`;
    }).join("");

    view.innerHTML = `
      <div class="mod-hero" style="--mc:var(--r-${m.color})">
        <div class="mh-ico">${m.icon}</div>
        <div><h1>${m.title}</h1><p>${m.desc}</p></div>
      </div>
      <div class="lesson-layout">
        <div class="lesson-main" style="--mc:var(--r-${m.color});--mc2:var(--r-${m.color}-2)">
          ${body}
          ${m.quiz && m.quiz.length ? `
          <div class="sec-done" style="border-style:solid;background:linear-gradient(120deg,color-mix(in srgb,var(--r-${m.color}) 12%,var(--surface)),var(--surface))">
            <div><b>Teste-toi sur ce module</b><div style="color:var(--text-3);font-size:.82rem">${m.quiz.length} questions corrigées</div></div>
            <button class="btn btn-primary" style="--accent:var(--r-${m.color})" onclick="location.hash='#/quiz/${m.id}'">Lancer le quiz →</button>
          </div>` : ""}
          ${lessonNav(m)}
        </div>
        <aside class="lesson-toc" style="--mc:var(--r-${m.color})">
          <div class="toc-label">Sur cette page</div>${toc}
        </aside>
      </div>`;

    // mount diagrams
    $$("[data-diagram]", view).forEach(el => {
      const fn = window.DIAGRAMS[el.dataset.diagram];
      if (fn) try { fn(el, m.color); } catch (e) { console.error("diagram", el.dataset.diagram, e); }
    });
    // copy buttons
    bindCopy(view);
    // checkboxes
    $$("[data-check]", view).forEach(cb => cb.addEventListener("change", () => {
      const sid = cb.dataset.check;
      if (cb.checked) {
        mp(m.id).sec[sid] = 1;
        const k = m.id + ":" + sid;
        if (G && !state.awarded[k]) { state.awarded[k] = 1; G.addXP(15, "Section validée ✓"); G.award("first-step"); }
        else toast("Section validée ✓");
      } else delete mp(m.id).sec[sid];
      save(); refreshNavProgress();
      if (modPct(m) === 100) {
        toast("Module terminé ! 🎉");
        if (G) { G.confetti({ n: 70 }); if (m.badge) G.award(m.badge); }
      }
    }));
    // TOC scrollspy
    const tocLinks = $$(".toc-link", view);
    tocLinks.forEach(l => l.addEventListener("click", () => {
      const t = $("#sec-" + l.dataset.toc);
      if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
    }));
    const secs = $$(".lesson-sec", view);
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(ents => {
        ents.forEach(e => {
          if (e.isIntersecting) {
            const id2 = e.target.dataset.sec;
            tocLinks.forEach(l => l.classList.toggle("active", l.dataset.toc === id2));
          }
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      secs.forEach(s => obs.observe(s));
      window.__obs = obs;
    }
    // défilement vers une section précise (depuis la nav déroulante)
    if (scrollSec) {
      const t = $("#sec-" + scrollSec);
      if (t) setTimeout(() => window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" }), 80);
    }
  }

  function lessonNav(m) {
    const list = NM.modules.filter(x => x.kind === m.kind);
    const i = list.indexOf(m);
    const prev = list[i - 1], next = list[i + 1];
    return `<div class="lesson-nav">
      ${prev ? `<button class="lnav-btn" onclick="location.hash='#/m/${prev.id}'"><span>← Précédent</span><b>${prev.title}</b></button>` : "<span></span>"}
      ${next ? `<button class="lnav-btn next" onclick="location.hash='#/m/${next.id}'"><span>Suivant →</span><b>${next.title}</b></button>`
             : `<button class="lnav-btn next" onclick="location.hash='#/exam'"><span>Et maintenant →</span><b>Mode Examen 🎯</b></button>`}
    </div>`;
  }

  function bindCopy(root) {
    $$(".cli-copy", root).forEach(b => b.addEventListener("click", () => {
      const pre = b.closest(".cli").querySelector("pre");
      const txt = pre.innerText;
      navigator.clipboard?.writeText(txt).then(() => { b.textContent = "Copié ✓"; setTimeout(() => b.textContent = "Copier", 1400); })
        .catch(() => toast("Copie indisponible"));
    }));
  }

  /* ===================================================================
     QUIZ ENGINE  (module quiz + exam)
     =================================================================== */
  function renderQuiz(view, id) {
    const m = NM.byId(id);
    if (!m || !m.quiz) { location.hash = "#/"; return; }
    crumb([["Accueil", ""], [m.title, "m/" + id], ["Quiz", ""]]);
    runQuiz(view, {
      title: m.title, color: m.color,
      questions: shuffle(m.quiz.slice()),
      onDone: (score, total) => {
        const pct = Math.round((score / total) * 100);
        const prev = mp(m.id).quiz;
        if (pct > prev) mp(m.id).quiz = pct;
        save();
        if (G) {
          if (pct === 100) G.award("perfect-quiz");
          const gain = pct > prev ? Math.round((pct - prev) * 0.6) + 10 : 5;
          G.addXP(gain, "Quiz — " + m.title);
        }
      },
      backHash: "#/m/" + id
    });
  }

  function runQuiz(view, cfg) {
    let i = 0, score = 0, answered = false;
    const Q = cfg.questions;
    const color = cfg.color || "bgp";
    document.documentElement.style.setProperty("--mc", `var(--r-${color})`);

    function draw() {
      answered = false;
      const q = Q[i];
      const opts = q._shuf || (q._shuf = shuffle(q.opts.map((o, k) => ({ o, correct: k === q.a }))));
      view.innerHTML = `
        <div class="quiz-wrap" style="--mc:var(--r-${color})">
          <div class="quiz-top">
            <span class="quiz-count">Question ${i + 1} / ${Q.length}</span>
            <span class="quiz-count">Score : <b style="color:var(--mc)">${score}</b></span>
          </div>
          <div class="quiz-pbar"><i style="width:${(i / Q.length) * 100}%"></i></div>
          <div class="quiz-card">
            ${q.tag ? `<span class="quiz-tag">${q.tag}</span>` : ""}
            <div class="quiz-q">${q.q}</div>
            <div class="quiz-opts">
              ${opts.map((o, k) => `<button class="opt" data-k="${k}">
                <span class="opt-key">${"ABCD"[k]}</span><span>${o.o}</span></button>`).join("")}
            </div>
            <div id="qx"></div>
            <div class="quiz-actions">
              <button class="btn btn-ghost" onclick="location.hash='${cfg.backHash}'">Quitter</button>
              <button class="btn btn-primary" id="qnext" style="--accent:var(--mc);visibility:hidden">Suivant →</button>
            </div>
          </div>
        </div>`;
      $$(".opt", view).forEach(b => b.addEventListener("click", () => pick(b, opts, q)));
      $("#qnext").addEventListener("click", advance);
    }

    function pick(btn, opts, q) {
      if (answered) return; answered = true;
      const k = +btn.dataset.k;
      const chosen = opts[k];
      $$(".opt", view).forEach((b, idx) => {
        b.classList.add("locked");
        if (opts[idx].correct) { b.classList.add("correct"); b.insertAdjacentHTML("beforeend", `<span class="opt-mark">✓</span>`); }
        else if (idx === k) { b.classList.add("wrong"); b.insertAdjacentHTML("beforeend", `<span class="opt-mark">✗</span>`); }
      });
      if (chosen.correct) score++;
      $("#qx").innerHTML = `<div class="quiz-explain ${chosen.correct ? "good" : "bad"}">
        <b>${chosen.correct ? "✅ Correct !" : "❌ Pas tout à fait."}</b> ${q.exp || ""}</div>`;
      $("#qnext").style.visibility = "visible";
      $("#qnext").textContent = i === Q.length - 1 ? "Voir le résultat →" : "Suivant →";
    }

    function advance() { if (i < Q.length - 1) { i++; draw(); window.scrollTo(0, 0); } else result(); }

    function result() {
      const pct = Math.round((score / Q.length) * 100);
      const off = 471 * (1 - pct / 100);
      const col = pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad";
      const msg = pct >= 90 ? "Excellent ! Tu es prêt 🚀" : pct >= 70 ? "Bien joué, encore un effort 💪"
        : pct >= 50 ? "Moyen — revois les sections faibles 📚" : "À retravailler sérieusement 🔁";
      cfg.onDone && cfg.onDone(score, Q.length);
      refreshNavProgress();
      view.innerHTML = `
        <div class="quiz-wrap">
          <div class="result-card" style="--mc:var(--r-${color})">
            <div class="result-ring">
              <svg viewBox="0 0 160 160"><circle class="rr-track" cx="80" cy="80" r="75"/>
                <circle class="rr-fill" cx="80" cy="80" r="75" style="stroke:var(--${col})"/></svg>
              <div class="rr-num"><b>${pct}%</b><span>${score}/${Q.length} bonnes</span></div>
            </div>
            <div class="result-msg">${msg}</div>
            <div class="result-detail">Tu as répondu correctement à <b>${score}</b> question(s) sur <b>${Q.length}</b>.</div>
            <div class="quiz-actions" style="justify-content:center;margin-top:24px">
              <button class="btn btn-ghost" onclick="location.hash='${cfg.backHash}'">← Retour</button>
              <button class="btn btn-primary" id="requiz" style="--accent:var(--r-${color})">↻ Recommencer</button>
            </div>
          </div>
        </div>`;
      requestAnimationFrame(() => { $(".rr-fill").style.strokeDashoffset = off; });
      $("#requiz").addEventListener("click", () => { i = 0; score = 0; Q.forEach(q => q._shuf = null); shuffle(Q); draw(); });
    }
    draw();
  }

  /* ===================================================================
     EXAM MODE
     =================================================================== */
  function renderExam(view, sub) {
    if (sub === "run") return; // handled in-memory
    crumb([["Accueil", ""], ["Mode Examen", ""]]);
    const pool = examPool();
    view.innerHTML = `
      <div class="exam-setup">
        <div class="exam-icon">🎯</div>
        <h1 style="margin:.1em 0">Examen blanc</h1>
        <p style="color:var(--text-2)">Questions tirées au hasard dans <b>tout le programme</b>
        (${pool.length} disponibles). Corrige-toi, identifie tes lacunes, recommence.</p>
        <div style="margin-top:26px;font-weight:650">Combien de questions ?</div>
        <div class="exam-opts" id="examOpts">
          ${[10, 20, 30].map((n, i) => `<div class="exam-opt ${i === 1 ? "sel" : ""}" data-n="${n}">
            <b>${Math.min(n, pool.length)}</b><span>questions</span></div>`).join("")}
          <div class="exam-opt" data-n="all"><b>${pool.length}</b><span>tout</span></div>
        </div>
        <button class="btn btn-primary" id="startExam" style="--accent:var(--r-bgp)">Démarrer l'examen →</button>
        <p style="color:var(--text-3);font-size:.82rem;margin-top:18px">💡 Astuce : vise 80%+ deux fois de suite avant le jour J.</p>
      </div>`;
    let n = 20;
    $$(".exam-opt", view).forEach(o => o.addEventListener("click", () => {
      $$(".exam-opt", view).forEach(x => x.classList.remove("sel")); o.classList.add("sel");
      n = o.dataset.n === "all" ? pool.length : +o.dataset.n;
    }));
    $("#startExam").addEventListener("click", () => {
      const qs = shuffle(pool.slice()).slice(0, Math.min(n, pool.length));
      history.replaceState(null, "", "#/exam/run");
      runQuiz(view, { title: "Examen", color: "cdc", questions: qs, backHash: "#/exam", onDone: (score, total) => {
        const pct = Math.round((score / total) * 100);
        if (G) { G.addXP(Math.round(pct * 0.4) + 10, "Examen blanc"); if (pct >= 80) G.award("examready"); if (pct === 100) G.award("perfect-quiz"); }
      } });
    });
  }
  function examPool() {
    let pool = [];
    NM.modules.forEach(m => (m.quiz || []).forEach(q => pool.push({ ...q, tag: q.tag || m.title })));
    if (NM.examExtra) pool = pool.concat(NM.examExtra);
    return pool;
  }

  /* ===================================================================
     FLASHCARDS
     =================================================================== */
  function renderFlash(view, deckId) {
    const decks = NM.modules.filter(m => m.flashcards && m.flashcards.length);
    if (!deckId) {
      crumb([["Accueil", ""], ["Flashcards", ""]]);
      view.innerHTML = `
        <div class="exam-setup" style="max-width:760px">
          <div class="exam-icon">🃏</div>
          <h1 style="margin:.1em 0">Flashcards</h1>
          <p style="color:var(--text-2)">Choisis un paquet. Clique la carte pour la retourner, navigue avec ← →.</p>
        </div>
        <div class="deck-grid">
          ${decks.map(m => `<div class="deck-card" data-deck="${m.id}" style="--mc:var(--r-${m.color})">
            <div class="dico">${m.icon}</div><b>${m.title}</b><span>${m.flashcards.length} cartes</span></div>`).join("")}
          <div class="deck-card" data-deck="__all" style="--mc:var(--r-bgp)">
            <div class="dico">🔀</div><b>Tout mélanger</b><span>${decks.reduce((a, m) => a + m.flashcards.length, 0)} cartes</span></div>
        </div>`;
      $$("[data-deck]", view).forEach(d => d.addEventListener("click", () => location.hash = "#/flashcards/" + d.dataset.deck));
      return;
    }
    let cards, color, title;
    if (deckId === "__all") {
      cards = []; decks.forEach(m => m.flashcards.forEach(c => cards.push({ ...c, color: m.color }))); shuffle(cards);
      color = "bgp"; title = "Toutes les cartes";
    } else {
      const m = NM.byId(deckId); if (!m) { location.hash = "#/flashcards"; return; }
      cards = m.flashcards.map(c => ({ ...c, color: m.color })); color = m.color; title = m.title;
    }
    crumb([["Accueil", ""], ["Flashcards", "flashcards"], [title, ""]]);
    let i = 0;
    document.documentElement.style.setProperty("--mc", `var(--r-${color})`);
    view.innerHTML = `
      <div class="fc-stage" style="--mc:var(--r-${cards[0].color || color})">
        <div style="text-align:center"><h2 style="margin:.2em 0">${title}</h2></div>
        <div class="flashcard" id="fcard">
          <div class="flashcard-inner">
            <div class="fc-face fc-front"><div class="fc-kic" id="fk"></div><div class="fc-q" id="fq"></div><div class="fc-hint">Clique pour révéler</div></div>
            <div class="fc-face fc-back"><div class="fc-kic">Réponse</div><div class="fc-a" id="fa"></div></div>
          </div>
        </div>
        <div class="fc-controls">
          <button class="icon-btn" id="fprev">←</button>
          <span class="fc-counter" id="fcount"></span>
          <button class="icon-btn" id="fnext">→</button>
        </div>
        <button class="btn btn-ghost" onclick="location.hash='#/flashcards'">Changer de paquet</button>
      </div>`;
    const cardEl = $("#fcard");
    function show() {
      const c = cards[i];
      cardEl.classList.remove("flipped");
      $(".fc-stage", view).style.setProperty("--mc", `var(--r-${c.color || color})`);
      setTimeout(() => { $("#fk").textContent = c.k || "Question"; $("#fq").innerHTML = c.f; $("#fa").innerHTML = c.b; }, cardEl.classList.contains("flipped") ? 250 : 0);
      $("#fcount").textContent = `${i + 1} / ${cards.length}`;
    }
    cardEl.addEventListener("click", () => cardEl.classList.toggle("flipped"));
    $("#fnext").addEventListener("click", () => { i = (i + 1) % cards.length; show(); });
    $("#fprev").addEventListener("click", () => { i = (i - 1 + cards.length) % cards.length; show(); });
    document.onkeydown = e => {
      if (!location.hash.includes("flashcards/")) { document.onkeydown = null; return; }
      if (e.key === "ArrowRight") $("#fnext").click();
      else if (e.key === "ArrowLeft") $("#fprev").click();
      else if (e.key === " ") { e.preventDefault(); cardEl.classList.toggle("flipped"); }
    };
    show();
  }

  /* ===================================================================
     CHEATSHEET
     =================================================================== */
  function renderCheat(view) {
    crumb([["Accueil", ""], ["Mémo commandes", ""]]);
    const blocks = (NM.cheatsheet || []);
    view.innerHTML = `
      <div class="mod-hero" style="--mc:var(--r-tp)">
        <div class="mh-ico">⌨️</div>
        <div><h1>Mémo commandes Cisco IOS</h1><p>Toutes les commandes des TP, prêtes à copier, classées par thème.</p></div>
      </div>
      <div class="cheat-grid">
        ${blocks.map(b => `<div class="cheat-card" style="--mc:var(--r-${b.color || "tp"})">
          <h3>${b.icon || "▹"} ${b.title}</h3><div class="cc-body">${b.html}</div></div>`).join("")}
      </div>`;
    bindCopy(view);
  }

  /* ---------------- utils ---------------- */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------------- reset ---------------- */
  $("#resetProgress").addEventListener("click", () => {
    if (confirm("Réinitialiser toute ta progression et tes scores ?")) {
      state.progress = {}; save(); refreshNavProgress(); router(); toast("Progression réinitialisée");
    }
  });

  /* ===================================================================
     BOOT
     =================================================================== */
  applyTheme();
  if (G) G.touchStreak();
  buildNav();
  examBadge();
  window.addEventListener("hashchange", router);

  setTimeout(() => {
    $("#splash").classList.add("gone");
    $("#app").classList.remove("hidden");
    applyNavCollapsed();
    router();
    refreshNavProgress();
    // recalc des carrousels (la sidebar était construite app cachée → largeur 0)
    $$(".carousel[data-carousel]").forEach(c => c._update && c._update());
    setTimeout(() => $("#splash").remove(), 700);
  }, 1700);

})();
