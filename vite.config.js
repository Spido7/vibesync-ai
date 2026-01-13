import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Required for SharedArrayBuffer (FFmpeg multi-threading)
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  // Important for WASM + workers
  build: {
    target: "esnext",
  },

  // Ensures FFmpeg workers load correctly
  worker: {
    format: "es",
  },
});
