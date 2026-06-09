/* ===================== EXAMEN — questions transverses + MÉMO commandes ===================== */

/* Questions supplémentaires (scénarios pratiques) ajoutées au pool d'examen */
NM.examExtra = [
  { q: "Un cahier des charges demande de filtrer HTTP/HTTPS vers un serveur précis. Quel type d'ACL et où ?", tag: "Examen",
    opts: ["Standard, près de la source", "Étendue, en entrée au plus près de la source", "Standard, en sortie WAN", "Aucune ACL"], a: 1,
    exp: "Filtrage proto+port+destination → ACL étendue, appliquée en entrée près de la source." },
  { q: "Tu dois publier un serveur web interne ET faire sortir 50 PC avec une seule IP publique. Quels mécanismes ?", tag: "Examen",
    opts: ["NAT statique pour le serveur + PAT pour les PC", "PAT pour les deux", "NAT dynamique pour les deux", "NAT statique pour les deux"], a: 0,
    exp: "Serveur publié = NAT statique ; partage d'une IP pour les PC = PAT (overload)." },
  { q: "Sur l'interface WAN entrante, comment ne laisser revenir QUE les réponses des connexions internes (méthode ACL) ?", tag: "Examen",
    opts: ["permit ip any any", "permit tcp any any established + deny le reste", "deny tcp established", "permit udp any any"], a: 1,
    exp: "established autorise seulement les retours TCP des sessions initiées de l'intérieur ; le deny implicite ferme le reste." },
  { q: "Quelle commande applique le jeu d'inspection CBAC nommé OUT en entrée de Fa0/0 ?", tag: "Examen",
    opts: ["ip inspect OUT in (en mode interface)", "ip access-group OUT in", "ip inspect name OUT in", "ip nat inspect OUT"], a: 0,
    exp: "En mode interface : ip inspect <nom> in. (ip inspect name … sert à DÉFINIR le jeu, en config globale.)" },
  { q: "Dans une config NAT, l'interface côté LAN privé reçoit…", tag: "Examen",
    opts: ["ip nat outside", "ip nat inside", "ip nat enable", "ip nat pool"], a: 1,
    exp: "Côté privé = ip nat inside ; côté public = ip nat outside." },
  { q: "Pour qu'un tunnel GRE monte, que faut-il impérativement de chaque côté ?", tag: "Examen",
    opts: ["Le même mot de passe", "tunnel source et tunnel destination croisés + IP de tunnel", "Le NAT activé", "Une ACL 100"], a: 1,
    exp: "source d'un côté = destination de l'autre, IP logique sur Tunnel0, mode gre ip." },
  { q: "Architecture : où placer un serveur web accessible depuis Internet ?", tag: "Examen",
    opts: ["Dans le LAN interne", "En DMZ", "Sur le routeur", "Sur le poste admin"], a: 1,
    exp: "Les serveurs publics vont en DMZ, isolés du LAN interne." },
  { q: "AAA : quel protocole chiffre TOUT le paquet et sépare finement l'autorisation (Cisco) ?", tag: "Examen",
    opts: ["RADIUS", "TACACS+", "SNMP", "Syslog"], a: 1,
    exp: "TACACS+ (TCP, Cisco) chiffre tout et sépare A/A/A ; RADIUS ne chiffre que le mot de passe." }
];

/* ===================== MÉMO COMMANDES (cheatsheet) ===================== */
NM.cheatsheet = [
  { title: "NAT statique", icon: "📌", color: "nat",
    html: cli("Publier un serveur (1-pour-1 fixe)",
`interface fa0/0
 ip nat inside
interface s0/0/0
 ip nat outside
ip nat inside source static 192.168.10.20 212.217.26.100`) },

  { title: "NAT dynamique (pool)", icon: "🔁", color: "nat",
    html: cli("Lot d'IP publiques",
`access-list 1 permit 192.168.1.0 0.0.0.255
ip nat pool POOL 200.200.200.1 200.200.200.5 netmask 255.255.255.128
ip nat inside source list 1 pool POOL`) },

  { title: "PAT (overload)", icon: "🎯", color: "nat",
    html: cli("Partage d'une seule IP publique",
`access-list 1 permit 192.168.10.0 0.0.0.255
ip nat inside source list 1 interface s0/0/0 overload`) +
    note("tip", "Vérif : <code>show ip nat translations</code> · <code>show ip nat statistics</code> · <code>debug ip nat</code>") },

  { title: "Tunnel GRE", icon: "🛤️", color: "gre",
    html: cli("Interface Tunnel0 (à faire des 2 côtés, croisé)",
`interface tunnel 0
 ip address 10.0.0.1 255.255.255.252
 tunnel source 212.217.7.1
 tunnel destination 212.217.7.2
 tunnel mode gre ip`) },

  { title: "ACL étendue (numérotée)", icon: "🚦", color: "acl",
    html: cli("Filtrage proto + port + dest",
`access-list 100 permit icmp host 192.168.1.20 any echo
access-list 100 permit tcp any any eq 80
access-list 100 permit tcp any any eq 443
access-list 100 permit udp any any eq 53
access-list 100 deny ip any any
interface fa0/0
 ip access-group 100 in`) },

  { title: "ACL étendue nommée + retour", icon: "↩️", color: "acl",
    html: cli("Trafic retour (established / echo-reply)",
`ip access-list extended RETOUR
 permit icmp any host 192.168.1.20 echo-reply
 permit udp any eq 53 any
 permit tcp any eq 80 any established
 deny ip any any
interface s0/0/0
 ip access-group RETOUR in`) },

  { title: "ACL contextuelle (CBAC)", icon: "🧠", color: "ctx",
    html: cli("Pare-feu à états — retour automatique",
`ip inspect name INSIDE_INSPECT http
ip inspect name INSIDE_INSPECT https
ip inspect name INSIDE_INSPECT dns
ip inspect name INSIDE_INSPECT icmp
interface fa0/1
 ip inspect INSIDE_INSPECT in
interface s0/0/0
 ip access-group ACL_OUTSIDE_IN in   ! (deny ip any any)`) },

  { title: "Vérifications utiles", icon: "🔎", color: "archi",
    html: cli("Commandes show",
`show ip nat translations
show ip nat statistics
show access-lists
show ip interface brief
show ip inspect name INSIDE_INSPECT
show interfaces tunnel 0
show running-config`) },

  { title: "Wildcard masks", icon: "🎭", color: "acl",
    html: `<table class="policy-table">
      <tr><th>Cible</th><th>Écriture</th></tr>
      <tr><td>Un hôte</td><td><code>host X</code> = <code>X 0.0.0.0</code></td></tr>
      <tr><td>Tout /24</td><td><code>… 0.0.0.255</code></td></tr>
      <tr><td>Un /30</td><td><code>… 0.0.0.3</code></td></tr>
      <tr><td>N'importe</td><td><code>any</code> = <code>0.0.0.0 255.255.255.255</code></td></tr>
    </table><p style="color:var(--text-3);font-size:.84rem">wildcard = 255.255.255.255 − masque</p>` }
];
