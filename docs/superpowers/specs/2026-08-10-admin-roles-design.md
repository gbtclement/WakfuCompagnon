# Rôles admin/player et gestion des comptes — design

Date: 2026-08-10

## Contexte et objectif

Le système de comptes (inscription, connexion, amis, métiers — voir
`docs/superpowers/specs/2026-08-09-accounts-friends-jobs-design.md`) n'a aujourd'hui aucune notion
de rôle. L'onglet Admin existant (gestion des référentiels quêtes environnementales/
archimonstres/exploits) est visible par tout le monde, sans restriction — vestige de l'app
100% locale d'avant les comptes.

L'objectif de cette feature :
- Ajouter un rôle `player` (par défaut) ou `admin` à chaque compte.
- L'onglet Admin ne doit plus être visible que pour un utilisateur connecté avec le rôle `admin`.
- Le seul moyen de passer un compte en `admin` est une modification manuelle en base
  (`UPDATE users SET role = 'admin' WHERE ...`, via le Table Editor ou SQL Editor de Supabase) —
  aucune UI ne permet de changer un rôle.
- Un admin doit pouvoir voir la liste des comptes inscrits, éditer leurs informations (pseudo,
  email, niveaux de métier), et supprimer un compte, depuis l'onglet Admin.

## Comportement du rôle et des tokens

Le rôle est encodé dans le JWT au moment de `login`/`register`, aux côtés de `userId` — évite un
aller-retour base de données à chaque requête pour vérifier les droits (cohérent avec le choix déjà
fait pour `userId`, voir spec comptes/amis/métiers).

**Conséquence acceptée :** si un compte est promu `admin` en base pendant qu'un token déjà émis
(rôle `player`) est encore valide (jusqu'à 30 jours, durée de vie actuelle du JWT), ce token ne
reflète pas la promotion tant que l'utilisateur ne se reconnecte pas. C'est un compromis assumé —
volume de promotions extrêmement faible (une seule personne, toi, effectue ce changement), pas
besoin de revérifier le rôle en base à chaque requête pour ce cas rare. Après une promotion
manuelle en base, il faut donc demander au joueur concerné de se déconnecter puis se reconnecter
dans l'app.

## Schéma de données

```sql
ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'admin'));
```

Migration additive pure (`ALTER TABLE ... ADD COLUMN ... DEFAULT`), sans impact sur les lignes
existantes — tous les comptes déjà inscrits deviennent `player` par défaut.

## API (backend)

Nouveau middleware `requireAdmin` (variante de `requireAuth` existant dans `src/auth/jwt.ts`) :
vérifie d'abord l'authentification (même logique que `requireAuth`), puis rejette avec `403` si le
`role` décodé du JWT n'est pas `'admin'`.

| Méthode | Route | Body | Description |
|---|---|---|---|
| GET | `/admin/users` | — | Liste tous les comptes : `{id, username, email, role, createdAt, jobs: [{jobName, level}]}`. |
| PUT | `/admin/users/:id` | `{username?, email?, jobs?}` | Édite pseudo/email/niveaux de métier d'un compte. Chaque champ est optionnel (mise à jour partielle). **Le rôle n'est jamais modifiable via cette route** — pas de champ `role` accepté, même si envoyé, il est ignoré. |
| DELETE | `/admin/users/:id` | — | Supprime le compte. Cascade déjà en place via `ON DELETE CASCADE` sur `user_jobs.user_id` et `friendships.requester_id`/`addressee_id` — aucune logique de nettoyage supplémentaire nécessaire. |

Toutes les routes `/admin/*` passent par `requireAdmin`. Validation des champs `PUT` avec `zod`,
même pattern que les routes existantes ; `jobs` (si fourni) est validé avec `isValidJobName`/
`clampLevel` comme à l'inscription.

`register` insère désormais explicitement `role: 'player'` dans la requête `INSERT` (déjà le
défaut SQL, mais explicite dans le code pour lisibilité — évite toute ambiguïté si le défaut SQL
change un jour). Les réponses de `POST /auth/register`, `POST /auth/login`, et la valeur décodée
pour `GET /auth-get-session` côté client incluent désormais `role` dans l'objet `user`.

## Client Electron

### Session et NavBar

`AppConfig.currentUser` (dans `src/main/store.ts`) gagne un champ `role: 'player' | 'admin'`,
stocké aux côtés de `username`/`friendCode` dans la session persistée.

`useAuthStore` (renderer) expose `isAdmin: boolean` (calculé depuis `user.role === 'admin'`).
`NavBar.vue` : le lien vers `/admin` n'est rendu que si `authStore.isAdmin` est vrai (remplace le
rendu inconditionnel actuel) — un joueur non connecté ou connecté en `player` ne voit plus du tout
cet onglet dans la navigation.

### Nouvelle IPC

Nouveaux canaux (suivant la convention kebab-case existante) : `admin-list-users`,
`admin-update-user`, `admin-delete-user`. Chacun vérifie côté main qu'une session admin existe
avant d'appeler l'API (défense en profondeur : même si l'UI cache le lien, un appel IPC direct
sans session admin valide échoue côté serveur avec 401/403, propagé tel quel au renderer).

### UI

Nouvelle section "Comptes" dans `AdminView.vue` (ou sous-onglet dédié si le fichier existant
devient trop chargé — à trancher à l'implémentation selon la taille actuelle du fichier) :
- Liste des joueurs inscrits : pseudo, email, rôle, date d'inscription.
- Bouton "Éditer" par ligne, ouvrant un formulaire réutilisant le pattern visuel de l'étape 2 du
  formulaire d'inscription (`RegisterView.vue`) — champs pseudo/email en haut, puis la liste des 13
  métiers avec leurs niveaux (0-155) en dessous.
- Bouton "Supprimer" par ligne, avec confirmation via `window.confirm()` (cohérent avec l'absence
  de composant modal système ailleurs dans l'app — pas de nouvelle dépendance UI pour ce besoin
  ponctuel).

## Tests

- Backend : tests d'intégration Fastify `.inject()` pour `requireAdmin` (401 sans token, 403 avec
  token `player`, 200 avec token `admin`) et pour chacune des 3 routes `/admin/users`, suivant le
  pattern des tests de routes existants (`server/tests/routes/*.test.ts`).
- Client : pas de nouveau parser ni de changement de `AppConfig` structurel majeur au-delà du champ
  `role` ajouté à `currentUser` — un test `AppStore` vérifiant que `role` est bien persisté/restauré
  suffit, suivant le pattern du test `setSession`/`getSession` existant.

## Hors périmètre (v1)

- Changer le rôle d'un compte depuis l'UI (volontairement exclu — seule la base de données permet
  cette action, décision explicite de l'utilisateur).
- Réinitialisation de mot de passe par un admin (hors périmètre, cohérent avec l'absence de flux
  "mot de passe oublié" dans la spec comptes/amis/métiers).
- Révocation immédiate de token après une promotion/rétrogradation en base — le joueur doit se
  reconnecter (voir section "Comportement du rôle et des tokens").
- Pagination de la liste des comptes (`GET /admin/users` renvoie tout — acceptable au volume actuel
  d'un petit groupe d'amis, à revisiter si le nombre de comptes grandit significativement).
- Journalisation des actions admin (qui a édité/supprimé quel compte, quand) — pas d'exigence
  explicite pour cette v1.