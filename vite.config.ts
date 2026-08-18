// defineConfig は vitest/config から取る。vite の defineConfig は test キーを
// 知らないため、tsc --noEmit が TS2769 で落ちる。
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
