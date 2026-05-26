# Pullframe

Pullframe is a macOS desktop app for pulling usable video, audio, subtitles, thumbnails, chapters, and metadata from YouTube links. It is built with Electron, React, TypeScript, yt-dlp, and ffmpeg.

Official website: [https://pullframe.app](https://pullframe.app)

Official downloads: [https://pullframe.app/download](https://pullframe.app/download)

Release notes: [https://pullframe.app/release-notes](https://pullframe.app/release-notes)

Why Pullframe exists: [https://pullframe.app/why-pullframe](https://pullframe.app/why-pullframe)

ProRes workflow: [https://pullframe.app/prores-youtube-downloader-mac](https://pullframe.app/prores-youtube-downloader-mac)

Acceptable use: [https://pullframe.app/acceptable-use](https://pullframe.app/acceptable-use)

## Features

- Multi-tab workflow for videos and playlists
- Video, audio, and merged format selection
- Optional muxing, transcoding, and professional format conversion
- Subtitle download and conversion to Original, SRT, VTT, or ASS
- Thumbnail, description, comments, info JSON, and chapter marker exports
- Download queue with persistent history
- Optional browser sign-in source for videos that require YouTube login or verification
- Built-in update checks against the official Pullframe update feed

## Requirements

- macOS on Apple Silicon for the packaged app target
- Node.js 22
- npm

Pullframe bundles yt-dlp and ffmpeg for packaged builds. During development, the app uses the binaries under `resources/bin`.

## Development

Install dependencies:

```bash
npm ci --legacy-peer-deps
```

Start the app in development mode:

```bash
npm run dev
```

Run the main verification checks:

```bash
npm run typecheck
npm run build
```

## Packaging A Local Build

Build a local macOS package:

```bash
npm run package:mac
```

Local packages are intended for development and self-built use. Official Pullframe releases are signed, notarized, and distributed from [pullframe.app](https://pullframe.app/download).

## Licensing In Source Builds

Source-built apps are unlocked for contributors and self-builders. They function as activated without storing a real Pullframe license entitlement.

The app still checks the official update feed. If you install an official update over a source-built app, the official app returns to the normal Pullframe trial and license flow.

## Privacy

Pullframe avoids sending source URLs, local paths, filenames, media titles, raw logs, license keys, hostnames, usernames, serials, clipboard contents, and window titles in telemetry. Feedback diagnostics show a summary before submission.

## Transparency

Pullframe is open source so editors, archivists, and internal media teams can inspect what the app does before trusting it in a professional workflow. The paid build is for signed downloads, lifetime updates, license recovery, and support. Source builds remain available for contributors and self-builders.

## License

Pullframe is licensed under GPL-3.0. See [LICENSE](LICENSE).
