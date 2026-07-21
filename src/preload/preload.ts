import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('wakfuApi', {})
