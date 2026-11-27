import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      includeAssets: [
        "supabase-config.js",
        "valley-of-peace-logo.png",
        "valley-of-peace-logo-removebg-preview.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-192.png",
        "icons/icon-maskable-512.png"
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/supabase-config\.js$/]
      },
      devOptions: { enabled: false }
    })
  ],
  base: "/",
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
