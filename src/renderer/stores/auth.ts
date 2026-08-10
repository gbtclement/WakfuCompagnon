import { defineStore } from 'pinia'

interface AuthUser {
  username: string
  friendCode: string
}

interface AuthStateShape {
  isLoggedIn: boolean
  user: AuthUser | null
  errorMessage: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthStateShape => ({
    isLoggedIn: false,
    user: null,
    errorMessage: null
  }),
  actions: {
    async load(): Promise<void> {
      const user = await window.wakfuApi.authGetSession()
      this.user = user
      this.isLoggedIn = user !== null
    },
    async register(payload: {
      username: string
      email: string
      password: string
      jobs: Record<string, number>
    }): Promise<boolean> {
      this.errorMessage = null
      const result = await window.wakfuApi.authRegister(payload)
      if ('error' in result) {
        this.errorMessage = result.error
        return false
      }
      this.user = result.user
      this.isLoggedIn = true
      return true
    },
    async login(payload: { usernameOrEmail: string; password: string }): Promise<boolean> {
      this.errorMessage = null
      const result = await window.wakfuApi.authLogin(payload)
      if ('error' in result) {
        this.errorMessage = result.error
        return false
      }
      this.user = result.user
      this.isLoggedIn = true
      return true
    },
    async logout(): Promise<void> {
      await window.wakfuApi.authLogout()
      this.user = null
      this.isLoggedIn = false
    }
  }
})
