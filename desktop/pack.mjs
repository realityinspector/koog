import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconPng = path.join(root, 'public', 'apple-touch-icon.png')
const outDir = path.join(root, 'release')

function ignore(file) {
  let rel = path.relative(root, file)
  if (!rel || rel === '.') return false
  if (rel.startsWith('..') && String(file).startsWith(path.sep)) rel = String(file).replace(/^[/\\]+/, '')
  if (!rel || rel.startsWith('..')) return true
  const top = rel.split(/[/\\]/)[0]
  return top !== 'package.json' && top !== 'desktop' && top !== 'dist'
}

function makeIcon() {
  // iconutil only accepts a directory whose name ends in .iconset.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'koog-icon-'))
  const set = path.join(scratch, 'Koog.iconset')
  fs.mkdirSync(set)
  const sizes = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ]
  for (const [px, name] of sizes) {
    execFileSync('sips', ['-z', String(px), String(px), iconPng, '--out', path.join(set, name)], { stdio: 'ignore' })
  }
  const icns = path.join(os.tmpdir(), `koog-${process.pid}.icns`)
  execFileSync('iconutil', ['-c', 'icns', set, '-o', icns], { stdio: 'inherit' })
  fs.rmSync(scratch, { recursive: true, force: true })
  return icns
}

function sign(appPath) {
  // This Mac's xattr has no -r. A locally packed app has no quarantine attribute.
  execFileSync('codesign', [
    '--force', '--deep', '--sign', '-',
    '--entitlements', path.join(root, 'desktop', 'entitlements.plist'),
    appPath,
  ], { stdio: 'inherit' })
}

function cachedElectronZipDir() {
  let version
  try {
    version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version
  } catch {
    return undefined
  }
  const name = `electron-v${version}-darwin-arm64.zip`
  const bases = [path.join(os.homedir(), 'Library/Caches/electron'), path.join(os.homedir(), '.cache/electron')]
  for (const base of bases) {
    if (!fs.existsSync(base)) continue
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(base, entry.name)
      if (fs.existsSync(path.join(dir, name))) return dir
    }
  }
  return undefined
}

function locateApp(returned) {
  const candidates = [returned, path.join(returned, 'Koog.app')]
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'Contents', 'MacOS', 'Koog'))) return candidate
  }
  throw new Error(`Packager did not produce Koog.app (got ${returned})`)
}

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/index.html is missing. Run the Vite build before packing.')
  process.exit(1)
}

const icon = makeIcon()
const zipDir = cachedElectronZipDir()
const built = await packager({
  dir: root,
  name: 'Koog',
  platform: 'darwin',
  arch: 'arm64',
  out: outDir,
  overwrite: true,
  asar: true,
  prune: false,
  icon,
  appBundleId: 'dev.koog.app',
  appCategoryType: 'public.app-category.music',
  ignore,
  ...(zipDir ? { electronZipDir: zipDir } : {}),
})

const appPath = locateApp(built[0])
const dest = path.join(outDir, 'Koog.app')
if (path.resolve(appPath) !== path.resolve(dest)) {
  fs.rmSync(dest, { recursive: true, force: true })
  fs.renameSync(appPath, dest)
  const parent = path.dirname(appPath)
  if (parent.startsWith(outDir) && path.resolve(parent) !== path.resolve(outDir)) {
    fs.rmSync(parent, { recursive: true, force: true })
  }
}
sign(dest)
fs.rmSync(icon, { force: true })
console.log(dest)
