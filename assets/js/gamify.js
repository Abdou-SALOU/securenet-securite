/* ===================================================================
   SecureNet — Gamification (dopamine engine)
   XP global · niveaux · séries (streaks) · badges · confettis · reward pop
   Exposé via window.NMGame — utilisé par app, labs, quiz et cahiers.
   =================================================================== */
(function () {
  "use strict";

  const KEY = "sn_game_v1";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  const S = load();
  S.xp = S.xp || 0;
  S.badges = S.badges || {};         // {id: timestamp}
  S.streak = S.streak || { count: 0, last: null, best: 0 };
  S.counters = S.counters || {};     // compteurs divers (quiz parfaits, labs, cahiers…)
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

  /* ---------- niveaux : courbe douce, titres « montée en grade » ---------- */
  const TITLES = [
    "Recrue", "Novice réseau", "Apprenti sécurité", "Technicien", "Analyste",
    "Administrateur", "Ingénieur sécurité", "Architecte réseau", "Expert pare-feu",
    "Maître SecureNet", "Légende cyber"
  ];
  // XP cumulée nécessaire pour atteindre le niveau L (L commence à 1)
  function xpForLevel(L) { return Math.round(60 * (L - 1) * L / 2 * 1.15); }
  function levelInfo() {
    let L = 1;
    while (S.xp >= xpForLevel(L + 1)) L++;
    const base = xpForLevel(L), next = xpForLevel(L + 1);
    const cur = S.xp - base, need = next - base;
    return {
      level: L, cur, need, pct: Math.min(100, Math.round((cur / need) * 100)),
      title: TITLES[Math.min(L - 1, TITLES.length - 1)], total: S.xp
    };
  }

  /* ---------- badges ---------- */
  const BADGES = {
    "first-step":   { icon: "👣", name: "Premiers pas",        desc: "Première section validée" },
    "nat-master":   { icon: "🔁", name: "Maître du NAT",       desc: "Module NAT/PAT terminé" },
    "gre-tunnel":   { icon: "🛤️", name: "Tunnelier",           desc: "Module GRE terminé" },
    "acl-base":     { icon: "🚦", name: "Filtreur",            desc: "Module ACL de base terminé" },
    "acl-ctx":      { icon: "🧠", name: "Inspecteur",          desc: "Module ACL contextuelle terminé" },
    "archi":        { icon: "🏛️", name: "Architecte",          desc: "Module Architecture sécurité terminé" },
    "lab-first":    { icon: "🖥️", name: "Main sur le clavier", desc: "Premier lab CLI réussi" },
    "lab-all":      { icon: "🏆", name: "Roi du terminal",     desc: "Tous les labs CLI réussis" },
    "cdc-first":    { icon: "📋", name: "Stratège",            desc: "Premier cahier des charges complété" },
    "perfect-quiz": { icon: "💯", name: "Sans-faute",          desc: "Un quiz réussi à 100%" },
    "streak-3":     { icon: "🔥", name: "Régulier",            desc: "Série de 3 jours" },
    "streak-7":     { icon: "⚡", name: "Assidu",              desc: "Série de 7 jours" },
    "examready":    { icon: "🎖️", name: "Prêt pour l'examen",  desc: "80%+ à un examen blanc" }
  };

  /* ---------- visuels dopamine ---------- */
  let popT;
  function rewardPop(text, sub) {
    let el = document.getElementById("rewardPop");
    if (!el) { el = document.createElement("div"); el.id = "rewardPop"; el.className = "reward-pop"; document.body.appendChild(el); }
    el.innerHTML = `<div class="rp-main">${text}</div>${sub ? `<div class="rp-sub">${sub}</div>` : ""}`;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    clearTimeout(popT); popT = setTimeout(() => el.classList.remove("show"), 1500);
  }

  function confetti(opts) {
    opts = opts || {};
    const n = opts.n || 90;
    const colors = ["#10b981", "#34d399", "#fbbf24", "#f59e0b", "#06b6d4", "#22d3ee", "#ec4899", "#a78bfa", "#ef4444"];
    const wrap = document.createElement("div");
    wrap.className = "confetti-wrap";
    document.body.appendChild(wrap);
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.className = "confetti-piece";
      const left = Math.random() * 100, size = 6 + Math.random() * 8;
      const dur = 1.6 + Math.random() * 1.6, delay = Math.random() * .35;
      const rot = (Math.random() * 720 - 360) | 0;
      const drift = (Math.random() * 180 - 90) | 0;
      p.style.cssText = `left:${left}vw;width:${size}px;height:${size * .5}px;background:${colors[i % colors.length]};--rot:${rot}deg;--drift:${drift}px;animation-duration:${dur}s;animation-delay:${delay}s;border-radius:${Math.random() > .5 ? "2px" : "50%"}`;
      wrap.appendChild(p);
    }
    setTimeout(() => wrap.remove(), 3600);
  }

  function toast(msg) {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2100);
  }

  /* ---------- API ---------- */
  function addXP(amount, reason) {
    if (!amount) return;
    const before = levelInfo().level;
    S.xp += amount; save();
    rewardPop(`+${amount} XP`, reason || "");
    const after = levelInfo();
    if (after.level > before) {
      setTimeout(() => {
        confetti({ n: 120 });
        toast(`🎉 Niveau ${after.level} — ${after.title} !`);
      }, 250);
    }
    refreshHUD();
    document.dispatchEvent(new CustomEvent("nmgame:xp", { detail: { amount, reason } }));
  }

  function award(id) {
    if (!BADGES[id] || S.badges[id]) return false;
    S.badges[id] = Date.now(); save();
    const b = BADGES[id];
    setTimeout(() => { confetti({ n: 70 }); toast(`${b.icon} Badge débloqué : ${b.name}`); }, 120);
    refreshHUD();
    return true;
  }

  function bump(counter) { S.counters[counter] = (S.counters[counter] || 0) + 1; save(); return S.counters[counter]; }

  // série quotidienne : à appeler à l'ouverture / à chaque activité
  function touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (S.streak.last === today) return S.streak;
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    S.streak.count = (S.streak.last === yest) ? S.streak.count + 1 : 1;
    S.streak.last = today;
    S.streak.best = Math.max(S.streak.best || 0, S.streak.count);
    save();
    if (S.streak.count >= 3) award("streak-3");
    if (S.streak.count >= 7) award("streak-7");
    return S.streak;
  }

  /* ---------- HUD sidebar ---------- */
  function hudHTML() {
    const li = levelInfo();
    const badgeCount = Object.keys(S.badges).length;
    return `
      <div class="xp-hud-top">
        <div class="xp-ring" style="--p:${li.pct}">
          <span class="xp-lvl">${li.level}</span>
        </div>
        <div class="xp-meta">
          <div class="xp-title">${li.title}</div>
          <div class="xp-sub">${li.total} XP · 🔥 ${S.streak.count}j</div>
        </div>
      </div>
      <div class="xp-bar"><i style="width:${li.pct}%"></i></div>
      <div class="xp-foot"><span>Niv. ${li.level}</span><span>${li.cur}/${li.need} → Niv. ${li.level + 1}</span></div>
      <div class="xp-badges">${badgeCount ? Object.keys(S.badges).map(id => `<span class="xp-badge" title="${BADGES[id] ? BADGES[id].name : id}">${BADGES[id] ? BADGES[id].icon : "🏅"}</span>`).join("") : `<span class="xp-badge-empty">Débloque des badges en révisant…</span>`}</div>`;
  }
  function refreshHUD() {
    const el = document.getElementById("xpHud");
    if (el) el.innerHTML = hudHTML();
  }

  window.NMGame = {
    addXP, award, bump, touchStreak, levelInfo, refreshHUD, confetti, rewardPop, toast,
    BADGES, hudHTML,
    get state() { return S; },
    badgeList() { return Object.keys(BADGES).map(id => ({ id, ...BADGES[id], owned: !!S.badges[id] })); }
  };
})();
