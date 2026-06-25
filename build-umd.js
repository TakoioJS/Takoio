import { execSync } from 'child_process'

console.log('Building UMD: takoio...')
execSync('pnpm vite build --mode umd', {
  stdio: 'inherit'
})
