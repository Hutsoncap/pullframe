import { useEffect, useState } from 'react'
import type { AppUpdateStatus } from '../types'

interface UpdateState {
  version: string | null
  state: AppUpdateStatus['state'] | 'idle'
  percent: number
  releaseNotes: string | null
  message: string | null
}

export function useUpdateNotifier(): UpdateState & { activate: () => void } {
  const [state, setState] = useState<UpdateState>({
    version: null,
    state: 'idle',
    percent: 0,
    releaseNotes: null,
    message: null
  })

  useEffect(() => {
    const unsubscribe = window.api.onAppUpdateStatus((status) => {
      setState((current) => ({
        version: status.version ?? current.version,
        state: status.state,
        percent: status.percent ?? current.percent,
        releaseNotes: status.releaseNotes ?? current.releaseNotes,
        message: status.message ?? null
      }))
    })

    window.api.checkForUpdates().catch(() => {})

    return unsubscribe
  }, [])

  const activate = (): void => {
    setState((current) => ({ ...current, message: null }))
    if (state.state === 'downloaded') {
      window.api.installAppUpdate().catch((error) => {
        setState((current) => ({
          ...current,
          state: 'error',
          message: error instanceof Error ? error.message : String(error)
        }))
      })
      return
    }

    if (state.state === 'available') {
      setState((current) => ({ ...current, state: 'downloading', percent: 0 }))
      window.api.downloadAppUpdate().catch((error) => {
        setState((current) => ({
          ...current,
          state: 'error',
          message: error instanceof Error ? error.message : String(error)
        }))
      })
    }
  }

  return { ...state, activate }
}
