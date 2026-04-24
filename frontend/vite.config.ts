import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendProxyTarget = process.env.ARIAD_BACKEND_PROXY_TARGET ?? "http://127.0.0.1:3001";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        service: fileURLToPath(new URL("./service.html", import.meta.url))
      }
    }
  },
  plugins: [react()],
  preview: {
    proxy: {
      "/api": backendProxyTarget
    }
  },
  server: {
    proxy: {
      "/api": backendProxyTarget
    }
  }
});
