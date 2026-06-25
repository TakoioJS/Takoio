import { execSync } from 'child_process'

console.log('Building UMD: takoio...')
// UMD 构建不清空 dist/，以保留 ESM + .d.ts 产物
execSync('pnpm vite build --mode umd', {
  stdio: 'inherit',
  env: {
    ...process.env,
    TK_UMD_BUILD: 'true'
  }
})
