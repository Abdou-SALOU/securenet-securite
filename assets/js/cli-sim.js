/* ===================================================================
   SecureNet Lab — Simulateur CLI Cisco IOS orienté SÉCURITÉ
   Modèle device (routeur/switch/hôte) + modes + parser (abréviations)
   + ACL standard/étendues nommées ou numérotées AVEC évaluateur de paquets
   + NAT statique / dynamique (pool) / PAT (overload) + GRE + CBAC (ip inspect)
   + routes statiques + labs guidés (cahiers des charges du prof) validés.
   Expose window.NMLab { render(view, sub), LABS }.
   =================================================================== */
(function () {
  "use strict";

  /* ---------------- gamification ---------------- */
  const G = window.NMGame;
  const LKEY = "sn_lab_v1";
  function loadL() { try { return JSON.parse(localStorage.getItem(LKEY)) || { done: {} }; } catch { return { done: {} }; } }
  function saveL(s) { localStorage.setItem(LKEY, JSON.stringify(s)); }
  const LS = loadL();

  /* ---------------- utils ---------------- */
  const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const kw = (tok, full, min) => { tok = (tok || "").toLowerCase(); return tok.length >= min && full.startsWith(tok); };
  function isIp(x) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(x) && x.split(".").every(o => +o >= 0 && +o <= 255); }
  const PORTS = { www: 80, http: 80, https: 443, domain: 53, dns: 53, ftp: 21, "ftp-data": 20, telnet: 23, smtp: 25, pop3: 110, ssh: 22, ntp: 123, snmp: 161, bootps: 67, bootpc: 68 };
  function portNum(t) { if (t == null) return null; if (/^\d+$/.test(t)) return +t; return PORTS[String(t).toLowerCase()] != null ? PORTS[String(t).toLowerCase()] : null; }
  function portName(n) { for (const k of ["www", "https", "domain", "ftp", "telnet", "smtp"]) if (PORTS[k] === n) return k; return String(n); }

  /* ---------------- normalisation interfaces ---------------- */
  function normIf(tok) {
    if (!tok) return null;
    const m = tok.match(/^([a-zA-Z]+)\s*([0-9](?:\/[0-9]+)*(?:\.[0-9]+)?)$/);
    if (!m) return null;
    const p = m[1].toLowerCase(), num = m[2];
    let base = null;
    if ("fastethernet".startsWith(p)) base = "FastEthernet";
    else if ("gigabitethernet".startsWith(p)) base = "GigabitEthernet";
    else if ("serial".startsWith(p)) base = "Serial";
    else if ("tunnel".startsWith(p)) base = "Tunnel";
    else if ("ethernet".startsWith(p)) base = "Ethernet";
    else if ("loopback".startsWith(p)) base = "Loopback";
    else if ("vlan".startsWith(p)) base = "Vlan";
    else return null;
    return base + num;
  }
  function shortIf(n) {
    return n.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")
      .replace("Serial", "Se").replace("Tunnel", "Tu").replace("Ethernet", "Et")
      .replace("Loopback", "Lo").replace("Vlan", "Vl");
  }

  /* ---------------- réseau utils ---------------- */
  function maskToCidr(m) { return (m || "").split(".").map(o => (+o).toString(2).replace(/0+$/, "")).join("").length || 0; }
  function networkOf(ip, mask) {
    const i = ip.split(".").map(Number), m = mask.split(".").map(Number);
    return i.map((o, k) => o & m[k]).join(".");
  }
  function wildMatch(ip, base, wild) {
    if (base === "0.0.0.0" && wild === "255.255.255.255") return true;
    if (!isIp(ip) || !isIp(base) || !isIp(wild)) return false;
    const a = ip.split(".").map(Number), b = base.split(".").map(Number), w = wild.split(".").map(Number);
    for (let i = 0; i < 4; i++) { const mk = 255 - (w[i] & 255); if ((a[i] & mk) !== (b[i] & mk)) return false; }
    return true;
  }

  /* ---------------- création device ---------------- */
  function mkIface(name, routed) {
    return {
      name, shutdown: routed ? true : false,
      ip: null, mask: null, ipv6: [], desc: null, encap: null,
      switchport: routed ? null : { mode: "access", accessVlan: 1, trunkEncap: null, trunkAllowed: "all" },
      nat: null, aclIn: null, aclOut: null, inspectIn: null, inspectOut: null, tun: null
    };
  }
  function makeDevice(spec) {
    const d = {
      id: spec.id || spec.hostname, type: spec.type, hostname: spec.hostname, mode: "user", enabled: false, ctx: {},
      running: {
        hostname: spec.hostname, vlans: { 1: { name: "default" } }, ipRouting: spec.type === "router", ospf: null,
        acls: {}, nat: { pools: {}, dyn: null, statics: [] }, inspects: {}, staticRoutes: [], dhcp: {}, dhcpExcl: []
      },
      ifaces: {}, order: [], natActive: []
    };
    (spec.ifaces || []).forEach(n => { d.ifaces[n] = mkIface(n, spec.type === "router"); d.order.push(n); });
    return d;
  }
  function makeHost(spec) {
    return { id: spec.id, type: "host", hostname: spec.hostname, mode: "user", ip: spec.ip, mask: spec.mask, gw: spec.gw, vlan: spec.vlan, port: spec.port, role: spec.role || "pc" };
  }
  const SWITCH_IF = (() => { const a = []; for (let i = 1; i <= 24; i++) a.push("FastEthernet0/" + i); a.push("GigabitEthernet0/1", "GigabitEthernet0/2"); return a; })();
  const ROUTER_IF = ["GigabitEthernet0/0", "GigabitEthernet0/1", "FastEthernet0/0", "FastEthernet0/1", "Serial0/0/0", "Serial0/0/1"];
  function newSwitch(h, id) { return makeDevice({ type: "switch", hostname: h, id: id, ifaces: SWITCH_IF }); }
  function newRouter(h, id) { return makeDevice({ type: "router", hostname: h, id: id, ifaces: ROUTER_IF }); }

  /* ---------------- prompt ---------------- */
  function prompt(d) {
    const h = d.hostname;
    return ({
      user: h + ">", enable: h + "#", config: h + "(config)#", if: h + "(config-if)#",
      subif: h + "(config-subif)#", range: h + "(config-if-range)#", vlan: h + "(config-vlan)#",
      router: h + "(config-router)#", line: h + "(config-line)#",
      stdnacl: h + "(config-std-nacl)#", extnacl: h + "(config-ext-nacl)#", dhcp: h + "(dhcp-config)#"
    })[d.mode] || h + ">";
  }

  /* ===================================================================
     ACL : parsing → règle structurée + évaluateur de paquets
     =================================================================== */
  function parseAddr(toks, i) {
    const t = (toks[i] || "").toLowerCase();
    if (t === "any") return { addr: { ip: "0.0.0.0", wild: "255.255.255.255" }, i: i + 1 };
    if (t === "host") return { addr: { ip: toks[i + 1], wild: "0.0.0.0" }, i: i + 2 };
    if (isIp(toks[i])) {
      if (isIp(toks[i + 1])) return { addr: { ip: toks[i], wild: toks[i + 1] }, i: i + 2 };
      return { addr: { ip: toks[i], wild: "0.0.0.0" }, i: i + 1 };
    }
    return { addr: null, i: i + 1 };
  }
  function parseAclRule(toks, kind) {
    let i = 0;
    const action = (toks[i] || "").toLowerCase();
    if (action !== "permit" && action !== "deny") return null;
    i++;
    const rule = { raw: toks.join(" "), action, proto: "ip", src: null, dst: null, op: null, port: null, port2: null, flags: {} };
    if (kind === "standard") {
      const r = parseAddr(toks, i); rule.src = r.addr; rule.dst = { ip: "0.0.0.0", wild: "255.255.255.255" };
      return rule.src ? rule : null;
    }
    rule.proto = (toks[i] || "ip").toLowerCase(); i++;
    let r = parseAddr(toks, i); rule.src = r.addr; i = r.i;
    if (["eq", "gt", "lt", "neq", "range"].includes((toks[i] || "").toLowerCase())) {
      rule.sop = toks[i].toLowerCase(); i += (rule.sop === "range" ? 3 : 2);
    }
    r = parseAddr(toks, i); rule.dst = r.addr; i = r.i;
    if (["eq", "gt", "lt", "neq", "range"].includes((toks[i] || "").toLowerCase())) {
      rule.op = toks[i].toLowerCase(); rule.port = portNum(toks[i + 1]);
      if (rule.op === "range") { rule.port2 = portNum(toks[i + 2]); i += 3; } else i += 2;
    }
    for (; i < toks.length; i++) {
      const f = toks[i].toLowerCase();
      if (f === "established") rule.flags.established = true;
      else if (f === "echo") rule.flags.echo = true;
      else if (f === "echo-reply") rule.flags.echoReply = true;
      else if (f === "log") rule.flags.log = true;
    }
    return rule.src && rule.dst ? rule : null;
  }
  function aclEval(acl, pkt) {
    if (!acl || !acl.entries.length) return "permit";
    for (const r of acl.entries) { const a = matchRule(r, pkt); if (a) return a; }
    return "deny";
  }
  function matchRule(r, pkt) {
    if (r.proto !== "ip" && r.proto !== pkt.proto) return null;
    if (!wildMatch(pkt.src, r.src.ip, r.src.wild)) return null;
    if (r.dst && !wildMatch(pkt.dst, r.dst.ip, r.dst.wild)) return null;
    if (r.op && r.port != null && pkt.dport != null) {
      const p = pkt.dport;
      const ok = r.op === "eq" ? p === r.port : r.op === "gt" ? p > r.port : r.op === "lt" ? p < r.port :
        r.op === "neq" ? p !== r.port : r.op === "range" ? (p >= r.port && p <= r.port2) : true;
      if (!ok) return null;
    }
    if (r.flags.established && !pkt.established) return null;
    if (r.flags.echo && pkt.icmpType && pkt.icmpType !== "echo") return null;
    if (r.flags.echoReply && pkt.icmpType !== "echo-reply") return null;
    return r.action;
  }

  /* ===================================================================
     PARSER
     =================================================================== */
  function processLine(s, raw) {
    const d = s.dev, out = [];
    const say = (t, c) => out.push({ t, c: c || "out" });
    const inval = () => say("% Invalid input detected at '^' marker.", "err");
    const incomplete = () => say("% Incomplete command.", "err");
    const line = raw.replace(/\s+$/, "");
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return out;

    if (d.type === "host") {
      const h0 = (parts[0] || "").toLowerCase();
      if (parts[parts.length - 1] === "?") { say("Commandes : ping <ip>, ipconfig", "cmt"); return out; }
      if (kw(h0, "ping", 2)) { doPing(s, parts, say); return out; }
      if (h0 === "ipconfig" || kw(h0, "show", 2)) {
        say(`Configuration IP de ${d.hostname}`, "out");
        say(`   Adresse IPv4. . . . . . : ${d.ip}`, "out");
        say(`   Masque de sous-réseau . : ${d.mask}`, "out");
        say(`   Passerelle par défaut . : ${d.gw}`, "out");
        return out;
      }
      say("'" + parts[0] + "' inconnu. Essaie : ping <ip>, ipconfig", "err"); return out;
    }

    if (parts[parts.length - 1] === "?") { helpFor(d, parts, say); return out; }
    const cfgModes = ["config", "if", "subif", "range", "vlan", "router", "line", "stdnacl", "extnacl", "dhcp"];
    const a = parts.map(x => x.toLowerCase());

    if (kw(a[0], "do", 2) && parts.length > 1) {
      const saved = d.mode, savedCtx = d.ctx; d.mode = "enable";
      const r = processLine(s, parts.slice(1).join(" "));
      d.mode = saved; d.ctx = savedCtx; return r;
    }
    if (kw(a[0], "exit", 2)) { exitMode(d); return out; }
    if (kw(a[0], "end", 3) && cfgModes.includes(d.mode)) { d.mode = "enable"; d.ctx = {}; return out; }

    // Bascule directe de contexte (IOS) — UNIQUEMENT pour des commandes sans ambiguïté.
    // ⚠️ On EXCLUT "ip nat", "ip inspect", "ip access-group" : ce sont des commandes
    // d'INTERFACE valides (ip nat inside / ip inspect NOM in / ip access-group N in).
    // Note : kw(a[1],"access-list",3) ne matche pas "access-group" (préfixes différents).
    if (["if", "subif", "range", "vlan", "router", "line", "stdnacl", "extnacl", "dhcp"].includes(d.mode) &&
      (kw(a[0], "interface", 3) || kw(a[0], "hostname", 4) || kw(a[0], "router", 4) || kw(a[0], "line", 3) ||
        (kw(a[0], "ip", 2) && kw(a[1] || "", "access-list", 3)) ||
        kw(a[0], "access-list", 6))) {
      d.mode = "config"; d.ctx = {};
      return cfgGlobal(s, parts, a, out, say, inval, incomplete);
    }

    if (d.mode === "user") {
      if (kw(a[0], "enable", 2)) { d.mode = "enable"; d.enabled = true; return out; }
      if (kw(a[0], "show", 2)) return doShow(s, parts, out, say) || out;
      if (kw(a[0], "ping", 2)) return doPing(s, parts, say) || out;
      if (kw(a[0], "disable", 4)) return out;
      inval(); return out;
    }
    if (d.mode === "enable") {
      if (kw(a[0], "configure", 4)) { d.mode = "config"; if (!a[1]) say("Enter configuration commands, one per line.  End with CNTL/Z.", "cmt"); return out; }
      if (kw(a[0], "disable", 4)) { d.mode = "user"; return out; }
      if (kw(a[0], "show", 2)) return doShow(s, parts, out, say) || out;
      if (kw(a[0], "ping", 2)) return doPing(s, parts, say) || out;
      if (kw(a[0], "debug", 3)) { say(parts.slice(1).join(" ") + " debugging is on", "cmt"); return out; }
      if (kw(a[0], "clear", 3)) { if (kw(a[1] || "", "ip", 2) && kw(a[2] || "", "nat", 3)) d.natActive = []; return out; }
      if (kw(a[0], "write", 2) || kw(a[0], "copy", 2)) { say("Building configuration...", "cmt"); say("[OK]", "ok"); return out; }
      if (kw(a[0], "reload", 4)) { say("(reload simulé — ignoré)", "cmt"); return out; }
      inval(); return out;
    }
    if (d.mode === "config") return cfgGlobal(s, parts, a, out, say, inval, incomplete);
    if (d.mode === "if" || d.mode === "subif" || d.mode === "range") return cfgIface(s, parts, a, out, say, inval, incomplete);
    if (d.mode === "vlan") {
      if (kw(a[0], "name", 2) && parts[1]) { d.running.vlans[d.ctx.vlan].name = parts[1]; return out; }
      if (a[0] === "no") return out; inval(); return out;
    }
    if (d.mode === "router") {
      if (kw(a[0], "network", 3)) { if (d.running.ospf) d.running.ospf.networks.push(parts.slice(1).join(" ")); return out; }
      if (a[0] === "no" || kw(a[0], "passive-interface", 4) || kw(a[0], "router-id", 6) || kw(a[0], "default-information", 7)) return out;
      inval(); return out;
    }
    if (d.mode === "line") {
      if (kw(a[0], "password", 4) || kw(a[0], "login", 3) || kw(a[0], "transport", 3) || kw(a[0], "exec-timeout", 4) || kw(a[0], "logging", 4) || a[0] === "no") return out;
      inval(); return out;
    }
    if (d.mode === "stdnacl" || d.mode === "extnacl") return cfgNacl(s, parts, a, out, say, inval, incomplete);
    if (d.mode === "dhcp") {
      const pool = d.running.dhcp[d.ctx.dhcp];
      if (kw(a[0], "network", 3)) { pool.network = parts[1]; pool.mask = parts[2]; return out; }
      if (kw(a[0], "default-router", 7)) { pool.gw = parts[1]; return out; }
      if (kw(a[0], "dns-server", 3)) { pool.dns = parts.slice(1).join(" "); return out; }
      if (kw(a[0], "domain-name", 6)) { pool.domain = parts[1]; return out; }
      if (a[0] === "no") return out; inval(); return out;
    }
    inval(); return out;
  }

  function exitMode(d) {
    if (["if", "subif", "range", "vlan", "router", "line", "stdnacl", "extnacl", "dhcp"].includes(d.mode)) { d.mode = "config"; d.ctx = {}; }
    else if (d.mode === "config") d.mode = "enable";
    else if (d.mode === "enable") d.mode = "user";
    else d.mode = "user";
  }

  /* ---------------- GLOBAL CONFIG ---------------- */
  function cfgGlobal(s, parts, a, out, say, inval, incomplete) {
    const d = s.dev;
    if (kw(a[0], "hostname", 4)) { if (!parts[1]) return incomplete(), out; d.hostname = parts[1]; d.running.hostname = parts[1]; return out; }
    if (a[0] === "no" && kw(a[1] || "", "ip", 2) && kw(a[2] || "", "domain-lookup", 6)) return out;
    if (kw(a[0], "vlan", 4) && /^\d+$/.test(parts[1] || "")) {
      const id = parseInt(parts[1], 10);
      if (!id || id < 1 || id > 4094) return say("% Invalid VLAN id.", "err"), out;
      if (!d.running.vlans[id]) d.running.vlans[id] = { name: "VLAN" + String(id).padStart(4, "0") };
      d.mode = "vlan"; d.ctx = { vlan: id }; return out;
    }
    if (kw(a[0], "interface", 3)) {
      if (kw(a[1] || "", "range", 3)) {
        const list = parseRange(parts.slice(2).join(" "), d);
        if (!list.length) return say("% Invalid interface range.", "err"), out;
        d.mode = "range"; d.ctx = { range: list }; return out;
      }
      const nm = normIf(parts.slice(1).join(""));
      if (!nm) return say("% Invalid interface.", "err"), out;
      if (!d.ifaces[nm]) {
        if (nm.includes(".")) {
          const parent = nm.split(".")[0];
          if (!d.ifaces[parent]) return say("% Interface parente inexistante.", "err"), out;
          d.ifaces[nm] = mkIface(nm, true); d.order.push(nm);
        } else if (/^Loopback/.test(nm) || /^Vlan/.test(nm) || /^Tunnel/.test(nm)) {
          d.ifaces[nm] = mkIface(nm, true); if (/^Vlan|^Tunnel/.test(nm)) d.ifaces[nm].switchport = null;
          if (/^Tunnel/.test(nm)) { d.ifaces[nm].shutdown = false; d.ifaces[nm].tun = { src: null, dst: null, mode: "gre" }; }
          d.order.push(nm);
        } else return say("% Interface inexistante sur ce matériel.", "err"), out;
      }
      d.mode = nm.includes(".") ? "subif" : "if"; d.ctx = { iface: nm }; return out;
    }
    if (kw(a[0], "access-list", 6)) {
      const num = parseInt(parts[1], 10);
      if (!num) return incomplete(), out;
      const kind = (num >= 100 && num <= 199) || (num >= 2000 && num <= 2699) ? "extended" : "standard";
      const acl = d.running.acls[parts[1]] = d.running.acls[parts[1]] || { id: parts[1], kind, entries: [] };
      const rule = parseAclRule(parts.slice(2), kind);
      if (!rule) return inval(), out;
      acl.entries.push(rule); return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "access-list", 3)) {
      const kind = kw(a[2] || "", "extended", 3) ? "extended" : kw(a[2] || "", "standard", 3) ? "standard" : null;
      if (!kind || !parts[3]) return incomplete(), out;
      const id = parts[3];
      d.running.acls[id] = d.running.acls[id] || { id, kind, entries: [], named: true };
      d.mode = kind === "extended" ? "extnacl" : "stdnacl"; d.ctx = { acl: id }; return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "route", 5)) {
      if (!isIp(parts[2]) || !isIp(parts[3]) || !parts[4]) return incomplete(), out;
      d.running.staticRoutes.push({ net: parts[2], mask: parts[3], nh: parts[4] }); return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "nat", 3)) {
      if (kw(a[2] || "", "pool", 4)) {
        const name = parts[3]; let start = null, end = null, mask = null;
        for (let i = 4; i < parts.length; i++) { if (isIp(parts[i]) && !start) start = parts[i]; else if (isIp(parts[i]) && !end) end = parts[i]; if ((a[i] || "") === "netmask") mask = parts[i + 1]; }
        d.running.nat.pools[name] = { start, end, mask }; return out;
      }
      if (kw(a[2] || "", "inside", 3) && kw(a[3] || "", "source", 3)) {
        if (kw(a[4] || "", "list", 3)) {
          const list = parts[5]; let pool = null, ifn = null, ovl = false;
          for (let i = 6; i < parts.length; i++) {
            if (kw(a[i] || "", "pool", 4)) pool = parts[i + 1];
            if (kw(a[i] || "", "interface", 3)) ifn = normIf(parts[i + 1] || "");
            if ((a[i] || "") === "overload") ovl = true;
          }
          d.running.nat.dyn = { list, pool, ifName: ifn, overload: ovl }; return out;
        }
        if (kw(a[4] || "", "static", 3)) { d.running.nat.statics.push({ local: parts[5], global: parts[6] }); return out; }
      }
      return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "inspect", 3)) {
      if (kw(a[2] || "", "name", 4)) {
        const name = parts[3], proto = parts[4];
        d.running.inspects[name] = d.running.inspects[name] || [];
        if (proto && !d.running.inspects[name].includes(proto)) d.running.inspects[name].push(proto);
        return out;
      }
      return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "dhcp", 4)) {
      if (kw(a[2] || "", "pool", 4)) { const n = parts[3]; d.running.dhcp[n] = d.running.dhcp[n] || { name: n }; d.mode = "dhcp"; d.ctx = { dhcp: n }; return out; }
      if (kw(a[2] || "", "excluded-address", 4)) { d.running.dhcpExcl.push(parts.slice(3).join(" ")); return out; }
      return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "routing", 4)) { d.running.ipRouting = true; return out; }
    if (a[0] === "no" && kw(a[1] || "", "ip", 2) && kw(a[2] || "", "routing", 4)) { d.running.ipRouting = false; return out; }
    if (kw(a[0], "router", 4)) {
      if (kw(a[1] || "", "ospf", 4)) { const pid = parseInt(parts[2], 10) || 1; d.running.ospf = d.running.ospf || { pid, networks: [] }; d.running.ospf.pid = pid; d.mode = "router"; d.ctx = { rp: "ospf" }; return out; }
      inval(); return out;
    }
    if (kw(a[0], "line", 3)) { d.mode = "line"; d.ctx = {}; return out; }
    if (kw(a[0], "username", 4) || kw(a[0], "enable", 3) || kw(a[0], "banner", 3) || kw(a[0], "service", 4) || kw(a[0], "spanning-tree", 4) || kw(a[0], "crypto", 4) || kw(a[0], "aaa", 3)) return out;
    // no access-list <num>  → supprime toute l'ACL numérotée (comportement IOS)
    if (a[0] === "no" && kw(a[1] || "", "access-list", 6)) {
      const id = parts[2];
      if (id && d.running.acls[id]) { delete d.running.acls[id]; say("% ACL " + id + " supprimée.", "cmt"); }
      else say("% ACL " + (id || "") + " inexistante.", "cmt");
      return out;
    }
    // no ip access-list <standard|extended> <nom>  → supprime l'ACL nommée
    if (a[0] === "no" && kw(a[1] || "", "ip", 2) && kw(a[2] || "", "access-list", 3)) {
      const id = parts[4];
      if (id && d.running.acls[id]) { delete d.running.acls[id]; say("% ACL " + id + " supprimée.", "cmt"); }
      else say("% ACL " + (id || "") + " inexistante.", "cmt");
      return out;
    }
    if (a[0] === "no") return out;
    inval(); return out;
  }

  function parseRange(str, d) {
    const m = str.replace(/\s/g, "").match(/^([a-zA-Z]+)([0-9])\/([0-9]+)-([0-9]+)$/);
    if (!m) { const one = normIf(str); return one && d.ifaces[one] ? [one] : []; }
    const base = m[1], slot = m[2], from = +m[3], to = +m[4], res = [];
    for (let i = from; i <= to; i++) { const nm = normIf(base + slot + "/" + i); if (nm && d.ifaces[nm]) res.push(nm); }
    return res;
  }

  function cfgNacl(s, parts, a, out, say, inval) {
    const d = s.dev, acl = d.running.acls[d.ctx.acl];
    if (a[0] === "permit" || a[0] === "deny") {
      const rule = parseAclRule(parts, acl.kind);
      if (!rule) return inval(), out;
      acl.entries.push(rule); return out;
    }
    // no permit/deny <règle> → retire la ligne correspondante (ACL nommée, comme IOS)
    if (a[0] === "no" && (a[1] === "permit" || a[1] === "deny")) {
      const rule = parseAclRule(parts.slice(1), acl.kind);
      if (rule) { const idx = acl.entries.findIndex(e => e.raw === rule.raw); if (idx >= 0) { acl.entries.splice(idx, 1); return out; } }
      say("% Ligne introuvable dans l'ACL " + acl.id + ".", "cmt"); return out;
    }
    if (a[0] === "no" || /^\d+$/.test(a[0]) || kw(a[0], "remark", 3)) return out;
    inval(); return out;
  }

  /* ---------------- INTERFACE CONFIG ---------------- */
  function cfgIface(s, parts, a, out, say, inval, incomplete) {
    const d = s.dev;
    const targets = d.mode === "range" ? d.ctx.range : [d.ctx.iface];
    const each = fn => targets.forEach(nm => fn(d.ifaces[nm]));
    if (a[0] === "no" && kw(a[1] || "", "shutdown", 4)) { each(i => i.shutdown = false); return out; }
    if (kw(a[0], "shutdown", 4)) { each(i => i.shutdown = true); return out; }
    if (kw(a[0], "description", 4)) { each(i => i.desc = parts.slice(1).join(" ")); return out; }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "address", 3)) {
      if (!parts[2] || !parts[3]) return incomplete(), out;
      if (!isIp(parts[2]) || !isIp(parts[3])) return say("% Invalid input detected at '^' marker.", "err"), out;
      each(i => { i.ip = parts[2]; i.mask = parts[3]; }); return out;
    }
    if (kw(a[0], "ipv6", 4) && kw(a[1] || "", "address", 3)) { if (parts[2]) each(i => i.ipv6.push(parts[2])); return out; }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "nat", 3)) {
      const dir = kw(a[2] || "", "inside", 3) ? "inside" : kw(a[2] || "", "outside", 3) ? "outside" : null;
      if (!dir) return inval(), out; each(i => i.nat = dir); return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "access-group", 3)) {
      const id = parts[2], dir = kw(a[3] || "", "in", 2) ? "in" : kw(a[3] || "", "out", 3) ? "out" : null;
      if (!id || !dir) return incomplete(), out;
      if (!d.running.acls[id]) say("% Note : ACL " + id + " pas encore définie.", "cmt");
      each(i => { if (dir === "in") i.aclIn = id; else i.aclOut = id; }); return out;
    }
    if (kw(a[0], "ip", 2) && kw(a[1] || "", "inspect", 3)) {
      const name = parts[2], dir = kw(a[3] || "", "in", 2) ? "in" : kw(a[3] || "", "out", 3) ? "out" : null;
      if (!name || !dir) return incomplete(), out;
      each(i => { if (dir === "in") i.inspectIn = name; else i.inspectOut = name; }); return out;
    }
    if (kw(a[0], "encapsulation", 4)) {
      if (!(a[1] || "").startsWith("dot1") || !parts[2]) return inval(), out;
      const v = parseInt(parts[2], 10); each(i => i.encap = v); return out;
    }
    if (kw(a[0], "tunnel", 4)) {
      if (kw(a[1] || "", "source", 3)) { each(i => { if (i.tun) i.tun.src = parts[2]; }); return out; }
      if (kw(a[1] || "", "destination", 4)) { each(i => { if (i.tun) i.tun.dst = parts[2]; }); return out; }
      if (kw(a[1] || "", "mode", 3)) { each(i => { if (i.tun) i.tun.mode = parts.slice(2).join(" "); }); return out; }
      return out;
    }
    if (kw(a[0], "switchport", 4)) {
      if (targets.some(nm => !d.ifaces[nm].switchport)) return say("% Commande non disponible sur cette interface.", "err"), out;
      if (kw(a[1] || "", "mode", 2)) {
        if (kw(a[2] || "", "access", 3)) { each(i => i.switchport.mode = "access"); return out; }
        if (kw(a[2] || "", "trunk", 3)) { each(i => i.switchport.mode = "trunk"); return out; }
        return inval(), out;
      }
      if (kw(a[1] || "", "access", 3) && kw(a[2] || "", "vlan", 4)) {
        const v = parseInt(parts[3], 10); if (!v) return incomplete(), out;
        if (!d.running.vlans[v]) d.running.vlans[v] = { name: "VLAN" + String(v).padStart(4, "0") };
        each(i => i.switchport.accessVlan = v); return out;
      }
      if (kw(a[1] || "", "trunk", 3)) {
        if (kw(a[2] || "", "encapsulation", 3)) { each(i => i.switchport.trunkEncap = (a[3] || "dot1q")); return out; }
        if (kw(a[2] || "", "allowed", 3)) { each(i => i.switchport.trunkAllowed = parts.slice(4).join(" ")); return out; }
        return out;
      }
      return out;
    }
    if (a[0] === "no") return out;
    inval(); return out;
  }

  /* ---------------- PING ---------------- */
  function doPing(s, parts, say) {
    const dst = parts[1] || "";
    if (!dst) { say("% Incomplete command.", "err"); return; }
    let ok, msg = "";
    if (s.lab && typeof s.lab.ping === "function") { const r = s.lab.ping(s, s.dev, dst); ok = r.ok; msg = r.msg || ""; }
    else ok = genericReach(s.dev, dst);
    if (ok && s.dev.type === "host") s.pinged = true;
    say("Type escape sequence to abort.", "cmt");
    say(`Sending 5, 100-byte ICMP Echos to ${dst}, timeout is 2 seconds:`, "cmt");
    say(ok ? "!!!!!" : ".....", ok ? "ok" : "err");
    say(`Success rate is ${ok ? 100 : 0} percent (${ok ? "5/5" : "0/5"})` + (ok ? ", round-trip min/avg/max = 1/2/4 ms" : ""), ok ? "ok" : "err");
    if (!ok && msg) say("💡 " + msg, "cmt");
    else if (ok && msg) say("✓ " + msg, "ok");
  }
  function genericReach(d, dst) {
    if (!isIp(dst) || !d.ifaces) return false;
    return Object.values(d.ifaces).some(i => i.ip && i.mask && !i.shutdown && (i.ip === dst || networkOf(i.ip, i.mask) === networkOf(dst, i.mask)));
  }

  /* ---------------- SHOW ---------------- */
  function doShow(s, parts, out, say) {
    const d = s.dev, a = parts.map(x => x.toLowerCase());
    const tag = t => s.ran.add(t);
    if (kw(a[1] || "", "running-config", 3) || kw(a[1] || "", "running", 3)) { genRun(d).forEach(l => say(l.t, l.c)); tag("show running-config"); return out; }
    if (kw(a[1] || "", "startup-config", 4)) { say("% Configuration NVRAM (simulée) identique au running.", "cmt"); return out; }
    if (kw(a[1] || "", "access-lists", 6)) { showAcls(d, say); tag("show access-lists"); return out; }
    if (kw(a[1] || "", "vlan", 4)) { showVlan(d, say); tag("show vlan brief"); return out; }
    if (kw(a[1] || "", "ip", 2)) {
      if (kw(a[2] || "", "interface", 3) && kw(a[3] || "", "brief", 2)) { showIpIntBr(d, say); tag("show ip interface brief"); return out; }
      if (kw(a[2] || "", "route", 3)) { showIpRoute(d, say); tag("show ip route"); return out; }
      if (kw(a[2] || "", "nat", 3) && kw(a[3] || "", "translations", 3)) { showNatTrans(d, say); tag("show ip nat translations"); return out; }
      if (kw(a[2] || "", "nat", 3) && kw(a[3] || "", "statistics", 4)) { showNatStats(d, say); tag("show ip nat statistics"); return out; }
      if (kw(a[2] || "", "access-lists", 6)) { showAcls(d, say); tag("show access-lists"); return out; }
      if (kw(a[2] || "", "inspect", 3)) { showInspect(d, say); tag("show ip inspect"); return out; }
      if (kw(a[2] || "", "ospf", 4)) { say(d.running.ospf ? 'Routing Process "ospf ' + d.running.ospf.pid + '"' : "(OSPF non configuré)", d.running.ospf ? "out" : "cmt"); return out; }
      if (kw(a[2] || "", "protocols", 4)) { say(d.running.ospf ? 'Routing Protocol is "ospf ' + d.running.ospf.pid + '"' : "(aucun protocole dynamique)", "out"); return out; }
      say("% Sous-commande non simulée.", "cmt"); return out;
    }
    if (kw(a[1] || "", "inspect", 3)) { showInspect(d, say); tag("show ip inspect"); return out; }
    if (kw(a[1] || "", "interfaces", 3) && kw(a[2] || "", "trunk", 3)) { showTrunk(d, say); tag("show interfaces trunk"); return out; }
    if (kw(a[1] || "", "version", 3)) { say("Cisco IOS Software, SecureNet Lab (simulateur pédagogique)", "out"); say(d.hostname + " uptime is 0 minutes", "out"); return out; }
    say("% show non simulé — essaie : run, ip int brief, ip route, access-lists, ip nat translations, ip inspect.", "cmt");
    return out;
  }
  function ifList(d) { return d.order.map(n => d.ifaces[n]); }
  function showIpIntBr(d, say) {
    say("Interface              IP-Address      OK? Method Status                Protocol", "out");
    ifList(d).forEach(i => {
      const ip = i.ip || "unassigned";
      const up = (!i.shutdown && (i.ip || d.type === "switch"));
      const status = i.shutdown ? "administratively down" : (i.ip || d.type === "switch" ? "up" : "down");
      say(pad(i.name, 23) + pad(ip, 16) + "YES " + pad(i.ip ? "manual" : "unset", 7) + pad(status, 22) + (up ? "up" : "down"), "out");
    });
  }
  function showVlan(d, say) {
    say("VLAN Name                             Status    Ports", "out");
    say("---- -------------------------------- --------- -------------------------------", "out");
    Object.keys(d.running.vlans).map(Number).sort((x, y) => x - y).forEach(id => {
      const ports = ifList(d).filter(i => i.switchport && i.switchport.mode === "access" && i.switchport.accessVlan === id && !i.name.startsWith("Vlan")).map(i => shortIf(i.name));
      say(pad(id, 5) + pad(d.running.vlans[id].name, 33) + pad("active", 10) + ports.slice(0, 6).join(", "), "out");
    });
  }
  function showTrunk(d, say) {
    const trunks = ifList(d).filter(i => i.switchport && i.switchport.mode === "trunk");
    if (!trunks.length) { say("(aucun port en mode trunk)", "cmt"); return; }
    say("Port        Mode      Encapsulation  Status        Native vlan", "out");
    trunks.forEach(i => say(pad(shortIf(i.name), 12) + pad("on", 10) + pad(i.switchport.trunkEncap || "802.1q", 15) + pad("trunking", 14) + "1", "out"));
  }
  function showIpRoute(d, say) {
    say("Codes: C - connected, L - local, S - static, O - OSPF", "cmt"); say("", "out");
    const conn = ifList(d).filter(i => i.ip && !i.shutdown);
    conn.forEach(i => {
      say(`C    ${networkOf(i.ip, i.mask)}/${maskToCidr(i.mask)} is directly connected, ${shortIf(i.name)}`, "ok");
      say(`L    ${i.ip}/32 is directly connected, ${shortIf(i.name)}`, "out");
    });
    d.running.staticRoutes.forEach(r => say(`S    ${r.net}/${maskToCidr(r.mask)} [1/0] via ${r.nh}`, "out"));
    if (!conn.length && !d.running.staticRoutes.length) say("(aucune route — configure des IP + 'no shutdown')", "cmt");
  }
  function showAcls(d, say) {
    const ids = Object.keys(d.running.acls);
    if (!ids.length) { say("(aucune ACL configurée)", "cmt"); return; }
    ids.forEach(id => {
      const acl = d.running.acls[id];
      say(`${acl.kind === "extended" ? "Extended" : "Standard"} IP access list ${id}`, "ok");
      acl.entries.forEach((e, k) => say("    " + (k + 1) * 10 + " " + renderRule(e, acl.kind), "out"));
      say("    (deny ip any any — implicite)", "cmt");
    });
  }
  function renderRule(e, kind) {
    if (kind === "standard") return `${e.action} ${e.src.wild === "0.0.0.0" ? "host " + e.src.ip : e.src.ip + " " + e.src.wild}`;
    const aS = a => a.ip === "0.0.0.0" && a.wild === "255.255.255.255" ? "any" : a.wild === "0.0.0.0" ? "host " + a.ip : a.ip + " " + a.wild;
    let r = `${e.action} ${e.proto} ${aS(e.src)} ${aS(e.dst)}`;
    if (e.op) r += ` ${e.op} ${portName(e.port)}` + (e.port2 ? " " + portName(e.port2) : "");
    if (e.flags.established) r += " established";
    if (e.flags.echo) r += " echo"; if (e.flags.echoReply) r += " echo-reply";
    return r;
  }
  function showNatTrans(d, say) {
    const st = d.running.nat.statics, act = d.natActive || [];
    if (!st.length && !act.length && !d.running.nat.dyn) { say("(NAT non configuré ou aucune translation active)", "cmt"); return; }
    say("Pro  Inside global       Inside local        Outside local       Outside global", "out");
    st.forEach(m => say(pad("---", 5) + pad(m.global, 20) + pad(m.local, 20) + pad("---", 20) + "---", "out"));
    act.forEach(t => say(pad(t.proto || "icmp", 5) + pad(t.ig, 20) + pad(t.il, 20) + pad(t.ol, 20) + t.og, "out"));
    if (!st.length && !act.length) say("(NAT dynamique configuré — lance un ping depuis l'intérieur pour créer des entrées)", "cmt");
  }
  function showNatStats(d, say) {
    const ins = ifList(d).filter(i => i.nat === "inside").map(i => i.name);
    const outs = ifList(d).filter(i => i.nat === "outside").map(i => i.name);
    say(`Total active translations: ${d.running.nat.statics.length + (d.natActive ? d.natActive.length : 0)} (${d.running.nat.statics.length} static, ${d.natActive ? d.natActive.length : 0} dynamic)`, "out");
    say("Outside interfaces: " + (outs.join(", ") || "(aucune)"), "out");
    say("Inside interfaces:  " + (ins.join(", ") || "(aucune)"), "out");
    if (d.running.nat.dyn && d.running.nat.dyn.pool) { const p = d.running.nat.pools[d.running.nat.dyn.pool]; if (p) say(`pool ${d.running.nat.dyn.pool}: netmask ${p.mask} start ${p.start} end ${p.end}`, "out"); }
    if (d.running.nat.dyn && d.running.nat.dyn.overload) say("(surcharge PAT active)", "cmt");
  }
  function showInspect(d, say) {
    const names = Object.keys(d.running.inspects);
    if (!names.length) { say("(aucun jeu d'inspection CBAC configuré)", "cmt"); return; }
    names.forEach(n => { say(`Inspection name ${n}`, "ok"); d.running.inspects[n].forEach(p => say(`    ${p} alert is on audit-trail is off timeout 3600`, "out")); });
    const app = ifList(d).filter(i => i.inspectIn || i.inspectOut);
    if (app.length) { say("", "out"); say("Appliqué sur :", "cmt"); app.forEach(i => say("    " + shortIf(i.name) + (i.inspectIn ? " in:" + i.inspectIn : "") + (i.inspectOut ? " out:" + i.inspectOut : ""), "out")); }
  }
  function genRun(d) {
    const L = [], add = (t, c) => L.push({ t, c: c || "out" });
    add("Building configuration...", "cmt"); add("", "out"); add("Current configuration:", "cmt"); add("!", "cmt");
    add("hostname " + d.hostname, "out"); add("!", "cmt");
    Object.keys(d.running.vlans).map(Number).filter(x => x !== 1).sort((x, y) => x - y).forEach(id => { add("vlan " + id, "out"); add(" name " + d.running.vlans[id].name, "out"); add("!", "cmt"); });
    Object.keys(d.running.dhcp).forEach(n => { const p = d.running.dhcp[n]; add("ip dhcp pool " + n, "out"); if (p.network) add(" network " + p.network + " " + (p.mask || ""), "out"); if (p.gw) add(" default-router " + p.gw, "out"); if (p.dns) add(" dns-server " + p.dns, "out"); add("!", "cmt"); });
    d.running.dhcpExcl.forEach(e => add("ip dhcp excluded-address " + e, "out"));
    Object.keys(d.running.inspects).forEach(n => d.running.inspects[n].forEach(p => add("ip inspect name " + n + " " + p, "out")));
    ifList(d).forEach(i => {
      const empty = !i.ip && !i.desc && !i.nat && !i.aclIn && !i.aclOut && !i.tun && !i.inspectIn && !i.inspectOut && !i.encap && (!i.switchport || (i.switchport.mode === "access" && i.switchport.accessVlan === 1));
      if (empty && i.shutdown && !/^(Serial|Gigabit|FastEth)/.test(i.name)) return;
      add("interface " + i.name, "out");
      if (i.desc) add(" description " + i.desc, "out");
      if (i.tun) { if (i.tun.src) add(" tunnel source " + i.tun.src, "out"); if (i.tun.dst) add(" tunnel destination " + i.tun.dst, "out"); add(" tunnel mode gre ip", "out"); }
      if (i.encap) add(" encapsulation dot1Q " + i.encap, "out");
      if (i.switchport) {
        if (i.switchport.mode === "access" && i.switchport.accessVlan !== 1) { add(" switchport access vlan " + i.switchport.accessVlan, "out"); add(" switchport mode access", "out"); }
        if (i.switchport.mode === "trunk") { if (i.switchport.trunkEncap) add(" switchport trunk encapsulation " + i.switchport.trunkEncap, "out"); add(" switchport mode trunk", "out"); }
      }
      if (i.ip) add(" ip address " + i.ip + " " + i.mask, "out");
      if (i.nat) add(" ip nat " + i.nat, "out");
      if (i.aclIn) add(" ip access-group " + i.aclIn + " in", "out");
      if (i.aclOut) add(" ip access-group " + i.aclOut + " out", "out");
      if (i.inspectIn) add(" ip inspect " + i.inspectIn + " in", "out");
      if (i.inspectOut) add(" ip inspect " + i.inspectOut + " out", "out");
      add(i.shutdown ? " shutdown" : " no shutdown", i.shutdown ? "cmt" : "out"); add("!", "cmt");
    });
    if (d.running.nat.dyn || d.running.nat.statics.length || Object.keys(d.running.nat.pools).length) {
      Object.keys(d.running.nat.pools).forEach(n => { const p = d.running.nat.pools[n]; add(`ip nat pool ${n} ${p.start} ${p.end} netmask ${p.mask}`, "out"); });
      if (d.running.nat.dyn) { const y = d.running.nat.dyn; add(`ip nat inside source list ${y.list} ${y.pool ? "pool " + y.pool : "interface " + (y.ifName || "?")}${y.overload ? " overload" : ""}`, "out"); }
      d.running.nat.statics.forEach(m => add(`ip nat inside source static ${m.local} ${m.global}`, "out"));
      add("!", "cmt");
    }
    if (d.running.ospf) { add("router ospf " + d.running.ospf.pid, "out"); d.running.ospf.networks.forEach(n => add(" network " + n, "out")); add("!", "cmt"); }
    d.running.staticRoutes.forEach(r => add(`ip route ${r.net} ${r.mask} ${r.nh}`, "out"));
    if (d.running.staticRoutes.length) add("!", "cmt");
    Object.keys(d.running.acls).forEach(id => {
      const acl = d.running.acls[id];
      if (acl.named) { add(`ip access-list ${acl.kind} ${id}`, "out"); acl.entries.forEach(e => add(" " + renderRule(e, acl.kind), "out")); }
      else acl.entries.forEach(e => add(`access-list ${id} ${renderRule(e, acl.kind)}`, "out"));
      add("!", "cmt");
    });
    add("end", "out");
    return L;
  }

  function helpFor(d, parts, say) {
    const lvl = {
      user: "  enable, ping, show, exit",
      enable: "  configure terminal, show, ping, debug, write, exit",
      config: "  hostname, interface, ip route, ip nat, ip access-list, access-list, ip inspect, ip dhcp, router ospf, line, exit",
      if: "  ip address, no shutdown, ip nat inside|outside, ip access-group N in|out, ip inspect NOM in|out, tunnel source|destination, switchport, exit",
      subif: "  encapsulation dot1Q <vlan>, ip address, exit",
      stdnacl: "  permit|deny <source>, exit",
      extnacl: "  permit|deny <proto> <src> <dst> [eq <port>] [established], exit",
      dhcp: "  network, default-router, dns-server, exit",
      router: "  network <réseau> <wildcard> area <n>, exit"
    }[d.mode] || "  exit";
    say("Commandes possibles :", "cmt"); say(lvl, "out");
  }

  /* ---------------- helpers exposés aux labs ---------------- */
  function aclAllows(dev, ifname, dir, pkt) {
    const i = dev.ifaces[ifname]; if (!i) return true;
    const id = dir === "in" ? i.aclIn : i.aclOut; if (!id) return true;
    const acl = dev.running.acls[id]; if (!acl) return false;
    return aclEval(acl, pkt) === "permit";
  }
  function ifaceByIp(dev, ip) { return dev.order.map(n => dev.ifaces[n]).find(i => i.ip === ip); }
  function hasRouteTo(dev, ip) {
    if (Object.values(dev.ifaces).some(i => i.ip && i.mask && !i.shutdown && networkOf(i.ip, i.mask) === networkOf(ip, i.mask))) return true;
    return dev.running.staticRoutes.some(r => networkOf(ip, r.mask) === networkOf(r.net, r.mask)) || !!(dev.running.ospf && dev.running.ospf.networks.length);
  }

  /* ===================================================================
     LABS  (définis dans labs-data.js → window.SN_LABS)
     =================================================================== */
  window.SNLabHelpers = { newSwitch, newRouter, makeHost, aclAllows, aclEval, wildMatch, networkOf, genericReach, ifaceByIp, hasRouteTo, isIp, normIf };
  const LABS = (window.SN_LABS || []);
  function labById(id) { return LABS.find(l => l.id === id); }

  /* ===================================================================
     RENDU
     =================================================================== */
  function render(view, sub) {
    if (!sub || sub === "") return renderList(view);
    if (sub === "sandbox") return renderLab(view, null);
    const lab = labById(sub);
    if (!lab) { location.hash = "#/lab"; return; }
    renderLab(view, lab);
  }
  function crumb(arr) {
    const c = document.getElementById("crumbs");
    if (c) c.innerHTML = arr.map((p, i) => (i ? `<span class="sep">/</span>` : "") + (i < arr.length - 1 ? `<span style="cursor:pointer" onclick="location.hash='#/${p[1]}'">${p[0]}</span>` : `<b>${p[0]}</b>`)).join(" ");
  }
  function renderList(view) {
    crumb([["Accueil", ""], ["Labs CLI", ""]]);
    document.documentElement.style.setProperty("--mc", "var(--r-nat)");
    const doneN = Object.keys(LS.done).length;
    view.innerHTML = `
      <div class="mod-hero" style="--mc:var(--r-nat)">
        <div class="mh-ico">🖥️</div>
        <div><h1>SecureNet Lab — Console Cisco IOS</h1>
        <p>Tape de vraies commandes IOS dans un terminal simulé : <b>NAT, ACL, GRE, CBAC</b>. Objectifs validés automatiquement + XP, ou explore en <b>bac à sable</b>.</p></div>
      </div>
      <div class="lab-xpbar">
        <span class="lab-xp">🖥️ ${doneN} / ${LABS.length} labs terminés</span>
        <span class="lab-xp-sub">${G ? G.levelInfo().total + " XP · niveau " + G.levelInfo().level : ""}</span>
      </div>
      <div class="section-head"><h2>Labs guidés</h2><span class="sub">Validation automatique + indices</span></div>
      <div class="lab-grid">
        ${LABS.map(labCard).join("")}
        <article class="lab-card sandbox" data-lab="sandbox" style="--mc:var(--r-nat)">
          <div class="lab-top"><div class="lab-ico">🧪</div><div><div class="lab-title">Bac à sable libre</div><div class="lab-kic">Routeur + Switch</div></div></div>
          <div class="lab-desc">Aucune contrainte : entraîne-toi sur toutes les commandes (NAT, ACL, GRE…), teste les <code>show</code>.</div>
          <div class="lab-meta"><span>Ouvrir la console →</span></div>
        </article>
      </div>`;
    [...view.querySelectorAll("[data-lab]")].forEach(c => c.addEventListener("click", () => location.hash = "#/lab/" + c.dataset.lab));
  }
  function labCard(l) {
    const done = LS.done[l.id];
    return `<article class="lab-card" data-lab="${l.id}" style="--mc:var(--r-${l.color})">
      <div class="lab-top"><div class="lab-ico">${l.icon}</div><div><div class="lab-title">${l.title}</div><div class="lab-kic">${l.objectives.length} objectifs · ${l.xp} XP</div></div></div>
      <div class="lab-desc">${l.intro}</div>
      <div class="lab-meta"><span>${done ? "✅ Terminé — rejouer" : "Démarrer le lab"} →</span></div>
      ${done ? `<div class="lab-done-badge">✓</div>` : ""}
    </article>`;
  }
  function renderLab(view, lab) {
    const sandbox = !lab;
    crumb([["Accueil", ""], ["Labs CLI", "lab"], [sandbox ? "Bac à sable" : lab.title, ""]]);
    const color = sandbox ? "nat" : lab.color;
    document.documentElement.style.setProperty("--mc", `var(--r-${color})`);
    const devices = sandbox ? [newRouter("Router", "r1"), newSwitch("Switch", "sw")] : (lab.devices ? lab.devices() : [lab.device()]);
    const startIdx = Math.max(0, devices.findIndex(d => d.type !== "host"));
    const session = { dev: devices[startIdx], devices, ran: new Set(), history: [], hpos: -1, xpGiven: {}, pinged: false, lab: sandbox ? null : lab, find: id => devices.find(d => d.id === id) };
    const objHtml = sandbox ? "" : lab.objectives.map((o, i) => `<li class="lab-obj" data-obj="${o.id}"><span class="lab-obj-ck">${i + 1}</span><span class="lab-obj-t">${o.t}</span></li>`).join("");
    view.innerHTML = `
      <div class="lab-run" style="--mc:var(--r-${color})">
        <div class="lab-head">
          <button class="dg-btn" onclick="location.hash='#/lab'">← Labs</button>
          <div class="lab-head-title">${sandbox ? "🧪 Bac à sable" : lab.icon + " " + lab.title}</div>
          <div class="lab-head-actions">
            ${devices.length > 1 ? `<div class="lab-devtabs" id="devtabs">${devices.map((dd, i) => `<button class="lab-devtab ${i === startIdx ? "on" : ""}" data-dev="${i}">${dd.type === "switch" ? "🔀 " : dd.type === "router" ? "🛰️ " : "💻 "}${dd.hostname}</button>`).join("")}</div>` : ""}
            <button class="dg-btn" id="labReset">↻ Réinitialiser</button>
          </div>
        </div>
        ${sandbox ? "" : `<div class="lab-brief"><b>🎯 Mission :</b> ${lab.intro}<div class="lab-topo">🗺️ ${lab.topo}</div></div>`}
        <div class="lab-body">
          <div class="term" id="term">
            <div class="term-out" id="termOut"></div>
            <div class="term-input-row">
              <span class="term-prompt" id="termPrompt"></span>
              <input class="cli-input" id="cliInput" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" />
            </div>
          </div>
          ${sandbox ? "" : `<aside class="lab-objs">
            <div class="lab-objs-head">Objectifs <span id="objCount">0/${lab.objectives.length}</span></div>
            <ul class="lab-objlist" id="objList">${objHtml}</ul>
            <div class="lab-obj-actions">
              <button class="dg-btn" id="labHint">💡 Indice</button>
              ${lab.solution ? `<button class="dg-btn" id="labSol">📜 Solution</button>` : ""}
              <button class="dg-btn primary" id="labCheck">✔ Vérifier</button>
            </div>
            <div class="lab-hintbox" id="hintBox"></div>
          </aside>`}
        </div>
      </div>`;
    const out = view.querySelector("#termOut"), input = view.querySelector("#cliInput"), promptEl = view.querySelector("#termPrompt"), term = view.querySelector("#term");
    function refreshPrompt() { promptEl.textContent = prompt(session.dev); }
    function append(t, c) { const div = document.createElement("div"); div.className = "tl tl-" + (c || "out"); div.innerHTML = esc(t) || "&nbsp;"; out.appendChild(div); }
    function scroll() { term.scrollTop = term.scrollHeight; }
    function banner() {
      append("SecureNet Lab — Cisco IOS (simulateur pédagogique)", "cmt");
      append("Tape '?' pour l'aide, 'show running-config' pour voir ta config.", "cmt");
      if (devices.length > 1) append("Astuce : change d'équipement avec les onglets en haut.", "cmt");
      append("", "out");
    }
    function runCommand(raw) {
      append(prompt(session.dev) + " " + raw, "echo");
      processLine(session, raw).forEach(l => append(l.t, l.c));
      refreshPrompt(); scroll();
      if (!sandbox) updateObjectives();
    }
    function updateObjectives(announce = true) {
      let done = 0;
      lab.objectives.forEach(o => {
        let ok = false; try { ok = !!o.c(session); } catch (e) { ok = false; }
        const li = view.querySelector(`[data-obj="${o.id}"]`);
        if (ok) {
          done++;
          if (li && !li.classList.contains("done")) {
            li.classList.add("done"); li.querySelector(".lab-obj-ck").textContent = "✓";
            if (announce && !session.xpGiven[o.id]) { session.xpGiven[o.id] = 1; if (G) G.addXP(8, "Objectif validé"); else toast("Objectif validé ✓"); }
          }
        }
      });
      const oc = view.querySelector("#objCount"); if (oc) oc.textContent = done + "/" + lab.objectives.length;
      if (done === lab.objectives.length && !session.completed) { session.completed = true; completeLab(); }
    }
    function completeLab() {
      const first = !LS.done[lab.id];
      LS.done[lab.id] = lab.objectives.length; saveL(LS);
      append("", "out"); append("════════════════════════════════════════", "ok");
      append("🎉 LAB TERMINÉ ! Tous les objectifs sont validés." + (first ? "  +" + lab.xp + " XP" : "  (déjà complété)"), "ok");
      append("════════════════════════════════════════", "ok"); scroll();
      if (G) {
        if (first) G.addXP(lab.xp, "Lab : " + lab.title);
        G.award("lab-first"); G.confetti({ n: 110 });
        if (lab.badge) G.award(lab.badge);
        if (Object.keys(LS.done).length >= LABS.length) G.award("lab-all");
      } else toast("🎉 Lab terminé !");
      const ca = view.querySelector("#labCheck"); if (ca) { ca.textContent = "🎉 Terminé"; ca.disabled = true; }
    }
    [...view.querySelectorAll("[data-dev]")].forEach(b => b.addEventListener("click", () => {
      view.querySelectorAll(".lab-devtab").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); session.dev = devices[+b.dataset.dev]; refreshPrompt();
      append("--- équipement actif : " + session.dev.hostname + " ---", "cmt"); scroll(); input.focus();
    }));
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const v = input.value; input.value = "";
        if (v.trim()) session.history.push(v);
        session.hpos = session.history.length; runCommand(v);
      } else if (e.key === "ArrowUp") {
        if (session.history.length) { session.hpos = Math.max(0, session.hpos - 1); input.value = session.history[session.hpos] || ""; e.preventDefault(); setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0); }
      } else if (e.key === "ArrowDown") {
        if (session.history.length) { session.hpos = Math.min(session.history.length, session.hpos + 1); input.value = session.history[session.hpos] || ""; e.preventDefault(); }
      } else if (e.key === "Tab") { e.preventDefault(); const c = complete(session.dev, input.value); if (c) input.value = c; }
    });
    term.addEventListener("click", () => input.focus());
    if (!sandbox) {
      view.querySelector("#labHint").addEventListener("click", () => {
        const next = lab.objectives.find(o => { try { return !o.c(session); } catch { return true; } });
        const box = view.querySelector("#hintBox");
        box.innerHTML = next ? `💡 <b>Prochain objectif :</b> ${next.t}<br>${next.hint}` : "✅ Tous les objectifs sont déjà validés !";
        box.classList.add("show");
      });
      view.querySelector("#labCheck").addEventListener("click", () => { updateObjectives(true); const box = view.querySelector("#hintBox"); if (!session.completed) { box.innerHTML = "🔍 Vérification effectuée — continue les objectifs restants."; box.classList.add("show"); } });
      const solBtn = view.querySelector("#labSol");
      if (solBtn) solBtn.addEventListener("click", () => {
        const box = view.querySelector("#hintBox");
        box.innerHTML = `<b>📜 Corrigé — copie-colle puis comprends chaque ligne :</b>${lab.solution}`;
        box.classList.add("show");
        box.querySelectorAll(".cli-copy").forEach(b => b.addEventListener("click", () => {
          const pre = b.closest(".cli").querySelector("pre");
          navigator.clipboard && navigator.clipboard.writeText(pre.innerText).then(() => { b.textContent = "Copié ✓"; setTimeout(() => b.textContent = "Copier", 1400); });
        }));
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    view.querySelector("#labReset").addEventListener("click", () => renderLab(view, lab));
    banner(); refreshPrompt();
    if (!sandbox) updateObjectives(false);
    setTimeout(() => input.focus(), 60);
  }
  function complete(d, val) {
    const tokens = val.split(/\s+/), last = tokens[tokens.length - 1].toLowerCase();
    if (!last) return null;
    const sets = {
      user: ["enable", "show", "ping", "exit"],
      enable: ["configure", "show", "ping", "debug", "write", "exit"],
      config: ["hostname", "interface", "ip", "access-list", "router", "line", "no", "exit"],
      if: ["ip", "no", "shutdown", "description", "switchport", "encapsulation", "tunnel", "exit"],
      subif: ["encapsulation", "ip", "no", "exit"],
      extnacl: ["permit", "deny", "exit"], stdnacl: ["permit", "deny", "exit"],
      dhcp: ["network", "default-router", "dns-server", "exit"], router: ["network", "exit"], line: ["password", "login", "transport", "exit"]
    }[d.mode] || [];
    const m = sets.filter(w => w.startsWith(last));
    if (m.length === 1) { tokens[tokens.length - 1] = m[0]; return tokens.join(" ") + " "; }
    return null;
  }
  let tT;
  function toast(msg) { const t = document.getElementById("toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("show"), 1900); }

  window.NMLab = { render, LABS, _engine: { processLine, newRouter, newSwitch, makeHost, aclEval, prompt } };
})();
