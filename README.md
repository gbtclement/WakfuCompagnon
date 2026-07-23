# Wakfu Companion

Application de bureau (Windows) qui accompagne les joueurs de [Wakfu](https://www.wakfu.com/) en lisant en local le fichier `wakfu.log` généré par le jeu, pour en déduire certains événements (connexion à un serveur, quêtes rencontrées ou terminées, hauts faits débloqués) et notifier l'utilisateur.

Il s'agit d'une implémentation originale — inspirée du *concept* d'applications communautaires existantes (log-watcher + notifications), mais avec un code, des regex et une architecture propres. L'application ne fait que de la **lecture passive** du fichier de log : pas d'automatisation d'actions en jeu, pas de lecture mémoire ou réseau.

## Fonctionnalités

- **Détection de serveur** : affiche automatiquement le serveur sur lequel le joueur est connecté.
- **Suivi de quêtes environnementales** : l'utilisateur suit des quêtes par leur nom exact ; l'app notifie quand une quête suivie est rencontrée ou terminée (`Quête remportée`/`Quête échouée` dans les logs).
- **Exploits** : regroupe des quêtes environnementales et des archimonstres en objectifs composés, avec suivi de progression.
- **Timers d'archimonstres** : création de timers avec respawn pré-rempli depuis un référentiel éditable, notification à échéance.
- **Panel Admin** : gestion manuelle des référentiels (quêtes, archimonstres, exploits) — les données de jeu ne sont pas exploitables automatiquement (voir [Pourquoi la saisie manuelle](#pourquoi-la-saisie-manuelle) ci-dessous).
- **Historique de session** et **thème clair/sombre** inspiré de l'identité visuelle Wakfu.

## Stack technique

- Electron (process principal en TypeScript)
- Vue 3 + Pinia + Vue Router pour l'interface
- Vite comme bundler
- `electron-store` pour la persistance locale (JSON)
- `electron-builder` (cible NSIS) pour l'installeur Windows
- Vitest pour les tests unitaires

## Démarrage

```bash
npm install
npm run build          # build renderer + main
npx electron dist/main/main.js
```

Sous Windows, si votre shell exporte `ELECTRON_RUN_AS_NODE=1` (fréquent dans certains environnements de dev), désactivez-le avant de lancer :

```bash
env -u ELECTRON_RUN_AS_NODE npx electron dist/main/main.js
```

### Tests et vérifications

```bash
npm run test                              # suite Vitest
npx tsc --noEmit -p tsconfig.main.json    # typecheck process principal
npx vue-tsc --noEmit -p tsconfig.json     # typecheck renderer
```

### Générer l'installeur Windows

```bash
npm run package
```

Produit `release/Wakfu Companion Setup <version>.exe`. L'installeur n'est actuellement **pas signé numériquement** — Windows SmartScreen ou un antivirus peuvent afficher un avertissement au premier lancement. C'est un problème de réputation d'éditeur, pas de comportement du code ; voir la section correspondante dans [CLAUDE.md](CLAUDE.md) pour plus de détails.

## Détection du fichier de log

L'app teste, dans l'ordre :
1. `%AppData%\zaap\gamesLogs\wakfu\logs\wakfu.log` (client Zaap/Ankama Launcher)
2. `C:\Program Files (x86)\Steam\steamapps\common\Wakfu\logs\wakfu.log` (client Steam)
3. Sinon, sélection manuelle du fichier via l'onglet Paramètres.

## Pourquoi la saisie manuelle

Les données de jeu (quêtes, hauts faits, monstres) ne sont pas disponibles dans le log sous une forme exploitable automatiquement : les fichiers d'installation du jeu (`%LocalAppData%\Ankama\Wakfu\contents\...`) contiennent des données binaires propriétaires compressées, non documentées. Les extraire nécessiterait du reverse engineering, ce qui est hors-scope de ce projet (voir les contraintes CGU ci-dessous). Les référentiels de quêtes/archimonstres/exploits sont donc alimentés manuellement via l'onglet Admin.

## Respect des CGU Ankama

- Lecture passive uniquement du fichier de log local.
- Aucune automatisation d'action en jeu.
- Aucune lecture mémoire ou réseau du client de jeu.
- Aucune donnée d'identification du joueur stockée ou transmise.

## Structure du projet

```
src/
  main/       → process principal Electron (log watcher, parsers, store, IPC)
  preload/    → bridge contextBridge exposé au renderer
  renderer/   → application Vue (vues, composants, stores Pinia)
tests/        → tests Vitest (parsers, store, timers, watcher)
docs/superpowers/
  specs/      → documents de conception (une spec par changement de fond)
  plans/      → plans d'implémentation détaillés issus des specs
```

## Documentation pour contribuer

Voir [CLAUDE.md](CLAUDE.md) pour le contexte détaillé destiné aux sessions de développement assisté (conventions du projet, pièges connus, décisions passées).
