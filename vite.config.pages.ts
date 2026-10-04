// Build estático para GitHub Pages. O vite.config.ts continua igual para o Lovable.
// Saída: dist/client/index.html (página principal, sem servidor).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "massiva-cop-movel";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
      },
    },
  },
  vite: {
    base: `/${repo}/`,
  },
});
