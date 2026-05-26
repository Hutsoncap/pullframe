import { useState } from 'react'
import { useUpdateNotifier } from '../hooks/useUpdateNotifier'
import type { LicenseState } from '../types'

interface TitleBarProps {
  onSettingsClick: () => void
  onFeedbackClick: () => void
  onLicenseClick: () => void
  licenseState: LicenseState | null
}

export function TitleBar({ onSettingsClick, onFeedbackClick, onLicenseClick, licenseState }: TitleBarProps) {
  const platform = window.api.platform
  const isMac = platform === 'darwin'
  const update = useUpdateNotifier()
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const showLicensePill = licenseState !== null && !licenseState.isActivated

  const showUpdatePill =
    update.state === 'available' ||
    update.state === 'downloading' ||
    update.state === 'downloaded'

  const updateLabel =
    update.state === 'downloaded'
      ? 'Install Update'
      : update.state === 'downloading'
        ? `Updating ${Math.round(update.percent)}%`
        : 'Update'

  return (
    <div
      className="h-10 flex items-center justify-between px-3 pt-0.5 bg-surface-950/90 border-b border-surface-800/50 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side: macOS traffic light inset + app name */}
      <div className="flex items-center gap-2" style={isMac ? { paddingLeft: 74 } : undefined}>
        <span className="text-xs font-semibold tracking-wide">
          <span className="bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent">Pull</span><span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">frame</span>
        </span>

        {showUpdatePill && (
          <button
            onClick={() => setUpdateDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent-500/20 px-2.5 py-0.5 text-[11px] font-medium text-accent-300 transition-colors duration-150 hover:bg-accent-500/30"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title={
              update.state === 'downloaded'
                ? 'Show update details'
                : update.state === 'downloading'
                  ? 'Show download progress'
                  : `Show update v${update.version}`
            }
          >
            {update.state === 'downloading' ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            <span>{updateLabel}</span>
          </button>
        )}
      </div>

      {/* Right side: settings + window controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {showLicensePill && (
          <button
            onClick={onLicenseClick}
            className="mr-1 rounded-full border border-warning/70 bg-warning px-2.5 py-1 text-[11px] font-semibold text-surface-950 shadow-sm shadow-warning/20 transition-all duration-150 hover:border-yellow-300 hover:bg-yellow-400 hover:shadow-warning/30 active:scale-[0.98]"
            title={licenseState.isTrialExpired ? 'Trial expired. Get a Pullframe license.' : `${licenseState.trialDaysRemaining} day${licenseState.trialDaysRemaining === 1 ? '' : 's'} left in trial`}
          >
            {licenseState.isTrialExpired ? 'Expired' : 'Buy'}
          </button>
        )}

        <button
          onClick={onFeedbackClick}
          className="p-1.5 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors duration-150"
          title="Send Feedback"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.142-4.03 7.5-9 7.5a10.4 10.4 0 01-2.946-.42L3 21l1.994-4.487A7.087 7.087 0 013 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5z" />
          </svg>
        </button>

        <button
          onClick={onSettingsClick}
          className="p-1.5 rounded-md text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors duration-150"
          title="Settings"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Windows-only controls */}
        {!isMac && (
          <div className="flex items-center ml-2">
            <button
              onClick={() => window.electron.ipcRenderer.send('window-minimize')}
              className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors duration-150"
              title="Minimize"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 10 1">
                <rect width="10" height="1" />
              </svg>
            </button>
            <button
              onClick={() => window.electron.ipcRenderer.send('window-maximize')}
              className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors duration-150"
              title="Maximize"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 10 10" stroke="currentColor">
                <rect x="0.5" y="0.5" width="9" height="9" strokeWidth="1" />
              </svg>
            </button>
            <button
              onClick={() => window.electron.ipcRenderer.send('window-close')}
              className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-red-500/80 transition-colors duration-150"
              title="Close"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 10 10"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M1 1l8 8M9 1l-8 8" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {updateDialogOpen && (
        <UpdateDialog update={update} onClose={() => setUpdateDialogOpen(false)} />
      )}
    </div>
  )
}

function UpdateDialog({
  update,
  onClose
}: {
  update: ReturnType<typeof useUpdateNotifier>
  onClose: () => void
}) {
  const releaseNotes = update.releaseNotes?.trim() || 'Release notes are not available for this update.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="w-full max-w-md rounded-lg border border-surface-700/70 bg-surface-900 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between border-b border-surface-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-surface-100">Pullframe update</h2>
            <p className="mt-1 text-xs text-surface-500">
              {update.version ? `Version ${update.version}` : 'A new version is available'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800/60 hover:text-surface-200"
            title="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="max-h-64 overflow-y-auto rounded-lg border border-surface-800 bg-surface-950/55 p-3 text-sm leading-6 text-surface-300">
            {renderReleaseNotes(releaseNotes)}
          </div>

          {update.state === 'downloading' && (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
                <div
                  className="h-full rounded-full bg-accent-400 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, update.percent))}%` }}
                />
              </div>
              <p className="text-[11px] text-surface-500">Downloading update... {Math.round(update.percent)}%</p>
            </div>
          )}

          {update.message && (
            <p className="text-xs text-error/80">{update.message}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-surface-800 px-5 py-4">
          <button onClick={onClose} className="btn-secondary flex-1 px-3 py-2 text-xs">
            Later
          </button>
          <button
            onClick={update.activate}
            disabled={update.state === 'downloading'}
            className="btn-primary flex-1 px-3 py-2 text-xs disabled:opacity-50"
          >
            {update.state === 'downloaded' ? 'Install and Restart' : update.state === 'downloading' ? 'Downloading...' : 'Download Update'}
          </button>
        </div>
      </div>
    </div>
  )
}

function renderReleaseNotes(markdown: string) {
  return markdown.split('\n').map((line, index) => {
    const trimmed = line.trim()
    const key = `${line}-${index}`

    if (!trimmed) {
      return <div key={key} className="h-3" />
    }

    if (trimmed.startsWith('## ')) {
      return (
        <h4 key={key} className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-accent-300 first:mt-0">
          {trimmed.replace(/^##\s+/, '')}
        </h4>
      )
    }

    if (trimmed.startsWith('# ')) {
      return (
        <h3 key={key} className="mb-3 text-base font-semibold text-surface-100">
          {trimmed.replace(/^#\s+/, '')}
        </h3>
      )
    }

    if (trimmed.startsWith('- ')) {
      return (
        <div key={key} className="mb-1.5 flex gap-2 text-sm leading-5 text-surface-300">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-300" />
          <span>{trimmed.replace(/^-\s+/, '')}</span>
        </div>
      )
    }

    return (
      <p key={key} className="mb-2 text-sm text-surface-300 last:mb-0">
        {trimmed}
      </p>
    )
  })
}
