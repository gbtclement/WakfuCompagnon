# Mise à jour automatique en un clic — design

Date: 2026-08-10

## Contexte et objectif

Le mécanisme actuel (`src/main/updateCheck.ts` + `src/renderer/components/UpdateBadge.vue`)
détecte une nouvelle version publiée sur GitHub Releases et affiche un badge, mais un clic dessus
se contente d'ouvrir la page de release dans le navigateur (`window.wakfuApi.openExternal`) — le
joueur doit ensuite télécharger et lancer l'installeur manuellement.

L'objectif est de remplacer cette redirection par un vrai flux en un clic : téléchargement de la
mise à jour en arrière-plan, puis installation et redémarrage automatiques de l'app, sans jamais
quitter Wakfu Companion.

## Approche

`electron-updater` (bibliothèque officiellement co-maintenue avec `electron-builder`, déjà notre
outil de packaging) remplace entièrement le mécanisme maison de vérification. Elle lit un fichier
`latest.yml` généré automatiquement par `electron-builder` à chaque `npm run package` et attaché à
la release GitHub à côté de l'installeur `.exe` — c'est ce fichier qui permet à `electron-updater`
de savoir si une version plus récente existe et où la télécharger, sans réinventer la logique de
comparaison de versions actuellement dans `updateCheck.ts` (qui est donc supprimé).

**Compromis accepté sur la signature de code :** l'installeur NSIS reste non signé numériquement
(comme aujourd'hui — voir CLAUDE.md, README). Le téléchargement/lancement automatique d'un
exécutable non signé peut déclencher un blocage Windows SmartScreen plus facilement qu'un
double-clic manuel classique. Ce risque est accepté pour l'instant ; si des blocages sont rapportés
en usage réel, une solution de repli sera reconsidérée à ce moment-là plutôt que d'anticiper une
signature de code payante maintenant.

## Flux utilisateur

1. Au démarrage de l'app, le processus main appelle `autoUpdater.checkForUpdates()` une seule fois
   (pas de polling périodique — cohérent avec l'usage en session de jeu, pas en tâche de fond).
2. Si une version plus récente existe, un event est poussé au renderer et le badge affiche
   **"Mise à jour disponible (x.y.z)"**, cliquable.
3. Clic → `autoUpdater.downloadUpdate()` est appelé côté main. Le badge passe à
   **"Téléchargement... N%"** (progression fournie par `electron-updater`), non cliquable pendant
   ce temps.
4. Téléchargement terminé → le badge affiche brièvement **"Redémarrage en cours..."**, puis
   `autoUpdater.quitAndInstall()` ferme et relance l'app avec la nouvelle version installée — sans
   confirmation supplémentaire (choix assumé : moins de friction, cohérent avec le fait que le clic
   initial sur le badge est déjà la confirmation explicite de l'utilisateur).
5. En cas d'échec à n'importe quelle étape (réseau coupé, SmartScreen bloque le téléchargement,
   fichier corrompu) : le badge revient à l'état **"Mise à jour disponible"** avec une info-bulle ou
   un texte d'erreur discret, permettant de réessayer d'un clic plutôt que de rester bloqué
   silencieusement ou de planter l'app.

## Composants modifiés

### Main process

- **Supprimé** : `src/main/updateCheck.ts` et son test associé — logique de comparaison de version
  et d'appel direct à l'API GitHub Releases, entièrement remplacée par `electron-updater`.
- **Nouveau** : `src/main/autoUpdate.ts` — configure `autoUpdater` (mode `github`, pas de
  téléchargement auto avant confirmation utilisateur puisque
  `autoUpdater.autoDownload = false`), enregistre les listeners (`update-available`,
  `download-progress`, `update-downloaded`, `error`) qui relaient chaque état au renderer via
  `getWindow()?.webContents.send(...)`, dans le même style que le relais `wakfu-event-pushed`
  existant dans `ipc.ts`.
- **`src/main/ipc.ts`** : nouveaux canaux `update-check` (déclenche `checkForUpdates()`, appelé une
  fois au démarrage plutôt qu'à la demande — voir Renderer ci-dessous),
  `update-download` (déclenche `downloadUpdate()`), `update-install` (déclenche
  `quitAndInstall()` — bien que l'appel automatique après téléchargement rende ce canal surtout
  utile pour un retry manuel futur si besoin).

### Preload / renderer

- `window.wakfuApi` gagne : `onUpdateAvailable(callback)`, `onUpdateDownloadProgress(callback)`,
  `onUpdateDownloaded(callback)`, `onUpdateError(callback)`, `downloadUpdate(): Promise<void>` —
  suit le pattern existant `onWakfuEvent`/`onTimerExpired` pour les callbacks poussés.
- `UpdateBadge.vue` gagne un état interne (`idle | available | downloading | ready | error`) piloté
  par ces callbacks, remplaçant son actuel `updateInfo: UpdateInfo | null` unique. Le clic appelle
  `window.wakfuApi.downloadUpdate()` au lieu de `openExternal`.

## Configuration de build

`electron-builder.yml` gagne un bloc :

```yaml
publish:
  provider: github
  owner: gbtclement
  repo: WakfuCompagnon
```

Cela fait générer `latest.yml` (et son blockmap) dans `release/` à chaque `npm run package`, en
plus de l'installeur `.exe`. **Ce fichier doit être attaché à la release GitHub aux côtés de
l'installeur** — sans lui, `electron-updater` ne peut pas déterminer qu'une mise à jour existe.
Toute future création de release (`gh release create`) doit donc uploader les deux fichiers
(`Wakfu Companion Setup x.y.z.exe` et `latest.yml`), pas seulement l'exe comme actuellement.

## Tests

- Suppression des tests de `updateCheck.ts` (fichier supprimé).
- `autoUpdate.ts` : logique fine (formatage de progression, relais d'événements) reste testable en
  isolant les listeners de `autoUpdater` — `electron-updater` lui-même n'est pas testé unitairement
  (comme `electron-store`/`net.fetch`, c'est une dépendance externe dont on fait confiance au
  contrat), suivant la même convention que le reste du projet pour les wrappers de bibliothèques
  Electron/tierces.
- Pas de nouveau test de parser ou de store — ce changement ne touche ni les logs ni `AppConfig`.

## Hors périmètre (v1)

- Signature de code de l'installeur (coût, hors budget pour l'instant — voir compromis accepté
  ci-dessus).
- Choix utilisateur du moment de redémarrage ("Redémarrer plus tard") — décision assumée
  d'installer immédiatement après téléchargement.
- Mises à jour delta/différentielles (`electron-updater` les supporte nativement via NSIS
  blockmaps, mais ce n'est pas une exigence explicite — le comportement par défaut suffit).
- Vérification de checksum/signature de `latest.yml` au-delà de ce qu'`electron-updater` fait déjà
  nativement.