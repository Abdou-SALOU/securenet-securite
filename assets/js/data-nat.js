/* ===================== MODULE 1 · NAT / PAT / NAT STATIQUE =====================
   D'après les Ateliers 1 (NAT dynamique), 2 (PAT) et 3 (NAT statique) du prof.
   Partie ① du programme d'examen.
   ============================================================================ */
NM.register({
  id: "nat", color: "nat", icon: "🔁", badge: "nat-master",
  title: "NAT · PAT · NAT Statique",
  kicker: "Translation d'adresses — Partie ①",
  est: "≈ 45 min",
  desc: "Traduire les adresses privées (RFC 1918) en adresses publiques : NAT statique pour publier un serveur, NAT dynamique avec pool, et PAT (overload) pour partager une seule IP publique.",
  chips: ["inside/outside", "NAT statique", "NAT dynamique", "PAT overload", "show ip nat"],
  sections: [

    { id: "obj", title: "Pourquoi le NAT ?",
      html: `<p>Le <b>NAT</b> (<i>Network Address Translation</i>) traduit les adresses IP <b>privées</b> (RFC 1918 : <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>) en adresses <b>publiques</b> routables sur Internet.</p>
      <ul>
        <li>🌍 <b>Économiser les adresses IPv4</b> publiques (pénurie) : des milliers d'hôtes privés derrière quelques IP publiques.</li>
        <li>🕵️ <b>Masquer</b> le plan d'adressage interne (sécurité par dissimulation).</li>
        <li>🔁 Permettre à un réseau privé d'accéder à Internet, et publier des serveurs internes.</li>
      </ul>` +
      note("exam", "Le NAT se configure sur le <b>routeur de bordure</b> (celui qui relie le LAN privé au WAN/Internet). On y désigne une patte <b>inside</b> et une patte <b>outside</b>.") +
      mnemo("🧭", "<b>Inside</b> = côté privé (ton LAN). <b>Outside</b> = côté public (Internet/FAI). C'est <u>toujours</u> par rapport au routeur NAT.") },

    { id: "termes", title: "1 · Le vocabulaire (4 adresses)",
      html: `<p>Cisco distingue <b>4 adresses</b>. La clé : <b>local</b> = comment l'hôte est vu <u>à l'intérieur</u>, <b>global</b> = comment il est vu <u>à l'extérieur</u>.</p>
      <table class="policy-table">
        <tr><th>Terme</th><th>Signification</th><th>Exemple</th></tr>
        <tr><td><b>Inside local</b></td><td>IP privée réelle de l'hôte interne</td><td><code>192.168.1.10</code></td></tr>
        <tr><td><b>Inside global</b></td><td>IP publique qui le représente dehors</td><td><code>200.200.200.1</code></td></tr>
        <tr><td><b>Outside global</b></td><td>IP publique réelle du serveur distant</td><td><code>212.217.26.10</code></td></tr>
        <tr><td><b>Outside local</b></td><td>Comment le distant est vu dedans (souvent = global)</td><td><code>212.217.26.10</code></td></tr>
      </table>` +
      dg("natTable") +
      note("tip", "Dans <code>show ip nat translations</code>, tu retrouves exactement ces 4 colonnes : <b>Inside global / Inside local / Outside local / Outside global</b>.") },

    { id: "types", title: "2 · Les 3 types de NAT",
      html: `<table class="policy-table">
        <tr><th>Type</th><th>Principe</th><th>Usage typique</th></tr>
        <tr><td><b>NAT statique</b></td><td>1 privée ↔ 1 publique, <b>fixe et permanent</b></td><td>Publier un serveur (web, mail) accessible depuis Internet</td></tr>
        <tr><td><b>NAT dynamique</b></td><td>Plusieurs privées ↔ un <b>pool</b> de publiques (1-pour-1 temporaire)</td><td>Sortie Internet avec un lot d'IP publiques</td></tr>
        <tr><td><b>PAT (overload)</b></td><td>Plusieurs privées ↔ <b>UNE</b> publique, différenciées par le <b>n° de port</b></td><td>Le partage de connexion classique (box, entreprise)</td></tr>
      </table>` +
      note("exam", "Le <b>PAT</b> est de loin le plus courant : c'est ce que fait ta box. Le mot-clé magique est <code>overload</code>.") },

    { id: "static", title: "3 · NAT Statique (Atelier 3)",
      html: `<p>Objectif : rendre le serveur interne <code>192.168.10.20</code> joignable depuis l'extérieur via l'IP publique fixe <code>212.217.26.100</code>.</p>` +
      cli("NAT statique sur R1",
`R1(config)# interface fa0/0
R1(config-if)# ip address 192.168.10.1 255.255.255.0
R1(config-if)# ip nat inside                 // patte interne
R1(config-if)# no shutdown
R1(config-if)# exit
R1(config)# interface s0/0/0
R1(config-if)# ip address 212.217.7.1 255.255.255.252
R1(config-if)# ip nat outside                // patte externe
R1(config-if)# no shutdown
R1(config-if)# exit
!
! Mappage statique : IP privée  <->  IP publique fixe
R1(config)# ip nat inside source static 192.168.10.20 212.217.26.100`) +
      note("warn", "Le routeur <b>distant</b> doit savoir router vers l'IP publique du serveur. Sur R2 (Atelier 3) : <code>ip route 212.217.26.100 255.255.255.255 212.217.7.1</code>.") +
      key("À retenir (NAT statique)", [
        "Mappage <b>permanent</b>, sans numéro de port → colonne <code>Pro = ---</code> dans la table.",
        "Sens : on publie un serveur <b>de l'intérieur vers l'extérieur</b> (<code>inside source static</code>).",
        "Toujours désigner <code>ip nat inside</code> et <code>ip nat outside</code> sur les bonnes interfaces."
      ]) },

    { id: "dynamic", title: "4 · NAT Dynamique avec pool (Atelier 1)",
      html: `<p>Objectif : les hôtes du LAN privé <code>192.168.1.0/24</code> sortent en empruntant une adresse d'un <b>pool</b> public (<code>200.200.200.1</code> → <code>200.200.200.5</code>).</p>
      <p>Trois étapes : ① une <b>ACL standard</b> identifie qui peut être traduit, ② un <b>pool</b> liste les IP publiques disponibles, ③ on <b>lie</b> l'ACL au pool.</p>` +
      cli("NAT dynamique sur RE (routeur de bordure)",
`! Interfaces : rôles inside / outside
RE(config)# interface gi0/0
RE(config-if)# ip address 192.168.1.1 255.255.255.0
RE(config-if)# ip nat inside
RE(config-if)# no shutdown
RE(config-if)# exit
RE(config)# interface s0/0/0
RE(config-if)# ip address 212.217.7.117 255.255.255.252
RE(config-if)# ip nat outside
RE(config-if)# no shutdown
RE(config-if)# exit
!
! Etape 1 — quelles adresses privées peuvent etre traduites
RE(config)# access-list 1 permit 192.168.1.0 0.0.0.255
!
! Etape 2 — le pool d'adresses publiques disponibles
RE(config)# ip nat pool Atelier1 200.200.200.1 200.200.200.5 netmask 255.255.255.128
!
! Etape 3 — lier l'ACL au pool (commande principale)
RE(config)# ip nat inside source list 1 pool Atelier1`) +
      note("warn", "Le réseau privé <b>n'est volontairement PAS annoncé dans OSPF</b> : le NAT a justement pour rôle de le rendre invisible dehors. En revanche, les routeurs distants doivent connaître une <b>route vers le pool</b> pour le retour des paquets : <code>ip route 200.200.200.0 255.255.255.128 212.217.7.117</code>.") +
      mnemo("1️⃣2️⃣3️⃣", "<b>ACL → pool → inside source list … pool</b>. Si tu oublies de lier les deux, rien ne se traduit.") },

    { id: "pat", title: "5 · PAT / overload (Atelier 2)",
      html: `<p>Objectif : <b>tout</b> le LAN privé <code>192.168.10.0/24</code> partage <b>une seule</b> IP publique (celle de l'interface de sortie), différencié par les numéros de port.</p>` +
      cli("PAT (overload) sur R1",
`R1(config)# interface fa0/0
R1(config-if)# ip address 192.168.10.1 255.255.255.0
R1(config-if)# ip nat inside
R1(config-if)# no shutdown
R1(config-if)# exit
R1(config)# interface s0/0/0
R1(config-if)# ip address 212.217.7.1 255.255.255.252
R1(config-if)# ip nat outside
R1(config-if)# no shutdown
R1(config-if)# exit
!
R1(config)# access-list 1 permit 192.168.10.0 0.0.0.255
!
! PAT : on surcharge l'IP de l'interface de sortie
R1(config)# ip nat inside source list 1 interface s0/0/0 overload`) +
      note("exam", "Le mot-clé <code>overload</code> est <b>indispensable</b> : c'est lui qui active le partage d'une seule IP par les ports. Sans lui, c'est du NAT dynamique 1-pour-1.") +
      note("info", "Variante : on peut aussi surcharger une IP d'un pool — <code>ip nat inside source list 1 pool NOM overload</code>.") },

    { id: "verif", title: "6 · Vérification & dépannage",
      html: cli("Commandes de vérification",
`R1# show ip nat translations      // la table des traductions actives
R1# show ip nat statistics        // hits/misses, interfaces, pool
R1# debug ip nat                  // voir les traductions en temps réel
R1# clear ip nat translation *    // vider la table dynamique`) +
      `<p>Exemple de table après un ping depuis un PC privé (NAT dynamique) :</p>` +
      cli("show ip nat translations (sortie type)",
`Pro  Inside global     Inside local      Outside local     Outside global
icmp 200.200.200.1:64  192.168.1.10:64   212.217.26.10:64  212.217.26.10:64`) +
      key("Pièges classiques (vus en TP)", [
        "Inverser <code>inside</code> / <code>outside</code> sur les interfaces → aucune traduction.",
        "Oublier la <b>route de retour</b> vers le pool / l'IP statique sur les routeurs distants.",
        "Annoncer le réseau privé dans OSPF (à NE PAS faire — le NAT le masque).",
        "Oublier <code>overload</code> pour le PAT.",
        "ACL qui ne couvre pas le bon réseau source (mauvais wildcard)."
      ]) +
      note("tip", "Le 1ᵉʳ ping perdu dans Packet Tracer est <b>normal</b> (résolution ARP) — ce n'est pas un bug du NAT.") }
  ],

  quiz: [
    { q: "Quel mot-clé active le partage d'une seule IP publique (PAT) ?", opts: ["overload", "pool", "static", "inside"], a: 0,
      exp: "« overload » différencie les hôtes par numéro de port sur une seule IP publique.", tag: "NAT" },
    { q: "Sur quelle interface place-t-on « ip nat inside » ?", opts: ["Côté Internet/WAN", "Côté LAN privé", "Sur le pool", "Sur l'ACL"], a: 1,
      exp: "inside = côté réseau privé interne ; outside = côté public.", tag: "NAT" },
    { q: "Pour publier un serveur interne sur une IP publique fixe, on utilise…", opts: ["NAT dynamique", "PAT overload", "NAT statique", "DHCP"], a: 2,
      exp: "Le NAT statique crée un mappage permanent 1-pour-1, idéal pour un serveur.", tag: "NAT statique" },
    { q: "Dans le NAT dynamique, à quoi sert l'ACL standard ?", opts: ["À filtrer le trafic web", "À identifier les adresses privées à traduire", "À créer le pool", "À router vers Internet"], a: 1,
      exp: "L'ACL (ex. access-list 1 permit 192.168.1.0 0.0.0.255) désigne QUI peut être traduit.", tag: "NAT dynamique" },
    { q: "Quelle commande lie l'ACL 1 à un pool nommé NAT-POOL ?", opts: ["ip nat pool 1 NAT-POOL", "ip nat inside source list 1 pool NAT-POOL", "ip nat outside source static 1", "access-list 1 pool NAT-POOL"], a: 1,
      exp: "« ip nat inside source list 1 pool NAT-POOL » est la commande principale.", tag: "NAT dynamique" },
    { q: "Pourquoi NE PAS annoncer le réseau privé dans OSPF quand on fait du NAT ?", opts: ["OSPF ne supporte pas le privé", "Le NAT a justement pour but de le masquer dehors", "Ça crée une boucle", "Pour économiser la RAM"], a: 1,
      exp: "Le réseau privé doit rester invisible dehors ; on annonce plutôt le lien WAN et le pool.", tag: "NAT" },
    { q: "Dans show ip nat translations, un mappage statique a Pro =", opts: ["icmp", "tcp", "---", "udp"], a: 2,
      exp: "Le NAT statique est sans port → la colonne protocole affiche ---.", tag: "NAT statique" }
  ],

  flashcards: [
    { k: "Définition", f: "Que fait le NAT ?", b: "Traduit des adresses IP privées (RFC 1918) en adresses publiques routables, sur le routeur de bordure." },
    { k: "Vocabulaire", f: "Inside local vs inside global", b: "Inside local = IP privée réelle de l'hôte ; inside global = IP publique qui le représente dehors." },
    { k: "Commande", f: "PAT : la commande complète", b: "ip nat inside source list 1 interface s0/0/0 overload (+ access-list 1 permit <réseau>)." },
    { k: "Commande", f: "NAT statique : la commande", b: "ip nat inside source static 192.168.10.20 212.217.26.100" },
    { k: "Mot-clé", f: "Rôle de « overload »", b: "Active le PAT : partage d'UNE seule IP publique via les numéros de port." },
    { k: "Étapes", f: "NAT dynamique en 3 temps", b: "1) ACL standard (qui traduire) — 2) ip nat pool (IP publiques) — 3) ip nat inside source list N pool NOM." },
    { k: "Interfaces", f: "Quelles 2 commandes d'interface obligatoires ?", b: "ip nat inside (côté LAN) et ip nat outside (côté WAN)." },
    { k: "Vérif", f: "Commande pour voir la table NAT", b: "show ip nat translations (et show ip nat statistics, debug ip nat)." },
    { k: "Piège", f: "Que faut-il sur le routeur distant ?", b: "Une route de retour vers le pool / l'IP statique (ex. ip route 200.200.200.0 … )." }
  ]
});
