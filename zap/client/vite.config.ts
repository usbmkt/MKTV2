 
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@zap_client': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
      // Se precisar acessar componentes do MKTV2 principal, poderia adicionar outro alias:
      // '@mktv2_client': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src'),
    },
  },
  // ... outras configs
});
