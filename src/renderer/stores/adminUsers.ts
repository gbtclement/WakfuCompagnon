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
