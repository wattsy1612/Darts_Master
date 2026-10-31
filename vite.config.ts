import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlinePlugin } from './build/offlinePlugin.ts';

export default defineConfig({
  plugins: [react(), offlinePlugin()],
  server: {
    port: 5173,
    strictPort: true,
    // WSL file notifications can miss edits on a Windows-mounted project.
    watch: {
      usePolling:
        process.platform === 'linux' && process.cwd().startsWith('/mnt/'),
      interval: 300,
    },
  },
});
