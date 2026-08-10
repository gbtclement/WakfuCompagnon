<template>
  <div class="auth-page">
    <div class="panel auth-panel">
      <h1 class="h1">Connexion</h1>
      <p class="subtitle">Connecte-toi pour voir tes amis et synchroniser tes métiers</p>

      <form @submit.prevent="submit">
        <label class="field-label">Pseudo ou email</label>
        <input v-model="usernameOrEmail" class="field full-input" type="text" required />

        <label class="field-label">Mot de passe</label>
        <input v-model="password" class="field full-input" type="password" required />

        <p v-if="authStore.errorMessage" class="error-text">{{ authStore.errorMessage }}</p>

        <button class="primary-btn" type="submit" :disabled="submitting">Se connecter</button>
      </form>

      <p class="switch-link">
        Pas de compte ? <RouterLink to="/register">S'inscrire</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const usernameOrEmail = ref('')
const password = ref('')
const submitting = ref(false)

async function submit(): Promise<void> {
  submitting.value = true
  const success = await authStore.login({ usernameOrEmail: usernameOrEmail.value, password: password.value })
  submitting.value = false
  if (success) router.push('/friends')
}
</script>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.auth-panel {
  width: 380px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 24px;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 6px 0 20px 0;
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

.error-text {
  color: var(--danger, #d9534f);
  font-size: 13px;
  margin: 12px 0 0 0;
}

.primary-btn {
  width: 100%;
  margin-top: 20px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-link {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 16px;
}
</style>
