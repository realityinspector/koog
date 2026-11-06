/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_WEB_DEMO?: string }
interface ImportMeta { readonly env: ImportMetaEnv }

/** Present only inside the desktop app. The browser build leaves this unset. */
interface KoogDesktop {
  /** Core Audio callback size, in frames. */
  bufferFrames: 128 | 256
}
interface Window {
  koogDesktop?: KoogDesktop
}
