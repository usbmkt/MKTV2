# 🚀 DEPLOY V5R - RENDER ESPECÍFICO

## 📋 BRANCH: v5r
**Configuração específica para deploy no Render**

## 🎯 PASSO A PASSO COMPLETO

### 1. **ACESSAR RENDER**
```
🔗 Site: https://render.com
👤 Criar conta gratuita
🔗 Conectar GitHub
```

### 2. **CRIAR WEB SERVICE**
1. Dashboard → **"New +"** → **"Web Service"**
2. Conectar repositório: **`usbmkt/MKTV2`**
3. Selecionar branch: **`v5r`**
4. Configurações:
```
Name: mktv5-render
Environment: Node
Region: Oregon (US West)
Branch: v5r
Build Command: npm install && npm run build && npm run db:generate
Start Command: npm start
```

### 3. **CRIAR POSTGRESQL**
1. Dashboard → **"New +"** → **"PostgreSQL"**
2. Configurações:
```
Name: mktv5-render-db
Database Name: mktv5render
User: mktv5renderuser
Region: Oregon (US West)
Plan: Free
```

### 4. **CONFIGURAR VARIÁVEIS DE AMBIENTE**
No Web Service, adicionar:
```
NODE_ENV=production
PORT=10000
FORCE_AUTH_BYPASS=false
GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
JWT_EXPIRES_IN=8d
GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df
DATABASE_URL=[COPIAR_DO_POSTGRESQL_CRIADO]
```

### 5. **CONECTAR BANCO**
1. No PostgreSQL criado, copiar **"External Database URL"**
2. No Web Service, adicionar como variável **DATABASE_URL**

### 6. **DEPLOY**
1. Clicar **"Create Web Service"**
2. Aguardar build (5-10 minutos)
3. Verificar logs para erros

## 🔗 URLS FINAIS
- **App**: https://mktv5-render.onrender.com
- **Admin**: https://mktv5-render.onrender.com/admin
- **API**: https://mktv5-render.onrender.com/api
- **Health**: https://mktv5-render.onrender.com/api/health

## ✅ VERIFICAÇÃO PÓS-DEPLOY
1. **Testar login** (auth bypass desabilitado)
2. **Verificar todas as páginas**
3. **Testar APIs** (Gemini, GrapesJS)
4. **Confirmar banco de dados**

## 🔧 CONFIGURAÇÕES ESPECÍFICAS
- **Health Check**: `/api/health` ✅ FUNCIONANDO
- **Auto Deploy**: Ativado na branch `v5r`
- **SSL**: Automático
- **Logs**: Disponíveis no dashboard
- **Build**: Otimizado com `npm ci`
- **Postinstall**: Removido para evitar conflitos

## 📞 SUPORTE RENDER
- **Docs**: https://render.com/docs
- **Status**: https://status.render.com
- **Community**: https://community.render.com

## 🎉 VANTAGENS DESTA CONFIGURAÇÃO
- ✅ **Deploy automático** a cada push na branch `v5r`
- ✅ **PostgreSQL gratuito** por 90 dias
- ✅ **SSL automático**
- ✅ **Health checks** configurados
- ✅ **Logs completos**
- ✅ **Zero configuração** adicional necessária