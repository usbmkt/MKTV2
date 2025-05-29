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
      'import.meta.env.VITE_FORCE_AUTH_BYPASS': JSON.stringify(process.env.VITE_FORCE_AUTH_BYPASS || process.env.FORCE_AUTH_BYPASS || 'false'),
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || process.env.APP_BASE_URL || ''),
    },
    resolve: {
      alias: {
        // Usando fileURLToPath para compatibilidade com ES modules
        "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "client", "src"),
        "@shared": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "shared"),
        "@assets": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "attached_assets"),
      },
    },
    // A raiz do projeto para o Vite (onde o index.html do cliente está)
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "client"),
    build: {
      // Diretório de saída para os assets do cliente, relativo à raiz do projeto (não à 'root' do Vite)
      outDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dist/public"),
      emptyOutDir: true, // Limpa o diretório de saída antes de cada build
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
        // Adicione aqui o nome EXATO do pacote que você está tentando importar
        // e que está causando o erro "Rollup failed to resolve import".
        // Se o erro for para "@grapesjs/studio", adicione-o.
        // Se o pacote real for "@grapesjs/studio-sdk", use esse.
        '@grapesjs/studio', // Exemplo, ajuste para o nome correto do pacote do GrapesJS Studio SDK
        // Adicione outros pacotes do SDK se forem importados diretamente e causarem problemas
        // Ex: '@grapesjs/studio-react' (se for um pacote separado e importado)
      ],
      // esbuildOptions: { // Raramente necessário, mas pode ajudar com alguns pacotes
      //   target: 'esnext', 
      // },
    },
    server: { // Configurações do servidor de desenvolvimento Vite
      port: 3000, // Ou a porta que você preferir para desenvolvimento local
      host: '0.0.0.0', // Permite acesso de qualquer host
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
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
