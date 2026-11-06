'use strict'

const { contextBridge } = require('electron')

function bufferFrames() {
  const arg = process.argv.find((item) => item.startsWith('--koog-buffer='))
  const n = Number(arg ? arg.slice('--koog-buffer='.length) : '')
  if (n === 128 || n === 256) return n
  return 128
}

contextBridge.exposeInMainWorld('koogDesktop', { bufferFrames: bufferFrames() })
