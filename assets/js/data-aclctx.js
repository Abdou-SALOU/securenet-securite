/* ===================== MODULE 4 · ACL CONTEXTUELLE / CBAC =====================
   D'après expose-acl-avance.pdf (CBAC, ACL temporelles, dynamiques, proxy auth)
   + Atelier 9 (tables ACL contextuelles + jeux d'inspection).
   Partie ② du programme d'examen.
   ============================================================================ */
NM.register({
  id: "aclctx", color: "ctx", icon: "🧠", badge: "acl-ctx",
  title: "ACL contextuelle (CBAC)",
  kicker: "Filtrage avancé à états — Partie ②",
  est: "≈ 40 min",
  desc: "Le pare-feu à états du routeur : CBAC (ip inspect) inspecte les sessions sortantes et ouvre dynamiquement le retour, sans écrire les ACL « established » à la main. Plus ACL temporelles et dynamiques.",
  chips: ["CBAC", "ip inspect", "stateful", "ACL temporelle", "lock-and-key"],
  sections: [

    { id: "obj", title: "Le problème : filtrer le retour",
      html: `<p>Avec des ACL classiques, autoriser le trafic <b>aller</b> est simple, mais le <b>retour</b> est pénible : il faut deviner tous les flux de réponse et écrire des règles <code>established</code> à la main, pour chaque protocole.</p>
      <p>L'<b>ACL contextuelle</b> (filtrage <b>à états</b> / <i>stateful</i>) résout ça : le routeur <b>mémorise les sessions sortantes</b> et ouvre <b>automatiquement</b> le trou de retour correspondant, puis le referme à la fin de la session. C'est le principe d'un vrai pare-feu.</p>` +
      mnemo("🧠", "ACL classique = <b>sans mémoire</b> (chaque paquet jugé seul). ACL contextuelle/CBAC = <b>avec mémoire</b> des sessions (le contexte).") },

    { id: "cbac", title: "1 · CBAC (Context-Based Access Control)",
      html: `<p><b>CBAC</b> = la mise en œuvre Cisco IOS de l'inspection à états, via la commande <code>ip inspect</code>. On définit un <b>jeu d'inspection</b> (quels protocoles surveiller) et on l'applique à une interface.</p>` +
      cli("CBAC — exemple type",
`! 1) Définir le jeu d'inspection : protocoles à surveiller
R(config)# ip inspect name OUTBOUND tcp
R(config)# ip inspect name OUTBOUND udp
R(config)# ip inspect name OUTBOUND icmp
!
! 2) ACL stricte côté extérieur : on bloque tout entrant non sollicité
R(config)# ip access-list extended ACL-OUT
R(config-ext-nacl)# deny ip any any
R(config-ext-nacl)# exit
!
! 3) Appliquer : inspection en SORTIE du trafic interne + ACL en entrée externe
R(config)# interface fa0/0                 // patte interne
R(config-if)# ip inspect OUTBOUND in       // inspecte ce qui sort du LAN
R(config-if)# exit
R(config)# interface s0/0/0                 // patte externe
R(config-if)# ip access-group ACL-OUT in   // bloque l'entrée non sollicitée`) +
      note("exam", "Le génie de CBAC : l'ACL extérieure dit <b>deny ip any any</b>, et pourtant les réponses aux sessions internes passent — car CBAC a <b>ouvert dynamiquement</b> les ports de retour. Pas besoin d'<code>established</code> manuel.") },

    { id: "atelier9", title: "2 · Cas concret (Atelier 9)",
      html: `<p>Sur Router0, trois zones : <b>INSIDE</b> (Fa0/1), <b>OUTSIDE</b> (Se0/1/0), <b>DMZ</b> (Fa0/0). Quatre ACL + deux jeux d'inspection.</p>
      <p>Jeu d'inspection appliqué côté INSIDE (le retour des sessions sortantes est ouvert automatiquement) :</p>` +
      cli("Jeux d'inspection (CBAC)",
`R0(config)# ip inspect name INSIDE_INSPECT http
R0(config)# ip inspect name INSIDE_INSPECT https
R0(config)# ip inspect name INSIDE_INSPECT dns
R0(config)# ip inspect name INSIDE_INSPECT icmp
R0(config)# ip inspect name DMZ_INSPECT dns
R0(config)# ip inspect name DMZ_INSPECT icmp
!
R0(config)# interface fa0/1                       // INSIDE
R0(config-if)# ip inspect INSIDE_INSPECT in`) +
      `<p>Logique des tables ACL (extrait) :</p>
      <table class="policy-table">
        <tr><th>ACL</th><th>Interface / sens</th><th>Idée</th></tr>
        <tr><td>ACL_INSIDE_IN (étendue)</td><td>Fa0/1 in</td><td>autorise/inspecte HTTP, HTTPS, DNS, ICMP vers l'extérieur ; deny le reste</td></tr>
        <tr><td>ACL_OUTSIDE_IN (étendue)</td><td>Se0/1/0 in</td><td>n'autorise que l'accès aux serveurs DMZ ; <b>deny ip any any</b> final</td></tr>
        <tr><td>ACL_DMZ_IN (étendue)</td><td>Fa0/0 in</td><td>la DMZ ne doit pas atteindre l'INSIDE</td></tr>
      </table>` +
      note("tip", "Vérifie tes objectifs avec : <code>show ip inspect name INSIDE_INSPECT</code>, <code>show ip inspect sessions</code>, <code>show ip inspect config</code>. ➜ Entraîne-toi avec le lab <b>CBAC</b>.") },

    { id: "established", title: "3 · CBAC vs established",
      html: `<table class="policy-table">
        <tr><th></th><th>ACL « established »</th><th>CBAC (ip inspect)</th></tr>
        <tr><td>Type</td><td>statique (sans état)</td><td>à états (stateful)</td></tr>
        <tr><td>Retour</td><td>tu écris chaque règle à la main</td><td>ouvert/fermé automatiquement</td></tr>
        <tr><td>Protocoles</td><td>surtout TCP (bit ACK)</td><td>TCP, UDP, ICMP, applicatifs</td></tr>
        <tr><td>Sécurité</td><td>basique</td><td>forte (suit l'état réel des sessions)</td></tr>
      </table>` +
      note("info", "Sur les IOS récents, CBAC est remplacé par le <b>Zone-Based Firewall (ZBF)</b>, mais le concept « ACL contextuelle / stateful » reste identique et c'est lui qui est évalué.") },

    { id: "autres", title: "4 · ACL temporelles & dynamiques",
      html: `<p><b>ACL à caractère temporel (time-based)</b> — autorise un trafic seulement à certaines heures/jours (s'appuie sur l'horloge du routeur, idéalement synchronisée par NTP) :</p>` +
      cli("ACL temporelle",
`R(config)# time-range OUVRE
R(config-time-range)# periodic monday wednesday friday 8:00 to 17:00
R(config)# ip access-list extended TELNET-HEURES
R(config-ext-nacl)# permit tcp any any eq 23 time-range OUVRE`) +
      `<p><b>ACL dynamique (lock-and-key)</b> — l'utilisateur doit d'abord <b>s'authentifier</b> (Telnet vers le routeur) ; une entrée temporaire est alors ajoutée pour le laisser passer, puis détruite après un délai :</p>` +
      cli("ACL dynamique (lock-and-key)",
`R(config)# username toto password tutu
R(config)# access-list 101 permit tcp any host 172.18.23.2 eq telnet
R(config)# access-list 101 dynamic OUVRE timeout 120 permit ip any any
R(config)# line vty 0
R(config-line)# login local
R(config-line)# autocommand access-enable timeout 5`) +
      note("info", "Le <b>proxy d'authentification</b> fait pareil mais via un <b>navigateur web</b> (HTTP) au lieu de Telnet, avec un serveur TACACS+/RADIUS — voir le module Architecture de sécurité (AAA).") +
      key("À retenir (ACL avancées)", [
        "<b>CBAC / ip inspect</b> = pare-feu à états : inspecte le sortant, ouvre le retour automatiquement.",
        "Remplace l'écriture manuelle des règles <code>established</code>.",
        "<b>Temporelle</b> : autorise selon l'heure (time-range + NTP).",
        "<b>Dynamique (lock-and-key)</b> : ouvre l'accès après authentification de l'utilisateur.",
        "Vérification : <code>show ip inspect …</code>."
      ]) }
  ],

  quiz: [
    { q: "Que fait CBAC (ip inspect) ?", opts: ["Chiffre le trafic", "Inspecte les sessions sortantes et ouvre dynamiquement le retour", "Crée des VLAN", "Traduit les adresses"], a: 1,
      exp: "CBAC est un pare-feu à états : il mémorise les sessions et ouvre/ferme le retour automatiquement.", tag: "CBAC" },
    { q: "Principal avantage de CBAC sur une ACL « established » ?", opts: ["Plus rapide à taper", "Filtrage à états automatique (TCP, UDP, ICMP)", "Moins sécurisé", "Pas besoin de routeur"], a: 1,
      exp: "CBAC suit l'état réel des sessions et gère plus que TCP, sans règles de retour manuelles.", tag: "CBAC" },
    { q: "Commande pour définir un jeu d'inspection nommé OUT pour HTTP ?", opts: ["ip inspect OUT http", "ip inspect name OUT http", "inspect http OUT", "ip access-list inspect OUT"], a: 1,
      exp: "ip inspect name <nom> <protocole> définit le jeu d'inspection.", tag: "CBAC" },
    { q: "Une ACL temporelle s'appuie sur…", opts: ["Le NAT", "L'horloge du routeur (idéalement NTP)", "Le DNS", "Le pool DHCP"], a: 1,
      exp: "time-range utilise l'heure interne ; on synchronise via NTP pour la fiabilité.", tag: "ACL avancée" },
    { q: "L'ACL dynamique (lock-and-key) ouvre l'accès…", opts: ["À tout le monde", "Après authentification de l'utilisateur", "Seulement la nuit", "Par adresse MAC"], a: 1,
      exp: "L'utilisateur s'authentifie (Telnet) ; une entrée temporaire est alors créée.", tag: "ACL avancée" }
  ],

  flashcards: [
    { k: "Définition", f: "Qu'est-ce qu'une ACL contextuelle ?", b: "Un filtrage à états (stateful) : le routeur mémorise les sessions et ouvre dynamiquement le retour. Réalisé par CBAC (ip inspect) en IOS." },
    { k: "Commande", f: "Définir et appliquer CBAC", b: "ip inspect name SET <proto> (global) puis ip inspect SET in sur l'interface interne." },
    { k: "Différence", f: "CBAC vs established", b: "established = statique/manuel (surtout TCP) ; CBAC = à états/automatique (TCP, UDP, ICMP, applicatifs)." },
    { k: "Temporelle", f: "Comment limiter un accès à des horaires ?", b: "time-range + periodic, référencé dans la règle ACL (time-range NOM) ; synchroniser via NTP." },
    { k: "Lock-and-key", f: "Principe de l'ACL dynamique ?", b: "L'utilisateur s'authentifie (Telnet) ; une entrée temporaire est ajoutée puis supprimée après timeout." },
    { k: "Vérif", f: "Vérifier CBAC", b: "show ip inspect name <set> / sessions / config." }
  ]
});
