# Comptes, amis et suivi des métiers — design

Date: 2026-08-09

## Contexte et objectif

Wakfu Companion est aujourd'hui une app 100% locale (Electron + electron-store), sans aucun
compte utilisateur ni communication réseau hormis la vérification de mise à jour GitHub Releases.

L'objectif de cette feature est d'ajouter :
- des comptes joueurs (inscription/connexion),
- un système d'amis (ajout via un code ami généré à l'inscription),
- le suivi du niveau des métiers (0 à 155) de chaque joueur, avec mise à jour **automatique**
  détectée depuis `wakfu.log` et correction **manuelle** possible,
- la visibilité des niveaux de métiers entre amis, pour synchroniser des sessions de jeu ensemble.

Ceci nécessite un vrai backend (API + base de données) puisque les amis doivent voir les niveaux
des uns et des autres même quand ils ne sont pas en train de jouer en même temps — une base locale
seule ne le permet pas.

**Le compte est optionnel.** Toutes les fonctionnalités locales actuelles (timers, quêtes
environnementales, archimonstres, exploits) continuent de fonctionner sans connexion. Le
compte/connexion ne déverrouille que le nouvel onglet "Amis".

## Vue d'ensemble de l'architecture

Deux nouveaux composants, en plus du client Electron existant :

1. **Backend** (dossier `server/` dans ce même repo, voir détail plus bas) : une API HTTP
   (Node + Fastify) qui expose l'authentification, la gestion des amis et la synchronisation des
   métiers. Déployée sur un hébergeur gratuit type Fly.io (ou Render), stateless.
2. **Base de données** : PostgreSQL géré par **Supabase** (tier gratuit pérenne). Le backend
   custom s'y connecte comme à un Postgres classique (via une chaîne de connexion) — on n'utilise
   pas l'auth ni l'API auto-générée de Supabase, uniquement l'hébergement de la base.
3. **Client Electron** (ce repo) : nouveau module réseau côté main process qui appelle l'API via
   `net.fetch`, nouveau parser de log, nouveaux canaux IPC, nouveaux stores Pinia, nouvelles vues.

```
Electron main process --HTTP(JSON)--> API Node (Fastify) --SQL--> PostgreSQL (Supabase)
        ^
        | tail + parse wakfu.log (inchangé, local)
```

Le backend vit dans le même repo Git (monorepo public), dans un nouveau dossier `server/` à la
racine, à côté de `src/`. Le client Electron existant n'est pas déplacé — `src/`, `tests/`, et
tous les fichiers de config à la racine (`tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`,
`electron-builder.yml`) restent exactement où ils sont, zéro risque sur le build actuel. `server/`
a son propre `package.json` indépendant (pas de workspace npm partagé — deux projets Node
autonomes côte à côte dans le même repo Git). Aucun secret (mot de passe DB, JWT secret) n'est
jamais commité — uniquement des variables d'environnement côté hébergeur.

## Schéma de données (PostgreSQL)

```sql
users
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  username      text UNIQUE NOT NULL
  email         text UNIQUE NOT NULL
  password_hash text NOT NULL           -- argon2
  friend_code   text UNIQUE NOT NULL    -- ex: "WC-A1B2C3", généré à l'inscription
  created_at    timestamptz NOT NULL DEFAULT now()

user_jobs
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  job_name   text NOT NULL              -- doit appartenir à la liste des métiers connus
  level      int NOT NULL CHECK (level BETWEEN 0 AND 155)
  updated_at timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (user_id, job_name)

friendships
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  status       text NOT NULL DEFAULT 'pending'  -- 'pending' | 'accepted'
  created_at   timestamptz NOT NULL DEFAULT now()
  UNIQUE (requester_id, addressee_id)
```

La liste des métiers (noms fixes, niveau 0-155) est codée en dur dans le code — côté client pour
l'UI d'inscription/édition, côté serveur pour valider `job_name` à l'écriture — pas de table
référentielle séparée. C'est cohérent avec le choix déjà fait dans ce projet pour les quêtes
environnementales et archimonstres (référentiels maintenus en dur / via Admin tab, jamais extraits
du jeu).

## API (backend)

Toutes les routes sauf `/auth/*` exigent un header `Authorization: Bearer <jwt>`.

| Méthode | Route | Body | Description |
|---|---|---|---|
| POST | `/auth/register` | `{username, email, password, jobs: {[jobName]: level}}` | Crée le compte + toutes les lignes `user_jobs` en une transaction. Retourne `{token, user}`. |
| POST | `/auth/login` | `{usernameOrEmail, password}` | Retourne `{token, user}`. |
| GET | `/me/jobs` | — | Métiers du joueur connecté. |
| PUT | `/me/jobs/:jobName` | `{level}` | Fixe le niveau final (le client calcule le delta, le serveur ne fait qu'écrire la valeur reçue). |
| POST | `/friends/request` | `{friendCode}` | Crée une `friendship` en `pending`. Erreur si code inconnu, si c'est son propre code, ou si une relation existe déjà. |
| GET | `/friends/requests` | — | Demandes reçues en attente. |
| POST | `/friends/requests/:id/accept` | — | Passe la friendship en `accepted`. |
| POST | `/friends/requests/:id/reject` | — | Supprime la friendship. |
| GET | `/friends` | — | Liste des amis acceptés, avec leurs métiers (jointure `user_jobs`). |

Mots de passe hashés avec argon2. JWT signé (secret côté serveur), pas de refresh token pour cette
v1 — expiration longue (ex: 30 jours), l'utilisateur se reconnecte manuellement si expiré.

Pas d'envoi d'email (pas de vérification d'adresse, pas de reset de mot de passe automatisé pour
cette v1) — l'email est stocké pour un futur "mot de passe oublié" mais n'est pas exploité tout de
suite.

## Client Electron

### Réseau (main process)

Nouveau `src/main/apiClient.ts` : wrapper `net.fetch` vers l'URL de base de l'API (constante),
ajoute le header `Authorization` si un token est présent, parse le JSON, et **propage les erreurs**
(contrairement à `updateCheck.ts` qui avale tout — ici l'échec doit remonter à l'UI, ex: "mot de
passe incorrect", "code ami invalide").

### Session

Le JWT est chiffré avec `safeStorage.encryptString` (API native Electron, aucune dépendance
ajoutée) puis stocké comme champ `authToken?: string` dans `electron-store`, à côté du reste de
`AppConfig`. Déchiffré au démarrage pour restaurer la session sans repasser par le formulaire de
connexion.

### Parser de log

Nouveau `src/main/parsers/jobLevelUp.ts`, suivant le pattern des parsers existants
(`(line: string) => WakfuEvent | null`, testé avec des fixtures) :

```
INFO 20:04:47,496 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Trappeur : +1 041 points d'XP.  +1 niveau. Prochain niveau dans : 20 796.
```

Capture le nom du métier et le nombre de niveaux gagnés (`+1`, `+2`, ... — nombre variable, pas
limité à 1). Si le nom du métier capturé n'appartient pas à la liste connue, retourne `null` (la
ligne est ignorée par ce parser, comme n'importe quelle ligne non reconnue).

Nouveau variant dans `WakfuEvent` (`parsers/types.ts`) :
```ts
{ type: 'job-level-up', jobName: string, levelsGained: number, timestamp: string }
```

Ajouté au tableau `PARSERS` dans `logWatcher.ts`.

### Calcul du niveau

Le niveau affiché/stocké localement est **niveau connu + delta du log**, plafonné à 155. C'est une
source de dérive possible si des lignes de log sont manquées (rotation, app fermée) — c'est
précisément pour ça que l'édition manuelle existe : un simple correctif, pas une reconstruction
d'historique.

Quand l'event `job-level-up` arrive (détecté dans `appState.ts`, déjà abonné à `onWakfuEvent`) :
1. Le niveau local du métier est incrémenté.
2. Si un compte est connecté, le nouveau niveau final est envoyé immédiatement au serveur
   (`PUT /me/jobs/:jobName`) — envoi immédiat à chaque changement, pas de batching (le volume est
   très faible : quelques montées de niveau par session de jeu).

La même logique d'envoi immédiat s'applique à une correction manuelle du niveau.

### IPC (nouveaux canaux, même convention kebab-case existante)

`auth-register`, `auth-login`, `auth-logout`, `auth-get-session`, `friends-send-request`,
`friends-accept-request`, `friends-reject-request`, `friends-list`, `friends-pending-requests`,
`job-update-manual`.

Comme le reste du projet, les handlers mutants renvoient l'état complet pertinent (session ou
liste d'amis à jour) plutôt qu'un diff.

### Stores Pinia

- `auth.ts` : `isLoggedIn`, `user` (username, friendCode), actions `register`/`login`/`logout`.
- `friends.ts` : liste des amis + leurs métiers, demandes en attente, actions
  `sendRequest`/`accept`/`reject`/`refresh`.

Chargement à l'ouverture de l'onglet Amis (pull), pas de temps réel/WebSocket pour cette v1.

### Vues

- `RegisterView.vue` — étape 1 : pseudo, email, mot de passe + confirmation. Étape 2 : saisie du
  niveau (0-155) de chaque métier connu, via inputs numériques pré-remplis à 0.
- `LoginView.vue` — pseudo/email + mot de passe.
- `FriendsView.vue` — liste des amis avec grille de niveaux de métiers, champ pour ajouter un ami
  par code, liste des demandes reçues avec boutons accepter/refuser, affichage de son propre code
  ami à partager.
- Édition manuelle des niveaux : section ajoutée à `SettingsView.vue` (ou sous-section de
  `FriendsView.vue`) avec un input par métier, corrige le niveau local et déclenche la synchro si
  connecté.
- `NavBar.vue` : nouvel item "Amis" visible uniquement si connecté, plus un indicateur
  connecté/déconnecté menant à Login/Register ou à un menu déconnexion.

## Tests

- Parser `jobLevelUp.ts` : fixtures dans `tests/parsers/fixtures.ts` avec la ligne exacte fournie,
  une variante `+2 niveaux`, et un métier inconnu (doit retourner `null`).
- Store/logique de calcul de niveau (delta + plafond 155) : tests unitaires côté `appState.ts` ou
  équivalent.
- Backend : suite de tests Vitest propre à `server/` (voir plan d'implémentation backend),
  intégration Fastify `.inject()` contre une vraie base Postgres de test.

## Hors périmètre (v1)

- Vérification d'email, reset de mot de passe automatisé.
- Notifications temps réel (WebSocket/push) des changements d'amis — pull uniquement.
- Historique des montées de niveau (on ne stocke que le niveau courant, pas un log d'événements
  côté serveur).
- Confidentialité fine (ex: cacher certains métiers à certains amis) — un ami voit tous les métiers.
- Suppression d'ami, blocage.
