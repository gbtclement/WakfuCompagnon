# Wakfu Companion — Design V1

Date : 2026-07-20

## Objectif

Application de bureau Windows (.exe avec installeur) qui lit en local le fichier `wakfu.log` généré par le jeu Wakfu pour en déduire des événements (connexion serveur, quête environnementale rencontrée, achievement) et notifier l'utilisateur, avec un suivi de quêtes et des timers d'archimonstres manuels.

Implémentation originale : conception, regex, nommage et architecture propres, sans reprise de code d'un projet tiers existant. Lecture passive seule du fichier de log — aucune automatisation en jeu, aucun accès réseau/mémoire du client Wakfu.

## Périmètre V1

Inclus :
1. Détection et affichage du serveur de connexion en cours.
2. Suivi de quêtes environnementales : liste de quêtes suivies par l'utilisateur (via un référentiel id → nom embarqué), notification quand une quête suivie est rencontrée (challenge actif).
3. Timers d'archimonstres manuels : nom libre + durée, notification à échéance.
4. Historique des événements détectés dans la session en cours, affiché dans l'UI.

Explicitement hors scope V1 (itérations futures) :
- Watcher de chat par mots-clés/regex.
- Backend communautaire / partage temps réel entre utilisateurs.
- Détection de fin de quête environnementale (le log ne donne qu'un état "challenge actif/inactif", pas d'événement de complétion dédié pour les challenges — seule la quête "remportée" classique a un événement explicite, cf. ci-dessous).
- Hôtel des Ventes (non exploitable via les logs).

## Formats de logs (calibrés sur un vrai `wakfu.log` fourni par l'utilisateur)

Toutes les regex ci-dessous ont été vérifiées contre un fichier `wakfu.log` réel (et ses rotations `.log.1`, `.log.2`) plutôt que déduites uniquement des exemples génériques. Les lignes n'ont **pas de date**, seulement une heure `HH:MM:SS,mmm` — l'historique en base horodate donc avec la date de lecture (jour courant), pas une date extraite du log.

### Connexion serveur
```
 INFO 18:26:49,060 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-ogrest.ankama-games.com:5556 / ssl : true
```
- Regex capture le sous-domaine entre `wakfu-` et `.ankama-games.com`.
- Le proxy `wakfu-dispatcher.ankama-games.com` est un lobby technique, pas un serveur de jeu : il doit être ignoré par le parser (filtré explicitement par nom `dispatcher`).
- Une ligne de perte de connexion existe aussi (`Connexion avec le serveur perdue ...`) mais n'est pas utilisée en V1 (pas de besoin identifié).

### Challenge / quête environnementale actif
```
 INFO 20:05:41,377 [AWT-EventQueue-0] (chJ:254) - Challenge courant : -1123 (dans 0s)
```
- L'ID est un entier négatif (identifiant interne du challenge), `-1` signifiant "aucun challenge actif".
- Le nom de la quête n'apparaît jamais dans cette ligne : uniquement l'ID. La correspondance id → nom passe par un référentiel JSON embarqué dans l'app (voir plus bas), à compléter au fil de l'eau.
- Un changement d'ID différent de `-1` (par rapport à l'état précédent) déclenche l'événement "quête environnementale rencontrée" si cet ID est dans la liste suivie par l'utilisateur.

### Quête classique remportée
```
 INFO 18:22:57,585 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Vous venez de remporter la quête "Course : Salbatroce Voyageur"
```
- Ici le nom est directement lisible dans le log (pas besoin de référentiel). Variante échec : `Quête échouée: "<nom>"`.
- Prévoir les variantes linguistiques (EN `You have won the quest "<name>"`, etc.) comme évoqué dans la demande initiale, même si non observées dans les logs FR fournis — à activer selon la langue détectée/configurée par l'utilisateur.

### Achievement
```
 INFO 21:03:16,003 [AWT-EventQueue-0] (ber:318) - Achievement objective completed : 9388
 INFO 16:29:51,226 [AWT-EventQueue-0] (ber:341) - Achievement activated : 4267
```
- Deux variantes observées (`objective completed` et `activated`), toutes deux avec un ID numérique, jamais de nom. Référentiel id → nom hors scope V1 (pas de besoin fonctionnel identifié pour l'instant — affiché par ID brut si jamais exposé dans l'UI, ce qui n'est pas prévu en V1).

### Chat (fichier séparé `wakfu_chat.log`)
```
16:49:57,058 - [Information (combat)] Poupée d'Osamodas: -1 093 PV (Terre)
```
- Canaux réels observés : `Commerce`, `Communauté (FR)`, `Communauté (EN)`, `Guilde`, `Information (combat)`, `Information (jeu)`, `Messages d'erreur`, `Politique`, `Privé`, `Proximité`, `Recrutement (FR)`, `Recrutement (EN)`.
- Non exploité en V1 (watcher de chat = itération future), mais le format est documenté ici pour ne pas avoir à re-explorer plus tard.

## Référentiel de quêtes environnementales

Fichier JSON embarqué dans le repo (`src/main/data/environmentalQuests.json`), structure `{ "<id>": "<nom>" }`. Pré-rempli avec les IDs observés dans les vrais logs fournis (noms provisoires du type `"Challenge #1123"` là où le nom réel n'est pas connu). Modifiable à la main au fil du temps ; pas de dépendance à une API externe pour la V1.

## Architecture

Electron 3 process, TypeScript partout, Vue 3 + Vite pour le renderer.

```
/src
  /main
    logWatcher.ts        → tail incrémental des fichiers, gère rotation .log/.log.1/.log.2, détection auto du chemin (Zaap puis fallback Steam)
    parsers/
      serverConnection.ts
      environmentalQuest.ts
      questCompleted.ts
      achievement.ts
      types.ts            → interfaces d'événements partagées, un type = un fichier de parser
    data/
      environmentalQuests.json
    store.ts               → wrapper electron-store (config utilisateur : chemin log, quêtes suivies, timers, historique)
    notifications.ts       → wrapper Notification Electron (toasts natifs Windows)
    timers.ts              → logique des timers d'archimonstres (setTimeout géré, persistance de l'échéance pour survivre à un redémarrage de l'app)
    ipc.ts                 → handlers ipcMain, un canal par fonctionnalité
    main.ts
  /preload
    preload.ts             → contextBridge, expose une API typée restreinte (pas de nodeIntegration côté renderer)
  /renderer
    /views
      ServerStatusView.vue
      QuestsView.vue
      TimersView.vue
      HistoryView.vue
      SettingsView.vue     → chemin du log (auto-détecté + override manuel)
    /components
    /stores                → Pinia, miroir de l'état exposé par le main process via IPC
    App.vue
    main.ts
/tests
  /parsers                 → Vitest, fixtures = extraits anonymisés du vrai wakfu.log fourni
/electron-builder.yml
/package.json
```

### Flux de données
1. `logWatcher.ts` détecte le chemin du log (test Zaap → fallback Steam → sinon attend une saisie manuelle via l'UI), tail le fichier en continu (nouvelles lignes seulement, gère la rotation).
2. Chaque nouvelle ligne est passée à chaque parser (modules purs, une fonction `parse(line: string): Event | null` par fichier — testables indépendamment de l'UI et d'Electron).
3. Un événement reconnu est : (a) écrit dans l'historique via `store.ts`, (b) déclenche une notification native si pertinent (quête suivie rencontrée, timer expiré), (c) poussé au renderer via IPC pour mise à jour temps réel de l'UI.
4. Le renderer ne lit/écrit jamais le disque directement : tout passe par IPC vers le main process (principe de moindre privilège, cohérent avec la sandbox Electron).

### Gestion d'erreurs
- Log introuvable aux deux chemins par défaut → écran de configuration manuelle du chemin dans `SettingsView.vue`, avec bouton "Parcourir" (dialog natif Electron).
- Format de ligne non reconnu par un parser → ignoré silencieusement (log debug interne uniquement), pas d'erreur bloquante : le jeu peut changer son format à tout moment, l'app doit rester robuste à des lignes inattendues.
- Fichier de log tourné/renommé en cours de lecture (rotation `.log` → `.log.1`) → le watcher détecte la troncature/renommage et se re-attache au nouveau fichier courant.

### Tests
- Vitest sur chaque parser, fixtures construites à partir d'extraits réels (pas de dépendance à un vrai jeu Wakfu qui tourne pour lancer les tests).
- Pas de test end-to-end Electron prévu pour la V1 (poids/complexité disproportionnés par rapport au périmètre) ; vérification manuelle de l'UI via `/verify` avant de considérer une fonctionnalité terminée.

## Stack technique retenue

- Electron (main process TypeScript)
- Vue 3 + Vue Router + Pinia
- Vite (bundler)
- `fs.watchFile`/lecture incrémentale par offset pour le tail (pas de dépendance `chokidar` nécessaire pour un seul fichier à surveiller — évite une dépendance superflue)
- `electron-store` pour la persistance (JSON local ; SQLite non nécessaire au volume de données de la V1 — quelques dizaines de quêtes suivies, timers, historique de session)
- `electron-builder` avec cible NSIS pour l'installeur `.exe` Windows
- Vitest pour les tests unitaires des parsers

## Points d'attention (rappel CGU)

- Lecture passive uniquement du fichier de log local, aucune automatisation d'action en jeu, aucune lecture mémoire/réseau du client.
- Aucune donnée d'identification du joueur stockée ou transmise (les lignes de log utilisées ne contiennent pas de pseudo/IP dans les patterns retenus pour la V1).
- Le format du log peut changer avec les mises à jour du jeu : parsers isolés en modules indépendants et testés séparément pour limiter l'impact d'une casse de format.
