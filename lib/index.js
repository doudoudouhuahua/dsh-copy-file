/**
 * dsh-copy-file —— 宿主半边
 *
 * 只做一件事：接收浏览器半边 POST 过来的绝对路径，校验它是真实存在的普通文件，
 * 然后调用 Windows PowerShell 的 Set-Clipboard -LiteralPath 把该文件放进剪贴板
 * （CF_HDROP 文件列表，资源管理器里可以直接 Ctrl+V 粘贴）。
 *
 * 不读取文件内容、不写日志里的路径明细；仅本机同源、已认证的请求可调用。
 */
import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

export const name = 'dsh-copy-file'
export const inject = ['webServer']

const ROUTE = '/dsh-copy-file'
const MAX_BODY_BYTES = 64 * 1024
const POWERSHELL_TIMEOUT_MS = 10_000

function sendJson(res, status, body) {
  try {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(JSON.stringify(body))
  } catch {
    try {
      res.destroy()
    } catch {
      /* ignore */
    }
  }
}

function normalizedHost(req) {
  try {
    const host = String((req && req.headers && req.headers.host) || '')
    return host.toLowerCase()
  } catch {
    return ''
  }
}

/** 与其它插件一致的本地同源 / 连接认证栅栏。 */
function isTrustedRequest(ctx, req) {
  try {
    const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
    if (connection && typeof connection.requestRejection === 'function') {
      const rejection = connection.requestRejection(req)
      return rejection === undefined || rejection === null || rejection === false
    }
  } catch {
    return false
  }
  const host = normalizedHost(req)
  return (
    host === '' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('127.0.0.1:') ||
    host.startsWith('localhost:') ||
    host === 'dsh-app'
  )
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        try {
          req.destroy()
        } catch {
          /* ignore */
        }
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * 用 Windows PowerShell 5.1 把文件放进剪贴板文件列表。
 * @param {string} filePath 已经校验为绝对路径、存在且为普通文件
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
function copyFileToClipboard(filePath) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(filePath, 'utf8').toString('base64')
    const script = [
      '$ErrorActionPreference = "Stop"',
      `$p = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))`,
      'Set-Clipboard -LiteralPath $p',
    ].join('; ')
    let child
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Sta', '-Command', script], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      })
    } catch (error) {
      resolve({ ok: false, error: String((error && error.message) || error) })
      return
    }
    let stderr = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
      finish({ ok: false, error: 'PowerShell timeout' })
    }, POWERSHELL_TIMEOUT_MS)
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 4000) stderr += String(chunk)
    })
    child.on('error', (error) => {
      finish({ ok: false, error: String((error && error.message) || error) })
    })
    child.on('exit', (code) => {
      if (code === 0) finish({ ok: true })
      else finish({ ok: false, error: stderr.trim() || `PowerShell exited with ${String(code)}` })
    })
  })
}

export function apply(ctx) {
  const handler = async (req, res) => {
    if (!req || req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST', 'Cache-Control': 'no-store' })
      res.end()
      return
    }
    if (!isTrustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    let payload
    try {
      const text = await readBody(req)
      payload = JSON.parse(text)
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'invalid body' })
      return
    }
    const filePath = payload && typeof payload.path === 'string' ? payload.path : ''
    if (filePath === '' || filePath.includes('\0') || !isAbsolute(filePath)) {
      sendJson(res, 400, { ok: false, error: 'invalid path' })
      return
    }
    let stats
    try {
      stats = statSync(filePath)
    } catch {
      sendJson(res, 404, { ok: false, error: 'file not found' })
      return
    }
    if (!stats.isFile()) {
      sendJson(res, 400, { ok: false, error: 'not a regular file' })
      return
    }
    const result = await copyFileToClipboard(filePath)
    if (!result.ok) {
      sendJson(res, 500, { ok: false, error: result.error || 'copy failed' })
      return
    }
    sendJson(res, 200, { ok: true })
  }

  const route = { kind: 'exact', path: ROUTE, handler }
  if (typeof ctx.effect === 'function') ctx.effect(() => ctx.webServer.register(route))
  else ctx.webServer.register(route)
}
