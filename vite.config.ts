import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [],
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        passenger: path.resolve(import.meta.dirname, "passenger.html"),
        driver: path.resolve(import.meta.dirname, "driver.html"),
        admin: path.resolve(import.meta.dirname, "admin.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    allowedHosts: true,
    fs: { strict: false },
  },
  preview: {
    port: 4173,
    host: "127.0.0.1",
    allowedHosts: true,
  },
});
