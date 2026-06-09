/* ===================== MODULE 2 · TUNNEL GRE =====================
   Atelier 4 (Tunnel GRE). Pas de corrigé écrit du prof → contenu rédigé
   dans sa méthode (adressage cohérent avec les autres ateliers).
   Partie ① du programme d'examen.
   =============================================================== */
NM.register({
  id: "gre", color: "gre", icon: "🛤️", badge: "gre-tunnel",
  title: "Tunnel GRE",
  kicker: "Interconnexion de sites — Partie ①",
  est: "≈ 30 min",
  desc: "Relier deux sites distants par un tunnel virtuel GRE par-dessus le réseau public : encapsuler le trafic privé dans un paquet IP public, et faire passer le routage à travers le tunnel.",
  chips: ["interface tunnel", "tunnel source/destination", "mode gre ip", "overlay/underlay"],
  sections: [

    { id: "obj", title: "Qu'est-ce que GRE ?",
      html: `<p><b>GRE</b> (<i>Generic Routing Encapsulation</i>, protocole Cisco) crée un <b>tunnel virtuel</b> point-à-point entre deux routeurs à travers un réseau intermédiaire (souvent Internet ou un WAN public).</p>
      <p>Le paquet d'origine (privé) est <b>encapsulé</b> dans un nouvel en-tête IP public : il « voyage caché » dans un autre paquet jusqu'à l'autre bout du tunnel, où il est désencapsulé.</p>
      <ul>
        <li>🔗 Relier deux <b>LAN privés</b> distants comme s'ils étaient adjacents.</li>
        <li>📡 Faire passer le <b>routage dynamique</b> (OSPF, EIGRP) et le <b>multicast</b> — ce que le NAT/IPsec seul ne permet pas.</li>
        <li>🧱 Encapsuler n'importe quel protocole de couche 3.</li>
      </ul>` +
      note("warn", "⚠️ GRE <b>ne chiffre pas</b> le trafic ! Pour la confidentialité, on combine <b>GRE over IPsec</b> (GRE pour le routage/multicast, IPsec pour le chiffrement).") },

    { id: "concepts", title: "1 · Underlay vs Overlay",
      html: `<table class="policy-table">
        <tr><th>Couche</th><th>Rôle</th><th>Adresses (exemple)</th></tr>
        <tr><td><b>Underlay</b> (transport)</td><td>Le réseau physique/public réel qui relie les routeurs</td><td>WAN <code>212.217.7.0/30</code> (Se0/0/0 de chaque routeur)</td></tr>
        <tr><td><b>Overlay</b> (tunnel)</td><td>Le tunnel virtuel GRE qui semble direct</td><td>Tunnel <code>10.0.0.0/30</code> (<code>Tunnel0</code> de chaque routeur)</td></tr>
      </table>
      <p>Trois informations définissent un tunnel GRE :</p>
      <ul>
        <li><b>tunnel source</b> — l'IP (ou l'interface) <u>physique</u> locale d'où part le tunnel.</li>
        <li><b>tunnel destination</b> — l'IP <u>physique</u> publique de l'autre routeur.</li>
        <li>une <b>IP de tunnel</b> (logique) sur l'interface <code>Tunnel0</code>, dans un réseau à part.</li>
      </ul>` +
      mnemo("📦", "Source/destination = adresses <b>physiques</b> (underlay). L'IP de l'interface Tunnel0 = adresse <b>logique</b> (overlay). Ne pas les confondre !") },

    { id: "config", title: "2 · Configuration pas-à-pas",
      html: `<p>Topologie : <b>R1</b> (Se0/0/0 = 212.217.7.1/30) ↔ <b>R2</b> (Se0/0/0 = 212.217.7.2/30). Tunnel : 10.0.0.1 ↔ 10.0.0.2.</p>` +
      cli("R1 — création du tunnel",
`! 1) Interface physique (underlay) — déjà adressée et active
R1(config)# interface s0/0/0
R1(config-if)# ip address 212.217.7.1 255.255.255.252
R1(config-if)# no shutdown
R1(config-if)# exit
!
! 2) Interface logique Tunnel0 (overlay)
R1(config)# interface tunnel 0
R1(config-if)# ip address 10.0.0.1 255.255.255.252
R1(config-if)# tunnel source 212.217.7.1          // ou : tunnel source s0/0/0
R1(config-if)# tunnel destination 212.217.7.2      // IP physique de R2
R1(config-if)# tunnel mode gre ip                  // (mode par défaut)`) +
      cli("R2 — configuration miroir",
`R2(config)# interface s0/0/0
R2(config-if)# ip address 212.217.7.2 255.255.255.252
R2(config-if)# no shutdown
R2(config-if)# exit
R2(config)# interface tunnel 0
R2(config-if)# ip address 10.0.0.2 255.255.255.252
R2(config-if)# tunnel source 212.217.7.2
R2(config-if)# tunnel destination 212.217.7.1
R2(config-if)# tunnel mode gre ip`) +
      note("tip", "La <b>source</b> d'un côté = la <b>destination</b> de l'autre, et inversement. C'est le piège n°1 du GRE.") },

    { id: "routage", title: "3 · Router à travers le tunnel",
      html: `<p>Une fois le tunnel monté, on peut router les LAN privés <b>par-dessus</b> le tunnel — soit par route statique, soit par OSPF qui voit Tunnel0 comme une interface normale.</p>` +
      cli("Exemple : OSPF sur le tunnel (R1)",
`R1(config)# router ospf 1
R1(config-router)# network 10.0.0.0 0.0.0.3 area 0       // le réseau du tunnel
R1(config-router)# network 192.168.1.0 0.0.0.255 area 0  // le LAN local
R1(config-router)# exit`) +
      note("info", "Les voisins OSPF s'établissent <b>à travers le tunnel</b> (adresses 10.0.0.x), pas sur le WAN public. C'est tout l'intérêt : le routage dynamique traverse Internet.") },

    { id: "verif", title: "4 · Vérification",
      html: cli("Commandes de vérification",
`R1# show ip interface brief        // Tunnel0 doit être up/up
R1# show interfaces tunnel 0       // état, source, destination, mode
R1# ping 10.0.0.2                  // ping de l'autre bout du tunnel
R1# show ip route                  // routes apprises via le tunnel`) +
      key("À retenir (GRE)", [
        "<code>interface tunnel 0</code> crée une interface logique (up dès qu'elle a source+destination valides).",
        "<b>source / destination</b> = adresses physiques publiques (underlay).",
        "L'<b>IP du tunnel</b> est dans un réseau /30 séparé (overlay).",
        "GRE transporte le <b>routage dynamique et le multicast</b> (atout vs IPsec seul).",
        "GRE <b>ne chiffre pas</b> → GRE over IPsec si confidentialité requise."
      ]) }
  ],

  quiz: [
    { q: "Que représente « tunnel destination » dans une config GRE ?", opts: ["L'IP du tunnel local", "L'IP physique publique du routeur distant", "Le LAN distant", "Le masque du tunnel"], a: 1,
      exp: "C'est l'adresse physique (underlay) de l'autre extrémité du tunnel.", tag: "GRE" },
    { q: "Principal atout de GRE par rapport à IPsec seul ?", opts: ["Il chiffre mieux", "Il transporte le routage dynamique et le multicast", "Il est plus rapide", "Il économise des IP"], a: 1,
      exp: "GRE encapsule routage dynamique et multicast ; IPsec seul ne le fait pas (d'où GRE over IPsec).", tag: "GRE" },
    { q: "GRE assure-t-il la confidentialité (chiffrement) ?", opts: ["Oui, AES par défaut", "Non, il faut le combiner à IPsec", "Oui mais seulement en IPv6", "Seulement avec un mot de passe"], a: 1,
      exp: "GRE n'offre aucun chiffrement ; on l'associe à IPsec si besoin.", tag: "GRE" },
    { q: "Sur quelle interface configure-t-on l'IP 10.0.0.1/30 du tunnel ?", opts: ["Serial0/0/0", "GigabitEthernet0/0", "Tunnel0", "Loopback0"], a: 2,
      exp: "L'IP logique de l'overlay se met sur l'interface Tunnel0.", tag: "GRE" },
    { q: "Sur R1, tunnel source = 212.217.7.1. Que doit valoir tunnel destination sur R2 ?", opts: ["10.0.0.1", "212.217.7.1", "212.217.7.2", "192.168.1.1"], a: 1,
      exp: "La destination de R2 = la source de R1 (adresses physiques croisées).", tag: "GRE" }
  ],

  flashcards: [
    { k: "Définition", f: "Qu'est-ce qu'un tunnel GRE ?", b: "Un tunnel virtuel point-à-point qui encapsule le trafic dans un paquet IP public pour relier deux sites à travers un réseau intermédiaire." },
    { k: "Underlay/Overlay", f: "Différence underlay / overlay", b: "Underlay = réseau physique public réel (WAN). Overlay = le tunnel logique (réseau du Tunnel0)." },
    { k: "Config", f: "Les 4 commandes clés du Tunnel0", b: "ip address <ip tunnel> ; tunnel source <ip phys locale> ; tunnel destination <ip phys distante> ; tunnel mode gre ip." },
    { k: "Sécurité", f: "GRE chiffre-t-il ?", b: "Non — aucun chiffrement. On utilise GRE over IPsec pour la confidentialité." },
    { k: "Atout", f: "Que peut transporter GRE que IPsec seul ne peut pas ?", b: "Le routage dynamique (OSPF/EIGRP) et le trafic multicast." },
    { k: "Vérif", f: "Comment vérifier un tunnel GRE ?", b: "show interfaces tunnel 0 (up/up, source, destination) puis ping de l'IP de l'autre bout." }
  ]
});
