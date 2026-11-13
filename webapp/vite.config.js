import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const API_PORT = process.env.API_PORT ?? "8787";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: `http://127.0.0.1:${API_PORT}`,
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "dist",
        sourcemap: false,
        // Plotly is loaded on demand (dynamic import in Plot.tsx), so it becomes
        // an async chunk fetched only when a chart first mounts. It legitimately
        // stays above the default 1400 kB warning limit.
        chunkSizeWarningLimit: 5000,
    },
});
