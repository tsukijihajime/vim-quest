// defineConfig は vitest/config から取る。vite の defineConfig は test キーを
// 知らないため、tsc --noEmit が TS2769 で落ちる。
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages は https://<user>.github.io/<repo>/ で配信するため、
  // base をリポジトリ名にしないと JS / CSS が 404 になる。
  base: process.env.GITHUB_ACTIONS === 'true' ? '/vim-quest/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
