import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      allowedHosts: [
        'flowtask.yaros.kg',
        '.yaros.kg',
        'localhost',
        '127.0.0.1'
      ],
      host: true
    }
  }
});