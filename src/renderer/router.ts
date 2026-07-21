import { createRouter, createWebHashHistory } from 'vue-router'
import ServerStatusView from './views/ServerStatusView.vue'
import QuestsView from './views/QuestsView.vue'
import TimersView from './views/TimersView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ServerStatusView },
    { path: '/quests', component: QuestsView },
    { path: '/timers', component: TimersView },
    { path: '/history', component: HistoryView },
    { path: '/settings', component: SettingsView }
  ]
})
