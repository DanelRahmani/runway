import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        /*
         * Keep the dependencies in chunks of their own.
         *
         * Emitted assets are content-hashed and served immutably, so an app-code
         * change should only invalidate the chunk holding app code. With one
         * combined entry chunk, every deploy made returning visitors re-download
         * React, the router, the database layer and the validator along with it.
         *
         * The chart library gets its own chunk because it is large and only
         * reached from the lazy routes — it was already being split out, and this
         * makes that explicit rather than incidental.
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("dexie")) return "storage";
          if (id.includes("zod")) return "validation";
          if (id.includes("react-router")) return "router";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
