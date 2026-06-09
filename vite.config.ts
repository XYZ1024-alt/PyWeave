import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const MONACO_CHUNK_WARNING_LIMIT_KB = 4_000;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    cssCodeSplit: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["@monaco-editor/react", "monaco-editor"],
          reactflow: ["@xyflow/react"],
        },
      },
    },
    chunkSizeWarningLimit: MONACO_CHUNK_WARNING_LIMIT_KB,
    sourcemap: false,
    target: "es2022",
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});
