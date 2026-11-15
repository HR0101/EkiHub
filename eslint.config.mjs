import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint（flat config）。
 * eslint-config-next 16 は flat config を直接返すので、FlatCompat は不要。
 */
const config = [
  {
    // 生成物と、移行前の実装（移植の参照用に残しているだけ）は対象外
    ignores: [
      ".next/**",
      "node_modules/**",
      "legacy/**",
      "scripts/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // 未使用でも _ 始まりなら意図的に残しているものとして扱う
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
