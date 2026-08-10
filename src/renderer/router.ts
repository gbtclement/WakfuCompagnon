import { createRouter, createWebHashHistory } from 'vue-router'
import ServerStatusView from './views/ServerStatusView.vue'
import ExploitsView from './views/ExploitsView.vue'
import TimersView from './views/TimersView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'
import AdminView from './views/AdminView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import FriendsView from './views/FriendsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ServerStatusView },
    { path: '/exploits', component: ExploitsView },
    { path: '/timers', component: TimersView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView },
    { path: '/admin', component: AdminView },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/friends', component: FriendsView }
  ]
})
