import type { WakfuApi } from '../preload/preload'

declare global {
  interface Window {
    wakfuApi: WakfuApi
  }
}

export {}
