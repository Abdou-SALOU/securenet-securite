/* ===================================================================
   SecureNet — LABS guidés (cahiers des charges du prof)
   window.SN_LABS lu par cli-sim.js. Les fonctions device()/devices()/c()/ping()
   sont appelées au runtime → elles utilisent window.SNLabHelpers (défini par cli-sim.js).
   =================================================================== */
(function () {
  "use strict";
  const H = () => window.SNLabHelpers;
  // prédicats ACL
  function acl(dev, id) { return dev.running.acls[id]; }
  function hasRule(dev, id, pred) { const a = acl(dev, id); return !!(a && a.entries.some(pred)); }
  const isAny = ad => ad && ad.ip === "0.0.0.0" && ad.wild === "255.255.255.255";
  const isHost = (ad, ip) => ad && ad.ip === ip && ad.wild === "0.0.0.0";

  window.SN_LABS = [

    /* ============ 1 · NAT DYNAMIQUE (Atelier 1) ============ */
    {
      id: "nat-dyn", title: "NAT Dynamique (pool)", icon: "🔁", color: "nat", xp: 120, badge: "nat-master",
      device: () => H().newRouter("Router", "re"),
      intro: "Atelier 1 du prof : le routeur RE traduit les adresses privées du LAN en adresses publiques tirées d'un pool. Configure inside/outside, l'ACL et le pool.",
      topo: "LAN privé 192.168.1.0/24 → Gi0/0 (inside) · WAN → Se0/0/0 212.217.7.117/30 (outside) · Pool 200.200.200.1-5",
      objectives: [
        { id: "h", t: "Renommer le routeur en <b>RE</b>", hint: "<code>hostname RE</code>", c: s => s.dev.running.hostname === "RE" },
        { id: "in", t: "<b>Gi0/0</b> : 192.168.1.1/24, activée, <b>ip nat inside</b>", hint: "<code>interface gi0/0</code> → <code>ip address 192.168.1.1 255.255.255.0</code> → <code>no shutdown</code> → <code>ip nat inside</code>", c: s => { const i = s.dev.ifaces["GigabitEthernet0/0"]; return i.ip === "192.168.1.1" && !i.shutdown && i.nat === "inside"; } },
        { id: "out", t: "<b>Se0/0/0</b> : 212.217.7.117/30, activée, <b>ip nat outside</b>", hint: "<code>interface se0/0/0</code> → <code>ip address 212.217.7.117 255.255.255.252</code> → <code>no shutdown</code> → <code>ip nat outside</code>", c: s => { const i = s.dev.ifaces["Serial0/0/0"]; return i.ip === "212.217.7.117" && !i.shutdown && i.nat === "outside"; } },
        { id: "acl", t: "<b>ACL 1</b> : autoriser le réseau privé à être traduit", hint: "<code>access-list 1 permit 192.168.1.0 0.0.0.255</code>", c: s => hasRule(s.dev, "1", e => e.action === "permit" && e.src.ip === "192.168.1.0" && e.src.wild === "0.0.0.255") },
        { id: "pool", t: "Créer le <b>pool</b> public 200.200.200.1 → 200.200.200.5", hint: "<code>ip nat pool Atelier1 200.200.200.1 200.200.200.5 netmask 255.255.255.128</code>", c: s => Object.values(s.dev.running.nat.pools).some(p => p.start === "200.200.200.1" && p.end === "200.200.200.5") },
        { id: "bind", t: "Lier l'ACL 1 au pool : <b>ip nat inside source list 1 pool …</b>", hint: "<code>ip nat inside source list 1 pool Atelier1</code>", c: s => s.dev.running.nat.dyn && s.dev.running.nat.dyn.list === "1" && s.dev.running.nat.dyn.pool && !s.dev.running.nat.dyn.overload },
        { id: "ver", t: "Vérifier avec <code>show ip nat translations</code>", hint: "<code>do show ip nat translations</code> ou en mode #", c: s => s.ran.has("show ip nat translations") }
      ]
    },

    /* ============ 2 · PAT / OVERLOAD (Atelier 2) ============ */
    {
      id: "pat", title: "PAT — partage d'une IP (overload)", icon: "🎯", color: "nat", xp: 130, badge: "nat-master",
      devices: () => { const Hh = H(); return [Hh.newRouter("Router", "r1"), Hh.makeHost({ id: "pc0", hostname: "PC0", ip: "192.168.10.10", mask: "255.255.255.0", gw: "192.168.10.1" })]; },
      intro: "Atelier 2 : plusieurs PC du LAN privé doivent partager UNE seule IP publique grâce au PAT (overload). Configure R1 puis prouve-le en pingant depuis PC0.",
      topo: "PC0 192.168.10.10 → Fa0/0 192.168.10.1 (inside) · Se0/0/0 212.217.7.1/30 (outside, IP partagée) · cible publique 212.217.26.10",
      ping: (s, src, dst) => {
        const Hh = H(), r = s.find("r1");
        if (src.type === "host") {
          const fa = r.ifaces["FastEthernet0/0"];
          if (!fa.ip || fa.shutdown || fa.nat !== "inside") return { ok: false, msg: "Configure Fa0/0 (inside) sur R1." };
          if (r.ifaces["Serial0/0/0"].nat !== "outside" || r.ifaces["Serial0/0/0"].shutdown) return { ok: false, msg: "Configure Se0/0/0 (outside) sur R1." };
          const ovl = r.running.nat.dyn && r.running.nat.dyn.overload && hasRule(r, r.running.nat.dyn.list, e => e.src.ip === "192.168.10.0");
          if (!ovl) return { ok: false, msg: "Active le PAT : ip nat inside source list 1 interface s0/0/0 overload (+ access-list 1)." };
          // crée une translation visible
          if (!r.natActive.some(t => t.il.startsWith(src.ip))) r.natActive.push({ proto: "icmp", il: src.ip + ":1", ig: r.ifaces["Serial0/0/0"].ip + ":1024", ol: dst + ":1", og: dst + ":1" });
          s.patOk = true;
          return { ok: true, msg: "Traduit en " + r.ifaces["Serial0/0/0"].ip + " (PAT par port)." };
        }
        return { ok: Hh.genericReach(src, dst) };
      },
      objectives: [
        { id: "h", t: "Renommer le routeur en <b>R1</b>", hint: "<code>hostname R1</code>", c: s => s.find("r1").running.hostname === "R1" },
        { id: "in", t: "<b>Fa0/0</b> : 192.168.10.1/24, activée, <b>ip nat inside</b>", hint: "<code>interface fa0/0</code> → <code>ip address 192.168.10.1 255.255.255.0</code> → <code>no shutdown</code> → <code>ip nat inside</code>", c: s => { const i = s.find("r1").ifaces["FastEthernet0/0"]; return i.ip === "192.168.10.1" && !i.shutdown && i.nat === "inside"; } },
        { id: "out", t: "<b>Se0/0/0</b> : 212.217.7.1/30, activée, <b>ip nat outside</b>", hint: "<code>interface se0/0/0</code> → <code>ip address 212.217.7.1 255.255.255.252</code> → <code>no shutdown</code> → <code>ip nat outside</code>", c: s => { const i = s.find("r1").ifaces["Serial0/0/0"]; return i.ip === "212.217.7.1" && !i.shutdown && i.nat === "outside"; } },
        { id: "acl", t: "<b>ACL 1</b> : permit 192.168.10.0 0.0.0.255", hint: "<code>access-list 1 permit 192.168.10.0 0.0.0.255</code>", c: s => hasRule(s.find("r1"), "1", e => e.src.ip === "192.168.10.0" && e.action === "permit") },
        { id: "pat", t: "Activer le <b>PAT</b> : …list 1 interface Se0/0/0 <b>overload</b>", hint: "<code>ip nat inside source list 1 interface s0/0/0 overload</code> — le mot-clé <b>overload</b> est indispensable", c: s => { const y = s.find("r1").running.nat.dyn; return y && y.overload && y.list === "1" && /0\/0$/.test(y.ifName || ""); } },
        { id: "ping", t: "🎯 Depuis <b>PC0</b>, ping <code>212.217.26.10</code> avec succès", hint: "Onglet <b>PC0</b> → <code>ping 212.217.26.10</code>. S'il échoue, revois inside/outside et le mot-clé overload.", c: s => !!s.patOk }
      ]
    },

    /* ============ 3 · NAT STATIQUE (Atelier 3) ============ */
    {
      id: "nat-stat", title: "NAT Statique (serveur public)", icon: "📌", color: "nat", xp: 110, badge: "nat-master",
      device: () => H().newRouter("Router", "r1"),
      intro: "Atelier 3 : rendre un serveur interne joignable depuis l'extérieur via une IP publique FIXE (mappage 1-pour-1 permanent).",
      topo: "Server0 192.168.10.20 (privé) ↔ 212.217.26.100 (public) · Fa0/0 inside · Se0/0/0 outside",
      objectives: [
        { id: "h", t: "Renommer le routeur en <b>R1</b>", hint: "<code>hostname R1</code>", c: s => s.dev.running.hostname === "R1" },
        { id: "in", t: "<b>Fa0/0</b> activée + <b>ip nat inside</b>", hint: "<code>interface fa0/0</code> → <code>ip address 192.168.10.1 255.255.255.0</code> → <code>no shutdown</code> → <code>ip nat inside</code>", c: s => { const i = s.dev.ifaces["FastEthernet0/0"]; return i.ip && !i.shutdown && i.nat === "inside"; } },
        { id: "out", t: "<b>Se0/0/0</b> activée + <b>ip nat outside</b>", hint: "<code>interface se0/0/0</code> → <code>ip address 212.217.7.1 255.255.255.252</code> → <code>no shutdown</code> → <code>ip nat outside</code>", c: s => { const i = s.dev.ifaces["Serial0/0/0"]; return i.ip && !i.shutdown && i.nat === "outside"; } },
        { id: "stat", t: "Mappage statique <b>192.168.10.20 ↔ 212.217.26.100</b>", hint: "<code>ip nat inside source static 192.168.10.20 212.217.26.100</code>", c: s => s.dev.running.nat.statics.some(m => m.local === "192.168.10.20" && m.global === "212.217.26.100") },
        { id: "ver", t: "Vérifier le mappage avec <code>show ip nat translations</code>", hint: "Le <b>Pro</b> doit être <code>---</code> (mappage permanent, sans port)", c: s => s.ran.has("show ip nat translations") }
      ]
    },

    /* ============ 4 · ACL ÉTENDUES + filtrage pare-feu (Atelier 7 / EXERCICE1) ============ */
    {
      id: "acl-ext", title: "ACL étendues — pare-feu périmètre", icon: "🚦", color: "acl", xp: 180, badge: "acl-base",
      devices: () => { const Hh = H(); return [Hh.newRouter("Router", "r1"),
        Hh.makeHost({ id: "admin", hostname: "Admin", ip: "212.217.26.2", mask: "255.255.255.0", gw: "212.217.26.1" }),
        Hh.makeHost({ id: "c1", hostname: "C1", ip: "212.217.26.3", mask: "255.255.255.0", gw: "212.217.26.1" })]; },
      intro: "Atelier 7 : politique pare-feu. SEUL Admin (212.217.26.2) peut pinger l'extérieur ; HTTP/HTTPS/DNS autorisés ; seules les RÉPONSES légitimes reviennent. Le reste : deny. Construis ACL 100 (Fa0/0 in) et ACL 150 (Se0/0/0 in), puis teste.",
      topo: "LAN intranet 212.217.26.0/24 → Fa0/0 (.1) · WAN → Se0/0/0 212.217.7.1/30 · extérieur 212.217.27.0/24",
      ping: (s, src, dst) => {
        const Hh = H(), r = s.find("r1"), fa = r.ifaces["FastEthernet0/0"];
        if (src.type === "host") {
          if (!fa.ip || fa.shutdown) return { ok: false, msg: "Configure et active Fa0/0 (212.217.26.1) sur R1." };
          const fwd = { proto: "icmp", src: src.ip, dst, dport: null, icmpType: "echo", established: false };
          const ret = { proto: "icmp", src: dst, dst: src.ip, dport: null, icmpType: "echo-reply", established: false };
          const okOut = Hh.aclAllows(r, "FastEthernet0/0", "in", fwd);
          const okRet = Hh.aclAllows(r, "Serial0/0/0", "in", ret);
          if (src.id === "admin" && okOut && okRet) s.adminOk = true;
          if (src.id === "c1" && !okOut) s.c1Blocked = true;
          if (okOut && okRet) return { ok: true, msg: "Aller permis (ACL 100) et retour permis (ACL 150)." };
          if (!okOut) return { ok: false, msg: "Bloqué à l'entrée Fa0/0 par l'ACL 100 (ce poste n'est pas autorisé)." };
          return { ok: false, msg: "Aller OK mais RETOUR bloqué sur Se0/0/0 (ACL 150 — pense à echo-reply)." };
        }
        return { ok: Hh.genericReach(src, dst) };
      },
      objectives: [
        { id: "fa", t: "<b>Fa0/0</b> = 212.217.26.1/24, activée", hint: "<code>interface fa0/0</code> → <code>ip address 212.217.26.1 255.255.255.0</code> → <code>no shutdown</code>", c: s => { const i = s.find("r1").ifaces["FastEthernet0/0"]; return i.ip === "212.217.26.1" && !i.shutdown; } },
        { id: "se", t: "<b>Se0/0/0</b> = 212.217.7.1/30, activée", hint: "<code>interface se0/0/0</code> → <code>ip address 212.217.7.1 255.255.255.252</code> → <code>no shutdown</code>", c: s => { const i = s.find("r1").ifaces["Serial0/0/0"]; return i.ip === "212.217.7.1" && !i.shutdown; } },
        { id: "a100icmp", t: "ACL 100 : <b>Admin seul</b> autorisé à pinger (permit icmp host 212.217.26.2 any echo)", hint: "<code>access-list 100 permit icmp host 212.217.26.2 any echo</code>", c: s => hasRule(s.find("r1"), "100", e => e.action === "permit" && e.proto === "icmp" && isHost(e.src, "212.217.26.2") && e.flags.echo) },
        { id: "a100web", t: "ACL 100 : autoriser <b>HTTP(80), HTTPS(443), DNS(53)</b>", hint: "<code>permit tcp any any eq 80</code> · <code>eq 443</code> · <code>permit udp any any eq 53</code>", c: s => { const r = s.find("r1"); return hasRule(r, "100", e => e.proto === "tcp" && e.op === "eq" && e.port === 80) && hasRule(r, "100", e => e.proto === "tcp" && e.op === "eq" && e.port === 443) && hasRule(r, "100", e => e.proto === "udp" && e.op === "eq" && e.port === 53); } },
        { id: "a100deny", t: "ACL 100 : <b>deny ip any any</b> explicite à la fin", hint: "<code>access-list 100 deny ip any any</code> (ferme la politique)", c: s => hasRule(s.find("r1"), "100", e => e.action === "deny" && e.proto === "ip" && isAny(e.src) && isAny(e.dst)) },
        { id: "applyfa", t: "Appliquer <b>ACL 100 en entrée</b> sur Fa0/0", hint: "<code>interface fa0/0</code> → <code>ip access-group 100 in</code>", c: s => s.find("r1").ifaces["FastEthernet0/0"].aclIn === "100" },
        { id: "a150", t: "ACL 150 (retour) : echo-reply vers Admin + réponses DNS/Web <b>established</b>", hint: "<code>permit icmp any host 212.217.26.2 echo-reply</code> · <code>permit udp any eq 53 any</code> · <code>permit tcp any eq 80 any established</code>", c: s => { const r = s.find("r1"); return hasRule(r, "150", e => e.proto === "icmp" && e.flags.echoReply && isHost(e.dst, "212.217.26.2")) && hasRule(r, "150", e => e.proto === "tcp" && e.flags.established); } },
        { id: "applyse", t: "Appliquer <b>ACL 150 en entrée</b> sur Se0/0/0", hint: "<code>interface se0/0/0</code> → <code>ip access-group 150 in</code>", c: s => s.find("r1").ifaces["Serial0/0/0"].aclIn === "150" },
        { id: "tAdmin", t: "🎯 Depuis <b>Admin</b>, ping <code>212.217.27.100</code> RÉUSSIT", hint: "Onglet <b>Admin</b> → <code>ping 212.217.27.100</code>", c: s => !!s.adminOk },
        { id: "tC1", t: "🎯 Depuis <b>C1</b>, le ping est <b>BLOQUÉ</b>", hint: "Onglet <b>C1</b> → <code>ping 212.217.27.100</code> doit échouer (deny implicite)", c: s => !!s.c1Blocked }
      ]
    },

    /* ============ 5 · TUNNEL GRE (Atelier 4) ============ */
    {
      id: "gre", title: "Tunnel GRE entre deux sites", icon: "🛤️", color: "gre", xp: 150, badge: "gre-tunnel",
      devices: () => { const Hh = H(); return [Hh.newRouter("R1", "r1"), Hh.newRouter("R2", "r2")]; },
      intro: "Atelier 4 : relier deux sites par un tunnel GRE par-dessus le WAN. Configure le réseau physique (underlay) puis l'interface Tunnel0 sur CHAQUE routeur (source, destination, mode GRE, IP du tunnel).",
      topo: "R1 Se0/0/0 212.217.7.1/30 ↔ R2 Se0/0/0 212.217.7.2/30 (underlay) · Tunnel0 : 10.0.0.1/30 ↔ 10.0.0.2/30 (overlay GRE)",
      objectives: [
        { id: "r1u", t: "R1 : <b>Se0/0/0</b> = 212.217.7.1/30, activée (underlay)", hint: "Onglet R1 : <code>interface se0/0/0</code> → <code>ip address 212.217.7.1 255.255.255.252</code> → <code>no shutdown</code>", c: s => { const i = s.find("r1").ifaces["Serial0/0/0"]; return i.ip === "212.217.7.1" && !i.shutdown; } },
        { id: "r1t", t: "R1 : <b>Tunnel0</b> source Se0/0/0, destination 212.217.7.2, IP 10.0.0.1/30", hint: "<code>interface tunnel 0</code> → <code>ip address 10.0.0.1 255.255.255.252</code> → <code>tunnel source 212.217.7.1</code> → <code>tunnel destination 212.217.7.2</code> → <code>tunnel mode gre ip</code>", c: s => { const t = s.find("r1").ifaces["Tunnel0"]; return t && t.ip === "10.0.0.1" && t.tun && t.tun.dst === "212.217.7.2" && (t.tun.src === "212.217.7.1" || t.tun.src === "Serial0/0/0"); } },
        { id: "r2u", t: "R2 : <b>Se0/0/0</b> = 212.217.7.2/30, activée", hint: "Onglet R2 : <code>interface se0/0/0</code> → <code>ip address 212.217.7.2 255.255.255.252</code> → <code>no shutdown</code>", c: s => { const i = s.find("r2").ifaces["Serial0/0/0"]; return i.ip === "212.217.7.2" && !i.shutdown; } },
        { id: "r2t", t: "R2 : <b>Tunnel0</b> source Se0/0/0, destination 212.217.7.1, IP 10.0.0.2/30", hint: "<code>interface tunnel 0</code> → <code>ip address 10.0.0.2 255.255.255.252</code> → <code>tunnel source 212.217.7.2</code> → <code>tunnel destination 212.217.7.1</code> → <code>tunnel mode gre ip</code>", c: s => { const t = s.find("r2").ifaces["Tunnel0"]; return t && t.ip === "10.0.0.2" && t.tun && t.tun.dst === "212.217.7.1" && (t.tun.src === "212.217.7.2" || t.tun.src === "Serial0/0/0"); } },
        { id: "ver", t: "Vérifier la config tunnel avec <code>show running-config</code> sur R1", hint: "<code>show running-config</code> doit montrer tunnel source/destination + mode gre ip", c: s => s.ran.has("show running-config") }
      ]
    },

    /* ============ 6 · CBAC — ACL contextuelle (Atelier 9) ============ */
    {
      id: "cbac", title: "CBAC — ACL contextuelle (ip inspect)", icon: "🧠", color: "ctx", xp: 170, badge: "acl-ctx",
      device: () => H().newRouter("Router", "r0"),
      intro: "Atelier 9 : au lieu d'écrire à la main les ACL de retour (established), CBAC inspecte les sessions sortantes et ouvre dynamiquement le retour. Crée un jeu d'inspection et applique-le, plus une ACL stricte côté extérieur.",
      topo: "INSIDE → Fa0/1 · OUTSIDE → Se0/0/0 · Le retour des sessions HTTP/HTTPS/DNS/ICMP initiées de l'intérieur est ouvert automatiquement par CBAC.",
      objectives: [
        { id: "h", t: "Renommer le routeur en <b>R0</b>", hint: "<code>hostname R0</code>", c: s => s.dev.running.hostname === "R0" },
        { id: "inspect", t: "Jeu d'inspection <b>INSIDE_INSPECT</b> pour HTTP, HTTPS, DNS, ICMP", hint: "<code>ip inspect name INSIDE_INSPECT http</code> (puis https, dns, icmp)", c: s => { const set = s.dev.running.inspects["INSIDE_INSPECT"]; return set && ["http", "https", "dns", "icmp"].every(p => set.includes(p)); } },
        { id: "aclout", t: "ACL extérieure <b>ACL_OUTSIDE_IN</b> qui se termine par <b>deny ip any any</b>", hint: "<code>ip access-list extended ACL_OUTSIDE_IN</code> → … → <code>deny ip any any</code>", c: s => hasRule(s.dev, "ACL_OUTSIDE_IN", e => e.action === "deny" && e.proto === "ip" && isAny(e.src) && isAny(e.dst)) },
        { id: "applyacl", t: "Appliquer <b>ACL_OUTSIDE_IN en entrée</b> sur Se0/0/0", hint: "<code>interface se0/0/0</code> → <code>ip access-group ACL_OUTSIDE_IN in</code>", c: s => s.dev.ifaces["Serial0/0/0"] && s.dev.ifaces["Serial0/0/0"].aclIn === "ACL_OUTSIDE_IN" },
        { id: "applyinspect", t: "Appliquer l'inspection <b>INSIDE_INSPECT en entrée</b> sur Fa0/1", hint: "<code>interface fa0/1</code> → <code>ip inspect INSIDE_INSPECT in</code>", c: s => s.dev.ifaces["FastEthernet0/1"] && s.dev.ifaces["FastEthernet0/1"].inspectIn === "INSIDE_INSPECT" },
        { id: "ver", t: "Vérifier avec <code>show ip inspect name INSIDE_INSPECT</code> (ou show ip inspect)", hint: "<code>do show ip inspect</code>", c: s => s.ran.has("show ip inspect") }
      ]
    }

  ];

  /* ---- Corrigés (config complète) attachés à chaque lab ---- */
  const C = window.cli || ((t, x) => "<pre>" + x + "</pre>");
  const SOL = {
    "nat-dyn":
`hostname RE
interface gi0/0
 ip address 192.168.1.1 255.255.255.0
 ip nat inside
 no shutdown
interface s0/0/0
 ip address 212.217.7.117 255.255.255.252
 ip nat outside
 no shutdown
access-list 1 permit 192.168.1.0 0.0.0.255
ip nat pool Atelier1 200.200.200.1 200.200.200.5 netmask 255.255.255.128
ip nat inside source list 1 pool Atelier1`,
    "pat":
`hostname R1
interface fa0/0
 ip address 192.168.10.1 255.255.255.0
 ip nat inside
 no shutdown
interface s0/0/0
 ip address 212.217.7.1 255.255.255.252
 ip nat outside
 no shutdown
access-list 1 permit 192.168.10.0 0.0.0.255
ip nat inside source list 1 interface s0/0/0 overload`,
    "nat-stat":
`hostname R1
interface fa0/0
 ip address 192.168.10.1 255.255.255.0
 ip nat inside
 no shutdown
interface s0/0/0
 ip address 212.217.7.1 255.255.255.252
 ip nat outside
 no shutdown
ip nat inside source static 192.168.10.20 212.217.26.100`,
    "acl-ext":
`hostname R1
access-list 100 permit icmp host 212.217.26.2 any echo
access-list 100 permit tcp any any eq 80
access-list 100 permit tcp any any eq 443
access-list 100 permit udp any any eq 53
access-list 100 deny ip any any
ip access-list extended 150
 permit icmp any host 212.217.26.2 echo-reply
 permit udp any eq 53 any
 permit tcp any eq 80 any established
 permit tcp any eq 443 any established
 deny ip any any
interface fa0/0
 ip address 212.217.26.1 255.255.255.0
 no shutdown
 ip access-group 100 in
interface s0/0/0
 ip address 212.217.7.1 255.255.255.252
 no shutdown
 ip access-group 150 in`,
    "gre":
`! ===== R1 =====
hostname R1
interface s0/0/0
 ip address 212.217.7.1 255.255.255.252
 no shutdown
interface tunnel 0
 ip address 10.0.0.1 255.255.255.252
 tunnel source 212.217.7.1
 tunnel destination 212.217.7.2
 tunnel mode gre ip
! ===== R2 =====
hostname R2
interface s0/0/0
 ip address 212.217.7.2 255.255.255.252
 no shutdown
interface tunnel 0
 ip address 10.0.0.2 255.255.255.252
 tunnel source 212.217.7.2
 tunnel destination 212.217.7.1
 tunnel mode gre ip`,
    "cbac":
`hostname R0
ip inspect name INSIDE_INSPECT http
ip inspect name INSIDE_INSPECT https
ip inspect name INSIDE_INSPECT dns
ip inspect name INSIDE_INSPECT icmp
ip access-list extended ACL_OUTSIDE_IN
 deny ip any any
interface fa0/1
 ip inspect INSIDE_INSPECT in
interface s0/0/0
 ip access-group ACL_OUTSIDE_IN in`
  };
  window.SN_LABS.forEach(l => { if (SOL[l.id]) l.solution = C(l.title + " — corrigé complet", SOL[l.id]); });
})();
