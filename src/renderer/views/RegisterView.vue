<template>
  <div class="auth-page">
    <div class="panel auth-panel">
      <h1 class="h1">Inscription</h1>
      <p class="subtitle">{{ step === 1 ? 'Étape 1 : identifiants' : 'Étape 2 : niveaux de métiers' }}</p>

      <form v-if="step === 1" @submit.prevent="goToStep2">
        <label class="field-label">Pseudo</label>
        <input v-model="username" class="field full-input" type="text" required minlength="3" />

        <label class="field-label">Email</label>
        <input v-model="email" class="field full-input" type="email" required />

        <label class="field-label">Mot de passe</label>
        <input v-model="password" class="field full-input" type="password" required minlength="8" />

        <label class="field-label">Confirmer le mot de passe</label>
        <input v-model="passwordConfirm" class="field full-input" type="password" required minlength="8" />

        <p v-if="step1Error" class="error-text">{{ step1Error }}</p>

        <button class="primary-btn" type="submit">Suivant</button>
      </form>

      <form v-else @submit.prevent="submit">
        <div v-for="jobName in JOB_NAMES" :key="jobName" class="job-row">
          <label class="job-label">{{ jobName }}</label>
          <input
            v-model.number="jobLevels[jobName]"
            class="field job-input"
            type="number"
            min="0"
            max="155"
          />
        </div>

        <p v-if="authStore.errorMessage" class="error-text">{{ authStore.errorMessage }}</p>

        <div class="button-row">
          <button class="secondary-btn" type="button" @click="step = 1">Retour</button>
          <button class="primary-btn" type="submit" :disabled="submitting">S'inscrire</button>
        </div>
      </form>

      <p class="switch-link">
        Déjà un compte ? <RouterLink to="/login">Se connecter</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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

const authStore = useAuthStore()
const router = useRouter()

const step = ref<1 | 2>(1)
const username = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const step1Error = ref<string | null>(null)
const submitting = ref(false)

const jobLevels = reactive<Record<string, number>>(
  Object.fromEntries(JOB_NAMES.map((name) => [name, 0]))
)

function goToStep2(): void {
  if (password.value !== passwordConfirm.value) {
    step1Error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  step1Error.value = null
  step.value = 2
}

async function submit(): Promise<void> {
  submitting.value = true
  const success = await authStore.register({
    username: username.value,
    email: email.value,
    password: password.value,
    jobs: { ...jobLevels }
  })
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
  width: 420px;
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

.error-text {
  color: var(--danger, #d9534f);
  font-size: 13px;
  margin: 12px 0 0 0;
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

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.switch-link {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 16px;
}
</style>
