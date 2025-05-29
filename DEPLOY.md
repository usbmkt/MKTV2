# 🚀 MKTV5 - APLICAÇÃO 100% FUNCIONAL - GUIA DE DEPLOY

## ✅ STATUS ATUAL
**APLICAÇÃO COMPLETAMENTE FUNCIONAL E PRONTA PARA DEPLOY**

- ✅ **Build funcionando**: Zero erros de compilação
- ✅ **TypeScript validado**: Todas as tipagens corretas
- ✅ **Servidor rodando**: Express na porta 12000
- ✅ **Todas as páginas testadas**: Dashboard, WhatsApp, Editor Visual, Landing Pages
- ✅ **APIs funcionais**: Gemini SDK e GrapesJS Studio
- ✅ **Acesso externo configurado**: Pronto para qualquer plataforma

## 🎯 VARIÁVEIS DE AMBIENTE ESSENCIAIS

Configure estas variáveis no seu serviço de deploy:

```env
# 🔧 CONFIGURAÇÕES BÁSICAS
NODE_ENV=production
PORT=3000

# 🔐 SEGURANÇA E AUTENTICAÇÃO
JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
JWT_EXPIRES_IN=8d
FORCE_AUTH_BYPASS=false

# 🤖 APIs FUNCIONAIS (TESTADAS)
GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df

# 🗄️ BANCO DE DADOS (Configure conforme sua plataforma)
DATABASE_URL=postgresql://user:password@host:port/database
```

## Deploy no Railway

1. Conecte seu repositório GitHub ao Railway
2. Configure as variáveis de ambiente acima
3. Adicione um banco PostgreSQL
4. O deploy será automático usando o `railway.json`

## Deploy no Heroku

1. Instale o Heroku CLI
2. Faça login: `heroku login`
3. Crie o app: `heroku create seu-app-name`
4. Adicione PostgreSQL: `heroku addons:create heroku-postgresql:mini`
5. Configure as variáveis: `heroku config:set VARIAVEL=valor`
6. Deploy: `git push heroku main`

## Deploy no Vercel

1. Instale o Vercel CLI: `npm i -g vercel`
2. Configure: `vercel`
3. Adicione banco PostgreSQL externo (Neon, Supabase, etc.)
4. Configure as variáveis no dashboard do Vercel

## Deploy no Render

1. Conecte seu repositório
2. Configure como Web Service
3. Build Command: `npm run build`
4. Start Command: `npm start`
5. Configure as variáveis de ambiente

## Estrutura do Projeto

```
MKTV2/
├── client/          # Frontend React
├── server/          # Backend Express
├── shared/          # Schemas compartilhados
├── migrations/      # Migrações do banco
├── dist/           # Build de produção
└── uploads/        # Arquivos enviados
```

## Funcionalidades

- ✅ Sistema de autenticação JWT
- ✅ Dashboard de campanhas
- ✅ Editor de landing pages (GrapesJS)
- ✅ Chat com IA (Gemini)
- ✅ Gestão de criativos
- ✅ Métricas e relatórios
- ✅ Integração WhatsApp
- ✅ Sistema de orçamentos

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Banco de dados
npm run db:generate  # Gerar migrações
npm run db:push      # Aplicar ao banco
```

## Troubleshooting

### Erro de DATABASE_URL
Certifique-se de que a variável DATABASE_URL está configurada corretamente.

### Erro de build
Execute `npm run build` localmente para verificar erros.

### Problemas de CORS
O servidor está configurado para aceitar requisições de qualquer origem em produção.

### Uploads não funcionam
Verifique se o diretório `uploads/` tem permissões de escrita.