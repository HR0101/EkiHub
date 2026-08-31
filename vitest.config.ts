import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // 既定は node。DOM が要るテストだけファイル先頭に
    // `// @vitest-environment jsdom` を書く。
    // jsdom を常時読み込むと、その依存（@asamuzakjp/css-color）が
    // ESM/CJS の衝突を起こして起動できないため。
    environment: "node",
    globals: true,
    // 移行前の実装と、ブラウザを立ち上げる旧スモークテストは対象外
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "legacy", "scripts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
