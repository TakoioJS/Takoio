#!/usr/bin/env node
/**
 * Takoio Dev — 一键启动 Server / Client(+Admin) 开发服务
 *
 * Client 使用 vite.config.dev.ts (MPA 模式)，Admin 通过 /admin/ 路径访问。
 * 所有服务并行启动，日志带彩色前缀区分来源。
 * Ctrl+C 优雅退出，自动清理残留端口占用。
 */
import { spawn, execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// ─── 常量 ────────────────────────────────────────────────────────────────────
const root = resolve(dirname(fileURLToPath(import.meta.url)))
const isWin = process.platform === 'win32'
const nodeExe = process.execPath
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ANSI = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m' }

// ─── 端口清理 ────────────────────────────────────────────────────────────────
function killPort(port) {
  try {
    if (isWin) {
      const raw = execSync('netstat -ano | findstr LISTENING', { encoding: 'utf-8', stdio: 'pipe' })
      const re = new RegExp(`:${port}\\s`, 'g')
      for (const line of raw.split('\n')) {
        if (!re.test(line)) continue
        re.lastIndex = 0
        const m = line.trim().match(/(\d+)\s*$/)
        if (m && m[1] !== '0') {
          try { execSync(`taskkill /F /PID ${m[1]} /T`, { stdio: 'pipe' }) } catch { /* gone */ }
        }
      }
    } else {
      const raw = execSync(`lsof -ti tcp:${port} 2>/dev/null || true`, { encoding: 'utf-8', stdio: 'pipe' })
      for (const pid of raw.trim().split('\n').filter(Boolean)) {
        try { process.kill(Number(pid), 'SIGTERM') } catch { /* gone */ }
      }
    }
  } catch { /* port free */ }
}

async function cleanPorts(ports) {
  let any = false
  for (const p of ports) {
    try {
      const before = isWin
        ? execSync('netstat -ano | findstr LISTENING', { encoding: 'utf-8', stdio: 'pipe' })
        : ''
      killPort(p)
      if (isWin) {
        const after = execSync('netstat -ano | findstr LISTENING', { encoding: 'utf-8', stdio: 'pipe' })
        if (before !== after) any = true
      }
    } catch { /* ignore */ }
  }
  if (any) await sleep(400)
}

// ─── CLI 解析（绕过 Windows .cmd 的 stdout 缓冲问题）─────────────────────────
function resolveCli(cwd, name) {
  const binDir = resolve(cwd, 'node_modules', '.bin')

  // 1) 常见入口路径
  for (const p of [
    resolve(binDir, '..', name, 'bin', `${name}.js`),
    resolve(binDir, '..', name, 'dist', 'cli.mjs'),
    resolve(binDir, '..', name, 'dist', 'cli.js'),
  ]) {
    if (existsSync(p)) return p
  }

  // 2) 解析 .cmd 中的 node 路径
  const cmdPath = resolve(binDir, `${name}.cmd`)
  if (existsSync(cmdPath)) {
    const m = readFileSync(cmdPath, 'utf-8').match(/node\s+"([^"]+\.(?:m?js))"/i)
    if (m) {
      const p = m[1]
        .replace(/%~dp0\\?\.\.\\/g, resolve(binDir, '..') + '/')
        .replace(/\\/g, '/')
      if (existsSync(p)) return p
    }
  }

  // 3) 通过 package.json bin 字段解析
  try {
    const require = createRequire(resolve(cwd, 'package.json'))
    const pkg = require(`${name}/package.json`)
    if (pkg.bin) {
      const entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name]
      if (entry) {
        const p = resolve(binDir, '..', name, entry)
        if (existsSync(p)) return p
      }
    }
  } catch { /* ignore */ }

  return null
}

// ─── 服务定义 ─────────────────────────────────────────────────────────────────
// tsx watch 在 piped stdio 下的孙进程既不输出也不绑定端口（Windows 尤甚）。
// 改用 node --watch + tsx/esm loader：Node 原生 watch 只监听 import 链上的模块，
// SQLite 数据库写入不触发重启，且无孙进程问题。
const SERVER_DIR = resolve(root, 'src/server')
const services = [
  { name: 'server', color: '\x1b[32m', cwd: SERVER_DIR, cli: 'nitro', args: ['dev'] },
  { name: 'client', color: '\x1b[36m', cwd: root,       cli: 'vite', args: ['--config', 'vite.config.dev.ts', '--host', '127.0.0.1', '--port', '9820'] },
]

// ─── 进程管理 ─────────────────────────────────────────────────────────────────
const children = []

function log(svc, line) {
  process.stdout.write(`${svc.color}[${svc.name}]${ANSI.reset} ${line}\n`)
}

function startService(svc) {
  const cliPath = svc.cli === 'node' ? null : resolveCli(svc.cwd, svc.cli)
  const useNode = svc.cli === 'node' || !!cliPath
  const useShell = !useNode && isWin
  const cmd  = useNode ? nodeExe : svc.cli + (isWin ? '.cmd' : '')
  const args = useNode ? (cliPath ? [cliPath, ...svc.args] : svc.args) : svc.args

  const child = spawn(cmd, args, {
    cwd: svc.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    windowsHide: true,
    ...(useShell ? { shell: true } : {}),
  })

  const onData = (d) =>
    d.toString('utf-8').split('\n').filter(Boolean).forEach((l) => log(svc, l))

  child.stdout?.on('data', onData)
  child.stderr?.on('data', onData)
  child.on('error', (err) => log(svc, `spawn error: ${err.message}`))
  child.on('exit', (code) => log(svc, `exited (${code})`))

  children.push(child)
  return child
}

// ─── 启动 ─────────────────────────────────────────────────────────────────────
async function main() {
  await cleanPorts([8080, 9820])

  console.log(`${ANSI.bold}Takoio dev${ANSI.reset} ${ANSI.dim}starting...${ANSI.reset}\n`)

  // 并行启动两个服务
  for (const svc of services) startService(svc)

  console.log(
    `\n${ANSI.bold}Dev servers:${ANSI.reset}\n` +
    `  \x1b[32mServer${ANSI.reset} → http://localhost:8080\n` +
    `  \x1b[36mClient${ANSI.reset} → http://127.0.0.1:9820\n` +
    `  \x1b[35mAdmin${ANSI.reset}  → http://127.0.0.1:9820/admin/\n`,
  )
}

main().catch((e) => { console.error(e); process.exit(1) })

// ─── 退出清理 ─────────────────────────────────────────────────────────────────
function cleanup() {
  for (const c of children) {
    if (isWin) {
      spawn('cmd.exe', ['/d', '/c', 'taskkill', '/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      c.kill('SIGTERM')
    }
  }
  setTimeout(() => process.exit(0), 500)
}

process.on('SIGINT',  cleanup)
process.on('SIGTERM', cleanup)
