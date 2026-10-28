import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// next-auth's ESM build imports Next.js subpaths without a file extension
// ("next/server"), which Node's resolver rejects outside the Next compiler.
// Aliasing them to the shipped .js files lets the auth module be unit tested.
const nextFile = (subpath: string) =>
  fileURLToPath(new URL(`./node_modules/next/${subpath}.js`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "next/server": nextFile("server"),
      "next/headers": nextFile("headers"),
      "next/navigation": nextFile("navigation"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // next-auth ships ESM that imports Next.js subpaths by bare package name;
    // inlining lets Vite resolve them through the aliases above.
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
  },
});
