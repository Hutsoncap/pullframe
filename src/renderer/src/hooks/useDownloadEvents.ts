import { useEffect } from 'react'
import { useAppStore } from '../stores/app-store'
import { buildDownloadSucceededProperties } from '../telemetry/download-workflow'

/**
 * Hook that subscribes to IPC download events from the main process
 * and updates the Zustand store accordingly.
 *
 * Mount this once at the app root level.
 */
export function useDownloadEvents(): void {
  const updateDownloadProgress = useAppStore((s) => s.updateDownloadProgress)
  const completeDownload = useAppStore((s) => s.completeDownload)
  const failDownload = useAppStore((s) => s.failDownload)

  useEffect(() => {
    const unsubProgress = window.api.onDownloadProgress((progress) => {
      updateDownloadProgress(progress.id, progress)
    })

    const unsubComplete = window.api.onDownloadComplete((result) => {
      const download = useAppStore.getState().downloads.get(result.id)
      completeDownload(result.id, result)
      window.api.trackEvent({
        eventType: 'download.succeeded',
        properties: download ? buildDownloadSucceededProperties(download) : {
          category: 'unknown',
          type: 'unknown',
          result: 'succeeded',
          source: 'app'
        }
      }).catch(() => {})
    })

    const unsubError = window.api.onDownloadError((error) => {
      const download = useAppStore.getState().downloads.get(error.id)
      failDownload(error.id, error.error)
      window.api.trackEvent({
        eventType: 'download.failed',
        properties: {
          category: download?.downloadCategory ?? 'unknown',
          type: download?.type ?? 'unknown',
          result: 'failed',
          source: 'app',
          failureReason: String(error.error ?? '').slice(0, 180)
        }
      }).catch(() => {})
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [updateDownloadProgress, completeDownload, failDownload])
}
