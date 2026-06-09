/* ===================================================================
   NetMaster — content helpers + interactive SVG diagrams
   Loaded FIRST so data files can use window.cli / note / key ...
   =================================================================== */
(function () {
  "use strict";

  /* ---------------- module registry (shared with data files) ---------------- */
  window.NM = window.NM || {
    modules: [],
    register(m) { this.modules.push(m); return m; },
    byId(id) { return this.modules.find(x => x.id === id); }
  };

  /* ---------------- text helpers (used inside data) ---------------- */
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  function findComment(l) {
    let best = -1;
    const a = l.indexOf("//"); if (a > -1) best = a;
    const b = l.search(/\s%/);  if (b > -1 && (best < 0 || b < best)) best = b + 1;
    return best;
  }
  window.cli = function (title, text) {
    const lines = String(text).replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
    const body = lines.map(l => {
      if (l.trim() === "") return "";
      if (/^\s*!/.test(l)) return `<span class="cmt">${esc(l)}</span>`;
      let main = l, comment = "";
      const idx = findComment(l);
      if (idx > -1) { main = l.slice(0, idx); comment = l.slice(idx); }
      let html;
      const pm = main.match(/^(\s*)([A-Za-z0-9_.\-]+(?:\([^)]*\))?[#>])(\s*)(.*)$/);
      if (pm) {
        html = `${pm[1]}<span class="prompt">${esc(pm[2])}</span>${pm[3]}`;
        const wm = pm[4].match(/^(\S+)(.*)$/);
        html += wm ? `<span class="cmd">${esc(wm[1])}</span>${esc(wm[2])}` : esc(pm[4]);
      } else html = esc(main);
      if (comment) html += `<span class="cmt">${esc(comment)}</span>`;
      return html;
    }).join("\n");
    return `<div class="cli"><div class="cli-head">
      <span class="cli-dot r"></span><span class="cli-dot y"></span><span class="cli-dot g"></span>
      <span class="cli-title">${esc(title || "Cisco IOS")}</span>
      <button class="cli-copy">Copier</button></div><pre>${body}</pre></div>`;
  };

  window.note = function (type, html, label) {
    const ic = { tip: "💡", warn: "⚠️", info: "ℹ️", exam: "⭐" };
    const ti = { tip: "Astuce", warn: "Attention", info: "Bon à savoir", exam: "Tombe souvent à l'examen" };
    return `<div class="callout ${type}"><span class="cico">${ic[type] || "•"}</span>
      <div><b>${label || ti[type] || ""}</b><div>${html}</div></div></div>`;
  };

  window.key = function (title, items) {
    return `<div class="keybox"><div class="keybox-head"><span class="kb-ic">🔑</span>${title}</div>
      <ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></div>`;
  };

  window.mnemo = function (emoji, html) {
    return `<div class="mnemo"><span class="em">${emoji}</span><div>${html}</div></div>`;
  };

  window.dg = function (name) { return `<div data-diagram="${name}"></div>`; };

  /* ---------------- diagram frame + stepper helpers ---------------- */
  function frame(title, inner, toolbar, status) {
    return `<div class="figure">
      ${inner}
      ${toolbar ? `<div class="diagram-toolbar">${toolbar}</div>` : ""}
      ${status !== undefined ? `<div class="dg-status">${status}</div>` : ""}
      <div class="figure-cap"><span class="fc-ic">▣</span> ${title}</div>
    </div>`;
  }
  const btn = (id, label, cls) => `<button class="dg-btn ${cls || ""}" data-act="${id}">${label}</button>`;

  /* SVG namespace shorthand not needed — we use innerHTML strings */

  window.DIAGRAMS = {};

  /* ===================================================================
     1. VLAN SEGMENTATION — broadcast domains
     =================================================================== */
  DIAGRAMS.vlanSegment = function (el) {
    const RED = "#f59e0b", BLUE = "#3b82f6";
    el.innerHTML = frame("Un commutateur, deux domaines de diffusion isolés",
      `<svg class="dg-svg" viewBox="0 0 640 320">
        <!-- switch -->
        <rect x="220" y="135" width="200" height="50" rx="10" fill="var(--surface-2)" stroke="var(--border-2)"/>
        <text x="320" y="165" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="700">Switch</text>
        <!-- ports -->
        ${[0,1,2,3].map(i=>`<rect x="${245+i*40}" y="178" width="14" height="10" rx="2" fill="${i<2?RED:BLUE}"/>`).join("")}
        <!-- PCs -->
        ${pc(70,40,"PC1",RED,"VLAN 10")}
        ${pc(70,210,"PC2",RED,"VLAN 10")}
        ${pc(490,40,"PC3",BLUE,"VLAN 20")}
        ${pc(490,210,"PC4",BLUE,"VLAN 20")}
        <!-- links -->
        <path id="l1" d="M150 75 C 210 95, 230 130, 250 150" stroke="${RED}" stroke-width="2.5" fill="none"/>
        <path id="l2" d="M150 245 C 210 225, 230 200, 250 175" stroke="${RED}" stroke-width="2.5" fill="none"/>
        <path id="l3" d="M490 75 C 430 95, 410 130, 390 150" stroke="${BLUE}" stroke-width="2.5" fill="none"/>
        <path id="l4" d="M490 245 C 430 225, 410 200, 390 175" stroke="${BLUE}" stroke-width="2.5" fill="none"/>
        <circle id="bcast" r="9" fill="#fff" opacity="0" stroke="${RED}" stroke-width="3"/>
        <text id="bx" x="0" y="0" font-size="11" fill="var(--text)" opacity="0" text-anchor="middle" font-weight="700">B</text>
      </svg>`,
      btn("red","📢 Broadcast depuis PC1 (VLAN 10)","primary") + btn("blue","📢 Broadcast PC3 (VLAN 20)") ,
      `Chaque VLAN forme un <b>domaine de diffusion</b> séparé. Lance un broadcast pour visualiser.`);

    function pc(x,y,name,col,vlan){
      return `<g><rect x="${x}" y="${y}" width="60" height="42" rx="7" fill="var(--surface)" stroke="${col}" stroke-width="2"/>
        <rect x="${x+8}" y="${y+8}" width="44" height="20" rx="2" fill="${col}" opacity=".25"/>
        <text x="${x+30}" y="${y+22}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${name}</text>
        <text x="${x+30}" y="${y+38}" text-anchor="middle" font-size="8" fill="${col}">${vlan}</text></g>`;
    }
    const svg = el.querySelector("svg");
    const dot = svg.querySelector("#bcast"), lab = svg.querySelector("#bx");
    let busy = false;
    function flood(color, paths, reachLabel){
      if(busy) return; busy=true;
      const st = el.querySelector(".dg-status");
      dot.setAttribute("stroke", color);
      // pulse on each path of same vlan, ignore others
      let done=0;
      paths.forEach((sel,idx)=>{
        const p = svg.querySelector(sel); const len=p.getTotalLength();
        const start = idx===0; // first = source
        animatePath(p, color, ()=>{ done++; if(done===paths.length){busy=false;} });
      });
      st.innerHTML = reachLabel;
    }
    function animatePath(p,color,cb){
      const len=p.getTotalLength(); let t=0;
      const d = dot.cloneNode(); // reuse single dot per path
      svg.appendChild(d); d.setAttribute("opacity","1"); d.setAttribute("stroke",color);
      const step=()=>{ t+=0.035; const pt=p.getPointAtLength(len*t);
        d.setAttribute("cx",pt.x); d.setAttribute("cy",pt.y);
        if(t<1) requestAnimationFrame(step); else { d.setAttribute("opacity","0"); d.remove(); cb&&cb(); } };
      requestAnimationFrame(step);
    }
    el.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      if(b.dataset.act==="red") flood(RED,["#l1","#l2"],`✅ Le broadcast de PC1 atteint <b>PC2</b> (même VLAN 10). PC3 et PC4 (VLAN 20) ne le reçoivent <b>jamais</b>.`);
      else flood(BLUE,["#l3","#l4"],`✅ Le broadcast de PC3 reste dans le <b>VLAN 20</b>. Les ports VLAN 10 sont isolés.`);
    }));
  };

  /* ===================================================================
     2. 802.1Q FRAME — tag insertion
     =================================================================== */
  DIAGRAMS.dot1q = function (el) {
    el.innerHTML = frame("Insertion de l'étiquette 802.1Q (4 octets) dans la trame Ethernet",
      `<svg class="dg-svg" viewBox="0 0 660 230">
        <g id="base" font-size="11" font-weight="600">
          ${fld(20,70,80,"Préamb.","var(--surface-2)")}
          ${fld(100,70,90,"@MAC Dest","#3b82f6")}
          ${fld(190,70,90,"@MAC Src","#3b82f6")}
          <g id="tagSlot" opacity="0">
            ${fld(280,70,150,"802.1Q TAG","#f59e0b")}
          </g>
          ${fld(280,70,70,"Type","#64748b","etype")}
          ${fld(350,70,150,"Données","var(--surface-2)","data")}
          ${fld(500,70,70,"FCS","#64748b","fcs")}
        </g>
        <!-- tag breakdown -->
        <g id="tagDetail" opacity="0" font-size="9" font-weight="600">
          <line x1="280" y1="110" x2="200" y2="150" stroke="#f59e0b" stroke-dasharray="3"/>
          <line x1="430" y1="110" x2="640" y2="150" stroke="#f59e0b" stroke-dasharray="3"/>
          ${fld(180,150,120,"TPID 0x8100","#f59e0b")}
          ${fld(300,150,55,"PCP","#fbbf24")}
          ${fld(355,150,40,"CFI","#fbbf24")}
          ${fld(395,150,150,"VID (12 bits)","#f97316")}
          <text x="240" y="200" text-anchor="middle" font-size="8.5" fill="var(--text-3)">16 bits</text>
          <text x="327" y="200" text-anchor="middle" font-size="8.5" fill="var(--text-3)">3</text>
          <text x="375" y="200" text-anchor="middle" font-size="8.5" fill="var(--text-3)">1</text>
          <text x="470" y="200" text-anchor="middle" font-size="8.5" fill="var(--text-3)">1→4094</text>
        </g>
      </svg>`,
      btn("tag","➕ Étiqueter la trame (port trunk)","primary")+btn("reset","↺ Trame normale"),
      `Sur un lien <b>trunk</b>, le switch insère 4 octets entre @MAC source et le champ Type pour identifier le VLAN.`);
    function fld(x,y,w,t,c,id){
      return `<g ${id?`id="${id}"`:""}><rect x="${x}" y="${y}" width="${w}" height="34" rx="5" fill="${c.startsWith('#')?c:c}" ${c.startsWith('#')?'opacity="0.85"':''} stroke="var(--border-2)"/>
        <text x="${x+w/2}" y="${y+21}" text-anchor="middle" font-size="10" font-weight="700" fill="${c.startsWith('#')?'#fff':'var(--text)'}">${t}</text></g>`;
    }
    const svg=el.querySelector("svg");
    const shift = on=>{
      ["etype","data","fcs"].forEach(id=>{ const g=svg.querySelector("#"+id);
        g.setAttribute("transform", on?"translate(150,0)":"translate(0,0)"); g.style.transition="transform .6s cubic-bezier(.22,.61,.36,1)"; });
      svg.querySelector("#tagSlot").style.transition="opacity .5s"; svg.querySelector("#tagSlot").setAttribute("opacity",on?"1":"0");
      svg.querySelector("#tagDetail").style.transition="opacity .6s .3s"; svg.querySelector("#tagDetail").setAttribute("opacity",on?"1":"0");
    };
    el.querySelector('[data-act="tag"]').addEventListener("click",()=>shift(true));
    el.querySelector('[data-act="reset"]').addEventListener("click",()=>shift(false));
  };

  /* ===================================================================
     3. TRUNK TAGGING — access → trunk → access
     =================================================================== */
  DIAGRAMS.trunkTag = function (el) {
    el.innerHTML = frame("Cheminement d'une trame : étiquetée sur le trunk, non-étiquetée sur les ports access",
      `<svg class="dg-svg" viewBox="0 0 660 220">
        ${node(40,90,"PC A")}
        ${sw(180,80,"SW1")}
        ${sw(420,80,"SW2")}
        ${node(580,90,"PC B")}
        <line x1="100" y1="111" x2="180" y2="111" stroke="var(--text-3)" stroke-width="2"/>
        <line x1="280" y1="111" x2="420" y2="111" stroke="#8b5cf6" stroke-width="3"/>
        <line x1="520" y1="111" x2="580" y2="111" stroke="var(--text-3)" stroke-width="2"/>
        <text x="140" y="100" text-anchor="middle" font-size="9" fill="var(--text-3)">access</text>
        <text x="350" y="100" text-anchor="middle" font-size="9.5" fill="#8b5cf6" font-weight="700">TRUNK 802.1Q</text>
        <text x="550" y="100" text-anchor="middle" font-size="9" fill="var(--text-3)">access</text>
        <g id="frm" opacity="0">
          <rect x="-22" y="125" width="44" height="20" rx="4" fill="#3b82f6"/>
          <text x="0" y="139" text-anchor="middle" font-size="9" fill="#fff" font-weight="700" id="frmt">DATA</text>
        </g>
      </svg>`,
      btn("go","▶ Envoyer la trame PC A → PC B","primary"),
      `Le tag (VLAN 10) n'existe que sur le <b>trunk</b>. SW2 le retire avant de livrer à PC B.`);
    function node(x,y,n){return `<g><rect x="${x}" y="${y-22}" width="60" height="44" rx="7" fill="var(--surface)" stroke="var(--border-2)" stroke-width="2"/><text x="${x+30}" y="${y+4}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${n}</text></g>`;}
    function sw(x,y,n){return `<g><rect x="${x}" y="${y}" width="100" height="62" rx="9" fill="var(--surface-2)" stroke="var(--border-2)"/><text x="${x+50}" y="${y+37}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text)">${n}</text></g>`;}
    const svg=el.querySelector("svg"), frm=svg.querySelector("#frm"), txt=svg.querySelector("#frmt");
    const st=el.querySelector(".dg-status"); let busy=false;
    function move(x0,x1,tagged,onMid,cb){
      let t=0; const dur=900, t0=performance.now();
      txt.textContent = tagged?"VLAN10|DATA":"DATA";
      frm.querySelector("rect").setAttribute("fill", tagged?"#8b5cf6":"#3b82f6");
      frm.querySelector("rect").setAttribute("width", tagged?"66":"44");
      frm.querySelector("rect").setAttribute("x", tagged?"-33":"-22");
      txt.setAttribute("font-size", tagged?"7.5":"9");
      const step=now=>{ t=Math.min(1,(now-t0)/dur); const x=x0+(x1-x0)*t;
        frm.setAttribute("transform",`translate(${x},0)`);
        if(t<1) requestAnimationFrame(step); else cb&&cb(); };
      requestAnimationFrame(step);
    }
    el.querySelector('[data-act="go"]').addEventListener("click",()=>{
      if(busy)return; busy=true; frm.setAttribute("opacity","1");
      st.innerHTML="① PC A émet une trame <b>non étiquetée</b> vers son port access.";
      move(70,230,false,null,()=>{
        st.innerHTML="② SW1 reçoit sur un port VLAN 10 → <b>ajoute le tag</b> et l'envoie sur le trunk.";
        move(230,470,true,null,()=>{
          st.innerHTML="③ SW2 lit le tag (VID 10), <b>retire l'étiquette</b> et transmet au port access.";
          move(470,610,false,null,()=>{
            st.innerHTML="✅ PC B reçoit une trame <b>standard</b> : il ignore tout du VLAN.";
            frm.setAttribute("opacity","0"); busy=false;
          });
        });
      });
    });
  };

  /* ===================================================================
     4. DIJKSTRA / SPF — step-by-step shortest-path tree from E
     =================================================================== */
  DIAGRAMS.dijkstra = function (el) {
    const C = "#3b82f6", DONE = "#10b981", FRONT = "#f59e0b";
    const P = { E:[90,190], C:[280,190], B:[280,70], A:[110,70], G:[450,70], D:[280,310], F:[110,310], H:[470,255] };
    const E = [["E","C",1],["E","D",2],["E","F",2],["E","B",4],["E","A",10],["C","B",2],["C","A",3],["C","G",3],["C","H",4],["D","H",3],["F","A",4],["B","G",2]];
    const TREE = { C:"E", D:"E", F:"E", B:"C", A:"C", G:"C", H:"C" };
    const STEPS = [
      { n:"E", d:0, via:"—", note:"Source <b>E</b> à distance 0. On relâche ses voisins : C=1, D=2, F=2, B=4, A=10." },
      { n:"C", d:1, via:"E", note:"Plus petite distance → <b>C (1)</b>. Via C on améliore : B=3 (&lt;4), A=4 (&lt;10), G=4, H=5." },
      { n:"D", d:2, via:"E", note:"On fige <b>D (2)</b>. Via D, H=5 (égalité — on conserve via C)." },
      { n:"F", d:2, via:"E", note:"On fige <b>F (2)</b>. Via F, A=6 (&gt;4) → ignoré." },
      { n:"B", d:3, via:"C", note:"On fige <b>B (3)</b>, atteint via C. Via B, G=5 (&gt;4) → ignoré." },
      { n:"A", d:4, via:"C", note:"On fige <b>A (4) via C</b> — bien mieux que le lien direct E–A=10 !" },
      { n:"G", d:4, via:"C", note:"On fige <b>G (4)</b> via C." },
      { n:"H", d:5, via:"C", note:"On fige <b>H (5)</b> via C. ✅ Arbre du plus court chemin terminé." }
    ];
    const edgesSvg = E.map(([a,b,w],i)=>{
      const [x1,y1]=P[a],[x2,y2]=P[b];
      return `<g><line id="e${i}" class="dg-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border-2)" stroke-width="2"/>
        <circle cx="${(x1+x2)/2}" cy="${(y1+y2)/2}" r="11" fill="var(--surface)" stroke="var(--border)"/>
        <text x="${(x1+x2)/2}" y="${(y1+y2)/2+4}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-2)">${w}</text></g>`;
    }).join("");
    const nodesSvg = Object.keys(P).map(k=>{
      const [x,y]=P[k];
      return `<g><circle id="n${k}" class="dg-node" cx="${x}" cy="${y}" r="20" fill="var(--surface-2)" stroke="var(--border-2)" stroke-width="2.5"/>
        <text x="${x}" y="${y+5}" text-anchor="middle" font-size="14" font-weight="800" fill="var(--text)">${k}</text>
        <text id="d${k}" x="${x}" y="${y-28}" text-anchor="middle" font-size="11" font-weight="700" fill="${C}"></text></g>`;
    }).join("");

    el.innerHTML = frame("Algorithme SPF de Dijkstra exécuté depuis le routeur E",
      `<svg class="dg-svg" viewBox="0 0 560 360">${edgesSvg}${nodesSvg}</svg>
       <div id="dkTable" style="margin-top:6px"></div>`,
      btn("prev","← Étape")+btn("next","Étape suivante →","primary")+btn("auto","⏩ Tout exécuter")+btn("reset","↺"),
      "Clique sur <b>Étape suivante</b> pour faire avancer l'algorithme.");

    const svg = el.querySelector("svg");
    let step = -1, timer=null;
    function setNode(k,color,fill){ const c=svg.querySelector("#n"+k); c.setAttribute("stroke",color); if(fill) c.setAttribute("fill",fill); }
    function render(){
      // reset visuals
      Object.keys(P).forEach(k=>{ setNode(k,"var(--border-2)","var(--surface-2)"); svg.querySelector("#d"+k).textContent=""; });
      E.forEach((_,i)=>{ const e=svg.querySelector("#e"+i); e.setAttribute("stroke","var(--border-2)"); e.setAttribute("stroke-width","2"); });
      const rows=[];
      for(let s=0;s<=step;s++){
        const st=STEPS[s];
        setNode(st.n, DONE, "color-mix(in srgb,#10b981 22%,var(--surface))");
        svg.querySelector("#d"+st.n).textContent = st.d;
        svg.querySelector("#d"+st.n).setAttribute("fill",DONE);
        // tree edge
        if(TREE[st.n]){
          const a=st.n, b=TREE[st.n];
          const idx=E.findIndex(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
          if(idx>-1){ const e=svg.querySelector("#e"+idx); e.setAttribute("stroke",DONE); e.setAttribute("stroke-width","4"); }
        }
        rows.push(`<tr><td><b>${st.n}</b></td><td>${st.d}</td><td>${st.via}</td></tr>`);
      }
      // current node pulse
      if(step>=0) setNode(STEPS[step].n, FRONT, "color-mix(in srgb,#f59e0b 22%,var(--surface))");
      // table
      el.querySelector("#dkTable").innerHTML = step<0?"":
        `<div class="tbl-wrap" style="max-width:340px;margin:8px auto 0"><table class="ntbl"><thead><tr><th>Nœud figé</th><th>Distance</th><th>Via</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
      el.querySelector(".dg-status").innerHTML = step<0 ? "Clique sur <b>Étape suivante</b> pour démarrer."
        : (step===STEPS.length-1 ? STEPS[step].note + "<br><b style='color:#10b981'>Chemin type E→C→B / E→C→A …</b>" : STEPS[step].note);
      el.querySelector('[data-act="prev"]').disabled = step<0;
      el.querySelector('[data-act="next"]').disabled = step>=STEPS.length-1;
    }
    el.querySelector('[data-act="next"]').addEventListener("click",()=>{ if(step<STEPS.length-1){step++;render();}});
    el.querySelector('[data-act="prev"]').addEventListener("click",()=>{ if(step>=0){step--;render();}});
    el.querySelector('[data-act="reset"]').addEventListener("click",()=>{ clearInterval(timer); step=-1; render(); });
    el.querySelector('[data-act="auto"]').addEventListener("click",()=>{
      clearInterval(timer); step=-1; render();
      timer=setInterval(()=>{ if(step<STEPS.length-1){step++;render();} else clearInterval(timer); },900);
    });
    render();
  };

  /* ===================================================================
     5. OSPF MULTI-AREA — LSA propagation by area type
     =================================================================== */
  DIAGRAMS.ospfAreas = function (el) {
    const TYPES = {
      standard: { name:"Standard", lsa:[1,2,3,4,5], def:false,
        note:"Tous les LSA circulent (1,2,3,4,5). La zone peut contenir un ASBR." },
      stub: { name:"Stub", lsa:[1,2,3], def:true,
        note:"Bloque les LSA 4 & 5. Les routes externes deviennent une <b>route par défaut</b> injectée par l'ABR." },
      totally: { name:"Totally Stubby", lsa:[1,2], def:true,
        note:"Bloque les LSA 3, 4 & 5. Les autres zones ET l'externe → une seule <b>route par défaut</b>." },
      nssa: { name:"NSSA", lsa:[1,2,3,7], def:false,
        note:"Zone Stub qui contient un ASBR : l'externe entre en <b>LSA 7</b> (converti en LSA 5 par l'ABR de sortie)." }
    };
    const LCOL = { 1:"#3b82f6",2:"#3b82f6",3:"#8b5cf6",4:"#ec4899",5:"#ef4444",7:"#f59e0b" };
    el.innerHTML = frame("Filtrage des LSA selon le type de zone (Area X)",
      `<svg class="dg-svg" viewBox="0 0 660 280">
        <!-- backbone -->
        <ellipse cx="200" cy="140" rx="120" ry="95" fill="color-mix(in srgb,#3b82f6 8%,var(--surface))" stroke="#3b82f6" stroke-dasharray="5" stroke-width="1.5"/>
        <text x="200" y="55" text-anchor="middle" font-size="12" font-weight="800" fill="#3b82f6">Area 0 · Backbone</text>
        ${rt(120,140,"IR")}${rt(280,140,"ABR","#8b5cf6")}
        <!-- area X -->
        <ellipse cx="500" cy="140" rx="120" ry="95" fill="color-mix(in srgb,#10b981 8%,var(--surface))" stroke="#10b981" stroke-dasharray="5" stroke-width="1.5"/>
        <text id="axName" x="500" y="55" text-anchor="middle" font-size="12" font-weight="800" fill="#10b981">Area X · Standard</text>
        ${rt(440,140,"IR2","#10b981")}${rt(575,110,"ASBR","#ef4444")}
        <line x1="300" y1="140" x2="420" y2="140" stroke="var(--text-3)" stroke-width="2"/>
        <line x1="595" y1="128" x2="640" y2="160" stroke="#ef4444" stroke-width="2"/>
        <text x="635" y="185" text-anchor="middle" font-size="9" fill="#ef4444">RIP/BGP</text>
        <!-- packet -->
        <g id="lsap" opacity="0"><rect x="-16" y="-11" width="32" height="22" rx="5"/><text id="lsapt" text-anchor="middle" y="4" font-size="10" font-weight="800" fill="#fff"></text></g>
      </svg>
      <div id="lsaLegend" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px;font-size:.78rem"></div>`,
      Object.keys(TYPES).map(k=>btn(k,TYPES[k].name,k==="standard"?"primary":"")).join(""),
      "Choisis un type de zone pour voir quels LSA franchissent l'ABR.");
    function rt(x,y,n,c){c=c||"#3b82f6";return `<g><circle cx="${x}" cy="${y}" r="20" fill="var(--surface)" stroke="${c}" stroke-width="2.5"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">${n}</text></g>`;}
    const svg=el.querySelector("svg"), pk=svg.querySelector("#lsap"), pkt=svg.querySelector("#lsapt");
    function select(k){
      el.querySelectorAll("[data-act]").forEach(b=>b.classList.toggle("primary",b.dataset.act===k));
      const T=TYPES[k];
      svg.querySelector("#axName").textContent = "Area X · "+T.name;
      el.querySelector(".dg-status").innerHTML = T.note;
      const allow=new Set(T.lsa);
      el.querySelector("#lsaLegend").innerHTML = [1,2,3,4,5,7].map(t=>{
        const ok=allow.has(t);
        return `<span style="display:inline-flex;align-items:center;gap:5px;opacity:${ok?1:.32}">
          <span style="width:11px;height:11px;border-radius:3px;background:${LCOL[t]}"></span>LSA ${t} ${ok?"✓":"�—"}</span>`;
      }).join("") + (T.def?`<span style="color:#10b981;font-weight:700">+ route par défaut</span>`:"");
      // animate one allowed cross-ABR LSA (3 or default)
      const carry = allow.has(3)?3:(T.def?0:1);
      pkt.textContent = carry===0?"D":carry; pk.querySelector("rect").setAttribute("fill",carry===0?"#10b981":LCOL[carry]);
      let t0=performance.now();
      const step=now=>{ const t=Math.min(1,(now-t0)/1100); const x=300+(440-300)*t;
        pk.setAttribute("transform",`translate(${x},140)`); pk.setAttribute("opacity",t<1?"1":"0");
        if(t<1)requestAnimationFrame(step); };
      pk.setAttribute("opacity","1"); requestAnimationFrame(step);
    }
    el.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>select(b.dataset.act)));
    select("standard");
  };

  /* ===================================================================
     6. BGP — AS_PATH propagation & loop prevention
     =================================================================== */
  DIAGRAMS.bgpAS = function (el) {
    el.innerHTML = frame("Annonce d'un préfixe entre AS : l'AS_PATH s'allonge à chaque saut",
      `<svg class="dg-svg" viewBox="0 0 660 250">
        ${asCloud(110,120,"AS 65001","#ec4899")}
        ${asCloud(330,120,"AS 65002","#3b82f6")}
        ${asCloud(550,120,"AS 65003","#10b981")}
        <line x1="190" y1="120" x2="250" y2="120" stroke="var(--text-3)" stroke-width="2.5"/>
        <line x1="410" y1="120" x2="470" y2="120" stroke="var(--text-3)" stroke-width="2.5"/>
        <text x="220" y="110" text-anchor="middle" font-size="9" fill="var(--text-3)">eBGP</text>
        <text x="440" y="110" text-anchor="middle" font-size="9" fill="var(--text-3)">eBGP</text>
        <text x="110" y="180" text-anchor="middle" font-size="9.5" fill="#ec4899" font-weight="700">origine 200.1.0.0/24</text>
        <g id="upd" opacity="0"><rect x="-46" y="-14" width="92" height="28" rx="6" fill="var(--surface)" stroke="#f59e0b" stroke-width="2"/>
          <text id="updt" text-anchor="middle" y="4" font-size="9.5" font-weight="700" fill="var(--text)">AS_PATH</text></g>
      </svg>`,
      btn("go","▶ Annoncer le préfixe depuis AS 65001","primary")+btn("loop","🔁 Tenter une boucle vers AS 65001"),
      "BGP est un protocole <b>à vecteur de chemin</b> : l'AS_PATH sert aussi à détecter les boucles.");
    function asCloud(x,y,n,c){return `<g><ellipse cx="${x}" cy="${y}" rx="78" ry="48" fill="color-mix(in srgb,${c} 10%,var(--surface))" stroke="${c}" stroke-width="2"/><text x="${x}" y="${y+5}" text-anchor="middle" font-size="13" font-weight="800" fill="${c}">${n}</text></g>`;}
    const svg=el.querySelector("svg"), up=svg.querySelector("#upd"), upt=svg.querySelector("#updt"), st=el.querySelector(".dg-status");
    let busy=false;
    function send(x0,x1,path,cb){ up.setAttribute("opacity","1"); upt.textContent=path; let t0=performance.now();
      const step=now=>{ const t=Math.min(1,(now-t0)/1100); up.setAttribute("transform",`translate(${x0+(x1-x0)*t},120)`);
        if(t<1)requestAnimationFrame(step); else cb&&cb(); }; requestAnimationFrame(step); }
    el.querySelector('[data-act="go"]').addEventListener("click",()=>{
      if(busy)return;busy=true;
      st.innerHTML="AS 65001 annonce <b>200.1.0.0/24</b> à AS 65002 → AS_PATH = <b>65001</b>.";
      send(110,330,"AS_PATH: 65001",()=>{
        st.innerHTML="AS 65002 ré-annonce à AS 65003 en <b>préfixant son propre numéro</b> → AS_PATH = <b>65002 65001</b>.";
        send(330,550,"AS_PATH: 65002 65001",()=>{ st.innerHTML="✅ AS 65003 connaît la route. Le chemin complet est mémorisé dans l'AS_PATH."; up.setAttribute("opacity","0"); busy=false; });
      });
    });
    el.querySelector('[data-act="loop"]').addEventListener("click",()=>{
      if(busy)return;busy=true; up.querySelector("rect").setAttribute("stroke","#ef4444");
      st.innerHTML="AS 65003 renvoie la route vers AS 65001…";
      send(550,170,"AS_PATH: 65003 65002 65001",()=>{
        st.innerHTML="🛑 AS 65001 voit <b>son propre numéro</b> dans l'AS_PATH → il <b>rejette</b> la route (boucle évitée).";
        up.querySelector("rect").setAttribute("fill","color-mix(in srgb,#ef4444 18%,var(--surface))");
        setTimeout(()=>{ up.setAttribute("opacity","0"); up.querySelector("rect").setAttribute("stroke","#f59e0b"); up.querySelector("rect").setAttribute("fill","var(--surface)"); busy=false; },1400);
      });
    });
  };

  /* ===================================================================
     7. IPv6 ADDRESS COMPRESSOR — interactive
     =================================================================== */
  DIAGRAMS.ipv6compress = function (el) {
    const presets = [
      "2001:0db8:0000:0000:0000:0000:0000:0c50",
      "2001:0db8:0000:a001:0000:0000:0000:0c50",
      "2001:0db8:0000:0000:b450:0000:0000:00b4",
      "0000:0000:0000:0000:0000:0000:0000:0001",
      "2001:0db8:00f0:0000:0000:03d0:0000:00ff",
      "fe80:0000:0000:0000:0202:b3ff:fe1e:8329",
      "0000:0000:0000:0000:0000:0000:0000:0000"
    ];
    el.innerHTML = frame("Compresseur d'adresse IPv6 (exercices du cours)",
      `<div style="display:flex;flex-direction:column;gap:10px">
        <input id="ipin" value="${presets[0]}" spellcheck="false"
          style="width:100%;padding:12px 14px;border-radius:11px;border:1px solid var(--border-2);background:var(--code-bg);color:#a5d6ff;font-family:ui-monospace,monospace;font-size:.95rem"/>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${presets.map((p,i)=>`<button class="dg-btn" data-pre="${i}" style="font-size:.72rem;padding:5px 9px">Ex ${i+1}</button>`).join("")}</div>
        <div id="ipsteps"></div>
      </div>`,
      btn("go","🗜️ Compresser pas-à-pas","primary"),
      "Tape une adresse (8 groupes) ou choisis un exercice, puis lance la compression.");
    const out=el.querySelector("#ipsteps");
    function compress(addr){
      let g = addr.trim().toLowerCase().split(":");
      if(g.length!==8) return {err:"⚠️ Une adresse complète doit avoir 8 groupes séparés par « : »."};
      if(!g.every(x=>/^[0-9a-f]{1,4}$/.test(x))) return {err:"⚠️ Chaque groupe = 1 à 4 chiffres hexadécimaux."};
      const noZeros = g.map(x=>x.replace(/^0+/,"")||"0");
      // longest run of "0"
      let best={start:-1,len:0}, cur={start:-1,len:0};
      noZeros.forEach((x,i)=>{ if(x==="0"){ if(cur.start<0)cur={start:i,len:1};else cur.len++; if(cur.len>best.len)best={...cur}; } else cur={start:-1,len:0}; });
      let result;
      if(best.len>1){ const a=noZeros.slice(0,best.start), b=noZeros.slice(best.start+best.len);
        result=(a.join(":")||"")+"::"+(b.join(":")||""); if(result==="::")result="::"; }
      else result=noZeros.join(":");
      return { g, noZeros, best, result };
    }
    function run(){
      const r=compress(el.querySelector("#ipin").value);
      if(r.err){ out.innerHTML=`<div class="callout warn" style="margin:0"><span class="cico">⚠️</span><div>${r.err}</div></div>`; return; }
      const hi = r.noZeros.map((x,i)=> (r.best.len>1 && i>=r.best.start && i<r.best.start+r.best.len)
        ? `<span style="color:#10b981;font-weight:700">${x}</span>` : x).join(":");
      out.innerHTML = `
        <div class="tbl-wrap" style="margin:6px 0"><table class="ntbl"><tbody>
          <tr><td style="width:42%">① Adresse de départ</td><td><code>${r.g.join(":")}</code></td></tr>
          <tr><td>② Retirer les zéros <b>non significatifs</b> de chaque groupe</td><td><code>${r.noZeros.join(":")}</code></td></tr>
          <tr><td>③ Repérer la plus longue suite de groupes nuls</td><td><code>${hi}</code></td></tr>
          <tr><td>④ La remplacer par <code>::</code> (une seule fois)</td><td><code style="color:#10b981;font-size:1.05em;font-weight:700">${r.result}</code></td></tr>
        </tbody></table></div>`;
    }
    el.querySelector('[data-act="go"]').addEventListener("click",run);
    el.querySelectorAll("[data-pre]").forEach(b=>b.addEventListener("click",()=>{ el.querySelector("#ipin").value=presets[+b.dataset.pre]; run(); }));
    run();
  };

  /* ===================================================================
     8. IPv6 HEADER — 40 bytes, hover fields
     =================================================================== */
  DIAGRAMS.ipv6header = function (el) {
    const F=[
      ["Version","4 bits","Toujours 6","#8b5cf6"],
      ["Traffic Class","8 bits","Priorité / QoS (DiffServ)","#8b5cf6"],
      ["Flow Label","20 bits","Identifie un flux nécessitant un traitement spécial","#8b5cf6"],
      ["Payload Length","16 bits","Longueur des données + en-têtes d'extension","#3b82f6"],
      ["Next Header","8 bits","Type de l'en-tête suivant (TCP=6, UDP=17, ICMPv6=58…)","#10b981"],
      ["Hop Limit","8 bits","Remplace le TTL d'IPv4","#f59e0b"],
      ["Adresse Source","128 bits","Interface émettrice","#ec4899"],
      ["Adresse Destination","128 bits","Interface destinataire","#ec4899"]
    ];
    el.innerHTML = frame("En-tête IPv6 fixe de 40 octets — survole chaque champ",
      `<div style="display:flex;flex-wrap:wrap;gap:6px">
        ${F.map((f,i)=>`<div class="v6f" data-i="${i}" style="flex:${f[1].includes('128')?'1 1 100%':f[0]==='Flow Label'?'2 1 150px':'1 1 90px'};
          background:color-mix(in srgb,${f[3]} 14%,var(--surface));border:1px solid color-mix(in srgb,${f[3]} 40%,var(--border));
          border-radius:9px;padding:10px;cursor:pointer;transition:.15s">
          <div style="font-weight:700;font-size:.82rem">${f[0]}</div>
          <div style="font-size:.68rem;color:var(--text-3)">${f[1]}</div></div>`).join("")}
      </div>`,
      "",
      "💡 IPv6 supprime <b>Checksum</b>, <b>IHL</b>, les options et la fragmentation par les routeurs : en-tête simplifié donc routage plus rapide.");
    el.querySelectorAll(".v6f").forEach(d=>d.addEventListener("mouseenter",()=>{
      const f=F[+d.dataset.i]; el.querySelector(".dg-status").innerHTML=`<b>${f[0]}</b> (${f[1]}) — ${f[2]}`;
    }));
  };

  /* ===================================================================
     9. EUI-64 — build interface ID from MAC
     =================================================================== */
  DIAGRAMS.eui64 = function (el) {
    el.innerHTML = frame("Construction de l'ID d'interface au format EUI-64 modifié",
      `<input id="macin" value="5E:FF:56:A2:AF:15" spellcheck="false"
        style="width:100%;padding:11px 14px;border-radius:11px;border:1px solid var(--border-2);background:var(--code-bg);color:#a5d6ff;font-family:ui-monospace,monospace;font-size:.92rem"/>
       <div id="euiout" style="margin-top:10px"></div>`,
      btn("go","⚙️ Générer l'ID d'interface","primary"),
      "Saisis une adresse MAC (48 bits). Les routeurs IPv6 l'utilisent pour l'auto-configuration sans état (SLAAC).");
    const out=el.querySelector("#euiout");
    function run(){
      const m=el.querySelector("#macin").value.replace(/[^0-9a-fA-F]/g,"").toLowerCase();
      if(m.length!==12){ out.innerHTML=`<div class="callout warn" style="margin:0"><span class="cico">⚠️</span><div>Une MAC = 12 chiffres hexadécimaux (ex. 5EFF56A2AF15).</div></div>`; return; }
      const b=m.match(/.{2}/g);
      const flipped=(parseInt(b[0],16)^0x02).toString(16).padStart(2,"0");
      const id=[flipped,b[1],b[2],"ff","fe",b[3],b[4],b[5]];
      const grp=v=>v.join("").match(/.{4}/g).join(":");
      out.innerHTML=`<div class="tbl-wrap" style="margin:0"><table class="ntbl"><tbody>
        <tr><td style="width:46%">① Couper la MAC en deux</td><td><code>${b[0]}${b[1]}${b[2]}</code> | <code>${b[3]}${b[4]}${b[5]}</code></td></tr>
        <tr><td>② Insérer <code>FFFE</code> au milieu</td><td><code>${b[0]}${b[1]}${b[2]}</code> <b style="color:#10b981">fffe</b> <code>${b[3]}${b[4]}${b[5]}</code></td></tr>
        <tr><td>③ Inverser le 7ᵉ bit (U/L) du 1ᵉʳ octet</td><td><code>${b[0]}</code> → <b style="color:#f59e0b">${flipped}</b></td></tr>
        <tr><td>④ ID d'interface (64 bits)</td><td><code style="color:#10b981;font-weight:700">${grp(id)}</code></td></tr>
        <tr><td>⑤ Adresse lien-local</td><td><code style="color:#34d399;font-weight:700">fe80::${grp(id).replace(/^0+/,"")}</code></td></tr>
      </tbody></table></div>`;
    }
    el.querySelector('[data-act="go"]').addEventListener("click",run); run();
  };

  /* ===================================================================
     10. NAT / PAT — translation table
     =================================================================== */
  DIAGRAMS.natTable = function (el) {
    let port=1024; const rows=[];
    el.innerHTML = frame("NAT/PAT : translation des adresses privées vers le public",
      `<svg class="dg-svg" viewBox="0 0 660 200">
        <text x="90" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-2)">Réseau privé (RFC1918)</text>
        <text x="570" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-2)">Internet</text>
        ${host(40,50,"PC A","192.168.1.10")}
        ${host(40,120,"PC B","192.168.1.11")}
        <rect x="280" y="70" width="100" height="60" rx="11" fill="var(--surface-2)" stroke="#06b6d4" stroke-width="2"/>
        <text x="330" y="95" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">Routeur</text>
        <text x="330" y="112" text-anchor="middle" font-size="8.5" fill="#06b6d4">NAT/PAT</text>
        <text x="232" y="64" font-size="8" fill="#10b981">inside</text>
        <text x="385" y="64" font-size="8" fill="#ef4444">outside</text>
        <rect x="520" y="78" width="100" height="44" rx="8" fill="var(--surface)" stroke="var(--border-2)"/>
        <text x="570" y="105" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">Serveur</text>
        <line x1="100" y1="71" x2="280" y2="95" stroke="var(--text-3)" stroke-width="1.5"/>
        <line x1="100" y1="141" x2="280" y2="105" stroke="var(--text-3)" stroke-width="1.5"/>
        <line x1="380" y1="100" x2="520" y2="100" stroke="var(--text-3)" stroke-width="1.5"/>
        <g id="np" opacity="0"><rect x="-30" y="-11" width="60" height="22" rx="5" fill="#06b6d4"/><text id="npt" text-anchor="middle" y="4" font-size="8" font-weight="700" fill="#fff"></text></g>
      </svg>
      <div id="nattbl"></div>`,
      btn("a","▶ PC A → web (PAT)","primary")+btn("b","▶ PC B → web (PAT)")+btn("s","▶ Serveur (NAT statique)")+btn("r","↺"),
      "Le PAT distingue les flux par le <b>numéro de port</b> : plusieurs hôtes partagent une seule IP publique.");
    function host(x,y,n,ip){return `<g><rect x="${x}" y="${y}" width="60" height="42" rx="7" fill="var(--surface)" stroke="#10b981" stroke-width="1.8"/><text x="${x+30}" y="${y+19}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">${n}</text><text x="${x+30}" y="${y+33}" text-anchor="middle" font-size="7.5" fill="var(--text-3)">${ip}</text></g>`;}
    const svg=el.querySelector("svg"), np=svg.querySelector("#np"), npt=svg.querySelector("#npt"), st=el.querySelector(".dg-status");
    let busy=false;
    function fly(label,cb){ np.setAttribute("opacity","1"); npt.textContent=label; let t0=performance.now();
      const step=now=>{ const t=Math.min(1,(now-t0)/1200); const x=t<.5?70+(330-70)*(t/.5):330+(570-330)*((t-.5)/.5);
        np.setAttribute("transform",`translate(${x},100)`); if(t<1)requestAnimationFrame(step); else { np.setAttribute("opacity","0"); cb&&cb(); } };
      requestAnimationFrame(step); }
    function draw(){ el.querySelector("#nattbl").innerHTML = rows.length?
      `<div class="tbl-wrap" style="margin-top:8px"><table class="ntbl"><thead><tr><th>Inside local</th><th>Inside global</th><th>Type</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`:""; }
    function add(priv,pub,type){ rows.unshift(`<tr><td><code>${priv}</code></td><td><code>${pub}</code></td><td>${type}</td></tr>`); draw(); }
    el.querySelector('[data-act="a"]').addEventListener("click",()=>{ if(busy)return;busy=true; const p=port++; st.innerHTML="PC A sort : source <b>192.168.1.10:3001</b> → <b>212.217.1.1:"+p+"</b>";
      fly("→ :"+p,()=>{ add("192.168.1.10:3001","212.217.1.1:"+p,"PAT"); busy=false; }); });
    el.querySelector('[data-act="b"]').addEventListener("click",()=>{ if(busy)return;busy=true; const p=port++; st.innerHTML="PC B sort : même IP publique, <b>port différent</b> ("+p+")";
      fly("→ :"+p,()=>{ add("192.168.1.11:3001","212.217.1.1:"+p,"PAT"); busy=false; }); });
    el.querySelector('[data-act="s"]').addEventListener("click",()=>{ if(busy)return;busy=true; st.innerHTML="Serveur web : mappage <b>statique</b> 1-pour-1, accessible depuis Internet.";
      fly("static",()=>{ add("192.168.1.100","212.217.1.2","NAT statique"); busy=false; }); });
    el.querySelector('[data-act="r"]').addEventListener("click",()=>{ rows.length=0; port=1024; draw(); st.textContent=""; });
  };

  /* ===================================================================
     11. TUNNEL 6in4 — encapsulation across IPv4 ISP
     =================================================================== */
  DIAGRAMS.tunnel6in4 = function (el) {
    el.innerHTML = frame("Tunnel manuel IPv6-in-IPv4 : encapsulation à travers un FAI IPv4",
      `<svg class="dg-svg" viewBox="0 0 660 200">
        ${zone(20,60,"Site 1 (IPv6)","#10b981")}
        ${rtr(170,90,"R1")}
        <rect x="250" y="40" width="160" height="120" rx="12" fill="color-mix(in srgb,#3b82f6 7%,var(--surface))" stroke="#3b82f6" stroke-dasharray="5"/>
        <text x="330" y="34" text-anchor="middle" font-size="11" font-weight="800" fill="#3b82f6">FAI · IPv4 uniquement</text>
        ${rtr(450,90,"R2")}
        ${zone(540,60,"Site 2 (IPv6)","#10b981")}
        <line x1="100" y1="100" x2="170" y2="100" stroke="#10b981" stroke-width="2"/>
        <line x1="210" y1="100" x2="450" y2="100" stroke="#3b82f6" stroke-width="2"/>
        <line x1="490" y1="100" x2="540" y2="100" stroke="#10b981" stroke-width="2"/>
        <g id="pkt" opacity="0">
          <rect id="outer" x="-44" y="-15" width="40" height="30" rx="5" fill="#3b82f6" opacity="0"/>
          <rect id="inner" x="-20" y="-11" width="40" height="22" rx="4" fill="#10b981"/>
          <text id="pktt" text-anchor="middle" y="4" font-size="8" font-weight="700" fill="#fff">IPv6</text>
        </g>
      </svg>`,
      btn("go","▶ Envoyer un paquet Site 1 → Site 2","primary"),
      "R1 emballe le paquet IPv6 dans un paquet IPv4 ; R2 le déballe. Le FAI ne voit que de l'IPv4.");
    function zone(x,y,n,c){return `<g><rect x="${x}" y="${y}" width="80" height="80" rx="11" fill="color-mix(in srgb,${c} 9%,var(--surface))" stroke="${c}" stroke-width="2"/><text x="${x+40}" y="${y+45}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${c}">${n}</text></g>`;}
    function rtr(x,y,n){return `<g><circle cx="${x}" cy="${y+10}" r="22" fill="var(--surface)" stroke="#06b6d4" stroke-width="2.5"/><text x="${x}" y="${y+14}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--text)">${n}</text></g>`;}
    const svg=el.querySelector("svg"), pkt=svg.querySelector("#pkt"), outer=svg.querySelector("#outer"), pt=svg.querySelector("#pktt"), st=el.querySelector(".dg-status");
    let busy=false;
    function move(x0,x1,dur,cb){ let t0=performance.now(); const step=now=>{ const t=Math.min(1,(now-t0)/dur);
      pkt.setAttribute("transform",`translate(${x0+(x1-x0)*t},100)`); if(t<1)requestAnimationFrame(step); else cb&&cb(); }; requestAnimationFrame(step); }
    el.querySelector('[data-act="go"]').addEventListener("click",()=>{
      if(busy)return;busy=true; pkt.setAttribute("opacity","1"); outer.setAttribute("opacity","0"); pt.textContent="IPv6";
      st.innerHTML="① Site 1 envoie un paquet <b>IPv6</b> natif vers R1.";
      move(60,170,800,()=>{
        st.innerHTML="② R1 <b>encapsule</b> : il ajoute un en-tête <b>IPv4</b> (tunnel mode ipv6ip) autour du paquet IPv6.";
        outer.style.transition="opacity .4s"; outer.setAttribute("opacity",".9"); pt.textContent="IPv4⟦IPv6⟧";
        setTimeout(()=>move(170,450,1300,()=>{
          st.innerHTML="③ R2 <b>décapsule</b> : il retire l'en-tête IPv4 et récupère le paquet IPv6 d'origine.";
          outer.setAttribute("opacity","0"); pt.textContent="IPv6";
          setTimeout(()=>move(450,560,800,()=>{ st.innerHTML="✅ Site 2 reçoit un paquet <b>IPv6</b> natif. Le tunnel est transparent."; pkt.setAttribute("opacity","0"); busy=false; }),350);
        }),500);
      });
    });
  };

  /* ===================================================================
     12. ACL — descente des règles (permit/deny, deny implicite)
     =================================================================== */
  DIAGRAMS.aclDecision = function (el) {
    const RULES = [
      { t: "deny  ip host 192.168.1.21 any", act: "deny", m: p => p.src === "192.168.1.21" },
      { t: "permit tcp 192.168.1.0/24 any eq 80", act: "permit", m: p => p.proto === "tcp" && p.port === 80 && p.src.startsWith("192.168.1.") },
      { t: "permit udp 192.168.1.0/24 any eq 53", act: "permit", m: p => p.proto === "udp" && p.port === 53 && p.src.startsWith("192.168.1.") },
      { t: "permit icmp host 192.168.1.20 any echo", act: "permit", m: p => p.proto === "icmp" && p.src === "192.168.1.20" }
    ];
    const PKTS = [
      { lab: "PC .10 → web (TCP 80)", src: "192.168.1.10", proto: "tcp", port: 80 },
      { lab: "PC .21 → web (TCP 80)", src: "192.168.1.21", proto: "tcp", port: 80 },
      { lab: "PC .10 → SMTP (TCP 25)", src: "192.168.1.10", proto: "tcp", port: 25 },
      { lab: "PC .20 → ping (ICMP)", src: "192.168.1.20", proto: "icmp", port: 0 }
    ];
    el.innerHTML = frame("Une ACL est lue de haut en bas : la 1ʳᵉ règle qui correspond gagne",
      `<div class="acldg">
        <div class="acldg-rules">
          ${RULES.map((r, i) => `<div class="acldg-rule" data-r="${i}"><span class="acldg-n">${(i + 1) * 10}</span><code>${r.t}</code><span class="acldg-tag ${r.act}">${r.act}</span></div>`).join("")}
          <div class="acldg-rule implicit" data-r="x"><span class="acldg-n">—</span><code>deny ip any any (implicite)</code><span class="acldg-tag deny">deny</span></div>
        </div>
      </div>`,
      PKTS.map((p, i) => btn("p" + i, "▶ " + p.lab, i === 0 ? "primary" : "")).join(""),
      "Choisis un paquet : on descend les règles jusqu'à la première correspondance.");
    const st = el.querySelector(".dg-status");
    function reset() { el.querySelectorAll(".acldg-rule").forEach(r => r.classList.remove("hit", "miss")); }
    function runPkt(p) {
      reset();
      const rules = [...el.querySelectorAll('.acldg-rule[data-r]')].filter(r => r.dataset.r !== "x");
      let i = 0;
      function step() {
        if (i >= RULES.length) {
          const imp = el.querySelector('[data-r="x"]'); imp.classList.add("hit");
          st.innerHTML = "Aucune règle ne correspond → <b style='color:var(--bad)'>bloqué par le deny implicite</b>.";
          return;
        }
        const r = RULES[i], row = rules[i];
        if (r.m(p)) { row.classList.add("hit"); st.innerHTML = `Règle ${(i + 1) * 10} correspond → <b style="color:var(--${r.act === "permit" ? "ok" : "bad"})">${r.act.toUpperCase()}</b>. On s'arrête ici.`; }
        else { row.classList.add("miss"); i++; setTimeout(step, 480); }
      }
      step();
    }
    PKTS.forEach((p, i) => el.querySelector('[data-act="p' + i + '"]').addEventListener("click", () => runPkt(p)));
  };

  /* ===================================================================
     13. Zones de sécurité (INSIDE / DMZ / OUTSIDE)
     =================================================================== */
  DIAGRAMS.dmzZones = function (el) {
    const FLOWS = {
      a: { from: "INSIDE", to: "OUTSIDE", ok: true, txt: "INSIDE → Internet : autorisé (navigation, DNS…)." },
      b: { from: "OUTSIDE", to: "DMZ", ok: true, txt: "Internet → DMZ : autorisé vers les serveurs publics (web, mail)." },
      c: { from: "OUTSIDE", to: "INSIDE", ok: false, txt: "Internet → INSIDE : BLOQUÉ (aucune connexion entrante non sollicitée)." },
      d: { from: "DMZ", to: "INSIDE", ok: false, txt: "DMZ → INSIDE : BLOQUÉ (un serveur DMZ piraté reste cloisonné)." }
    };
    el.innerHTML = frame("Segmentation : filtrer entre zones de confiance",
      `<svg class="dg-svg" viewBox="0 0 660 240">
        <rect x="20" y="60" width="150" height="120" rx="12" fill="#10b981" fill-opacity=".12" stroke="#10b981" stroke-width="2"/>
        <text x="95" y="48" text-anchor="middle" font-size="12" font-weight="800" fill="#10b981">INSIDE</text>
        <text x="95" y="128" text-anchor="middle" font-size="10" fill="var(--text-2)">LAN interne</text>
        <rect x="300" y="20" width="60" height="200" rx="8" fill="var(--surface-2)" stroke="var(--border-2)"/>
        <text x="330" y="120" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text)" transform="rotate(-90 330 120)">PARE-FEU</text>
        <rect x="250" y="120" width="160" height="100" rx="12" fill="#f59e0b" fill-opacity=".12" stroke="#f59e0b" stroke-width="2"/>
        <text x="330" y="210" text-anchor="middle" font-size="12" font-weight="800" fill="#f59e0b">DMZ</text>
        <rect x="490" y="60" width="150" height="120" rx="12" fill="#ef4444" fill-opacity=".12" stroke="#ef4444" stroke-width="2"/>
        <text x="565" y="48" text-anchor="middle" font-size="12" font-weight="800" fill="#ef4444">OUTSIDE</text>
        <text x="565" y="128" text-anchor="middle" font-size="10" fill="var(--text-2)">Internet</text>
        <path id="fa" d="M170 100 H300" stroke="var(--text-3)" stroke-width="2" fill="none" opacity=".4" marker-end="url(#ar)"/>
        <path id="fb" d="M490 130 H360" stroke="var(--text-3)" stroke-width="2" fill="none" opacity=".4" marker-end="url(#ar)"/>
        <path id="fc" d="M490 90 H170" stroke="var(--text-3)" stroke-width="2" fill="none" opacity=".4" stroke-dasharray="5 4"/>
        <path id="fd" d="M250 160 H170 V120" stroke="var(--text-3)" stroke-width="2" fill="none" opacity=".4" stroke-dasharray="5 4"/>
        <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--text-3)"/></marker></defs>
      </svg>`,
      btn("a", "INSIDE→Internet", "primary") + btn("b", "Internet→DMZ") + btn("c", "Internet→INSIDE") + btn("d", "DMZ→INSIDE"),
      "Clique un flux pour voir s'il est autorisé ou bloqué par la politique inter-zones.");
    const st = el.querySelector(".dg-status"), svg = el.querySelector("svg");
    Object.keys(FLOWS).forEach(k => el.querySelector('[data-act="' + k + '"]').addEventListener("click", () => {
      svg.querySelectorAll("path[id^=f]").forEach(p => { p.setAttribute("opacity", ".4"); p.setAttribute("stroke", "var(--text-3)"); });
      const f = FLOWS[k], path = svg.querySelector("#f" + k);
      path.setAttribute("opacity", "1"); path.setAttribute("stroke", f.ok ? "#22c55e" : "#ef4444"); path.setAttribute("stroke-width", "3");
      st.innerHTML = (f.ok ? "✅ " : "⛔ ") + f.txt;
    }));
  };

})();
