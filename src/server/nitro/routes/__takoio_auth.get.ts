/**
 * OAuth 回调落地页 — 修复 /__takoio_auth?token=... 死链。
 * OAuth callback (GitHub/Google) 成功后 302 跳转到这里，本路由返回 HTML，
 * 内嵌 JS 调 /api/auth/me 拿 user 信息并写入 localStorage。
 */

export default defineHandler(async (event) => {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>登录成功 - Takoio</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d0d0d; color: #f5f5f5; margin: 0; padding: 40px 20px;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px;
      padding: 32px; max-width: 400px; width: 100%; text-align: center; }
    .spinner { width: 32px; height: 32px; border: 3px solid #2a2a2a;
      border-top-color: #fbbf24; border-radius: 50%; margin: 0 auto 16px;
      animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #a3a3a3; margin: 0; line-height: 1.5; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; margin: 0 auto 16px; }
    .provider { display: inline-block; padding: 2px 8px; background: #262626;
      border-radius: 9999px; font-size: 11px; color: #737373; margin-top: 8px; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" id="spinner"></div>
    <h1 id="title">登录中…</h1>
    <p id="msg">正在验证您的身份</p>
  </div>
  <script>
    (async function() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const titleEl = document.getElementById('title');
      const msgEl = document.getElementById('msg');
      const spinnerEl = document.getElementById('spinner');
      if (!token) {
        titleEl.textContent = '登录失败';
        msgEl.textContent = '未提供 token';
        msgEl.className = 'error';
        spinnerEl.style.display = 'none';
        return;
      }
      try {
        // 同步调用 /api/auth/me 拿 user 信息
        const res = await fetch('/api/auth/me?token=' + encodeURIComponent(token));
        if (!res.ok) throw new Error('验证失败: HTTP ' + res.status);
        const data = await res.json();
        if (!data.user) throw new Error('未获取到用户信息');
        // 写入 localStorage（与 src/client/utils/auth.ts 兼容）
        localStorage.setItem('takoio_auth', JSON.stringify({
          token: token,
          user: {
            name: data.user.name,
            email: data.user.email || '',
            avatar: data.user.avatar || '',
            provider: data.user.provider,
          }
        }));
        // 清空 URL 参数
        window.history.replaceState({}, '', window.location.pathname);
        // 显示成功
        spinnerEl.style.display = 'none';
        titleEl.textContent = '登录成功';
        const providerLabel = { github: 'GitHub', google: 'Google', email: '邮箱' }[data.user.provider] || data.user.provider;
        msgEl.innerHTML = '欢迎，' + (data.user.name || '') + '<br><span class="provider">' + providerLabel + '</span>';
        // 3s 后尝试关闭弹窗（如果是 OAuth 弹窗打开）或刷新父窗口
        setTimeout(function() {
          if (window.opener) {
            try { window.opener.location.reload(); window.close(); } catch (e) {}
          } else {
            // 尝试回到来源页
            if (document.referrer) {
              window.location.href = document.referrer;
            }
          }
        }, 3000);
      } catch (e) {
        spinnerEl.style.display = 'none';
        titleEl.textContent = '登录失败';
        msgEl.textContent = e.message || String(e);
        msgEl.className = 'error';
      }
    })();
  </script>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })
})
