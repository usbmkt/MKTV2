# 🚀 DEPLOY V5VS - VERCEL + SUPABASE

## 📋 BRANCH: v5vs
**Configuração específica para deploy no Vercel + Supabase**

## 🎯 PASSO A PASSO COMPLETO

### PARTE 1: CONFIGURAR SUPABASE (BACKEND)

#### 1. **CRIAR PROJETO SUPABASE**
```
🔗 Site: https://supabase.com
👤 Criar conta gratuita
➕ New Project
```

**Configurações:**
```
Organization: Sua organização
Name: mktv5-supabase
Database Password: [GERAR_SENHA_FORTE]
Region: East US (Virginia)
Plan: Free
```

#### 2. **CONFIGURAR BANCO DE DADOS**
1. No dashboard Supabase → **"SQL Editor"**
2. Copiar e executar o arquivo: `supabase/schema.sql`
3. Verificar se todas as tabelas foram criadas

#### 3. **OBTER CREDENCIAIS**
No dashboard → **"Settings"** → **"Database"**:
```
Host: db.[PROJECT_REF].supabase.co
Database name: postgres
Port: 5432
User: postgres
Password: [SUA_SENHA]
```

**URL de conexão:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### PARTE 2: CONFIGURAR VERCEL (FRONTEND)

#### 1. **INSTALAR VERCEL CLI**
```bash
npm i -g vercel
vercel login
```

#### 2. **FAZER DEPLOY**
```bash
cd /workspace/MKTV2
git checkout v5vs
vercel --prod
```

**Configurações durante o deploy:**
```
? Set up and deploy "~/MKTV2"? [Y/n] Y
? Which scope do you want to deploy to? [Sua conta]
? Link to existing project? [N/y] N
? What's your project's name? mktv5-vercel
? In which directory is your code located? ./
? Want to override the settings? [y/N] N
```

#### 3. **CONFIGURAR VARIÁVEIS DE AMBIENTE**
No dashboard Vercel → **"Settings"** → **"Environment Variables"**:

```
NODE_ENV=production
FORCE_AUTH_BYPASS=false
GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
JWT_EXPIRES_IN=8d
GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df
DATABASE_URL=[URL_DO_SUPABASE]
```

#### 4. **REDEPLOY**
Após configurar as variáveis:
```bash
vercel --prod
```

## 🔗 URLS FINAIS
- **App**: https://mktv5-vercel.vercel.app
- **Admin**: https://mktv5-vercel.vercel.app/admin
- **API**: https://mktv5-vercel.vercel.app/api
- **Supabase Dashboard**: https://app.supabase.com/project/[PROJECT_REF]

## ✅ VERIFICAÇÃO PÓS-DEPLOY

### 1. **TESTAR APLICAÇÃO**
- ✅ Login funcionando
- ✅ Dashboard carregando
- ✅ WhatsApp Business página
- ✅ Funnel Analysis página
- ✅ APIs respondendo

### 2. **VERIFICAR BANCO**
No Supabase → **"Table Editor"**:
- ✅ Todas as 11 tabelas criadas
- ✅ Usuário admin inserido
- ✅ Empresa padrão criada

### 3. **MONITORAR LOGS**
- **Vercel**: Dashboard → Functions → Logs
- **Supabase**: Dashboard → Logs

## 🔧 CONFIGURAÇÕES ESPECÍFICAS

### **VERCEL**
- **Framework**: Detectado automaticamente
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Node Version**: 18.x

### **SUPABASE**
- **PostgreSQL**: 15.x
- **Extensions**: uuid-ossp, pgcrypto
- **Row Level Security**: Desabilitado (para simplicidade)
- **Realtime**: Disponível se necessário

## 🎉 VANTAGENS DESTA CONFIGURAÇÃO

### **VERCEL**
- ✅ **Deploy automático** a cada push
- ✅ **Edge Functions** globais
- ✅ **SSL automático**
- ✅ **CDN global**
- ✅ **Analytics incluído**

### **SUPABASE**
- ✅ **PostgreSQL completo**
- ✅ **Auth integrado** (se necessário)
- ✅ **Realtime subscriptions**
- ✅ **Storage para arquivos**
- ✅ **Dashboard visual**

## 📞 SUPORTE
- **Vercel**: https://vercel.com/docs
- **Supabase**: https://supabase.com/docs
- **Status Vercel**: https://vercel-status.com
- **Status Supabase**: https://status.supabase.com

## 🔄 ATUALIZAÇÕES FUTURAS
1. **Push para branch v5vs** → Deploy automático no Vercel
2. **Mudanças no banco** → Executar no SQL Editor do Supabase
3. **Variáveis de ambiente** → Configurar no dashboard Vercel

## 💡 DICAS IMPORTANTES
- **Supabase Free**: 500MB storage, 2GB transfer/mês
- **Vercel Free**: 100GB bandwidth/mês
- **Logs**: Disponíveis por 24h no plano gratuito
- **Custom Domain**: Configurável em ambas plataformas