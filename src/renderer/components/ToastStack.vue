<template>
  <div class="toast-stack">
    <div v-for="toast in toastStore.toasts" :key="toast.id" class="toast" :class="kindClass(toast.kind)">
      <span class="toast-dot" :class="dotClass(toast.kind)"></span>
      <div class="toast-body">
        <div class="toast-title">{{ toast.title }}</div>
        <div class="toast-message">{{ toast.message }}</div>
      </div>
      <button class="toast-close" @click="toastStore.dismiss(toast.id)">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToastStore, type ToastKind } from '../stores/toasts'

const toastStore = useToastStore()

function kindClass(kind: ToastKind): string {
  return `toast-${kind}`
}

function dotClass(kind: ToastKind): string {
  return `toast-dot-${kind}`
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 22px;
  right: 22px;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  z-index: 80;
  width: 320px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--panel-bg);
  border-radius: 9px;
  border: 1.5px solid var(--border);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  animation: toast-in 0.25s ease-out;
}

.toast-success {
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 14px color-mix(in srgb, var(--success) 20%, transparent);
}

.toast-warning {
  border-color: color-mix(in srgb, var(--warning) 40%, transparent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 14px color-mix(in srgb, var(--warning) 20%, transparent);
}

.toast-error {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 14px color-mix(in srgb, var(--danger) 20%, transparent);
}

.toast-info {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 14px color-mix(in srgb, var(--accent) 20%, transparent);
}

.toast-dot {
  width: 9px;
  height: 9px;
  margin-top: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast-dot-success {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.toast-dot-warning {
  background: var(--warning);
  box-shadow: 0 0 8px var(--warning);
}

.toast-dot-error {
  background: var(--danger);
  box-shadow: 0 0 8px var(--danger);
}

.toast-dot-info {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.toast-body {
  flex: 1;
}

.toast-title {
  font-weight: 700;
  font-size: 13.5px;
  color: var(--text-primary);
}

.toast-message {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.toast-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
</style>
