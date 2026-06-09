/* ===================================================================
   SecureNet — CAHIERS DES CHARGES GUIDÉS (fonctionnalité phare)
   Wizard pas-à-pas : énoncé → analyse guidée (QCM méthode du prof) → corrigé.
   Reproduit le format d'examen : "identifie les ACL, interfaces et sens".
   Expose window.NMCDC { render(view, sub), LIST }.
   =================================================================== */
(function () {
  "use strict";
  const G = window.NMGame;
  const KEY = "sn_cdc_v1";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { done: {} }; } catch { return { done: {} }; } }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  const ST = load();

  const cli = window.cli, note = window.note, key = window.key;

  /* =================================================================
     DONNÉES — les cahiers des charges
     ================================================================= */
  const LIST = [

    /* ---------- 0 · EXAMEN BLANC — sujet complet (format prof) ---------- */
    {
      id: "exam-blanc", title: "Examen blanc — Réseau ISGA", tag: "Examen blanc", color: "cdc", icon: "📝", xp: 320, badge: "examready", timed: true,
      intro: "Le sujet type : un seul cahier des charges qui combine NAT/PAT, ACL/CBAC et architecture — exactement le format Objectifs / Activités / Évalué. Chronométré, avec corrigé et barème.",
      topoHtml: `<div class="cdc-enonce"><b>Contexte — sécuriser le réseau de l'entreprise ISGA</b><br>
        Un routeur de bordure <b>RB</b> relie trois zones :<br>
        • <b>Fa0/0</b> → <b>INSIDE</b> (LAN interne) <code>192.168.10.0/24</code> — poste <b>Admin</b> = 192.168.10.2<br>
        • <b>Fa0/1</b> → <b>DMZ</b> <code>192.168.20.0/24</code> — serveur web <b>SRV</b> = 192.168.20.10<br>
        • <b>Se0/0/0</b> → <b>OUTSIDE</b> (Internet) <code>212.217.7.1/30</code></div>`,
      enonceHtml: `<div class="cdc-enonce"><b>🎯 Objectifs</b>
        <ol>
          <li>Tout le réseau INSIDE accède à Internet en <b>partageant l'IP publique</b> du lien WAN.</li>
          <li>Le serveur web de la DMZ est <b>publié</b> sur Internet via l'IP publique fixe <b>212.217.7.10</b>.</li>
          <li>Seul le poste <b>Admin</b> peut <b>pinger</b> l'extérieur.</li>
          <li>INSIDE peut faire du <b>Web (80/443)</b> et du <b>DNS (53)</b> vers Internet.</li>
          <li>Depuis Internet, on accède au <b>serveur web DMZ</b> (80/443) mais <b>jamais</b> au LAN INSIDE.</li>
          <li>Le <b>retour</b> des sessions internes doit être autorisé <b>automatiquement</b> (sans « established » à la main).</li>
          <li>Par défaut, <b>tout est bloqué</b>.</li>
        </ol>
        <span style="color:var(--text-3)">⏱️ Travaille comme en examen : raisonne chaque activité, puis compare au corrigé et au barème.</span></div>`,
      steps: [
        { ask: "<b>Activité 1.</b> Objectif 1 (partage de l'IP publique pour tout INSIDE) → quel mécanisme ?", options: [
            { label: "PAT (NAT overload)", correct: true, fb: "Oui : partage d'une seule IP publique = PAT, mot-clé overload." },
            { label: "NAT statique", correct: false, fb: "Le statique est 1-pour-1, inadapté à un partage." },
            { label: "NAT dynamique sans overload", correct: false, fb: "Sans overload, c'est 1-pour-1 jusqu'à épuisement." }
          ], explain: "Partage d'UNE IP = PAT (overload)." },
        { ask: "<b>Activité 2.</b> Objectif 2 (publier le serveur DMZ sur 212.217.7.10) → quel mécanisme et quelle commande ?", options: [
            { label: "ip nat inside source static 192.168.20.10 212.217.7.10", correct: true, fb: "Exact : NAT statique, mappage permanent privé ↔ public." },
            { label: "ip nat inside source list 1 interface s0/0/0 overload", correct: false, fb: "Ça, c'est le PAT pour la sortie, pas la publication d'un serveur." },
            { label: "ip route 212.217.7.10 192.168.20.10", correct: false, fb: "Une route ne fait pas de translation." }
          ], explain: "Publier un serveur = NAT statique : ip nat inside source static <privé> <public>." },
        { ask: "<b>Activité 3.</b> Pour le NAT, quelles interfaces sont <b>inside</b> et laquelle <b>outside</b> ?", options: [
            { label: "Fa0/0 et Fa0/1 = inside ; Se0/0/0 = outside", correct: true, fb: "Oui : INSIDE et DMZ sont des réseaux privés (inside) ; le WAN est outside." },
            { label: "Fa0/0 = inside ; Fa0/1 et Se0/0/0 = outside", correct: false, fb: "La DMZ est aussi en adressage privé traduit → inside." },
            { label: "Se0/0/0 = inside", correct: false, fb: "Non : le côté WAN public est toujours outside." }
          ], explain: "inside = tous les réseaux privés à traduire (INSIDE + DMZ) ; outside = le WAN." },
        { ask: "<b>Activité 4.</b> Objectifs 3-5 → quel type d'ACL est nécessaire ?", options: [
            { label: "Étendue (proto + source + destination + port)", correct: true, fb: "Oui : on filtre ICMP, TCP 80/443, UDP 53 vers des destinations précises." },
            { label: "Standard", correct: false, fb: "La standard ne connaît que la source." },
            { label: "Aucune", correct: false, fb: "Sans ACL, la politique ne tient pas." }
          ], explain: "Filtrage proto/port/destination ⇒ ACL étendue." },
        { ask: "<b>Activité 5.</b> Objectif 3 (seul Admin ping dehors) → quelle règle, appliquée où ?", options: [
            { label: "permit icmp host 192.168.10.2 any echo — sur Fa0/0 in", correct: true, fb: "Exact : un seul hôte source, echo (la requête), au plus près de la source (Fa0/0 in)." },
            { label: "permit icmp 192.168.10.0 0.0.0.255 any echo — sur Se0/0/0 in", correct: false, fb: "Cela autoriserait tout INSIDE, et le sens est mauvais." },
            { label: "deny icmp any any — sur Fa0/0 out", correct: false, fb: "On veut autoriser Admin, pas tout interdire." }
          ], explain: "host = un seul poste ; echo = la requête ; ACL étendue en entrée de la patte source." },
        { ask: "<b>Activité 6.</b> Objectif 5 (Internet → serveur web DMZ autorisé) → quelle règle sur Se0/0/0 in ?", options: [
            { label: "permit tcp any host 212.217.7.10 eq 80 (et 443)", correct: true, fb: "Oui : on autorise l'accès depuis Internet à l'IP publique publiée du serveur, sur 80/443." },
            { label: "permit ip any any", correct: false, fb: "Cela ouvrirait tout — interdit (objectif 5 : jamais INSIDE)." },
            { label: "permit tcp any 192.168.10.0 0.0.0.255 eq 80", correct: false, fb: "Ça viserait INSIDE, ce qui est interdit." }
          ], explain: "On n'ouvre QUE le service publié (serveur DMZ, ports 80/443) ; le reste tombe sous le deny." },
        { ask: "<b>Activité 7.</b> Objectif 5 (Internet → INSIDE interdit) → comment le garantir ?", options: [
            { label: "Ne rien autoriser vers 192.168.10.0/24 + deny ip any any final", correct: true, fb: "Exact : aucune permission vers INSIDE + deny implicite/explicite = INSIDE injoignable." },
            { label: "permit tcp any 192.168.10.0 0.0.0.255 established uniquement", correct: false, fb: "Avec CBAC le retour est géré automatiquement ; on ne crée pas d'ouverture vers INSIDE ici." },
            { label: "Mettre INSIDE en outside", correct: false, fb: "Non-sens d'adressage." }
          ], explain: "Pas de permit vers INSIDE → le deny final bloque tout accès entrant non sollicité." },
        { ask: "<b>Activité 8.</b> Objectif 6 (retour automatique des sessions internes) → quelle techno ?", options: [
            { label: "CBAC — ip inspect (pare-feu à états)", correct: true, fb: "Oui : CBAC inspecte le sortant et ouvre le retour tout seul, sans règles established." },
            { label: "NAT statique", correct: false, fb: "Le NAT ne gère pas l'état des sessions." },
            { label: "Routage OSPF", correct: false, fb: "Le routage ne filtre pas." }
          ], explain: "Retour automatique = CBAC : ip inspect name … puis ip inspect … in côté interne." },
        { ask: "<b>Activité 9.</b> Où appliquer l'inspection CBAC INSIDE_INSPECT ?", options: [
            { label: "Fa0/0 in (entrée de la patte interne)", correct: true, fb: "Oui : on inspecte le trafic au moment où il sort du LAN, pour ouvrir son retour." },
            { label: "Se0/0/0 in", correct: false, fb: "On inspecte au plus près de la source des sessions (INSIDE)." },
            { label: "Fa0/1 out", correct: false, fb: "C'est la DMZ, pas le trafic INSIDE." }
          ], explain: "Inspection en entrée de l'interface interne (Fa0/0 in)." },
        { ask: "<b>Activité 10.</b> Architecture : pourquoi placer le serveur web en <b>DMZ</b> et non dans INSIDE ?", options: [
            { label: "Pour qu'un serveur piraté reste cloisonné et n'atteigne pas le LAN interne", correct: true, fb: "Exact : la DMZ isole les services exposés ; une compromission ne se propage pas vers INSIDE." },
            { label: "Pour aller plus vite", correct: false, fb: "Ce n'est pas une question de performance." },
            { label: "Parce que la DMZ n'a pas besoin d'IP", correct: false, fb: "Faux, la DMZ est adressée comme toute zone." }
          ], explain: "DMZ = zone tampon pour les services exposés, isolée du LAN interne." },
        { ask: "<b>Activité 11.</b> Pour administrer RB de façon centralisée et tracée (qui se connecte, quels droits, quoi), on met en place…", options: [
            { label: "AAA (avec TACACS+ pour l'admin des équipements)", correct: true, fb: "Oui : AAA centralise authentification/autorisation/traçabilité ; TACACS+ (TCP, chiffre tout) est idéal pour l'admin Cisco." },
            { label: "Un simple mot de passe enable", correct: false, fb: "Ni centralisé, ni tracé, ni granulaire." },
            { label: "Le NAT", correct: false, fb: "Le NAT ne gère pas les accès admin." }
          ], explain: "Admin centralisée + traçabilité = AAA ; TACACS+ pour les équipements." }
      ],
      solution: window.cli("Corrigé — NAT / PAT sur RB",
`hostname RB
interface fa0/0
 ip address 192.168.10.1 255.255.255.0
 ip nat inside
 no shutdown
interface fa0/1
 ip address 192.168.20.1 255.255.255.0
 ip nat inside
 no shutdown
interface s0/0/0
 ip address 212.217.7.1 255.255.255.252
 ip nat outside
 no shutdown
!
! (1) PAT : tout le privé partage l'IP du lien WAN
access-list 1 permit 192.168.10.0 0.0.0.255
access-list 1 permit 192.168.20.0 0.0.0.255
ip nat inside source list 1 interface s0/0/0 overload
!
! (2) NAT statique : publier le serveur web DMZ
ip nat inside source static 192.168.20.10 212.217.7.10`) +
      window.cli("Corrigé — ACL étendue + CBAC",
`! (3)(4) trafic INSIDE autorisé, appliqué en entrée Fa0/0
ip access-list extended INSIDE_IN
 permit icmp host 192.168.10.2 any echo          ! (3) Admin seul ping
 permit tcp 192.168.10.0 0.0.0.255 any eq 80     ! (4) web
 permit tcp 192.168.10.0 0.0.0.255 any eq 443
 permit udp 192.168.10.0 0.0.0.255 any eq 53     ! (4) DNS
 deny ip any any
!
! (5) entrée d'Internet : seulement le serveur web publié, jamais INSIDE
ip access-list extended OUTSIDE_IN
 permit tcp any host 212.217.7.10 eq 80
 permit tcp any host 212.217.7.10 eq 443
 deny ip any 192.168.10.0 0.0.0.255              ! (5) INSIDE interdit
 deny ip any any
!
! (6) CBAC : ouvre le retour des sessions internes automatiquement
ip inspect name INSIDE_INSPECT http
ip inspect name INSIDE_INSPECT https
ip inspect name INSIDE_INSPECT dns
ip inspect name INSIDE_INSPECT icmp
!
interface fa0/0
 ip access-group INSIDE_IN in
 ip inspect INSIDE_INSPECT in
interface s0/0/0
 ip access-group OUTSIDE_IN in`) +
      `<div class="cdc-bareme"><b>📊 Barème / points à cocher</b>
        <ul>
          <li>✅ inside/outside corrects (Fa0/0, Fa0/1 = inside ; Se0/0/0 = outside)</li>
          <li>✅ PAT avec <code>overload</code> + ACL listant les réseaux privés</li>
          <li>✅ NAT statique pour le serveur DMZ</li>
          <li>✅ ACL étendue : Admin seul en ICMP, Web/DNS pour INSIDE, deny final</li>
          <li>✅ Accès Internet limité au serveur publié, INSIDE injoignable</li>
          <li>✅ CBAC (ip inspect) appliqué en entrée interne pour le retour auto</li>
          <li>✅ Architecture justifiée : DMZ cloisonnée, AAA/TACACS+ pour l'admin</li>
        </ul></div>` +
      note("exam", "Stratégie d'examen : commence par le <b>NAT</b> (inside/outside, PAT, statique), puis l'<b>ACL étendue</b> au plus près de la source, et termine par <b>CBAC</b> pour le retour. Justifie toujours <b>interface + sens</b>."),
      labHint: "acl-ext"
    },

    /* ---------- 1 · EXERCICE 1 — ACL (le cahier du prof) ---------- */
    {
      id: "ex1-acl", title: "EXERCICE 1 — ACL pare-feu", tag: "ACL étendues", color: "acl", icon: "🚦", xp: 220, badge: "acl-base",
      intro: "Le cahier des charges donné par le prof. Un routeur, deux LAN et Internet. Tu dois identifier les ACL, les interfaces et le sens d'application, puis écrire chaque règle.",
      topoHtml: `<div class="cdc-enonce"><b>Topologie</b><br>
        Un routeur relie trois réseaux :<br>
        • <b>E0</b> → <b>LAN1</b> <code>192.168.1.0/24</code><br>
        • <b>E1</b> → <b>LAN2</b> <code>192.168.2.0/24</code> (contient le serveur web <b>SERV-HTTP 192.168.2.250</b>)<br>
        • <b>S0</b> → <b>Internet</b></div>`,
      enonceHtml: `<div class="cdc-enonce"><b>Accès autorisés</b>
        <ol>
          <li>Les postes de <b>LAN1</b> consultent (HTTP/HTTPS) le serveur web de LAN2 (192.168.2.250).</li>
          <li>LAN1 → services Web (TCP 80 & 443) vers Internet.</li>
          <li>LAN1 → services DNS (UDP & TCP 53) vers Internet.</li>
          <li>LAN2 → services Web (TCP 80 & 443) vers Internet.</li>
          <li>LAN2 → services DNS (UDP & TCP 53) vers Internet.</li>
          <li>La machine <b>192.168.1.20</b> peut <b>pinger</b> toutes les machines de LAN2.</li>
        </ol>
        <b>Accès interdits</b>
        <ol start="7">
          <li>La machine <b>192.168.1.21</b> ne communique avec personne dehors (ni LAN2 ni Internet).</li>
          <li>Depuis Internet, l'accès au serveur web 192.168.2.250 est <b>impossible</b>.</li>
          <li>Tout trafic <b>UDP sortant</b> vers Internet est interdit, sauf ce qui est explicitement autorisé.</li>
          <li><b>Par défaut</b>, tout paquet ne correspondant à aucune règle est bloqué.</li>
        </ol></div>`,
      steps: [
        { ask: "Quel <b>type d'ACL</b> est nécessaire ici ?", options: [
            { label: "Standard (source seule)", correct: false, fb: "Non : on filtre sur la destination, le protocole (TCP/UDP/ICMP) et le port (80/443/53) — la standard ne sait pas faire." },
            { label: "Étendue (source + destination + protocole + port)", correct: true, fb: "Exact. Filtrer HTTP/HTTPS/DNS/ICMP vers des destinations précises impose des ACL étendues." },
            { label: "Aucune, le routage suffit", correct: false, fb: "Non, sans ACL tout passe." }
          ], explain: "Dès qu'on parle de ports/protocoles/destination → ACL ÉTENDUE." },
        { ask: "Combien d'ACL, et sur quelles interfaces/sens, pour filtrer au plus près de la source ?", options: [
            { label: "Une seule ACL sur S0 out", correct: false, fb: "Insuffisant : on ne distingue plus facilement LAN1 et LAN2, et on filtre loin de la source." },
            { label: "Trois ACL en entrée : E0 in (LAN1), E1 in (LAN2), S0 in (Internet)", correct: true, fb: "Oui : une ACL par interface, en entrée, filtre chaque flux au plus près de sa source — la méthode du prof." },
            { label: "Deux ACL en sortie sur E0 et E1", correct: false, fb: "Le sens « out » filtrerait trop tard et compliquerait le contrôle des retours." }
          ], explain: "ACL étendue = près de la source → on applique en ENTRÉE de chaque interface d'arrivée du trafic." },
        { ask: "Besoin 7 : bloquer <b>192.168.1.21</b>. Quelle règle, et où la placer dans l'ACL E0 in ?", options: [
            { label: "deny ip host 192.168.1.21 any — tout en HAUT de l'ACL", correct: true, fb: "Parfait. L'ordre compte : ce deny doit précéder les permit, sinon le poste passerait par une règle d'autorisation." },
            { label: "deny ip host 192.168.1.21 any — tout en BAS", correct: false, fb: "Trop tard : un permit plus haut (ex. web) laisserait déjà sortir ce poste." },
            { label: "permit ip host 192.168.1.21 any", correct: false, fb: "Au contraire, il faut le bloquer." }
          ], explain: "Dans une ACL, la 1ʳᵉ règle qui correspond gagne → les exceptions (deny ciblés) se placent AVANT les permit généraux." },
        { ask: "Besoin 1 : LAN1 consulte le serveur web 192.168.2.250 (HTTP). Quelle règle ?", options: [
            { label: "permit tcp 192.168.1.0 0.0.0.255 host 192.168.2.250 eq 80", correct: true, fb: "Oui : source = réseau LAN1, destination = l'hôte serveur, port 80." },
            { label: "permit tcp any any eq 80", correct: false, fb: "Trop large : autoriserait n'importe qui vers n'importe quoi." },
            { label: "permit ip 192.168.1.0 0.0.0.255 host 192.168.2.250", correct: false, fb: "Trop permissif (tout IP) ; le besoin est HTTP/HTTPS uniquement." }
          ], explain: "On colle la règle au besoin : bon réseau source, bon hôte destination, bon port (+ une règle pour 443)." },
        { ask: "Besoin 6 : seule <b>192.168.1.20</b> peut pinger LAN2. Quelle règle ?", options: [
            { label: "permit icmp host 192.168.1.20 192.168.2.0 0.0.0.255 echo", correct: true, fb: "Exact : un seul hôte source (host), tout LAN2 en destination, echo (la requête ping)." },
            { label: "permit icmp 192.168.1.0 0.0.0.255 192.168.2.0 0.0.0.255 echo", correct: false, fb: "Cela autoriserait TOUT LAN1 à pinger, pas seulement .20." },
            { label: "permit icmp host 192.168.1.20 any", correct: false, fb: "Trop large : autoriserait à pinger Internet aussi." }
          ], explain: "« host X » = un seul hôte (wildcard 0.0.0.0). echo = la requête ; le retour (echo-reply) se gère côté E1 in." },
        { ask: "Besoin 8/10 : sur <b>S0 in</b> (Internet → intérieur), que doit faire l'ACL pour que .250 reste injoignable de l'extérieur ?", options: [
            { label: "N'autoriser que les RÉPONSES (established / DNS) puis deny le reste", correct: true, fb: "Oui : aucune connexion entrante nouvelle n'est permise → le serveur reste injoignable, et le deny implicite ferme tout." },
            { label: "permit tcp any host 192.168.2.250 eq 80", correct: false, fb: "Ce serait exactement ouvrir le serveur à Internet — interdit (besoin 8)." },
            { label: "permit ip any any", correct: false, fb: "Catastrophe : on ouvre tout l'extérieur vers l'intérieur." }
          ], explain: "Côté Internet entrant : on n'autorise QUE le trafic de retour (TCP established, réponses DNS) ; tout le reste tombe sous le deny implicite." },
        { ask: "Besoin 9 : interdire l'UDP sortant sauf le DNS. Comment ?", options: [
            { label: "Mettre UNIQUEMENT permit udp … eq 53 et laisser le deny implicite bloquer le reste de l'UDP", correct: true, fb: "Exact : on autorise précisément le DNS (53), et tout autre UDP tombe sous le deny implicite final." },
            { label: "deny udp any any en tête puis permit udp eq 53", correct: false, fb: "Mauvais ordre : le deny en tête bloquerait aussi le DNS." },
            { label: "permit udp any any", correct: false, fb: "Cela autoriserait tout l'UDP — l'inverse du besoin." }
          ], explain: "Le deny implicite est ton ami : autorise seulement le strict nécessaire, le reste est bloqué d'office." }
      ],
      solution: cli("Corrigé — ACL E0 in (trafic de LAN1)",
`ip access-list extended LAN1_IN
 deny   ip  host 192.168.1.21 any                              ! (7) blocage ciblé EN PREMIER
 permit tcp 192.168.1.0 0.0.0.255 host 192.168.2.250 eq 80     ! (1) serveur web LAN2
 permit tcp 192.168.1.0 0.0.0.255 host 192.168.2.250 eq 443    ! (1)
 permit icmp host 192.168.1.20 192.168.2.0 0.0.0.255 echo      ! (6) seul .20 ping LAN2
 permit tcp 192.168.1.0 0.0.0.255 any eq 80                    ! (2) web Internet
 permit tcp 192.168.1.0 0.0.0.255 any eq 443                   ! (2)
 permit udp 192.168.1.0 0.0.0.255 any eq 53                    ! (3) DNS UDP
 permit tcp 192.168.1.0 0.0.0.255 any eq 53                    ! (3) DNS TCP
 deny   ip  any any                                            ! (9)(10) tout le reste
!
interface e0
 ip access-group LAN1_IN in`) +
      cli("Corrigé — ACL E1 in (trafic de LAN2, + retours vers LAN1)",
`ip access-list extended LAN2_IN
 permit tcp 192.168.2.0 0.0.0.255 any eq 80                       ! (4)
 permit tcp 192.168.2.0 0.0.0.255 any eq 443                      ! (4)
 permit udp 192.168.2.0 0.0.0.255 any eq 53                       ! (5)
 permit tcp 192.168.2.0 0.0.0.255 any eq 53                       ! (5)
 permit tcp host 192.168.2.250 192.168.1.0 0.0.0.255 established  ! réponses serveur -> LAN1 (1)
 permit icmp 192.168.2.0 0.0.0.255 host 192.168.1.20 echo-reply   ! réponses ping -> .20 (6)
 deny   ip  any any
!
interface e1
 ip access-group LAN2_IN in`) +
      cli("Corrigé — ACL S0 in (retour d'Internet uniquement)",
`ip access-list extended NET_IN
 permit tcp any any established        ! réponses web établies (2)(4)
 permit udp any eq 53 any              ! réponses DNS (3)(5)
 deny   ip  any host 192.168.2.250     ! (8) Internet ne joint jamais le serveur
 deny   ip  any any                    ! (10) deny par défaut
!
interface s0
 ip access-group NET_IN in`) +
      note("exam", "Méthode gagnante : <b>1 ACL par interface, en entrée</b> ; les <b>deny ciblés en tête</b>, les <b>permit du plus précis au plus large</b>, et on s'appuie sur le <b>deny implicite</b>. Côté Internet entrant, on n'autorise que les <b>retours</b>.")
    },

    /* ---------- 2 · NAT + PAT (cahier des charges) ---------- */
    {
      id: "nat-pat", title: "Cahier — NAT & PAT", tag: "NAT / PAT", color: "nat", icon: "🔁", xp: 200, badge: "nat-master",
      intro: "Un routeur de bordure RB relie le LAN privé à Internet. Tu dois choisir le bon type de NAT pour chaque besoin, désigner inside/outside, et écrire la configuration.",
      topoHtml: `<div class="cdc-enonce"><b>Topologie</b><br>
        • <b>Fa0/0</b> → LAN privé <code>192.168.10.0/24</code> (PC + serveur 192.168.10.20)<br>
        • <b>S0/0/0</b> → WAN / Internet <code>212.217.7.1/30</code></div>`,
      enonceHtml: `<div class="cdc-enonce"><b>Besoins</b>
        <ol>
          <li>Tous les PC du LAN privé doivent accéder à Internet en <b>partageant l'IP publique</b> du lien WAN.</li>
          <li>Le <b>serveur 192.168.10.20</b> doit être joignable depuis Internet via l'IP publique fixe <b>212.217.7.10</b>.</li>
          <li>Le plan d'adressage privé ne doit pas être visible/annoncé dehors.</li>
        </ol></div>`,
      steps: [
        { ask: "Besoin 1 (partager UNE IP publique pour tous les PC) : quel mécanisme ?", options: [
            { label: "PAT (NAT overload)", correct: true, fb: "Oui : le PAT partage une seule IP publique en différenciant par numéro de port." },
            { label: "NAT statique", correct: false, fb: "Non, le statique fait du 1-pour-1 — il faudrait autant d'IP que de PC." },
            { label: "NAT dynamique sans overload", correct: false, fb: "Non, sans overload c'est 1-pour-1 jusqu'à épuisement du pool." }
          ], explain: "Partage d'une seule IP publique = PAT = mot-clé overload." },
        { ask: "Besoin 2 (publier le serveur sur une IP fixe) : quel mécanisme ?", options: [
            { label: "NAT statique", correct: true, fb: "Exact : mappage permanent 1-pour-1, idéal pour publier un serveur." },
            { label: "PAT", correct: false, fb: "Le PAT est pour la sortie partagée, pas pour publier un serveur de façon stable." },
            { label: "DHCP", correct: false, fb: "Le DHCP distribue des adresses, il ne traduit pas." }
          ], explain: "Publier un serveur sur une IP publique fixe = NAT statique." },
        { ask: "Sur quelles interfaces met-on inside / outside ?", options: [
            { label: "Fa0/0 = ip nat inside, S0/0/0 = ip nat outside", correct: true, fb: "Oui : inside = côté privé (LAN), outside = côté public (WAN)." },
            { label: "Fa0/0 = outside, S0/0/0 = inside", correct: false, fb: "Inversé : inside est toujours le côté privé." },
            { label: "Les deux en inside", correct: false, fb: "Non, il faut exactement une patte inside et une outside." }
          ], explain: "inside = LAN privé, outside = Internet — toujours du point de vue du routeur NAT." },
        { ask: "Pour le PAT, qu'identifie l'ACL standard ?", options: [
            { label: "Le réseau privé à traduire : access-list 1 permit 192.168.10.0 0.0.0.255", correct: true, fb: "Exact : l'ACL désigne QUI a le droit d'être traduit." },
            { label: "L'IP publique du serveur", correct: false, fb: "Non, ça c'est le mappage statique séparé." },
            { label: "Les ports HTTP/HTTPS", correct: false, fb: "Le PAT ici ne filtre pas par port applicatif ; l'ACL liste les sources." }
          ], explain: "ACL standard du PAT = liste des adresses privées sources autorisées à sortir." },
        { ask: "Besoin 3 (ne pas exposer le privé) : que NE faut-il PAS faire ?", options: [
            { label: "Ne PAS annoncer 192.168.10.0/24 dans OSPF", correct: true, fb: "Exact : le NAT masque le privé ; on annonce le lien WAN, pas le LAN privé." },
            { label: "Annoncer le LAN privé dans OSPF", correct: false, fb: "Erreur classique : ça exposerait le plan privé aux routeurs distants." },
            { label: "Supprimer le NAT", correct: false, fb: "Au contraire, c'est le NAT qui assure le masquage." }
          ], explain: "Le privé reste invisible : on l'exclut volontairement du routage annoncé." }
      ],
      solution: cli("Corrigé — NAT + PAT sur RB",
`hostname RB
!
interface fa0/0
 ip address 192.168.10.1 255.255.255.0
 ip nat inside
 no shutdown
!
interface s0/0/0
 ip address 212.217.7.1 255.255.255.252
 ip nat outside
 no shutdown
!
! (1) PAT : tout le LAN partage l'IP du lien WAN
access-list 1 permit 192.168.10.0 0.0.0.255
ip nat inside source list 1 interface s0/0/0 overload
!
! (2) NAT statique : publier le serveur sur une IP publique fixe
ip nat inside source static 192.168.10.20 212.217.7.10`) +
      note("warn", "Sur le routeur distant, prévoir la <b>route de retour</b> vers l'IP publique du serveur : <code>ip route 212.217.7.10 255.255.255.255 212.217.7.1</code>. Et ne jamais annoncer 192.168.10.0/24 dehors.") +
      note("exam", "Réflexe : un besoin = un mécanisme. <b>Partage</b> → PAT (overload). <b>Publier un serveur</b> → NAT statique. <b>Lot d'IP</b> → NAT dynamique (pool).")
    },

    /* ---------- 3 · CBAC / ACL contextuelle (Atelier 9) ---------- */
    {
      id: "cbac-cdc", title: "Cahier — Pare-feu à états (CBAC)", tag: "ACL contextuelle", color: "ctx", icon: "🧠", xp: 200, badge: "acl-ctx",
      intro: "Trois zones (INSIDE, OUTSIDE, DMZ). Plutôt que d'écrire les ACL de retour à la main, tu utilises CBAC pour ouvrir le retour automatiquement. Identifie le jeu d'inspection et son application.",
      topoHtml: `<div class="cdc-enonce"><b>Topologie (Atelier 9)</b><br>
        • <b>Fa0/1</b> → INSIDE (LAN interne)<br>
        • <b>Se0/0/0</b> → OUTSIDE (Internet)<br>
        • <b>Fa0/0</b> → DMZ (serveurs publics)</div>`,
      enonceHtml: `<div class="cdc-enonce"><b>Besoins</b>
        <ol>
          <li>Les postes INSIDE accèdent à Internet en HTTP/HTTPS/DNS et peuvent pinger (ICMP).</li>
          <li>Le <b>retour</b> de ces sessions doit être autorisé <b>automatiquement</b> (sans règles « established » manuelles).</li>
          <li>Aucune connexion entrante non sollicitée depuis Internet vers INSIDE.</li>
          <li>La DMZ ne doit pas pouvoir initier vers INSIDE.</li>
        </ol></div>`,
      steps: [
        { ask: "Quelle technologie répond au besoin 2 (ouvrir le retour automatiquement) ?", options: [
            { label: "CBAC — ip inspect (filtrage à états)", correct: true, fb: "Oui : CBAC mémorise les sessions sortantes et ouvre/ferme le retour tout seul." },
            { label: "ACL standard sur S0", correct: false, fb: "Une ACL standard ne gère ni le port ni l'état des sessions." },
            { label: "NAT statique", correct: false, fb: "Le NAT ne filtre pas les sessions." }
          ], explain: "Retour automatique = pare-feu à états = CBAC (ip inspect)." },
        { ask: "Comment définir le jeu d'inspection INSIDE_INSPECT ?", options: [
            { label: "ip inspect name INSIDE_INSPECT http / https / dns / icmp", correct: true, fb: "Exact : une ligne par protocole à surveiller." },
            { label: "ip inspect INSIDE_INSPECT in", correct: false, fb: "Ça, c'est l'APPLICATION à l'interface, pas la définition." },
            { label: "access-list INSIDE_INSPECT permit ip any any", correct: false, fb: "CBAC n'utilise pas access-list pour définir l'inspection." }
          ], explain: "Définition globale : ip inspect name <jeu> <protocole>, répété pour chaque protocole." },
        { ask: "Où applique-t-on l'inspection pour surveiller le trafic qui SORT de INSIDE ?", options: [
            { label: "interface Fa0/1 → ip inspect INSIDE_INSPECT in", correct: true, fb: "Oui : en entrée de l'interface interne, on inspecte ce que les postes envoient vers l'extérieur." },
            { label: "interface Se0/0/0 → ip inspect INSIDE_INSPECT out", correct: false, fb: "On inspecte au plus près de la source des sessions (côté INSIDE)." },
            { label: "Sur la DMZ Fa0/0", correct: false, fb: "La DMZ a son propre jeu d'inspection ; ici on parle du trafic INSIDE." }
          ], explain: "On inspecte le trafic sortant à son entrée sur la patte interne (Fa0/1 in)." },
        { ask: "Besoin 3 : que met l'ACL appliquée en entrée de Se0/0/0 (OUTSIDE) ?", options: [
            { label: "deny ip any any (CBAC rouvre le retour légitime tout seul)", correct: true, fb: "Parfait : l'ACL bloque tout entrant, et CBAC perce des trous temporaires pour les réponses aux sessions internes." },
            { label: "permit ip any any", correct: false, fb: "Cela ouvrirait tout l'extérieur — l'inverse du besoin." },
            { label: "Pas d'ACL du tout", correct: false, fb: "Sans ACL stricte, le filtrage perd son sens ; CBAC s'appuie dessus." }
          ], explain: "L'astuce CBAC : ACL extérieure = deny tout, et l'inspection ouvre dynamiquement le retour." }
      ],
      solution: cli("Corrigé — CBAC sur R0",
`hostname R0
!
! Jeu d'inspection : protocoles dont on veut ouvrir le retour
ip inspect name INSIDE_INSPECT http
ip inspect name INSIDE_INSPECT https
ip inspect name INSIDE_INSPECT dns
ip inspect name INSIDE_INSPECT icmp
!
! ACL extérieure : rien n'entre sans être sollicité
ip access-list extended ACL_OUTSIDE_IN
 deny ip any any
!
interface fa0/1                       ! INSIDE
 ip inspect INSIDE_INSPECT in         ! inspecte le sortant -> ouvre le retour
!
interface s0/0/0                      ! OUTSIDE
 ip access-group ACL_OUTSIDE_IN in    ! bloque tout entrant non sollicité`) +
      note("exam", "Le réflexe CBAC : <b>inspecter en entrée de la patte interne</b> + <b>ACL deny stricte en entrée de la patte externe</b>. Le retour s'ouvre tout seul. Plus besoin d'écrire les « established » à la main."),
      labHint: "cbac"
    }
  ];

  /* ---- Phase Construction : règles à assembler (+ distracteurs) par cahier ---- */
  const BUILDS = {
    "ex1-acl": {
      title: "Assemble l'<b>ACL LAN1_IN</b> (version essentielle) dans le BON ORDRE — appliquée en entrée sur E0.",
      orderMatters: true,
      target: [
        "deny ip host 192.168.1.21 any",
        "permit tcp 192.168.1.0 0.0.0.255 host 192.168.2.250 eq 80",
        "permit tcp 192.168.1.0 0.0.0.255 any eq 80",
        "permit udp 192.168.1.0 0.0.0.255 any eq 53",
        "deny ip any any"
      ],
      distractors: ["permit ip host 192.168.1.21 any", "permit ip any any"],
      tip: "Le blocage ciblé de .21 vient AVANT les permit ; le deny ip any any termine la liste."
    },
    "nat-pat": {
      title: "Sélectionne les <b>commandes NAT</b> correctes (évite les pièges : overload, sens du static).",
      orderMatters: false,
      target: [
        "access-list 1 permit 192.168.10.0 0.0.0.255",
        "ip nat inside source list 1 interface s0/0/0 overload",
        "ip nat inside source static 192.168.10.20 212.217.7.10"
      ],
      distractors: ["ip nat inside source list 1 interface s0/0/0", "ip nat outside source static 192.168.10.20 212.217.7.10"],
      tip: "PAT = …overload (sinon 1-pour-1). Publication serveur = inside source static privé → public."
    },
    "cbac-cdc": {
      title: "Remets les commandes <b>CBAC</b> dans l'ordre : définir le jeu d'inspection PUIS l'appliquer en entrée interne.",
      orderMatters: true,
      target: [
        "ip inspect name INSIDE_INSPECT http",
        "ip inspect name INSIDE_INSPECT https",
        "ip inspect name INSIDE_INSPECT dns",
        "ip inspect name INSIDE_INSPECT icmp",
        "ip inspect INSIDE_INSPECT in"
      ],
      distractors: ["ip access-group INSIDE_INSPECT in", "ip inspect INSIDE_INSPECT out"],
      tip: "D'abord ip inspect name … (définition), puis ip inspect … in sur la patte interne (application)."
    },
    "exam-blanc": {
      title: "Assemble la config <b>NAT</b> de RB : PAT pour le privé + publication du serveur DMZ.",
      orderMatters: false,
      target: [
        "access-list 1 permit 192.168.10.0 0.0.0.255",
        "access-list 1 permit 192.168.20.0 0.0.0.255",
        "ip nat inside source list 1 interface s0/0/0 overload",
        "ip nat inside source static 192.168.20.10 212.217.7.10"
      ],
      distractors: ["ip nat inside source list 1 interface s0/0/0", "ip nat inside source static 212.217.7.10 192.168.20.10"],
      tip: "Les DEUX réseaux privés (INSIDE + DMZ) dans l'ACL du PAT ; overload obligatoire ; static = privé → public."
    }
  };
  const REVIEW = { "ex1-acl": "acl", "nat-pat": "nat", "cbac-cdc": "aclctx", "exam-blanc": "acl" };
  LIST.forEach(c => { if (BUILDS[c.id]) c.build = BUILDS[c.id]; if (REVIEW[c.id]) c.reviewModule = REVIEW[c.id]; });

  /* ---- helpers ---- */
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; }
  const stripTags = h => String(h).replace(/<[^>]+>/g, "");

  const byId = id => LIST.find(c => c.id === id);

  /* =================================================================
     RENDU
     ================================================================= */
  function crumb(arr) {
    const c = document.getElementById("crumbs");
    if (c) c.innerHTML = arr.map((p, i) => (i ? `<span class="sep">/</span>` : "") + (i < arr.length - 1 ? `<span style="cursor:pointer" onclick="location.hash='#/${p[1]}'">${p[0]}</span>` : `<b>${p[0]}</b>`)).join(" ");
  }

  function render(view, sub) {
    if (!sub) return renderList(view);
    const c = byId(sub);
    if (!c) { location.hash = "#/cdc"; return; }
    renderCahier(view, c);
  }

  function renderList(view) {
    crumb([["Accueil", ""], ["Cahiers des charges", ""]]);
    document.documentElement.style.setProperty("--mc", "var(--r-cdc)");
    view.innerHTML = `
      <div class="cdc-hero">
        <div class="mh-ico">📋</div>
        <div><h1 style="margin:.1em 0">Cahiers des charges guidés</h1>
        <p style="color:var(--text-2);margin:.2em 0">Le <b>format exact de l'examen</b> : on te donne un énoncé, tu identifies <b>quelle ACL/NAT, quelle interface, quel sens</b>, puis tu construis la solution — guidé pas-à-pas, avec le corrigé du prof à la fin.</p></div>
      </div>
      <div class="cdc-grid">
        ${LIST.map(c => `
          <article class="cdc-card" data-cdc="${c.id}" style="--mc:var(--r-${c.color})">
            ${ST.done[c.id] ? `<div class="cdc-done">✓</div>` : ""}
            <span class="cdc-tag">${c.tag}</span>
            <h3>${c.icon} ${c.title}</h3>
            <p>${c.intro}</p>
            <div class="cdc-foot"><span>${c.steps.length} analyses${c.build ? " · 🏗️ construction" : ""}${c.timed ? " · ⏱️" : ""}</span><span>${c.xp} XP →</span></div>
          </article>`).join("")}
      </div>`;
    [...view.querySelectorAll("[data-cdc]")].forEach(el => el.addEventListener("click", () => location.hash = "#/cdc/" + el.dataset.cdc));
  }

  function renderCahier(view, c) {
    crumb([["Accueil", ""], ["Cahiers des charges", "cdc"], [c.title, ""]]);
    document.documentElement.style.setProperty("--mc", `var(--r-${c.color})`);
    const N = c.steps.length;
    const hasBuild = !!c.build;
    const BUILD_IDX = hasBuild ? N + 1 : -1;
    const SOL_IDX = hasBuild ? N + 2 : N + 1;
    // état : 0 = énoncé, 1..N = QCM, (BUILD_IDX = construction), SOL_IDX = bilan + corrigé
    let idx = 0, completed = false, finalMs = 0;
    const answers = new Array(N).fill(null);
    // construction
    const buildBank = hasBuild ? shuffle([...c.build.target, ...c.build.distractors]) : [];
    let buildList = [], buildChecked = false, buildSolved = false, buildXP = false;
    // chrono optionnel (examen blanc)
    let started = false, t0 = 0;
    const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    if (window.__cdcTimer) clearInterval(window.__cdcTimer);
    if (c.timed) window.__cdcTimer = setInterval(() => { const e = view.querySelector("#cdcTimer"); if (started && e) e.textContent = "⏱️ " + fmt(Date.now() - t0); }, 1000);

    function checkBuild() {
      const b = c.build; if (!b) return false;
      if (b.orderMatters) return buildList.length === b.target.length && buildList.every((r, i) => r === b.target[i]);
      const a = [...buildList].sort(), t = [...b.target].sort();
      return a.length === t.length && a.every((r, i) => r === t[i]);
    }
    function scoreQ() { return answers.filter((a, i) => a !== null && c.steps[i].options[a].correct).length; }

    function phase(i) { if (i === 0) return 0; if (i <= N) return 1; if (hasBuild && i === BUILD_IDX) return 2; return hasBuild ? 3 : 2; }
    function stepper() {
      const ph = phase(idx);
      const items = hasBuild ? [["1", "Énoncé"], ["2", "Analyse"], ["3", "Construction"], ["4", "Bilan"]] : [["1", "Énoncé"], ["2", "Analyse guidée"], ["3", "Bilan"]];
      return `<div class="cdc-steps">${items.map((it, k) => `<div class="cdc-step ${k === ph ? "active" : k < ph ? "done" : ""}"><span class="csn">${k < ph ? "✓" : it[0]}</span>${it[1]}${k === 1 && ph === 1 ? ` <span style="margin-left:auto;opacity:.7">${idx}/${N}</span>` : ""}</div>`).join("")}</div>`;
    }

    function draw() {
      let body = "";
      if (idx === 0) {
        body = `<div class="cdc-panel">
          <h2>${c.icon} ${c.title}</h2>
          ${c.topoHtml}
          ${c.enonceHtml}
          ${note("tip", "Lis bien l'énoncé. Ensuite on raisonne <b>ensemble</b> (type d'ACL/NAT, interfaces, sens)" + (hasBuild ? ", puis tu <b>assembles la vraie config</b>." : "."))}
          <div class="cdc-nav"><span></span><button class="btn btn-primary" id="cdcNext" style="--accent:var(--r-${c.color})">Commencer l'analyse →</button></div>
        </div>`;
      } else if (idx <= N) {
        const q = c.steps[idx - 1], chosen = answers[idx - 1];
        const answered = chosen !== null;
        body = `<div class="cdc-panel">
          <div class="cdc-q">
            <div class="cdc-ask"><span style="color:var(--r-${c.color})">Q${idx}.</span> ${q.ask}</div>
            <div class="cdc-opts">
              ${q.options.map((o, k) => {
                let cls = "cdc-opt";
                if (answered) { cls += " locked"; if (o.correct) cls += " correct"; else if (k === chosen) cls += " wrong"; }
                return `<button class="${cls}" data-k="${k}"><span class="ck">${"ABC"[k]}</span><span>${o.label}</span></button>`;
              }).join("")}
            </div>
            <div class="cdc-feed ${answered ? "show " + (q.options[chosen].correct ? "good" : "bad") : ""}" id="cdcFeed">
              ${answered ? `<b>${q.options[chosen].correct ? "✅ Correct !" : "❌ Pas tout à fait."}</b> ${q.options[chosen].fb}<br><span style="color:var(--text-3)">💡 ${q.explain}</span>` : ""}
            </div>
          </div>
          <div class="cdc-nav">
            <button class="btn btn-ghost" id="cdcPrev">← Précédent</button>
            <button class="btn btn-primary" id="cdcNext" style="--accent:var(--r-${c.color})">${idx === N ? (hasBuild ? "Construire la config →" : "Voir le bilan →") : (answered ? "Suivant →" : "Passer →")}</button>
          </div>
        </div>`;
      } else if (hasBuild && idx === BUILD_IDX) {
        const b = c.build, bankLeft = buildBank.filter(r => !buildList.includes(r));
        body = `<div class="cdc-panel">
          <h2>🏗️ Construction de la config</h2>
          <p style="color:var(--text-2)">${b.title}</p>
          <div class="cdc-build-wrap">
            <div class="cdc-build-col">
              <div class="cdc-build-h">Banque de règles</div>
              <div class="cdc-bank">
                ${bankLeft.length ? bankLeft.map(r => `<button class="cdc-bank-item" data-add="${encodeURIComponent(r)}">+ <code>${r}</code></button>`).join("") : `<div class="cdc-empty">Toutes les règles sont placées.</div>`}
              </div>
            </div>
            <div class="cdc-build-col">
              <div class="cdc-build-h">Ta configuration ${b.orderMatters ? "<span style='opacity:.6'>(l'ordre compte ⬇)</span>" : ""}</div>
              <div class="cdc-buildlist">
                ${buildList.length ? buildList.map((r, i) => {
                  let mk = ""; if (buildChecked) { const ok = b.orderMatters ? r === b.target[i] : b.target.includes(r); mk = ok ? " ok" : " ko"; }
                  return `<div class="cdc-buildrow${mk}"><span class="cdc-num">${i + 1}</span><code>${r}</code>
                    <span class="cdc-build-ctrls"><button data-mv="${i}|-1" aria-label="Monter">▲</button><button data-mv="${i}|1" aria-label="Descendre">▼</button><button data-rm="${i}" aria-label="Retirer">✕</button></span></div>`;
                }).join("") : `<div class="cdc-empty">Clique des règles à gauche pour les empiler ici.</div>`}
              </div>
            </div>
          </div>
          <div class="cdc-feed ${buildChecked ? "show " + (buildSolved ? "good" : "bad") : ""}">
            ${buildChecked ? (buildSolved ? "<b>✅ Configuration correcte !</b> " + (b.tip || "") : "<b>❌ Pas encore.</b> Corrige les lignes en rouge (ou complète). 💡 " + (b.tip || "")) : ""}
          </div>
          <div class="cdc-nav">
            <button class="btn btn-ghost" id="cdcPrev">← Précédent</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost" id="cdcBuildHint">💡 Indice</button>
              <button class="btn btn-ghost" id="cdcBuildCheck">✔ Vérifier</button>
              <button class="btn btn-primary" id="cdcNext" style="--accent:var(--r-${c.color})">Voir le bilan →</button>
            </div>
          </div>
        </div>`;
      } else {
        const score = scoreQ(), pct = Math.round(score / N * 100);
        const missed = c.steps.map((s, i) => i).filter(i => !(answers[i] !== null && c.steps[i].options[answers[i]].correct));
        body = `<div class="cdc-panel">
          <h2>📊 Bilan — ${c.title}</h2>
          <div class="cdc-bilan">
            <div class="cdc-bilan-ring" style="--p:${pct}"><span>${score}/${N}</span></div>
            <div><div class="cdc-bilan-msg">${pct >= 80 ? "Excellent ! 🚀" : pct >= 50 ? "Pas mal — consolide 💪" : "À retravailler 📚"}</div>
            <div class="cdc-bilan-sub">Analyse : <b>${score}/${N}</b> du premier coup${hasBuild ? ` · Construction : <b>${buildSolved ? "✅ réussie" : "❌ à revoir"}</b>` : ""}${c.timed ? ` · ⏱️ ${fmt(finalMs)}` : ""}</div></div>
          </div>
          ${missed.length ? `<div class="cdc-weak"><b>🎯 À revoir :</b><ul>${missed.map(i => `<li>${stripTags(c.steps[i].ask)}</li>`).join("")}</ul>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
              ${c.reviewModule ? `<button class="btn btn-ghost" onclick="location.hash='#/m/${c.reviewModule}'">📚 Revoir le cours</button>` : ""}
              <button class="btn btn-ghost" onclick="location.hash='#/lab/${c.labHint || "acl-ext"}'">🖥️ S'entraîner au lab</button>
            </div></div>` : `<div class="cdc-weak ok">🎉 Toutes les activités réussies du premier coup !</div>`}
          <h3 style="margin-top:18px">✅ Correction complète — rédigée par le professeur</h3>
          ${note("tip", "Voici la <b>correction complète et détaillée</b> du cahier des charges (configuration + justifications). Tu peux la lire en entier même si tu as sauté des étapes — c'est ton corrigé de référence pour réviser.")}
          <div class="cdc-build">${c.solution}</div>
          <div class="cdc-nav">
            <button class="btn btn-ghost" id="cdcPrev">← Revoir</button>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-ghost" onclick="location.hash='#/lab/${c.labHint || "acl-ext"}'">🖥️ Lab</button>
              <button class="btn btn-primary" style="--accent:var(--r-${c.color})" onclick="location.hash='#/cdc'">Terminer ✓</button>
            </div>
          </div>
        </div>`;
      }
      view.innerHTML = `<div style="--mc:var(--r-${c.color})">
        <div class="lab-head" style="margin-bottom:14px"><button class="dg-btn" onclick="location.hash='#/cdc'">← Cahiers</button>
        <div class="lab-head-title">${c.icon} ${c.title}</div>${c.timed && started ? `<span class="cdc-timer" id="cdcTimer">⏱️ ${fmt(Date.now() - t0)}</span>` : "<span></span>"}</div>
        ${stepper()}
        ${body}
      </div>`;
      bind();
    }

    function bind() {
      const next = view.querySelector("#cdcNext"), prev = view.querySelector("#cdcPrev");
      if (next) next.addEventListener("click", () => { if (c.timed && idx === 0 && !started) { started = true; t0 = Date.now(); } idx++; if (idx === SOL_IDX && !completed) { completed = true; complete(); } window.scrollTo(0, 0); draw(); });
      if (prev) prev.addEventListener("click", () => { idx = Math.max(0, idx - 1); window.scrollTo(0, 0); draw(); });
      // --- phase construction ---
      view.querySelectorAll("[data-add]").forEach(el => el.addEventListener("click", () => { buildList.push(decodeURIComponent(el.dataset.add)); buildChecked = false; draw(); }));
      view.querySelectorAll("[data-rm]").forEach(el => el.addEventListener("click", () => { buildList.splice(+el.dataset.rm, 1); buildChecked = false; draw(); }));
      view.querySelectorAll("[data-mv]").forEach(el => el.addEventListener("click", () => { const [i, d] = el.dataset.mv.split("|").map(Number); const j = i + d; if (j < 0 || j >= buildList.length) return;[buildList[i], buildList[j]] = [buildList[j], buildList[i]]; buildChecked = false; draw(); }));
      const bh = view.querySelector("#cdcBuildHint");
      if (bh) bh.addEventListener("click", () => { const nx = c.build.target.find(t => !buildList.includes(t)); if (nx) { buildList.push(nx); buildChecked = false; if (G) G.toast("Indice : une règle ajoutée"); draw(); } else if (G) G.toast("Toutes les règles sont là — vérifie l'ordre"); });
      const bc = view.querySelector("#cdcBuildCheck");
      if (bc) bc.addEventListener("click", () => { buildChecked = true; buildSolved = checkBuild(); if (buildSolved && !buildXP) { buildXP = true; if (G) G.addXP(20, "Config assemblée ✓"); } draw(); });
      view.querySelectorAll(".cdc-opt").forEach(b => b.addEventListener("click", () => {
        if (answers[idx - 1] !== null) return;
        const k = +b.dataset.k;
        answers[idx - 1] = k;
        const correct = c.steps[idx - 1].options[k].correct;
        if (G) { if (correct) G.addXP(10, "Bonne analyse"); else G.toast("Relis l'explication 👇"); }
        draw();
      }));
      // mount cli copy buttons in solution
      view.querySelectorAll(".cli-copy").forEach(btn => btn.addEventListener("click", () => {
        const pre = btn.closest(".cli").querySelector("pre");
        navigator.clipboard && navigator.clipboard.writeText(pre.innerText).then(() => { btn.textContent = "Copié ✓"; setTimeout(() => btn.textContent = "Copier", 1400); });
      }));
    }

    function complete() {
      if (window.__cdcTimer) { clearInterval(window.__cdcTimer); window.__cdcTimer = null; }
      finalMs = started ? Date.now() - t0 : 0;
      const score = scoreQ();
      ST.done[c.id] = 1; save(ST);
      if (G) {
        G.addXP(c.xp, "Cahier des charges : " + c.title); G.award("cdc-first"); if (c.badge) G.award(c.badge);
        if (score === N && (!hasBuild || buildSolved)) { G.addXP(25, "Sans faute ! 💯"); }
        G.confetti({ n: 130 });
      }
    }

    draw();
  }

  window.NMCDC = { render, LIST };
})();
