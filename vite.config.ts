import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath, URL } from 'node:url';

// Plugins específicos do Replit (ou ambiente similar)
// Remova ou ajuste se não estiver usando o ambiente Replit para o build final
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"; 

export default defineConfig(({ command, mode }) => {
  const plugins = [
    react(),
    // O runtimeErrorOverlay é útil para desenvolvimento, pode ser removido para produção final se desejado
    // runtimeErrorOverlay(), 
  ];

  return {
    plugins: plugins,
    define: {
      // Expor variáveis de ambiente para o frontend
      // Garante que o código do cliente possa acessar essas variáveis.
      'import.meta.env.VITE_FORCE_AUTH_BYPASS': JSON.stringify(process.env.VITE_FORCE_AUTH_BYPASS || process.env.FORCE_AUTH_BYPASS || 'false'),
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || process.env.APP_BASE_URL || ''),
    },
    resolve: {
      alias: {
        // Alias para facilitar importações do diretório src do cliente.
        // Ex: import MyComponent from '@/components/MyComponent';
        "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "client", "src"),
        // Alias para o diretório compartilhado (shared).
        // Crucial para importações como import { ... } from '@shared/schema';
        "@shared": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "shared"),
        // Alias para assets.
        "@assets": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "attached_assets"),
        // Alias para os tipos do fluxo (se você criar client/src/types/zapTypes.ts)
        "@/types": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "client", "src", "types"),
        // Alias para componentes do fluxo (se você criar client/src/components/flow)
        "@/components/flow": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "client", "src", "components", "flow"),

      },
    },
    // Define a pasta raiz para o Vite, onde ele procurará o index.html.
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "client"),
    build: {
      // Define o diretório de saída para os arquivos de build do cliente.
      // Relativo à raiz do projeto (onde vite.config.ts está), não à 'root' do Vite.
      outDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dist/public"),
      emptyOutDir: true, // Limpa o diretório de saída antes de cada build.
      rollupOptions: {
        // external: [], // Use apenas se você explicitamente não quer empacotar uma lib
      },
      // commonjsOptions: { // Descomente se suspeitar de problemas com módulos CommonJS
      //   transformMixedEsModules: true,
      //   include: [/node_modules/], 
      // },
    },
    optimizeDeps: {
      include: [
        '@grapesjs/studio',
        '@xyflow/react',
        'jspdf', // <-- ADICIONADO AQUI 
      ],
      // esbuildOptions: { // Raramente necessário, mas pode ajudar com alguns pacotes
      //   target: 'esnext', 
      // },
    },
    server: { // Configurações do servidor de desenvolvimento Vite
      port: 3000, // Porta para o servidor de desenvolvimento.
      host: '0.0.0.0', // Permite acesso de qualquer host na rede local.
      allowedHosts: [ // Lista de hosts permitidos.
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        // Adicione aqui os hosts específicos do seu ambiente de desenvolvimento/preview, se necessário.
        'work-1-cixzsejsspdqlyvw.prod-runtime.all-hands.dev',
        'work-2-cixzsejsspdqlyvw.prod-runtime.all-hands.dev',
        '.all-hands.dev',
        '.prod-runtime.all-hands.dev'
      ],
      // proxy: { // Exemplo se você precisar de proxy para o backend em desenvolvimento
      //   '/api': {
      //     target: 'http://localhost:5000', // Seu servidor backend
      //     changeOrigin: true,
      //   },
      // },
    },
  };
});