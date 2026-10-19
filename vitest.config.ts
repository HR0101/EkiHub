import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
// This workspace uses Node 22.9, where jsdom's ESM dependencies need opt-in.
const needsRequireModuleFlag = nodeMajor === 22 && (nodeMinor ?? 0) < 12;

export default defineConfig({
  plugins: [react()],
  test: {
    // 既定は node。DOM が要るテストだけファイル先頭に
    // `// @vitest-environment jsdom` を書く。
    // DOM tests run in their own environment; core tests stay lightweight.
    environment: "node",
    execArgv: needsRequireModuleFlag ? ["--experimental-require-module"] : [],
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
