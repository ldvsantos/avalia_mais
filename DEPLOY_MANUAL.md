# Deploy Manual - Sistema de Certificados

## ✅ Código já está no GitHub
O commit `713f9e8` foi enviado com sucesso para o repositório.

## 🔑 Problema: Chave SSH não encontrada
A chave SSH (`planterr.pem`) não está em `C:\Users\vidal\.ssh\`

## 📋 Opções para Deploy:

### Opção 1: Deploy via AWS Console (Recomendado)

1. **Acesse o AWS Console**: https://console.aws.amazon.com/
2. **EC2 → Instances → Connect**
3. **Session Manager ou EC2 Instance Connect**
4. Execute no terminal:

```bash
cd /opt/planterr
git pull origin main
npm install --prefix server
pm2 restart planterr
pm2 logs planterr --lines 30
```

### Opção 2: Localizar e usar sua chave SSH

1. **Encontre o arquivo `planterr.pem`** (provavelmente em Downloads quando criou a EC2)
2. **Copie para**: `C:\Users\vidal\.ssh\planterr.pem`
3. **Execute**:

```powershell
cd "c:\Users\vidal\OneDrive\Documentos\13 - CLONEGIT\site_planter_projeto"
.\scripts\deploy.ps1
```

### Opção 3: Deploy via GitHub Actions (Se configurado)

Se o repositório tiver workflow de CI/CD configurado, o deploy será automático.

## 🎯 Verificar Deploy

Após o deploy, acesse:
- **Admin**: https://13.59.96.218/secret/4a98a736-811d-447a-bfb3-6f4c2bc0dbc7/admin
- **Público**: https://13.59.96.218/

Teste:
1. ✅ Criar novo evento com atividades
2. ✅ Gerar certificado de teste
3. ✅ Verificar tabela de atividades no PDF

## 🔍 Comandos úteis no servidor:

```bash
# Ver logs em tempo real
pm2 logs planterr

# Status do serviço
pm2 status

# Reiniciar
pm2 restart planterr

# Ver última atualização Git
git log --oneline -5
```

---

**Próximo Passo**: Escolha uma das opções acima para completar o deploy!
