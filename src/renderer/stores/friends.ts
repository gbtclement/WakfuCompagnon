import { defineStore } from 'pinia'

interface JobEntry {
  jobName: string
  level: number
}

interface FriendWithJobs {
  username: string
  jobs: JobEntry[]
}

interface PendingRequest {
  id: string
  fromUsername: string
}

interface FriendsStateShape {
  friends: FriendWithJobs[]
  pendingRequests: PendingRequest[]
  myJobs: JobEntry[]
}

export const useFriendsStore = defineStore('friends', {
  state: (): FriendsStateShape => ({
    friends: [],
    pendingRequests: [],
    myJobs: []
  }),
  actions: {
    async refresh(): Promise<void> {
      this.friends = await window.wakfuApi.getFriends()
      this.pendingRequests = await window.wakfuApi.getPendingFriendRequests()
      this.myJobs = await window.wakfuApi.getMyJobs()
    },
    async sendRequest(friendCode: string): Promise<void> {
      await window.wakfuApi.sendFriendRequest(friendCode)
    },
    async accept(id: string): Promise<void> {
      await window.wakfuApi.acceptFriendRequest(id)
      await this.refresh()
    },
    async reject(id: string): Promise<void> {
      await window.wakfuApi.rejectFriendRequest(id)
      await this.refresh()
    },
    async updateJobManual(jobName: string, level: number): Promise<void> {
      const updated = await window.wakfuApi.updateJobManual(jobName, level)
      if (updated) {
        this.myJobs = this.myJobs.map((j) => (j.jobName === jobName ? updated : j))
      }
    }
  }
})
