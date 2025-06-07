import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'node:url'; // Importando fileURLToPath

// Plugins específicos do Replit (ou ambiente similar)
// Remova ou ajuste se não estiver usando o ambiente Replit para o build final
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"; 

export default defineConfig(({ command, mode }) => {
  const plugins = [
    react(),
    // runtimeErrorOverlay(), // Descomente se estiver usando no Replit e precisar
  ];

  // Adicionar plugin cartographer apenas em desenvolvimento no Replit
  // Ajuste esta lógica se não estiver usando Replit ou se o cartographer não for necessário.
  if (mode !== "production" && process.env.REPL_ID) {
    import("@replit/vite-plugin-cartographer")
      .then(module => {
        if (module && module.cartographer) {
          plugins.push(module.cartographer());
        } else {
          console.warn("@replit/vite-plugin-cartographer could not be loaded as expected.");
        }
      })
      .catch(e => console.warn("@replit/vite-plugin-cartographer not found or failed to load, skipping.", e));
  }
  
  // Obtém o diretório atual de forma robusta para ESM
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  return {
    plugins: plugins,
    define: {
      // Expor variáveis de ambiente para o frontend
      'import.meta.env.VITE_FORCE_AUTH_BYPASS': JSON.stringify(process.env.VITE_FORCE_AUTH_BYPASS || process.env.FORCE_AUTH_BYPASS || 'false'),
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || process.env.APP_BASE_URL || ''),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"), // Se você tiver esta pasta na raiz do projeto
        "@/types": path.resolve(__dirname, "client", "src", "types"),
        "@/components/flow": path.resolve(__dirname, "client", "src", "components", "flow"),
      },
    },
    // A raiz do projeto para o Vite (onde o index.html do cliente está)
    root: path.resolve(__dirname, "client"),
    build: {
      // Diretório de saída para os assets do cliente, relativo à raiz do projeto
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true, 
      rollupOptions: {
        // external: [], 
      },
      // commonjsOptions: { 
      //   transformMixedEsModules: true,
      //   include: [/node_modules/], 
      // },
    },
    optimizeDeps: {
      include: [
        '@grapesjs/studio', 
        '@xyflow/react', 
        'jspdf', 
        'jspdf-autotable',
      ],
      // esbuildOptions: { 
      //   target: 'esnext', 
      // },
    },
    server: { 
      port: 3000, 
      host: '0.0.0.0', // Permite acesso de qualquer host na rede local.
      allowedHosts: [ // Lista de hosts permitidos.
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        // Hosts específicos do seu ambiente de desenvolvimento/preview (mantidos da sua configuração anterior)
        'work-1-cixzsejsspdqlyvw.prod-runtime.all-hands.dev',
        'work-2-cixzsejsspdqlyvw.prod-runtime.all-hands.dev',
        '.all-hands.dev',
        '.prod-runtime.all-hands.dev'
      ],
      // proxy: { 
      //   '/api': {
      //     target: 'http://localhost:5000', 
      //     changeOrigin: true,
      //   },
      // },
    },
  };
});
