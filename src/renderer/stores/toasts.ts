import { defineStore } from 'pinia'

export type ToastKind = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message: string
}

let nextId = 1

export const useToastStore = defineStore('toasts', {
  state: () => ({
    toasts: [] as Toast[]
  }),
  actions: {
    push(kind: ToastKind, title: string, message: string): void {
      const id = nextId++
      this.toasts.push({ id, kind, title, message })
      setTimeout(() => this.dismiss(id), 6000)
    },
    dismiss(id: number): void {
      this.toasts = this.toasts.filter((toast) => toast.id !== id)
    }
  }
})
