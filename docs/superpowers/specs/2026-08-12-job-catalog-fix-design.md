# Correction du catalogue de métiers, catégories et icônes — design

Date: 2026-08-12

## Contexte et objectif

La liste des métiers codée en dur (`src/main/jobs.ts` côté client, `server/src/jobs.ts` côté
serveur) contient des noms erronés qui n'existent pas réellement dans Wakfu (ex: "Bûcheron",
"Alchimiste", "Sculpteur", "Cordonnier", "Façonneur"). Conséquence directe : le parser de log
`parseJobLevelUp` (`src/main/parsers/jobLevelUp.ts`) rejette silencieusement toute ligne de log
mentionnant un vrai métier absent de cette liste erronée (`isValidJobName` renvoie `false`), donc
la détection automatique de montée de niveau ne fonctionne pas pour ces métiers.

L'objectif de cette feature :
- Remplacer la liste par les 14 vrais métiers du jeu, organisés en deux catégories : récolte et
  artisanat.
- Afficher une icône par métier (fournies en `.webp`) partout où la grille de métiers apparaît.
- Regrouper visuellement les métiers par catégorie (titre de section "Récolte" / "Artisanat") dans
  les mêmes trois endroits.
- Nettoyer les données déjà en base qui référencent les anciens noms erronés.

## Liste des métiers

```
Récolte    : Paysan, Pêcheur, Trappeur, Mineur, Herboriste, Forestier
Artisanat  : Ébéniste, Tailleur, Bijoutier, Armurier, Maître d'Armes, Maroquinier, Cuisinier,
             Boulanger
```

14 métiers au total (6 récolte + 8 artisanat), niveaux toujours bornés 0-155 (inchangé).

## Structure de données

Remplace le tableau plat `JOB_NAMES: readonly string[]` par une structure typée, dans
`src/main/jobs.ts` et `server/src/jobs.ts` (chacun reste la source de vérité de son propre
runtime — client et serveur restent deux processus séparés, donc toujours deux définitions, mais
chacune n'est plus dupliquée une seconde fois à l'intérieur de son propre côté) :

```typescript
export type JobCategory = 'recolte' | 'artisanat'

export interface JobDefinition {
  name: string
  category: JobCategory
}

export const JOBS: readonly JobDefinition[] = [
  { name: 'Paysan', category: 'recolte' },
  { name: 'Pêcheur', category: 'recolte' },
  { name: 'Trappeur', category: 'recolte' },
  { name: 'Mineur', category: 'recolte' },
  { name: 'Herboriste', category: 'recolte' },
  { name: 'Forestier', category: 'recolte' },
  { name: 'Ébéniste', category: 'artisanat' },
  { name: 'Tailleur', category: 'artisanat' },
  { name: 'Bijoutier', category: 'artisanat' },
  { name: 'Armurier', category: 'artisanat' },
  { name: "Maître d'Armes", category: 'artisanat' },
  { name: 'Maroquinier', category: 'artisanat' },
  { name: 'Cuisinier', category: 'artisanat' },
  { name: 'Boulanger', category: 'artisanat' }
] as const

export const JOB_NAMES: readonly string[] = JOBS.map((j) => j.name)
```

`isValidJobName`/`clampLevel` restent inchangées (elles utilisent déjà `JOB_NAMES`). Les noms de
fichiers d'icônes n'ont pas d'accents/apostrophes (`Ebeniste.webp`, `MaitredArmes.webp`,
`Pecheur.webp`) — la fonction de mapping icône devra donc normaliser le nom du métier vers le nom
de fichier via une table de correspondance explicite plutôt que de déduire le nom de fichier
depuis le nom affiché.

**Client uniquement — chaque site qui affiche actuellement une liste inline de noms de métiers
(`RegisterView.vue`, `AdminUsersPanel.vue`, la section métiers de `FriendsView.vue`) importe
désormais `JOBS` depuis `src/main/jobs.ts` au lieu de redéfinir son propre tableau `JOB_NAMES`
local — élimine la duplication actuelle à 3 endroits côté renderer.**

## Icônes

Les 14 fichiers `.webp` sont copiés dans `src/renderer/assets/jobs/` (déjà fait : `Armurier.webp`,
`Bijoutier.webp`, `Boulanger.webp`, `Cuisinier.webp`, `Ebeniste.webp`, `Forestier.webp`,
`Herboriste.webp`, `MaitredArmes.webp`, `Maroquinier.webp`, `Mineur.webp`, `Paysan.webp`,
`Pecheur.webp`, `Tailleur.webp`, `Trappeur.webp`), embarqués dans le build via les imports Vite
standards — fonctionnent offline, aucune dépendance à un chemin local hors du repo.

Nouveau fichier `src/renderer/jobIcons.ts` : table de correspondance explicite nom de métier
affiché → import de l'icône :

```typescript
import paysan from './assets/jobs/Paysan.webp'
import pecheur from './assets/jobs/Pecheur.webp'
import trappeur from './assets/jobs/Trappeur.webp'
import mineur from './assets/jobs/Mineur.webp'
import herboriste from './assets/jobs/Herboriste.webp'
import forestier from './assets/jobs/Forestier.webp'
import ebeniste from './assets/jobs/Ebeniste.webp'
import tailleur from './assets/jobs/Tailleur.webp'
import bijoutier from './assets/jobs/Bijoutier.webp'
import armurier from './assets/jobs/Armurier.webp'
import maitredarmes from './assets/jobs/MaitredArmes.webp'
import maroquinier from './assets/jobs/Maroquinier.webp'
import cuisinier from './assets/jobs/Cuisinier.webp'
import boulanger from './assets/jobs/Boulanger.webp'

export const JOB_ICONS: Record<string, string> = {
  'Paysan': paysan,
  'Pêcheur': pecheur,
  'Trappeur': trappeur,
  'Mineur': mineur,
  'Herboriste': herboriste,
  'Forestier': forestier,
  'Ébéniste': ebeniste,
  'Tailleur': tailleur,
  'Bijoutier': bijoutier,
  'Armurier': armurier,
  "Maître d'Armes": maitredarmes,
  'Maroquinier': maroquinier,
  'Cuisinier': cuisinier,
  'Boulanger': boulanger
}
```

## UI : regroupement par catégorie + icônes

S'applique aux trois endroits qui affichent la grille de métiers :
1. `RegisterView.vue` (étape 2 du formulaire d'inscription)
2. `AdminUsersPanel.vue` (formulaire d'édition d'un compte joueur, dans l'onglet Admin)
3. `FriendsView.vue` (section "Mes métiers" et l'affichage des métiers de chaque ami dans la liste
   d'amis)

Chaque grille est désormais découpée en deux sous-sections avec un titre ("Récolte", "Artisanat"),
chacune listant uniquement les métiers de sa catégorie (filtré depuis `JOBS`). Chaque ligne de
métier reste au format compact actuel (nom + input ou valeur affichée), avec l'ajout d'une petite
icône (24-28px) avant le nom, tirée de `JOB_ICONS`.

## Migration des données existantes

Les comptes déjà inscrits en production ont des lignes `user_jobs` référençant les anciens noms
erronés. Nouvelle migration `server/migrations/003_fix_job_names.sql` :

```sql
DELETE FROM user_jobs
WHERE job_name NOT IN (
  'Paysan', 'Pêcheur', 'Trappeur', 'Mineur', 'Herboriste', 'Forestier',
  'Ébéniste', 'Tailleur', 'Bijoutier', 'Armurier', 'Maître d''Armes', 'Maroquinier',
  'Cuisinier', 'Boulanger'
);
```

Suppression pure et définitive des lignes orphelines — choix assumé, le volume de données réel à ce
stade est minime (système très récent). Après cette migration, le backend rejette déjà
automatiquement toute tentative d'écrire un ancien nom de métier via `isValidJobName` (mécanisme
existant, inchangé) — aucun risque de réintroduction.

## Parser de log

Aucun changement de code dans `src/main/parsers/jobLevelUp.ts` — il appelle déjà
`isValidJobName(jobName)` dynamiquement depuis `src/main/jobs.ts`. Une fois la liste corrigée, la
détection fonctionne automatiquement pour les 14 vrais métiers, y compris ceux dont le nom contient
une apostrophe ("Maître d'Armes") : le regex existant capture `[^:]+?` (tout caractère non-`:`),
donc l'apostrophe ne casse pas la capture.

## Tests

- `tests/main/jobs.test.ts` / `server/tests/jobs.test.ts` : mis à jour pour vérifier `JOB_NAMES`
  contient les 14 vrais métiers (et plus les anciens noms erronés), et que `JOBS` associe
  correctement chaque métier à sa catégorie.
- `tests/parsers/fixtures.ts` / `tests/parsers/jobLevelUp.test.ts` : les fixtures existantes
  utilisant "Trappeur"/"Bûcheron" sont mises à jour — "Bûcheron" n'étant plus un métier valide,
  remplacé par un autre vrai métier (ex: "Mineur") pour le cas "métier valide", tout en gardant un
  cas "métier invalide inconnu" avec un nom qui n'existe toujours pas.
- `server/tests/routes/auth.test.ts` : tout payload de test utilisant un ancien nom de métier
  erroné est mis à jour vers un vrai nom.
- Pas de nouveau test dédié aux icônes (asset statique, pas de logique à tester — cohérent avec le
  reste du projet qui ne teste pas les assets visuels).

## Hors périmètre (v1)

- Icônes de fallback si `JOB_ICONS` ne trouve pas de correspondance (n'arrivera pas en pratique
  puisque la table est exhaustive et couvre exactement `JOBS`).
- Réorganisation plus poussée de l'UI au-delà du regroupement par catégorie demandé (pas de
  changement de layout général, de tri, ou de recherche/filtre).
- Historique ou audit des anciennes valeurs de métier supprimées par la migration de nettoyage.
