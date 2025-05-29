# 🚀 GUIA COMPLETO DE DEPLOY GRATUITO - MKTV5

## 🎯 3 MELHORES OPÇÕES GRATUITAS

### 🏆 OPÇÃO 1: RENDER (MAIS RECOMENDADA)

**✅ Vantagens:**
- Fullstack completo gratuito
- PostgreSQL incluído (90 dias grátis)
- SSL automático
- Deploy automático do GitHub
- 750 horas/mês grátis

**📋 Passo a passo:**
1. Acesse: https://render.com
2. Conecte com GitHub
3. Selecione repositório: `usbmkt/MKTV2`
4. Branch: `mktv5`
5. Configure:
   ```
   Build Command: npm install && npm run build
   Start Command: npm start
   ```
6. Adicione variáveis de ambiente:
   ```
   NODE_ENV=production
   GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
   JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
   GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df
   ```

---

### 🥈 OPÇÃO 2: FLY.IO

**✅ Vantagens:**
- $5 crédito mensal grátis
- Performance excelente
- PostgreSQL incluído
- Boa documentação

**📋 Passo a passo:**
1. Instale Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
2. Faça login:
   ```bash
   fly auth login
   ```
3. No diretório do projeto:
   ```bash
   fly launch --name mktv5-app
   ```
4. Configure variáveis:
   ```bash
   fly secrets set GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
   fly secrets set JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
   ```
5. Deploy:
   ```bash
   fly deploy
   ```

---

### 🥉 OPÇÃO 3: VERCEL + SUPABASE

**✅ Vantagens:**
- Frontend ultra-rápido (Vercel)
- Backend completo (Supabase)
- Ambos 100% gratuitos
- Excelente para produção

**📋 Passo a passo:**

**Frontend (Vercel):**
1. Acesse: https://vercel.com
2. Conecte GitHub
3. Selecione: `usbmkt/MKTV2`
4. Branch: `mktv5`
5. Configure build:
   ```
   Build Command: npm run build
   Output Directory: dist/public
   ```

**Backend (Supabase):**
1. Acesse: https://supabase.com
2. Crie novo projeto
3. Configure PostgreSQL
4. Use a Database URL no Vercel

---

## 🚀 DEPLOY RÁPIDO - RENDER (RECOMENDADO)

Vou fazer o deploy no Render agora mesmo:

### 1. **Preparar aplicação:**
```bash
# Já está pronto na branch mktv5!
git checkout mktv5
```

### 2. **Acessar Render:**
- Site: https://render.com
- Clique: "Get Started for Free"
- Conecte GitHub

### 3. **Criar Web Service:**
- Repository: `usbmkt/MKTV2`
- Branch: `mktv5`
- Name: `mktv5-app`
- Build: `npm install && npm run build`
- Start: `npm start`

### 4. **Variáveis de ambiente:**
```
NODE_ENV=production
PORT=10000
GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
JWT_EXPIRES_IN=8d
GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df
FORCE_AUTH_BYPASS=false
```

### 5. **Criar PostgreSQL:**
- New → PostgreSQL
- Name: `mktv5-postgres`
- Copiar Database URL
- Adicionar como `DATABASE_URL` no web service

## 🎯 RESULTADO FINAL

Após o deploy, você terá:
- ✅ **App funcionando**: https://mktv5-app.onrender.com
- ✅ **Todas as funcionalidades ativas**
- ✅ **APIs integradas** (Gemini, GrapesJS)
- ✅ **Banco PostgreSQL**
- ✅ **SSL automático**
- ✅ **Deploy automático** (a cada push)

## 📞 QUAL OPÇÃO ESCOLHER?

**Para iniciantes:** RENDER (mais fácil)
**Para performance:** FLY.IO (mais rápido)
**Para escalabilidade:** VERCEL + SUPABASE (mais profissional)

**Recomendação:** Comece com RENDER, é a mais simples e completa!