import { defineHandler, setResponseHeader } from 'h3'

export default defineHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Takoio</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{max-width:480px;width:100%;padding:2.5rem;border-radius:16px;background:#1e293b;box-shadow:0 4px 24px rgba(0,0,0,.4)}
  h1{font-size:1.5rem;font-weight:600;margin-bottom:.25rem}
  .tag{display:inline-block;padding:2px 10px;border-radius:9999px;background:#22c55e20;color:#4ade80;font-size:.75rem;font-weight:500;margin-bottom:1.5rem}
  .row{display:flex;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid #334155;font-size:.875rem}
  .row:last-child{border-bottom:none}
  .label{color:#94a3b8}
  .links{margin-top:1.5rem;display:flex;gap:.75rem}
  .links a{flex:1;text-align:center;padding:.6rem;border-radius:8px;background:#334155;color:#e2e8f0;text-decoration:none;font-size:.8rem;font-weight:500;transition:background .15s}
  .links a:hover{background:#475569}
</style>
</head>
<body>
<div class="card">
  <h1>Takoio</h1>
  <span class="tag">Running</span>
  <div class="row"><span class="label">Preset</span><span>${process.env.NITRO_PRESET || 'node-server'}</span></div>
  <div class="row"><span class="label">DB</span><span>${(process.env.DB_TYPE || 'sqlite').toUpperCase()}</span></div>
  <div class="row"><span class="label">Node</span><span>${process.version}</span></div>
  <div class="links">
    <a href="/api/health">Health</a>
    <a href="https://github.com/TakoioJS/Takoio" target="_blank">GitHub</a>
  </div>
</div>
</body>
</html>`
})
