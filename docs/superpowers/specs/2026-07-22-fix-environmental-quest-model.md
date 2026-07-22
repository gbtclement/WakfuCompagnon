# Fix environmental quest model — remove Challenge courant, use real quest names

Date : 2026-07-22

## Problème

La V1 confondait deux événements distincts du log Wakfu :
- `Challenge courant : <id>` — un ID de challenge interne (souvent négatif), sans nom exploitable dans le log, dont la signification exacte n'est pas confirmée.
- `Vous venez de remporter la quête "<nom>"` / `Quête échouée: "<nom>"` — les vraies quêtes environnementales telles que vues par l'utilisateur dans l'historique (tag "quête"), avec un nom directement lisible.

Le modèle `EnvironmentalQuest` et tout le suivi (Admin, Exploits) étaient bâtis sur le premier concept (`challengeId`), obligeant l'utilisateur à deviner/saisir un ID opaque (ex: "Challenge #1841") sans rapport avec ce qu'il voit réellement en jeu.

## Décision

Retirer entièrement le concept "Challenge courant" du code (parser, type d'événement, affichage). Le suivi de quêtes environnementales repose désormais uniquement sur les événements `quest-completed`/`quest-failed`, qui portent un nom de quête textuel exact.

## Changements de modèle

- **Parser** : suppression de `src/main/parsers/environmentalQuest.ts` et du type `environmental-quest` dans `parsers/types.ts`. `LogWatcher` n'utilise plus ce parser.
- **`EnvironmentalQuest`** (`store.ts`) : `{ id: string; name: string }` — `id` devient un uuid généré à la création (comme pour `Archimonster`), au lieu de l'ancien `challengeId` numérique saisi à la main.
- **`followedQuestIds`** : `string[]` (uuid de quête) au lieu de `number[]` (ancien challenge id).
- **Détection de rencontre** : un événement `quest-completed` ou `quest-failed` dont `questName` correspond exactement (égalité stricte de chaîne) au `name` d'une `EnvironmentalQuest` suivie déclenche la notification "Quête environnementale rencontrée" — remplace l'ancienne logique basée sur `challengeId !== -1`.
- **Exploit.questIds** : `string[]` (uuid de quête) au lieu de `number[]`.

## Écrans impactés

- **AdminView** : le formulaire de création de quête n'a plus de champ ID — juste un champ nom.
- **ExploitsView** : la progression "quête rencontrée" se base sur la présence d'un événement `quest-completed`/`quest-failed` avec le nom correspondant dans `liveEvents`, au lieu de `challengeId`.
- **HistoryView** et **ServerStatusView** : suppression du cas d'affichage `environmental-quest`/"Challenge actif" — ces vues n'affichent plus que les types d'événements restants (server-connection, quest-completed, quest-failed, achievement).

## Migration des données existantes

Les 13 entrées actuellement en store sont des placeholders sans valeur ("Challenge #1123", etc.) créés par l'ancien seed JSON statique — elles ne correspondent à aucune vraie quête nommée. Au démarrage suivant cette mise à jour, si une entrée de `environmentalQuests` a un `id` numérique (signature de l'ancien format), le tableau est vidé entièrement (pas de tentative de conversion, puisque le nom n'a aucune valeur informative). L'utilisateur repart d'une liste vide qu'il alimente via l'Admin ou, plus tard, via une détection automatique optionnelle (hors scope ici) des noms de quêtes vus dans les logs.

`followedQuestIds` et tout `Exploit.questIds` référençant l'ancien format numérique sont également vidés à cette occasion (plus aucune correspondance possible avec le nouveau modèle).

## Tests

Mise à jour des tests `store.test.ts` existants pour le nouveau modèle `EnvironmentalQuest`/`followedQuestIds` (string au lieu de number). Suppression des tests du parser `environmentalQuest.test.ts` et de ses fixtures (`ENVIRONMENTAL_QUEST_LINES` dans `tests/parsers/fixtures.ts`). `logWatcher.test.ts` ne référence pas ce parser dans ses fixtures actuelles — aucun changement nécessaire là, hormis le retrait de `parseEnvironmentalQuest` de la liste des parsers utilisés par `LogWatcher`.
