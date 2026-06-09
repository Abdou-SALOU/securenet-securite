/* ===================== MODULE 5 · ARCHITECTURE DE SÉCURITÉ =====================
   D'après « Architecture securite.pdf » (réseau à plat → FW → zones/DMZ →
   proxy/reverse-proxy → AAA/NAC → IDS/IPS/SIEM/Zero Trust) + Atelier 11 (AAA).
   Partie ③ du programme d'examen.
   ============================================================================= */
NM.register({
  id: "archi", color: "archi", icon: "🏛️", badge: "archi",
  title: "Architecture de sécurité",
  kicker: "Pare-feu, proxy, DMZ, AAA, NAC — Partie ③",
  est: "≈ 40 min",
  desc: "Concevoir un réseau d'entreprise sécurisé par couches : du réseau « à plat » dangereux vers une architecture segmentée avec pare-feu, DMZ, proxy / reverse-proxy, AAA, NAC et supervision.",
  chips: ["Firewall", "DMZ", "proxy / reverse-proxy", "AAA", "NAC", "IDS/IPS", "Zero Trust"],
  sections: [

    { id: "flat", title: "1 · Le réseau « à plat » (à éviter)",
      html: `<p>Un réseau <b>à plat</b> place serveurs, postes et Wi-Fi sur le <b>même segment</b>, sans cloisonnement. C'est le point de départ… et le pire des cas.</p>
      <ul>
        <li>🔓 Aucune séparation : un poste compromis voit <b>tout</b> (serveurs inclus).</li>
        <li>📡 Le Wi-Fi ouvre une porte directe sur le cœur du réseau.</li>
        <li>🌍 Les serveurs exposés à Internet le sont sans filtrage.</li>
      </ul>` +
      note("warn", "Principe directeur de toute la partie ③ : la <b>défense en profondeur</b> — plusieurs couches de sécurité, et la <b>segmentation</b> pour limiter la propagation d'une attaque.") },

    { id: "fw", title: "2 · Le pare-feu (Firewall)",
      html: `<p>Le <b>pare-feu</b> filtre le trafic entre zones de confiance différentes selon une politique. On le place <b>en frontal</b> entre le LAN et Internet, puis entre les zones internes.</p>
      <table class="policy-table">
        <tr><th>Type de FW</th><th>Filtre sur</th></tr>
        <tr><td>Filtrage de paquets (ACL)</td><td>IP source/dest, protocole, port (sans état)</td></tr>
        <tr><td>Stateful (à états)</td><td>suit les sessions (cf. CBAC) — autorise le retour légitime</td></tr>
        <tr><td>Applicatif / NGFW</td><td>inspecte le contenu applicatif (L7), IPS, antivirus…</td></tr>
      </table>` +
      mnemo("🧱", "Un routeur avec ACL/CBAC est déjà un pare-feu de base. Un <b>NGFW</b> ajoute l'inspection applicative, l'IPS et le contrôle des utilisateurs.") },

    { id: "dmz", title: "3 · Segmentation & DMZ",
      html: dg("dmzZones") +
      `<p>On découpe le réseau en <b>zones</b> filtrées entre elles. La <b>DMZ</b> (zone démilitarisée) héberge les serveurs <b>accessibles depuis Internet</b> (web, mail, DNS public), isolés du LAN interne.</p>
      <table class="policy-table">
        <tr><th>Zone</th><th>Contenu</th><th>Règle d'or</th></tr>
        <tr><td>OUTSIDE</td><td>Internet</td><td>non fiable</td></tr>
        <tr><td>DMZ</td><td>serveurs publics</td><td>joignable de l'extérieur, mais ne doit <b>pas</b> initier vers l'INSIDE</td></tr>
        <tr><td>INSIDE</td><td>LAN interne</td><td>le plus protégé ; sort vers DMZ/Internet, jamais l'inverse</td></tr>
      </table>` +
      note("info", "Si un serveur en DMZ est piraté, l'attaquant reste <b>cloisonné</b> en DMZ : il n'atteint pas le LAN interne. C'est tout l'intérêt. (cf. ACL_DMZ_IN « deny vers INSIDE » de l'Atelier 9.)") +
      note("tip", "La <b>DMZ de mise en conformité</b> reçoit les postes <b>nomades</b> : on vérifie leur état (antivirus, mises à jour) avant de les laisser entrer → c'est du <b>NAC</b> (voir plus bas).") },

    { id: "proxy", title: "4 · Proxy & Reverse-proxy",
      html: `<table class="policy-table">
        <tr><th></th><th>Proxy (direct)</th><th>Reverse-proxy (inverse)</th></tr>
        <tr><td>Protège</td><td>les <b>clients</b> internes qui sortent</td><td>les <b>serveurs</b> internes/DMZ exposés</td></tr>
        <tr><td>Sens</td><td>LAN → Internet</td><td>Internet → serveurs</td></tr>
        <tr><td>Rôles</td><td>filtrage d'URL, cache, journalisation, anonymisation</td><td>répartition de charge, terminaison TLS, WAF, cache</td></tr>
      </table>
      <p>Placés <b>en coupure</b> des flux, ils empêchent toute connexion directe client↔serveur : tout passe par l'intermédiaire, qui inspecte et journalise.</p>` +
      mnemo("🔁", "<b>Proxy</b> = je sors caché (protège les clients). <b>Reverse-proxy</b> = je rentre par un guichet unique (protège les serveurs).") },

    { id: "aaa", title: "5 · AAA (Atelier 11)",
      html: `<p><b>AAA</b> centralise le contrôle des accès aux équipements/réseau :</p>
      <ul>
        <li><b>Authentication</b> — qui es-tu ? (login/mot de passe, certificat)</li>
        <li><b>Authorization</b> — qu'as-tu le droit de faire ? (commandes, VLAN, ACL)</li>
        <li><b>Accounting</b> — qu'as-tu fait ? (traçabilité, journaux)</li>
      </ul>
      <table class="policy-table">
        <tr><th>Protocole</th><th>Particularités</th></tr>
        <tr><td><b>RADIUS</b></td><td>UDP, chiffre seulement le mot de passe, ouvert/multi-constructeur, surtout pour l'accès réseau (Wi-Fi 802.1X, VPN)</td></tr>
        <tr><td><b>TACACS+</b></td><td>TCP, chiffre tout le paquet, Cisco, sépare finement A/A/A, surtout pour l'admin des équipements</td></tr>
      </table>` +
      note("info", "Dans l'Atelier 11, un serveur <b>AAA</b> authentifie les accès Wi-Fi (Adm/Étudiant/Prof) avec un SSID et un réseau par profil — l'authentification est déléguée au serveur central plutôt qu'à chaque équipement.") },

    { id: "nac", title: "6 · NAC & contrôle d'accès",
      html: `<p>Le <b>NAC</b> (<i>Network Access Control</i>) contrôle <b>qui</b> et <b>quoi</b> se connecte au réseau, et vérifie la <b>conformité</b> du poste avant de l'admettre.</p>
      <ul>
        <li>🔐 <b>802.1X</b> : authentification du poste au branchement (port switch / Wi-Fi), via AAA/RADIUS.</li>
        <li>🩺 <b>Posture</b> : antivirus à jour ? correctifs installés ? sinon → mise en quarantaine (DMZ de conformité).</li>
        <li>🚪 Attribution dynamique de VLAN/ACL selon le profil.</li>
      </ul>` +
      note("tip", "Tendance moderne : <b>Zero Trust</b> — « ne jamais faire confiance, toujours vérifier ». Aucune confiance implicite, même à l'intérieur : chaque accès est authentifié et autorisé.") },

    { id: "detection", title: "7 · Détection & supervision",
      html: `<table class="policy-table">
        <tr><th>Dispositif</th><th>Rôle</th></tr>
        <tr><td><b>IDS</b></td><td>détecte les intrusions et <b>alerte</b> (passif, en copie du trafic)</td></tr>
        <tr><td><b>IPS</b></td><td>détecte et <b>bloque</b> en temps réel (en coupure du trafic)</td></tr>
        <tr><td><b>VPN</b></td><td>tunnel chiffré pour l'accès distant (IPsec, SSL) — confidentialité</td></tr>
        <tr><td><b>SIEM</b></td><td>collecte et corrèle les journaux (Syslog) pour détecter et investiguer</td></tr>
      </table>` +
      key("Synthèse — attaques & parades", [
        "<b>Écoute / usurpation</b> (sniffing, ARP/IP spoofing) → chiffrement, port-security, DAI.",
        "<b>Actives / destructives</b> (DoS/DDoS) → filtrage, limitation de débit, IPS.",
        "<b>Détournement / exfiltration</b> (MITM, vol de données) → TLS, segmentation, DLP.",
        "<b>Wi-Fi</b> (rogue AP, déauth) → WPA2/3, 802.1X, détection de points d'accès pirates."
      ]) },

    { id: "synthese", title: "8 · L'architecture cible",
      html: `<p>En empilant les couches, on obtient une architecture défendable :</p>
      <ol>
        <li>Pare-feu <b>frontal</b> entre Internet et le reste.</li>
        <li><b>DMZ</b> pour les serveurs publics (isolée du LAN).</li>
        <li>LAN interne <b>segmenté</b> en VLAN/zones avec filtrage entre elles.</li>
        <li><b>Proxy</b> (sortie) + <b>reverse-proxy</b> (entrée) en coupure des flux.</li>
        <li><b>AAA + NAC + 802.1X</b> pour contrôler les accès (filaire, Wi-Fi, VPN).</li>
        <li><b>IDS/IPS + SIEM</b> pour détecter, bloquer et tracer.</li>
      </ol>` +
      mnemo("🛡️", "Défense en profondeur : <b>segmenter</b>, <b>filtrer entre les zones</b>, <b>authentifier</b> chaque accès, <b>superviser</b> en continu.") }
  ],

  quiz: [
    { q: "À quoi sert une DMZ ?", opts: ["Accélérer le réseau", "Isoler les serveurs accessibles depuis Internet du LAN interne", "Chiffrer le Wi-Fi", "Distribuer le DHCP"], a: 1,
      exp: "La DMZ héberge les serveurs publics, cloisonnés : un serveur compromis n'atteint pas l'INSIDE.", tag: "Archi" },
    { q: "Différence proxy vs reverse-proxy ?", opts: ["Aucune", "Le proxy protège les clients sortants, le reverse-proxy protège les serveurs exposés", "Le proxy chiffre, le reverse non", "Le reverse est plus lent"], a: 1,
      exp: "Proxy = clients → Internet ; reverse-proxy = Internet → serveurs (guichet unique).", tag: "Archi" },
    { q: "Que signifie AAA ?", opts: ["Adresse-Accès-Audit", "Authentication, Authorization, Accounting", "Antivirus-ACL-Audit", "Access-Auth-Alert"], a: 1,
      exp: "Authentification (qui), Autorisation (droits), Accounting (traçabilité).", tag: "AAA" },
    { q: "Quelle différence majeure entre IDS et IPS ?", opts: ["L'IDS bloque, l'IPS alerte", "L'IDS alerte (passif), l'IPS bloque (en coupure)", "Aucune", "L'IPS est pour le Wi-Fi"], a: 1,
      exp: "IDS = détection passive + alerte ; IPS = détection + blocage en temps réel.", tag: "Archi" },
    { q: "RADIUS vs TACACS+ : lequel chiffre tout le paquet et est Cisco/TCP ?", opts: ["RADIUS", "TACACS+", "Les deux", "Aucun"], a: 1,
      exp: "TACACS+ (TCP, Cisco) chiffre tout le paquet et sépare finement A/A/A ; RADIUS (UDP) ne chiffre que le mot de passe.", tag: "AAA" },
    { q: "Le NAC vérifie notamment…", opts: ["La vitesse du lien", "La conformité du poste (antivirus, MAJ) avant admission", "Le nombre de VLAN", "La table NAT"], a: 1,
      exp: "Le NAC contrôle l'accès et la posture (conformité) du poste, souvent via 802.1X.", tag: "NAC" }
  ],

  flashcards: [
    { k: "DMZ", f: "Rôle d'une DMZ ?", b: "Zone tampon hébergeant les serveurs accessibles depuis Internet, isolée du LAN interne ; un serveur compromis n'atteint pas l'INSIDE." },
    { k: "Proxy", f: "Proxy vs reverse-proxy", b: "Proxy = protège les clients qui sortent (filtrage URL, cache). Reverse-proxy = protège les serveurs exposés (LB, TLS, WAF)." },
    { k: "AAA", f: "Les 3 A de AAA", b: "Authentication (qui ?), Authorization (quels droits ?), Accounting (traçabilité)." },
    { k: "RADIUS/TACACS+", f: "Différence clé", b: "RADIUS : UDP, chiffre le mot de passe, accès réseau. TACACS+ : TCP, chiffre tout, Cisco, admin d'équipements." },
    { k: "NAC", f: "Que fait le NAC ?", b: "Contrôle qui/quoi se connecte et vérifie la conformité du poste (posture) avant admission, via 802.1X." },
    { k: "IDS/IPS", f: "IDS vs IPS", b: "IDS = détecte et alerte (passif). IPS = détecte et bloque (en coupure)." },
    { k: "Concept", f: "Qu'est-ce que la défense en profondeur ?", b: "Empiler plusieurs couches de sécurité (segmentation, filtrage, AAA, supervision) pour qu'aucune faille unique ne soit fatale." },
    { k: "Zero Trust", f: "Principe du Zero Trust", b: "Ne jamais faire confiance par défaut, toujours vérifier — chaque accès est authentifié/autorisé, même en interne." }
  ]
});
