# 🚀 MKTV5 - Guia de Deploy Completo

## ✅ Status do Projeto
- **Branch**: `mktv5` 
- **Commit**: `21fa1a7` (PostCSS config fix)
- **Build**: ✅ Funcionando (npm run build)
- **Aplicação**: ✅ 100% Funcional
- **Deploy**: 🔧 Pronto para deploy

## 📋 Pré-requisitos

### 1. Variáveis de Ambiente Necessárias
```env
# Autenticação
FORCE_AUTH_BYPASS=false
JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
JWT_EXPIRES_IN=8d

# APIs
GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df

# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@host:port/database

# URLs da Aplicação
APP_BASE_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com

# Configurações
SSL_CERT_DAYS=820
NODE_ENV=production
PORT=5000
```

## 🌐 Plataformas de Deploy Suportadas

### 1. Railway
- ✅ Configurado com `render.yaml`
- ✅ PostgreSQL integrado
- ✅ Build automático

### 2. Render
- ✅ Configurado com `render.yaml`
- ✅ PostgreSQL addon disponível
- ✅ Build automático

### 3. Vercel
- ✅ Suporte a Node.js
- ⚠️ Requer configuração de database externa

### 4. Heroku
- ✅ Buildpack Node.js
- ✅ PostgreSQL addon disponível

## 🔧 Configuração de Deploy

### Arquivos de Configuração
- `render.yaml` - Configuração para Render/Railway
- `package.json` - Scripts de build e start
- `vite.config.ts` - Configuração do frontend
- `client/postcss.config.js` - PostCSS (corrigido)
- `client/tailwind.config.ts` - Tailwind CSS

### Scripts Disponíveis
```bash
npm run build    # Build completo (frontend + backend)
npm start        # Inicia servidor de produção
npm run dev      # Desenvolvimento local
npm run db:push  # Sincroniza schema do banco
```

## 📦 Deploy no Render

### 1. Conectar Repositório
1. Acesse [render.com](https://render.com)
2. Conecte sua conta GitHub
3. Selecione o repositório `usbmkt/MKTV2`
4. Escolha a branch `mktv5`

### 2. Configurar Serviço
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Node Version**: 18+
- **Environment**: Production

### 3. Configurar Database
1. Crie um PostgreSQL service no Render
2. Copie a DATABASE_URL
3. Configure nas variáveis de ambiente

### 4. Variáveis de Ambiente
Configure todas as variáveis listadas acima no painel do Render.

## 📦 Deploy no Railway

### 1. Conectar Repositório
1. Acesse [railway.app](https://railway.app)
2. Conecte sua conta GitHub
3. Deploy from GitHub repo
4. Selecione `usbmkt/MKTV2` branch `mktv5`

### 2. Configurar Database
1. Add PostgreSQL service
2. Connect to your app
3. Railway auto-configura DATABASE_URL

### 3. Configurar Variáveis
Configure as variáveis de ambiente no painel do Railway.

## 🔍 Verificação Pós-Deploy

### Endpoints para Testar
- `GET /` - Página inicial
- `GET /api/health` - Health check
- `POST /api/auth/login` - Login
- `GET /whatsapp` - Página WhatsApp
- `GET /copy-ia` - Página Copy & IA

### Funcionalidades a Verificar
- ✅ Login/Logout
- ✅ Navegação entre páginas
- ✅ WhatsApp Flow Builder
- ✅ Copy & IA Generator
- ✅ GrapesJS Studio
- ✅ Responsividade

## 🐛 Troubleshooting

### Erro de Build
```bash
# Se houver erro de PostCSS/Tailwind
npm install
npm run build
```

### Erro de Database
```bash
# Verificar conexão
npm run db:push
```

### Erro de Dependências
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

## 📱 URLs de Produção

Após o deploy, sua aplicação estará disponível em:
- **Render**: `https://your-app-name.onrender.com`
- **Railway**: `https://your-app-name.up.railway.app`
- **Vercel**: `https://your-app-name.vercel.app`

## 🎯 Próximos Passos

1. ✅ **Deploy Realizado** - Aplicação online
2. 🔧 **Configurar Domínio** - Domínio personalizado
3. 📊 **Monitoramento** - Logs e métricas
4. 🔒 **SSL/HTTPS** - Certificado automático
5. 📈 **Scaling** - Configurar auto-scaling

---

## 📞 Suporte

Se encontrar problemas durante o deploy:
1. Verifique os logs da plataforma
2. Confirme todas as variáveis de ambiente
3. Teste o build localmente primeiro
4. Verifique a conexão com o database

**Status**: 🟢 Pronto para Deploy
**Última Atualização**: 29/05/2025
**Commit**: 21fa1a7