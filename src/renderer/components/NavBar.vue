<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-title">Wakfu</div>
      <div class="brand-subtitle">COMPAGNON</div>
    </div>

    <RouterLink to="/" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-6h4v6" /></svg>
      <span>Serveur</span>
    </RouterLink>
    <RouterLink to="/exploits" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8" /><path d="M6 3.5A2 2 0 0 0 4 5.5v13a2 2 0 0 0 2 2" /><path d="M8.5 8h6M8.5 11.5h6M8.5 15h4" /></svg>
      <span>Exploits</span>
    </RouterLink>
    <RouterLink to="/timers" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /><path d="M9.5 2h5M12 2v2" /></svg>
      <span>Archimonstres</span>
    </RouterLink>
    <RouterLink to="/history" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10a6 6 0 1 1 12 0c0 3 1.2 4.5 2 5.5H4c.8-1 2-2.5 2-5.5Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
      <span>Historique</span>
    </RouterLink>
    <RouterLink to="/settings" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M4.6 7l1.9 1.1M17.5 15.9l1.9 1.1M4.6 17l1.9-1.1M17.5 8.1l1.9-1.1M3.5 12h2.2M18.3 12h2.2" /></svg>
      <span>Paramètres</span>
    </RouterLink>
    <RouterLink to="/admin" class="nav-link" active-class="nav-link-active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a1 1 0 0 1 1-1h9l6 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M13 4v5h6" /><path d="M8.5 13h7M8.5 16.5h7" /></svg>
      <span>Admin</span>
    </RouterLink>

    <div class="server-pill">
      <span class="conn-dot" :class="{ 'conn-dot-idle': !currentServer }"></span>
      <div class="server-pill-text">
        <span class="server-pill-label">Serveur détecté</span>
        <span class="server-pill-value">{{ currentServer ?? 'Aucun' }}</span>
      </div>
    </div>

    <div class="theme-row">
      <span class="theme-label">Mode {{ themeStore.theme === 'dark' ? 'sombre' : 'clair' }}</span>
      <button class="theme-switch" :class="{ 'theme-switch-on': themeStore.theme === 'dark' }" @click="themeStore.toggle()">
        <span class="theme-switch-thumb"></span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appState'
import { useThemeStore } from '../stores/theme'

const appStore = useAppStore()
const themeStore = useThemeStore()

const currentServer = computed(() => {
  const event = appStore.liveEvents.find((e) => e.type === 'server-connection')
  return event && event.type === 'server-connection' ? event.server : null
})
</script>

<style scoped>
.sidebar {
  width: 224px;
  flex-shrink: 0;
  background: var(--panel-bg);
  border-right: 3px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 22px 14px;
  height: 100vh;
  overflow-y: auto;
}

.brand {
  text-align: center;
  margin-bottom: 22px;
}

.brand-title {
  font-family: 'Cinzel', serif;
  font-size: 21px;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.5px;
}

.brand-subtitle {
  font-size: 11px;
  letter-spacing: 2.5px;
  color: var(--accent);
  font-weight: 700;
  margin-top: 2px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  width: 100%;
  text-decoration: none;
}

.nav-link-active {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 33%, transparent);
}

.server-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 10px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.server-pill-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.server-pill-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.server-pill-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.conn-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
  animation: glow-pulse 2.4s ease-in-out infinite;
  flex-shrink: 0;
}

.conn-dot-idle {
  background: var(--text-secondary);
  box-shadow: none;
  animation: none;
}

.theme-row {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.theme-label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.theme-switch {
  width: 40px;
  height: 22px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  position: relative;
  padding: 0;
  flex-shrink: 0;
  background: var(--border);
}

.theme-switch-on {
  background: var(--accent);
}

.theme-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--on-accent);
  transition: left 0.15s;
}

.theme-switch-on .theme-switch-thumb {
  left: 20px;
}
</style>
