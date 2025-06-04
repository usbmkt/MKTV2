import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Plugins específicos do Replit (ou ambiente similar)
// Remova ou ajuste se não estiver usando o ambiente Replit para o build final
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"; 

export default defineConfig(async ({ command, mode }) => {
  const plugins = [
    react(),
    // O runtimeErrorOverlay é útil para desenvolvimento, pode ser removido para produção final se desejado
    runtimeErrorOverlay(), 
  ];

  // Adicionar plugin cartographer apenas em desenvolvimento no Replit
  // Verifique se REPL_ID está definido no seu ambiente de build do Railway, caso contrário, remova esta lógica condicional.
  // Para um build de produção padrão, você provavelmente não precisará do cartographer.
  if (mode !== "production" && process.env.REPL_ID) {
    try {
      const { cartographer } = await import("@replit/vite-plugin-cartographer");
      plugins.push(cartographer());
    } catch (e) {
      console.warn("@replit/vite-plugin-cartographer not found, skipping.");
    }
  }

  return {
    plugins: plugins,
    resolve: {
      alias: {
        // Garanta que 'import.meta.dirname' funcione no seu ambiente de build.
        // Se estiver usando uma versão mais antiga do Node onde não funciona, use '__dirname'
        // e ajuste o 'type: "module"' no package.json ou a configuração do tsconfig.
        "@": path.resolve(import.meta.dirname || __dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname || __dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname || __dirname, "attached_assets"),
      },
    },
    // A raiz do projeto para o Vite (onde o index.html do cliente está)
    root: path.resolve(import.meta.dirname || __dirname, "client"),
    build: {
      // Diretório de saída para os assets do cliente, relativo à raiz do projeto (não à 'root' do Vite)
      outDir: path.resolve(import.meta.dirname || __dirname, "dist/public"),
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
      // proxy: { // Exemplo se você precisar de proxy para o backend em desenvolvimento
      //   '/api': {
      //     target: 'http://localhost:5000', // Seu servidor backend
      //     changeOrigin: true,
      //   },
      // },
    },
  };
});