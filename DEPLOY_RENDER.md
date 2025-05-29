# 🚀 DEPLOY NO RENDER - MKTV5

## 📋 PASSO A PASSO COMPLETO

### 1. **CRIAR CONTA NO RENDER**
1. Acesse: https://render.com
2. Clique em **"Get Started for Free"**
3. Conecte com sua conta GitHub
4. Autorize o acesso ao repositório **usbmkt/MKTV2**

### 2. **CRIAR SERVIÇO WEB**
1. No dashboard do Render, clique **"New +"**
2. Selecione **"Web Service"**
3. Conecte o repositório **usbmkt/MKTV2**
4. Selecione a branch **mktv5**

### 3. **CONFIGURAR O SERVIÇO**
```
Name: mktv5-app
Environment: Node
Region: Oregon (US West)
Branch: mktv5
Build Command: npm install && npm run build
Start Command: npm start
```

### 4. **CONFIGURAR VARIÁVEIS DE AMBIENTE**
```
NODE_ENV=production
PORT=10000
FORCE_AUTH_BYPASS=false
GEMINI_API_KEY=AIzaSyBh6HdznlhY0Xvm-rKWMBuQh83xVlEdSd4
JWT_SECRET=k3jHs9aF3dLmN5pQrT7vWxYz1bC4eI0oP2uV6iM/s=
JWT_EXPIRES_IN=8d
GRAPESJS_STUDIO_LICENSE_KEY=bcea48b82acd486f90429a86ef8e5f42b6abdef35d0e486f8649b929acfde5df
```

### 5. **CRIAR BANCO POSTGRESQL**
1. No dashboard, clique **"New +"**
2. Selecione **"PostgreSQL"**
3. Configure:
```
Name: mktv5-postgres
Database Name: mktv5
User: mktv5user
```

### 6. **CONECTAR BANCO AO SERVIÇO**
1. Copie a **Database URL** do PostgreSQL
2. Adicione no serviço web:
```
DATABASE_URL=[URL_DO_BANCO_COPIADA]
```

### 7. **DEPLOY AUTOMÁTICO**
1. Clique **"Create Web Service"**
2. O Render fará o build automaticamente
3. Aguarde 5-10 minutos para conclusão

## 🔗 URLS FINAIS
- **App**: https://mktv5-app.onrender.com
- **Admin**: https://mktv5-app.onrender.com/admin
- **API**: https://mktv5-app.onrender.com/api

## ✅ VERIFICAÇÃO
1. **Teste o login** (bypass ativo)
2. **Verifique todas as páginas**
3. **Teste as APIs**
4. **Confirme integração Gemini**

## 🎯 ALTERNATIVA RÁPIDA: CYCLIC

Se preferir uma opção ainda mais simples:

1. Acesse: https://cyclic.sh
2. Conecte GitHub
3. Selecione repositório **usbmkt/MKTV2**
4. Branch **mktv5**
5. Deploy automático!

## 📞 SUPORTE
- **Render Docs**: https://render.com/docs
- **Status**: https://status.render.com