/* ===================== MODULE 3 · ACL DE BASE =====================
   D'après expose-acl-base.pdf + Atelier 7 (méthode du prof : deux ACL,
   ACL 100 en entrée Fa0/0, ACL 150 retour avec « established »).
   Partie ② du programme d'examen.
   ================================================================ */
NM.register({
  id: "acl", color: "acl", icon: "🚦", badge: "acl-base",
  title: "ACL de base",
  kicker: "Filtrage du trafic — Partie ②",
  est: "≈ 50 min",
  desc: "Listes de contrôle d'accès : filtrer le trafic par adresse, protocole et port. Masques génériques, standard vs étendue, sens d'application, et la méthode pare-feu du prof (deux ACL avec established).",
  chips: ["wildcard mask", "standard/étendue", "in/out", "established", "deny implicite"],
  sections: [

    { id: "obj", title: "À quoi sert une ACL ?",
      html: `<p>Une <b>ACL</b> (<i>Access Control List</i>) ajoute des fonctions de <b>pare-feu</b> au routeur : elle examine chaque paquet et décide de le <b>laisser passer</b> (<code>permit</code>) ou de le <b>jeter</b> (<code>deny</code>).</p>
      <ul>
        <li>Filtre sur les <b>couches 3 (adresses IP)</b> et <b>4 (ports TCP/UDP)</b>.</li>
        <li>Contrôle le trafic entrant depuis l'extérieur, ou sortant vers l'extérieur.</li>
        <li>Crée en mode de configuration globale, puis <b>appliquée à une interface</b> dans un sens (in/out).</li>
      </ul>` +
      note("info", "Une ACL ne filtre <b>jamais</b> les paquets générés par le routeur lui-même. Elle filtre le trafic qui le <b>traverse</b>.") },

    { id: "wildcard", title: "1 · Le masque générique (wildcard)",
      html: `<p>Le <b>wildcard mask</b> indique quels bits de l'adresse doivent être <b>vérifiés</b> ou <b>ignorés</b>. C'est l'inverse logique d'un masque de sous-réseau.</p>
      <table class="policy-table">
        <tr><th>Bit du wildcard</th><th>Signification</th></tr>
        <tr><td><b>0</b></td><td>le bit correspondant <b>doit correspondre</b> (match)</td></tr>
        <tr><td><b>1</b></td><td>le bit correspondant est <b>ignoré</b> (n'importe)</td></tr>
      </table>
      <p>Astuce de calcul : <b>wildcard = 255.255.255.255 − masque de sous-réseau</b>.</p>
      <table class="policy-table">
        <tr><th>Cible</th><th>Écriture</th></tr>
        <tr><td>Tout le réseau 192.168.18.0/24</td><td><code>192.168.18.0 0.0.0.255</code></td></tr>
        <tr><td>Un seul hôte 192.168.18.5</td><td><code>192.168.18.5 0.0.0.0</code> = <code>host 192.168.18.5</code></td></tr>
        <tr><td>N'importe quelle adresse</td><td><code>0.0.0.0 255.255.255.255</code> = <code>any</code></td></tr>
        <tr><td>Un /30 (4 adresses)</td><td><code>… 0.0.0.3</code></td></tr>
      </table>` +
      mnemo("🎭", "Wildcard : un <b>0</b> verrouille (regarde), un <b>1</b> laisse libre (ignore). <code>0.0.0.255</code> = « le dernier octet, je m'en fiche » → tout le /24.") },

    { id: "stdext", title: "2 · Standard ou étendue ?",
      html: `<table class="policy-table">
        <tr><th></th><th>ACL standard</th><th>ACL étendue</th></tr>
        <tr><td>Numéros</td><td><b>1–99</b> (et 1300–1999)</td><td><b>100–199</b> (et 2000–2699)</td></tr>
        <tr><td>Filtre sur</td><td>adresse <b>source</b> seulement</td><td>source + destination + <b>protocole + port</b></td></tr>
        <tr><td>À placer…</td><td>au plus <b>près de la destination</b></td><td>au plus <b>près de la source</b></td></tr>
      </table>
      <p>Syntaxe :</p>` +
      cli("Création d'ACL",
`! ACL STANDARD (source uniquement)
R(config)# access-list 10 permit 192.168.1.0 0.0.0.255
R(config)# access-list 10 deny any
!
! ACL ÉTENDUE (proto + source + destination + port)
R(config)# access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80
R(config)# access-list 100 deny ip any any
!
! ACL ÉTENDUE NOMMÉE (recommandée — lisible, éditable)
R(config)# ip access-list extended FILTRE-WEB
R(config-ext-nacl)# permit tcp any any eq 443
R(config-ext-nacl)# deny ip any any`) +
      note("exam", "Mnémo de placement : <b>S</b>tandard → près de la de<b>S</b>tination ; é<b>T</b>endue → près de la sour<b>T</b>ce (source). Pourquoi ? La standard ne connaît que la source, on la met loin pour ne pas tout bloquer trop tôt.") },

    { id: "sens", title: "3 · Sens d'application (in / out) & deny implicite",
      html: dg("aclDecision") +
      `<p>On applique l'ACL <b>sur une interface</b>, dans un <b>sens</b> :</p>
      <ul>
        <li><b>in</b> : le paquet est filtré <u>en entrant</u> dans l'interface (avant routage).</li>
        <li><b>out</b> : le paquet est filtré <u>en sortant</u> de l'interface (après routage).</li>
      </ul>` +
      cli("Application à une interface",
`R(config)# interface fa0/0
R(config-if)# ip access-group 100 in     // filtre ce qui ENTRE par Fa0/0`) +
      note("warn", "🚨 <b>Deny implicite</b> : toute ACL se termine par un <code>deny any</code> invisible. <u>Tout ce qui n'est pas explicitement autorisé est bloqué</u>. Pense toujours à un <code>permit</code> final si tu veux laisser passer le reste.") +
      key("Les 6 règles d'or des ACL (exposé du prof)", [
        "Une seule ACL <b>par interface, par sens, par protocole</b>.",
        "Toute ACL se termine par une <b>exclusion globale</b> (deny implicite).",
        "Standard = 1–99, étendue = 100–199.",
        "Par défaut sans <code>ip access-group</code>, l'ACL ne filtre rien.",
        "Standard <b>près de la destination</b>, étendue <b>près de la source</b>.",
        "Les ACL ne filtrent pas les paquets générés par le routeur lui-même."
      ]) },

    { id: "operateurs", title: "4 · Opérateurs de port & established",
      html: `<p>Dans une ACL étendue, on précise le port applicatif avec un opérateur :</p>
      <table class="policy-table">
        <tr><th>Opérateur</th><th>Sens</th><th>Exemple</th></tr>
        <tr><td><code>eq</code></td><td>égal à</td><td><code>permit tcp any any eq 80</code></td></tr>
        <tr><td><code>gt</code> / <code>lt</code></td><td>supérieur / inférieur</td><td><code>… gt 1023</code></td></tr>
        <tr><td><code>neq</code></td><td>différent de</td><td><code>… neq 23</code></td></tr>
        <tr><td><code>range</code></td><td>plage</td><td><code>… range 1024 65535</code></td></tr>
      </table>
      <p>Ports utiles : <b>80</b> HTTP · <b>443</b> HTTPS · <b>53</b> DNS · <b>21</b> FTP · <b>23</b> Telnet · <b>25</b> SMTP.</p>` +
      note("exam", "Le mot-clé <code>established</code> autorise <b>uniquement les réponses</b> d'une connexion TCP déjà initiée de l'intérieur (bit ACK/RST positionné). C'est la base d'un pare-feu : on laisse sortir, et on n'accepte en retour que les réponses légitimes.") +
      cli("established en action",
`! Autorise le retour des connexions web initiées de l'interieur
permit tcp any eq 80 192.168.10.0 0.0.0.255 established
permit tcp any eq 443 192.168.10.0 0.0.0.255 established`) },

    { id: "methode", title: "5 · La méthode du prof (Atelier 7)",
      html: `<p>Politique pare-feu type sur le routeur de bordure R1 : l'hôte <b>Admin</b> (212.217.26.2) peut pinger dehors ; HTTP/HTTPS/DNS autorisés ; <b>seules les réponses</b> reviennent ; le reste est bloqué.</p>
      <p>👉 Deux ACL étendues : une pour le trafic <b>aller</b> (LAN → ext) en entrée sur la patte LAN, une pour le trafic <b>retour</b> (ext → LAN) en entrée sur la patte WAN.</p>` +
      cli("ACL 100 — trafic sortant (appliquée Fa0/0 in)",
`R1(config)# ip access-list extended 100
R1(config-ext-nacl)# permit icmp host 212.217.26.2 any echo   // Admin seul peut pinger
R1(config-ext-nacl)# permit udp any any eq 53                  // DNS
R1(config-ext-nacl)# permit tcp any any eq 80                  // HTTP
R1(config-ext-nacl)# permit tcp any any eq 443                 // HTTPS
R1(config-ext-nacl)# deny ip any any                           // tout le reste
R1(config-ext-nacl)# exit
R1(config)# interface fa0/0
R1(config-if)# ip access-group 100 in`) +
      cli("ACL 150 — trafic retour (appliquée S0/0/0 in)",
`R1(config)# ip access-list extended 150
R1(config-ext-nacl)# permit icmp any host 212.217.26.2 echo-reply  // réponse ping → Admin
R1(config-ext-nacl)# permit udp any eq 53 any                      // réponses DNS
R1(config-ext-nacl)# permit tcp any eq 80 any established           // réponses HTTP
R1(config-ext-nacl)# permit tcp any eq 443 any established          // réponses HTTPS
R1(config-ext-nacl)# deny ip any any
R1(config-ext-nacl)# exit
R1(config)# interface s0/0/0
R1(config-if)# ip access-group 150 in`) +
      note("tip", "Logique : l'ACL d'<b>entrée Fa0/0</b> filtre ce qui part du LAN ; l'ACL d'<b>entrée S0/0/0</b> filtre ce qui revient d'Internet. Le sens « in » se raisonne <u>du point de vue du routeur</u>.") +
      note("exam", "C'est exactement le type de question d'examen : on te donne un cahier des charges, tu dois dire <b>quelle ACL, quelle interface, quel sens</b>, puis écrire les règles. → Entraîne-toi avec l'outil <b>Cahiers des charges</b> et le lab <b>ACL étendues</b>.") },

    { id: "verif", title: "6 · Vérification",
      html: cli("Commandes de vérification",
`R1# show access-lists                 // toutes les ACL + compteurs de correspondance
R1# show ip interface fa0/0           // quelle ACL appliquée, dans quel sens
R1# show running-config               // la config complète`) +
      key("Réflexe de test (méthode du prof)", [
        "Tester <b>avant</b> ACL : tous les pings passent (routage OK).",
        "Tester <b>après</b> : depuis Admin → OK, depuis un autre poste → bloqué.",
        "Un <code>deny</code> renvoie « Destination host unreachable » côté source.",
        "Vérifier les compteurs avec <code>show access-lists</code> (les matchs s'incrémentent)."
      ]) }
  ],

  quiz: [
    { q: "Le wildcard 0.0.0.255 sur 192.168.1.0 désigne…", opts: ["Un seul hôte", "Tout le réseau /24", "Tout Internet", "Les hôtes pairs"], a: 1,
      exp: "0 = vérifier, 1 = ignorer ; 0.0.0.255 ignore le dernier octet → tout le /24.", tag: "ACL" },
    { q: "Une ACL standard filtre sur…", opts: ["La source uniquement", "Source + destination + port", "Le protocole seulement", "Les VLAN"], a: 0,
      exp: "Standard (1-99) = adresse source seulement ; étendue = source+dest+proto+port.", tag: "ACL" },
    { q: "Où placer une ACL étendue ?", opts: ["Près de la destination", "Près de la source", "Sur le serveur DNS", "Peu importe"], a: 1,
      exp: "Étendue près de la source (elle connaît la destination, on bloque tôt).", tag: "ACL" },
    { q: "Que fait le deny implicite ?", opts: ["Autorise tout par défaut", "Bloque tout ce qui n'est pas explicitement permis", "Supprime l'ACL", "Loggue le trafic"], a: 1,
      exp: "Toute ACL finit par un deny any invisible : non autorisé = bloqué.", tag: "ACL" },
    { q: "À quoi sert le mot-clé « established » ?", opts: ["Créer l'ACL", "N'autoriser que les réponses TCP aux connexions initiées de l'intérieur", "Activer le NAT", "Ouvrir tous les ports"], a: 1,
      exp: "established autorise seulement les segments TCP de retour (ACK/RST), pas les nouvelles connexions entrantes.", tag: "ACL" },
    { q: "Commande pour appliquer l'ACL 100 en entrée sur Fa0/0 ?", opts: ["ip access-list 100 in", "ip access-group 100 in", "access-class 100 in", "ip acl 100 in"], a: 1,
      exp: "ip access-group <n> {in|out} applique l'ACL à l'interface.", tag: "ACL" },
    { q: "host 212.217.26.2 équivaut à quel wildcard ?", opts: ["0.0.0.255", "255.255.255.255", "0.0.0.0", "0.0.0.1"], a: 2,
      exp: "host = un seul hôte = wildcard 0.0.0.0 (tous les bits doivent matcher).", tag: "ACL" }
  ],

  flashcards: [
    { k: "Wildcard", f: "Bit 0 et bit 1 d'un wildcard ?", b: "0 = le bit doit correspondre (match) ; 1 = le bit est ignoré." },
    { k: "Wildcard", f: "Calcul rapide du wildcard ?", b: "wildcard = 255.255.255.255 − masque de sous-réseau (ex. /24 → 0.0.0.255)." },
    { k: "Numéros", f: "ACL standard vs étendue : numéros", b: "Standard 1–99 (source seule) ; étendue 100–199 (source+dest+proto+port)." },
    { k: "Placement", f: "Où place-t-on chaque type d'ACL ?", b: "Standard près de la destination ; étendue près de la source." },
    { k: "Sécurité", f: "Que finit toujours une ACL ?", b: "Un deny implicite (deny any) : tout ce qui n'est pas permis est bloqué." },
    { k: "Mot-clé", f: "Rôle de « established »", b: "Autorise seulement les réponses TCP des connexions initiées de l'intérieur (bit ACK)." },
    { k: "Commande", f: "Appliquer une ACL à une interface", b: "ip access-group <numéro|nom> {in | out} en mode interface." },
    { k: "Méthode prof", f: "Combien d'ACL pour filtrer aller + retour ?", b: "Deux : une en entrée côté LAN (aller), une en entrée côté WAN (retour, avec established / echo-reply)." }
  ]
});
