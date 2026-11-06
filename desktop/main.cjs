'use strict'

// Desktop shell for Koog. The browser cannot set the Core Audio callback size;
// this process can. 128 frames at 48 kHz is 2.7 ms, one Web Audio render
// block. A request for 64 still comes back as 128, so 128 is the floor.
// KOOG_AUDIO_BUFFER=256 is the larger fallback for a terminal launch. A Finder
// launch has no environment, so 128 is the app kids open.
//
// AudioServiceOutOfProcess is off because that helper does not reliably honor
// audio-buffer-size, and a music app needs the buffer it asked for.

const { app, BrowserWindow, session, protocol, shell, powerSaveBlocker } = require('electron')
const fs = require('fs')
const path = require('path')

const ALLOWED_BUFFERS = new Set([128, 256])

function bufferFrames() {
  const n = Number(process.env.KOOG_AUDIO_BUFFER)
  return ALLOWED_BUFFERS.has(n) ? n : 128
}

const FRAMES = bufferFrames()

// Menu and window title. The .app file stays Koog so the Dock name stays short.
const APP_TITLE = 'KOOG: The Koding Synth for Koogaliens'
app.setName(APP_TITLE)
app.commandLine.appendSwitch('audio-buffer-size', String(FRAMES))
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
// A plugged-in keyboard is not a page click. This is a local music app.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'koog',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
}

function distFile(requestUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname)
  } catch {
    return null
  }
  if (pathname.includes('\0')) return null
  const parts = pathname.split('/').filter((part) => part.length > 0)
  if (parts.some((part) => part === '..' || part === '.')) return null
  if (parts.length === 0) parts.push('index.html')
  const root = path.resolve(app.getAppPath(), 'dist')
  // Strip the leading slash before resolve. An absolute segment would discard root.
  const file = path.resolve(root, ...parts)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
  if (file !== root && !file.startsWith(rootWithSep)) return null
  return file
}

function serve(request) {
  const file = distFile(request.url)
  if (!file) return new Response('Not found', { status: 404 })
  let data
  try {
    data = fs.readFileSync(file)
  } catch {
    return new Response('Not found', { status: 404 })
  }
  // Copy out of the Buffer pool. A view into a larger pool can send the wrong bytes.
  const body = new Uint8Array(data.byteLength)
  body.set(data)
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
  return new Response(body, { headers: { 'content-type': type, 'cache-control': 'no-cache' } })
}

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_TITLE,
    backgroundColor: '#16122b',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      additionalArguments: [`--koog-buffer=${FRAMES}`],
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('koog://')) return
    event.preventDefault()
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
  })

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('load failed', code, description, url)
  })

  win.on('closed', () => { win = null })
  void win.loadURL('koog://app/index.html')
}

const ALLOWED_PERMISSIONS = new Set(['midi', 'midiSysex', 'media', 'pointerLock', 'pointer-lock'])

function allowPermission(_wc, permission) {
  return ALLOWED_PERMISSIONS.has(permission)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.on('window-all-closed', () => { app.quit() })

  app.whenReady().then(() => {
    protocol.handle('koog', serve)
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(allowPermission(wc, permission))
    })
    session.defaultSession.setPermissionCheckHandler((wc, permission) => allowPermission(wc, permission))
    powerSaveBlocker.start('prevent-app-suspension')
    createWindow()
  })
}
