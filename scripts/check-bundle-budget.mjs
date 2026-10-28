import { readdir, readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const assetDirectory = new URL('../dist/assets/', import.meta.url)
const limits = {
  largestJavaScriptGzip: 120 * 1024,
  totalJavaScriptGzip: 200 * 1024,
  totalCssGzip: 30 * 1024,
}

const names = await readdir(assetDirectory)
const assets = await Promise.all(names
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map(async (name) => {
    const url = new URL(name, assetDirectory)
    const [metadata, content] = await Promise.all([stat(url), readFile(url)])
    return { name, bytes: metadata.size, gzipBytes: gzipSync(content).length }
  }))

const scripts = assets.filter((asset) => asset.name.endsWith('.js'))
const styles = assets.filter((asset) => asset.name.endsWith('.css'))
const largestScript = scripts.reduce(
  (largest, asset) => asset.gzipBytes > largest.gzipBytes ? asset : largest,
  { name: 'none', gzipBytes: 0 },
)
const totalJavaScriptGzip = scripts.reduce((total, asset) => total + asset.gzipBytes, 0)
const totalCssGzip = styles.reduce((total, asset) => total + asset.gzipBytes, 0)

const failures = []
if (largestScript.gzipBytes > limits.largestJavaScriptGzip) {
  failures.push(`largest JS ${largestScript.name} is ${largestScript.gzipBytes} bytes gzip`)
}
if (totalJavaScriptGzip > limits.totalJavaScriptGzip) {
  failures.push(`total JS is ${totalJavaScriptGzip} bytes gzip`)
}
if (totalCssGzip > limits.totalCssGzip) {
  failures.push(`total CSS is ${totalCssGzip} bytes gzip`)
}

console.log(
  `Bundle budget: largest JS ${largestScript.gzipBytes}/${limits.largestJavaScriptGzip}, `
  + `total JS ${totalJavaScriptGzip}/${limits.totalJavaScriptGzip}, `
  + `total CSS ${totalCssGzip}/${limits.totalCssGzip} bytes gzip`,
)

if (failures.length > 0) {
  throw new Error(`Bundle budget exceeded: ${failures.join('; ')}`)
}
