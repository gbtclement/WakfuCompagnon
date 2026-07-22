<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Paramètres</h1>
      <p class="subtitle">Configuration générale de l'application</p>
    </div>

    <div class="panel">
      <h2 class="h2">Général</h2>
      <label class="field-label">Chemin des logs Wakfu</label>
      <div class="log-path-row">
        <input class="field full-input" :value="store.config.logPath ?? 'Non configuré'" readonly />
        <button class="secondary-btn" @click="store.browseLogFile()">Parcourir...</button>
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Thème</h2>
      <div class="theme-options">
        <button class="theme-option" :class="{ 'theme-option-active': themeStore.theme === 'dark' }" @click="themeStore.setTheme('dark')">
          Sombre
        </button>
        <button class="theme-option" :class="{ 'theme-option-active': themeStore.theme === 'light' }" @click="themeStore.setTheme('light')">
          Clair
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import { useThemeStore } from '../stores/theme'

const store = useAppStore()
const themeStore = useThemeStore()
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

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

.field-label {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 0 0 6px 0;
}

.log-path-row {
  display: flex;
  gap: 10px;
}

.full-input {
  flex: 1;
}

.secondary-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 7px;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.theme-options {
  display: flex;
  gap: 12px;
}

.theme-option {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  border: 1.5px solid var(--border);
  background: var(--card-bg);
  color: var(--text-secondary);
}

.theme-option-active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
</style>
