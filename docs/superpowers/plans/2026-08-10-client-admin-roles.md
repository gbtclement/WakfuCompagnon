# Client — Rôles admin/player et gestion des comptes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the Admin tab behind an `admin` role, and add an account-management panel (list,
edit, delete) to it, consuming the backend `/admin/users` routes.

**Architecture:** The session's `role` flows from the backend through IPC/preload into
`useAuthStore`, which exposes `isAdmin`. `NavBar.vue` conditions the Admin link on it. A new
`AdminUsersPanel.vue` component (kept separate from the already-230-line `AdminView.vue`) handles
the new account list/edit/delete UI, backed by a new `useAdminUsersStore`.

**Tech Stack:** Same as the rest of the client — Electron IPC, Pinia, Vue 3 SFCs, vitest.

## Global Constraints

- This plan depends on the backend plan (`docs/superpowers/plans/2026-08-10-backend-admin-roles.md`)
  being implemented and running — `PUT /admin/users/:id`, `GET /admin/users`,
  `DELETE /admin/users/:id`, and `role` in `/auth/login`/`/auth/register` responses must exist.
- The Admin nav link is rendered only when `authStore.isAdmin` is true — a logged-out user or a
  `player` never sees it, matching the existing pattern where `/friends` is gated on
  `authStore.isLoggedIn`.
- No UI anywhere allows changing a user's role — the edit form only touches username, email, and
  job levels, by explicit design decision (see spec).
- Deletion requires a `window.confirm()` confirmation before the IPC call fires — no silent
  destructive action.
- `AdminView.vue` is not rewritten wholesale — the new accounts section is added as a separate
  mounted component (`AdminUsersPanel.vue`), keeping the existing quests/archimonsters/exploits
  panels untouched.

---

## File Structure

```
src/main/
  store.ts                    # MODIFY — AppConfig.currentUser gains role field
  ipc.ts                        # MODIFY — admin-list-users/admin-update-user/admin-delete-user handlers

src/preload/
  preload.ts                    # MODIFY — expose adminListUsers/adminUpdateUser/adminDeleteUser

src/renderer/
  stores/
    auth.ts                       # MODIFY — isAdmin getter, role threaded through register/login/load
    adminUsers.ts                  # NEW — users list + update/delete actions
  components/
    NavBar.vue                     # MODIFY — Admin link gated on authStore.isAdmin
    AdminUsersPanel.vue              # NEW — accounts list, edit form, delete button
  views/
    AdminView.vue                    # MODIFY — mounts <AdminUsersPanel /> as a new panel

tests/
  main/
    store.test.ts                     # MODIFY — assert role round-trips through setSession/getSession
```

**Interfaces summary (for cross-task reference):**
- `AppConfig.currentUser` becomes `{ username: string; friendCode: string; role: 'player' | 'admin' } | null`.
- `window.wakfuApi` gains: `adminListUsers(): Promise<AdminUserView[]>`,
  `adminUpdateUser(id: string, payload: {username?: string; email?: string; jobs?: Record<string, number>}): Promise<void>`,
  `adminDeleteUser(id: string): Promise<void>`, where
  `AdminUserView = { id: string; username: string; email: string; role: string; createdAt: string; jobs: {jobName: string; level: number}[] }`.
- `useAuthStore` gains `isAdmin: boolean` (getter, `state.user?.role === 'admin'`).
- `useAdminUsersStore` (new) exposes `users: AdminUserView[]`, actions `refresh()`,
  `updateUser(id, payload)`, `deleteUser(id)`.

---

### Task 1: Thread `role` through session storage

**Files:**
- Modify: `src/main/store.ts`
- Modify: `tests/main/store.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AppConfig.currentUser.role: 'player' | 'admin'` — used by Task 2 (IPC handlers passing
  role through) and Task 4 (`useAuthStore.isAdmin`).

- [ ] **Step 1: Write the failing test**

In `tests/main/store.test.ts`, find the existing test `'stores and retrieves an encrypted session,
decrypted on read'` and replace it with this version (adds `role` to the session object):

```typescript
  it('stores and retrieves an encrypted session, decrypted on read', () => {
    expect(store.getSession()).toEqual({ token: null, user: null })

    store.setSession('a.fake.jwt', { username: 'clement', friendCode: 'WC-ABCDEF', role: 'player' })
    const session = store.getSession()
    expect(session.token).toBe('a.fake.jwt')
    expect(session.user).toEqual({ username: 'clement', friendCode: 'WC-ABCDEF', role: 'player' })

    // the raw config field must not be the plaintext token
    expect(store.getConfig().authToken).not.toBe('a.fake.jwt')

    store.setSession(null, null)
    expect(store.getSession()).toEqual({ token: null, user: null })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/store.test.ts`
Expected: FAIL — `setSession`'s second parameter type doesn't accept `role` yet (TypeScript error
surfaces as a test file compile failure under vitest, reported as a failing suite).

- [ ] **Step 3: Modify `src/main/store.ts`**

In the `AppConfig` interface, change:

```typescript
  currentUser: { username: string; friendCode: string } | null
```

to:

```typescript
  currentUser: { username: string; friendCode: string; role: 'player' | 'admin' } | null
```

Change the `setSession`/`getSession` method signatures to match:

```typescript
  setSession(token: string | null, user: { username: string; friendCode: string; role: 'player' | 'admin' } | null): void {
    this.store.set('authToken', token ? encryptToken(token) : null)
    this.store.set('currentUser', user)
  }

  getSession(): { token: string | null; user: { username: string; friendCode: string; role: 'player' | 'admin' } | null } {
    const encrypted = this.store.get('authToken')
    return {
      token: encrypted ? decryptToken(encrypted) : null,
      user: this.store.get('currentUser')
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: this will FAIL at this point — `src/main/ipc.ts` calls `store.setSession` with objects
missing `role` (from the pre-existing auth-register/auth-login handlers). This is expected and
resolved in Task 2; do not attempt to fix `ipc.ts` here. Proceed to Task 2 immediately.

- [ ] **Step 6: Commit**

```bash
git add src/main/store.ts tests/main/store.test.ts
git commit -m "client: add role to session storage"
```

---

### Task 2: IPC handlers — role threading and admin routes

**Files:**
- Modify: `src/main/ipc.ts`

**Interfaces:**
- Consumes: `AppStore.setSession` with `role` (Task 1), backend `/admin/users` routes (backend
  plan), backend `role` field in `/auth/register`/`/auth/login` responses (backend plan).
- Produces: IPC channels `admin-list-users`, `admin-update-user`, `admin-delete-user`; existing
  `auth-register`/`auth-login`/`auth-get-session` now thread `role` through.

- [ ] **Step 1: Locate and modify the `auth-register` handler in `src/main/ipc.ts`**

Find:

```typescript
        const result = await apiClient.register({ ...payload, jobs: clampedJobs })
        store.setSession(result.token, { username: result.user.username, friendCode: result.user.friendCode })
        return { user: { username: result.user.username, friendCode: result.user.friendCode } }
```

Replace with:

```typescript
        const result = await apiClient.register({ ...payload, jobs: clampedJobs })
        const user = { username: result.user.username, friendCode: result.user.friendCode, role: result.user.role as 'player' | 'admin' }
        store.setSession(result.token, user)
        return { user }
```

- [ ] **Step 2: Modify the `auth-login` handler**

Find:

```typescript
      const result = await apiClient.login(payload)
      store.setSession(result.token, { username: result.user.username, friendCode: result.user.friendCode })
      return { user: { username: result.user.username, friendCode: result.user.friendCode } }
```

Replace with:

```typescript
      const result = await apiClient.login(payload)
      const user = { username: result.user.username, friendCode: result.user.friendCode, role: result.user.role as 'player' | 'admin' }
      store.setSession(result.token, user)
      return { user }
```

- [ ] **Step 3: Add the admin IPC handlers**

Add these handlers after the existing `friends-list` handler (before the `watcher.on('wakfu-event',
...)` block):

```typescript
  ipcMain.handle('admin-list-users', async () => {
    const { token } = store.getSession()
    if (!token) return []
    return apiClient.getAdminUsers(token)
  })

  ipcMain.handle(
    'admin-update-user',
    async (
      _event,
      id: string,
      payload: { username?: string; email?: string; jobs?: Record<string, number> }
    ) => {
      const { token } = store.getSession()
      if (!token) return
      await apiClient.updateAdminUser(token, id, payload)
    }
  )

  ipcMain.handle('admin-delete-user', async (_event, id: string) => {
    const { token } = store.getSession()
    if (!token) return
    await apiClient.deleteAdminUser(token, id)
  })
```

- [ ] **Step 4: Add the corresponding methods to `src/main/apiClient.ts`**

**Implementation note (discovered during Task 2):** `apiClient.ts`'s existing `AuthResult`
interface (`{ token: string; user: { id, username, friendCode } }`) does not include `role`. Step 1
and Step 2 above read `result.user.role` from `apiClient.register`/`.login`'s return value — add
`role: string` to `AuthResult.user` first, or the `role: result.user.role as 'player' | 'admin'`
casts in those steps won't type-check.

This file already exists (from the accounts/friends/jobs client plan). Add these interfaces near
the existing `FriendWithJobs` interface:

```typescript
export interface AdminUserView {
  id: string
  username: string
  email: string
  role: string
  createdAt: string
  jobs: JobEntry[]
}
```

Add these methods inside the object returned by `createApiClient` (alongside the existing
`getFriends` method):

```typescript
    getAdminUsers(token: string): Promise<AdminUserView[]> {
      return request(resolvedFetch, baseUrl, '/admin/users', { token })
    },

    updateAdminUser(
      token: string,
      id: string,
      payload: { username?: string; email?: string; jobs?: Record<string, number> }
    ): Promise<void> {
      return request(resolvedFetch, baseUrl, `/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        token,
        body: payload,
      })
    },

    deleteAdminUser(token: string, id: string): Promise<void> {
      return request(resolvedFetch, baseUrl, `/admin/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        token,
      })
    },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 6: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc.ts src/main/apiClient.ts
git commit -m "client: thread role through auth IPC, add admin user management IPC"
```

---

### Task 3: Expose admin methods through preload

**Files:**
- Modify: `src/preload/preload.ts`

**Interfaces:**
- Consumes: `admin-list-users`/`admin-update-user`/`admin-delete-user` channels (Task 2).
- Produces: `window.wakfuApi.adminListUsers/adminUpdateUser/adminDeleteUser` — used by Task 6
  (`useAdminUsersStore`).

- [ ] **Step 1: Modify `src/preload/preload.ts`**

Change the `authRegister`/`authLogin` return type annotations to include `role` (they already
forward whatever `ipcRenderer.invoke` resolves to — only the TypeScript type needs updating):

Find:

```typescript
  authRegister: (payload: {
    username: string
    email: string
    password: string
    jobs: Record<string, number>
  }): Promise<{ user: { username: string; friendCode: string } } | { error: string }> =>
    ipcRenderer.invoke('auth-register', payload),
  authLogin: (payload: {
    usernameOrEmail: string
    password: string
  }): Promise<{ user: { username: string; friendCode: string } } | { error: string }> =>
    ipcRenderer.invoke('auth-login', payload),
  authLogout: (): Promise<void> => ipcRenderer.invoke('auth-logout'),
  authGetSession: (): Promise<{ username: string; friendCode: string } | null> =>
    ipcRenderer.invoke('auth-get-session'),
```

Replace with:

```typescript
  authRegister: (payload: {
    username: string
    email: string
    password: string
    jobs: Record<string, number>
  }): Promise<{ user: { username: string; friendCode: string; role: 'player' | 'admin' } } | { error: string }> =>
    ipcRenderer.invoke('auth-register', payload),
  authLogin: (payload: {
    usernameOrEmail: string
    password: string
  }): Promise<{ user: { username: string; friendCode: string; role: 'player' | 'admin' } } | { error: string }> =>
    ipcRenderer.invoke('auth-login', payload),
  authLogout: (): Promise<void> => ipcRenderer.invoke('auth-logout'),
  authGetSession: (): Promise<{ username: string; friendCode: string; role: 'player' | 'admin' } | null> =>
    ipcRenderer.invoke('auth-get-session'),
```

Add these entries after the existing `getFriends` entry:

```typescript
  adminListUsers: (): Promise<
    { id: string; username: string; email: string; role: string; createdAt: string; jobs: { jobName: string; level: number }[] }[]
  > => ipcRenderer.invoke('admin-list-users'),
  adminUpdateUser: (
    id: string,
    payload: { username?: string; email?: string; jobs?: Record<string, number> }
  ): Promise<void> => ipcRenderer.invoke('admin-update-user', id, payload),
  adminDeleteUser: (id: string): Promise<void> => ipcRenderer.invoke('admin-delete-user', id)
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/preload/preload.ts
git commit -m "client: expose admin user management on window.wakfuApi"
```

---

### Task 4: `useAuthStore.isAdmin` and role-aware session load

**Files:**
- Modify: `src/renderer/stores/auth.ts`

**Interfaces:**
- Consumes: `window.wakfuApi.authRegister/authLogin/authGetSession` returning `role` (Task 3).
- Produces: `useAuthStore().isAdmin: boolean` — used by Task 5 (`NavBar.vue`) and Task 6
  (`AdminUsersPanel.vue`, to double check before rendering, defense in depth alongside the IPC-side
  check).

- [ ] **Step 1: Modify `src/renderer/stores/auth.ts`**

Find the `AuthUser` interface:

```typescript
interface AuthUser {
  username: string
  friendCode: string
}
```

Replace with:

```typescript
interface AuthUser {
  username: string
  friendCode: string
  role: 'player' | 'admin'
}
```

Find the `AuthStateShape` interface and the store definition's `state`/`actions` — no structural
change needed there since `user: AuthUser | null` already covers the new field once `AuthUser` is
updated. Add a getter block to `useAuthStore`'s options (Pinia option stores support `getters`
alongside `state`/`actions` — insert this new top-level key in the `defineStore('auth', { ... })`
call, alongside the existing `state` and `actions` keys):

```typescript
  getters: {
    isAdmin: (state): boolean => state.user?.role === 'admin'
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/auth.ts
git commit -m "client: add isAdmin getter to auth store"
```

---

### Task 5: Gate the Admin nav link on `isAdmin`

**Files:**
- Modify: `src/renderer/components/NavBar.vue`

**Interfaces:**
- Consumes: `useAuthStore().isAdmin` (Task 4).
- Produces: nothing further downstream — UI leaf change.

- [ ] **Step 1: Modify `src/renderer/components/NavBar.vue`**

Find the existing Admin link:

```html
    <RouterLink to="/admin" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a1 1 0 0 1 1-1h9l6 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M13 4v5h6" /><path d="M8.5 13h7M8.5 16.5h7" /></svg>
      <span>Admin</span>
    </RouterLink>
```

Add a `v-if="authStore.isAdmin"` attribute:

```html
    <RouterLink v-if="authStore.isAdmin" to="/admin" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a1 1 0 0 1 1-1h9l6 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M13 4v5h6" /><path d="M8.5 13h7M8.5 16.5h7" /></svg>
      <span>Admin</span>
    </RouterLink>
```

`authStore` is already imported and instantiated in this file (added by the accounts/friends/jobs
client plan, Task 13) — no new import needed.

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/NavBar.vue
git commit -m "client: hide Admin nav link from non-admin users"
```

---

### Task 6: `useAdminUsersStore` and `AdminUsersPanel.vue`

**Files:**
- Create: `src/renderer/stores/adminUsers.ts`
- Create: `src/renderer/components/AdminUsersPanel.vue`
- Modify: `src/renderer/views/AdminView.vue`

**Interfaces:**
- Consumes: `window.wakfuApi.adminListUsers/adminUpdateUser/adminDeleteUser` (Task 3).
- Produces: the "Comptes" panel rendered inside the existing Admin page.

- [ ] **Step 1: Write `src/renderer/stores/adminUsers.ts`**

```typescript
import { defineStore } from 'pinia'

interface JobEntry {
  jobName: string
  level: number
}

export interface AdminUserView {
  id: string
  username: string
  email: string
  role: string
  createdAt: string
  jobs: JobEntry[]
}

interface AdminUsersStateShape {
  users: AdminUserView[]
}

export const useAdminUsersStore = defineStore('adminUsers', {
  state: (): AdminUsersStateShape => ({
    users: []
  }),
  actions: {
    async refresh(): Promise<void> {
      this.users = await window.wakfuApi.adminListUsers()
    },
    async updateUser(
      id: string,
      payload: { username?: string; email?: string; jobs?: Record<string, number> }
    ): Promise<void> {
      await window.wakfuApi.adminUpdateUser(id, payload)
      await this.refresh()
    },
    async deleteUser(id: string): Promise<void> {
      await window.wakfuApi.adminDeleteUser(id)
      await this.refresh()
    }
  }
})
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Write `src/renderer/components/AdminUsersPanel.vue`**

```vue
<template>
  <div class="panel">
    <h2 class="h2">Comptes</h2>

    <div v-if="editingUser === null">
      <div v-for="user in store.users" :key="user.id" class="row user-row">
        <div class="user-info">
          <span class="row-name">{{ user.username }}</span>
          <span class="row-meta">{{ user.email }} — {{ user.role }} — inscrit le {{ formatDate(user.createdAt) }}</span>
        </div>
        <button class="secondary-btn" @click="startEdit(user)">Éditer</button>
        <button class="delete-btn" @click="confirmDelete(user)">Supprimer</button>
      </div>
      <p v-if="store.users.length === 0" class="subtitle">Aucun compte inscrit.</p>
    </div>

    <form v-else class="edit-form" @submit.prevent="submitEdit">
      <label class="field-label">Pseudo</label>
      <input v-model="editUsername" class="field full-input" type="text" required minlength="3" />

      <label class="field-label">Email</label>
      <input v-model="editEmail" class="field full-input" type="email" required />

      <div v-for="jobName in JOB_NAMES" :key="jobName" class="job-row">
        <label class="job-label">{{ jobName }}</label>
        <input
          v-model.number="editJobLevels[jobName]"
          class="field job-input"
          type="number"
          min="0"
          max="155"
        />
      </div>

      <div class="button-row">
        <button class="secondary-btn" type="button" @click="cancelEdit">Annuler</button>
        <button class="primary-btn" type="submit">Enregistrer</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useAdminUsersStore, type AdminUserView } from '../stores/adminUsers'

const JOB_NAMES = [
  'Bûcheron',
  'Mineur',
  'Trappeur',
  'Pêcheur',
  'Paysan',
  'Alchimiste',
  'Forgeron',
  'Bijoutier',
  'Sculpteur',
  'Tailleur',
  'Cordonnier',
  'Façonneur',
  'Boulanger'
] as const

const store = useAdminUsersStore()

const editingUser = ref<AdminUserView | null>(null)
const editUsername = ref('')
const editEmail = ref('')
const editJobLevels = reactive<Record<string, number>>({})

onMounted(() => {
  store.refresh()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

function startEdit(user: AdminUserView): void {
  editingUser.value = user
  editUsername.value = user.username
  editEmail.value = user.email
  for (const jobName of JOB_NAMES) {
    const existing = user.jobs.find((j) => j.jobName === jobName)
    editJobLevels[jobName] = existing?.level ?? 0
  }
}

function cancelEdit(): void {
  editingUser.value = null
}

async function submitEdit(): Promise<void> {
  if (!editingUser.value) return
  await store.updateUser(editingUser.value.id, {
    username: editUsername.value,
    email: editEmail.value,
    jobs: { ...editJobLevels }
  })
  editingUser.value = null
}

function confirmDelete(user: AdminUserView): void {
  if (window.confirm(`Supprimer définitivement le compte "${user.username}" ?`)) {
    store.deleteUser(user.id)
  }
}
</script>

<style scoped>
.panel {
  background: var(--panel-bg);
  border: 2px solid var(--border);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-strong) 20%, transparent);
  padding: 20px 22px;
  margin-bottom: 18px;
}

.h2 {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--gold);
  margin: 0 0 14px 0;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.user-row {
  justify-content: space-between;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.row-name {
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.row-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.secondary-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 7px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.delete-btn {
  background: transparent;
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 33%, transparent);
  border-radius: 7px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.edit-form {
  display: flex;
  flex-direction: column;
}

.field-label {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 14px 0 6px 0;
}

.full-input {
  width: 100%;
  box-sizing: border-box;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.job-label {
  font-size: 13.5px;
  color: var(--text-primary);
}

.job-input {
  width: 80px;
  text-align: right;
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.primary-btn {
  flex: 1;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
</style>
```

- [ ] **Step 4: Modify `src/renderer/views/AdminView.vue`**

Add the import in `<script setup>`:

```typescript
import AdminUsersPanel from '../components/AdminUsersPanel.vue'
```

Add `<AdminUsersPanel />` as the last panel in the `<template>`, right before the closing `</div>`
of the root element (after the existing Exploits panel):

```html
    <AdminUsersPanel />
  </div>
</template>
```

(i.e. insert `<AdminUsersPanel />` immediately before the final `</div>` that currently closes the
template's root `<div>`.)

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/stores/adminUsers.ts src/renderer/components/AdminUsersPanel.vue src/renderer/views/AdminView.vue
git commit -m "client: add account management panel to Admin tab"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full client test suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 2: Typecheck both main and renderer**

Run: `npx tsc --noEmit -p tsconfig.main.json && npx vue-tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: succeeds, no errors.

- [ ] **Step 4: Manual smoke test**

Requires the backend plan (`2026-08-10-backend-admin-roles.md`) already implemented and running
locally (`cd server && npm start`, migrations applied) with `src/main/apiClient.ts`'s
`DEFAULT_API_BASE_URL` pointed at it.

Run: `npm run build && npx electron dist/main/main.js` (unset `ELECTRON_RUN_AS_NODE` first if set).

Manually verify: register a new account, confirm the Admin nav link is NOT visible; manually
promote that account to admin via `UPDATE users SET role = 'admin' WHERE username = '...'` against
the dev database; log out and back in inside the app; confirm the Admin nav link now appears;
navigate to Admin, confirm the new "Comptes" panel lists all registered accounts; edit one
account's username/email/job levels and confirm the change persists after a refresh; delete a test
account and confirm it disappears from the list.

- [ ] **Step 5: Report results**

Summarize pass/fail for each step above. Do not mark this task complete if any step failed.

---

## Post-plan note

This plan assumes the backend plan (`2026-08-10-backend-admin-roles.md`) has already been executed
and its migration applied to whatever database `DEFAULT_API_BASE_URL` points at. If testing against
the deployed Render/Supabase backend instead of a local one, apply migration
`002_add_user_role.sql` to production first (see that plan's Post-plan note) before running this
plan's manual smoke test.