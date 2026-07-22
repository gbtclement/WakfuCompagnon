import { defineStore } from 'pinia'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'wakfu-companion-theme'

function loadInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: loadInitialTheme() as Theme
  }),
  actions: {
    apply(): void {
      document.documentElement.setAttribute('data-theme', this.theme)
    },
    setTheme(theme: Theme): void {
      this.theme = theme
      localStorage.setItem(STORAGE_KEY, theme)
      this.apply()
    },
    toggle(): void {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    }
  }
})
