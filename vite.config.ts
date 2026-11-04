import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The workshop is styled with Tailwind classes — the plugin
// compiles them at build and dev time alike. The wardrobe server
// (server.ts) listens on 127.0.0.1:8791 by default; the dev server
// delegates /api to it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8791",
    },
  },
});
