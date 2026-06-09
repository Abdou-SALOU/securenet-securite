# 🛡️ SecureNet — Révision Sécurité des Systèmes & Réseaux

Plateforme de révision **orientée pratique** pour l'examen de *Sécurité des Systèmes et Réseaux* (2CI-ISI), construite d'après les supports et ateliers du prof.

## ▶️ Ouvrir la plateforme
Double-clique sur **`Ouvrir-SecureNet.bat`** (ou ouvre `index.html` dans ton navigateur).
100 % hors-ligne, aucune installation. Ta progression est sauvegardée dans le navigateur.

## 🎯 Le programme couvert (tableau du prof)
- **① NAT/PAT/GRE** — NAT dynamique, PAT (overload), NAT statique, tunnel GRE
- **② ACL** — ACL de base (wildcard, standard/étendue, established) + ACL contextuelle (CBAC)
- **③ Architecture de sécurité** — pare-feu, DMZ, proxy / reverse-proxy, AAA, NAC, IDS/IPS

## 🧩 Ce que tu trouves dedans
| Outil | À quoi ça sert |
|---|---|
| **📋 Cahiers des charges guidés** | Le **format exact de l'examen** : on t'amène pas-à-pas à identifier *quelle ACL/NAT, quelle interface, quel sens*, puis on dévoile le corrigé (méthode du prof). 3 cahiers : EXERCICE 1 (ACL), NAT & PAT, CBAC. |
| **🖥️ Labs CLI** | Un **vrai terminal Cisco IOS simulé** : tape les commandes (NAT, ACL étendues, GRE, CBAC). Les objectifs se valident tout seuls. Le lab **ACL** évalue réellement tes règles : *Admin* passe, *C1* est bloqué. |
| **📚 5 modules de cours** | Théorie pratique avec les **configs exactes du prof**, diagrammes interactifs, quiz et flashcards. |
| **🎯 Mode Examen** | Questions aléatoires chronométrées sur tout le programme. |
| **🃏 Flashcards · ⌨️ Mémo commandes** | Mémorisation rapide + toutes les commandes par thème, prêtes à copier. |

## 🔥 Motivation (gamification)
XP, niveaux, **série quotidienne** (reviens chaque jour !), **badges** à débloquer et confettis à chaque réussite. Tout est visible sur le tableau de bord.

## 🗓️ Régler la date d'examen (optionnel)
Dans `assets/js/app.js`, change la ligne :
```js
const EXAM_DATE = null;   // ex : new Date("2026-06-22T08:00:00");
```
→ un compte à rebours s'affichera dans la barre latérale.

## 📂 Basé sur
Les ateliers du module (1 NAT dynamique, 2 PAT, 3 NAT statique, 4 GRE, 7 ACL, 9 CBAC, 11 AAA),
les exposés ACL (base + avancé/CBAC), l'EXERCICE 1 et le diaporama *Architecture de sécurité*.

> Conçu pour réviser **en pratiquant**, pas en récitant. Bonne chance pour l'examen ! 💪
