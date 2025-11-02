# 🚀 GitHub Actions Frontend Deployment

## Automatische Deployment Pipeline für Proovid Frontend

### 📋 Was passiert automatisch?

1. **Bei jedem Push auf `master`** mit Änderungen im `frontend/` Ordner:
   - ✅ Frontend wird gebaut (`npm run build`)
   - ✅ Automatisch zu AWS S3 deployed
   - ✅ CloudFront Cache wird geleert (optional)

### 🔧 Setup (Einmalig)

#### 1. GitHub Secrets konfigurieren
Gehe zu: `Settings` → `Secrets and variables` → `Actions`

Füge hinzu:
```
AWS_ACCESS_KEY_ID=AIDA4MTWNG66EWETW7W4B
AWS_SECRET_ACCESS_KEY=dein_secret_key
```

#### 2. S3 Bucket erstellen (Einmalig)
```bash
# Option A: Manuell im Terminal
cd frontend
./scripts/setup-aws-hosting.sh

# Option B: Über GitHub Actions
# Gehe zu "Actions" Tab → "Setup AWS Infrastructure" → "Run workflow"
```

### 🎯 Deployment Workflows

#### 🔄 Automatisches Deployment
```bash
# Einfach pushen!
git add .
git commit -m "Update frontend design"
git push origin master
```

#### 🚀 Manuelles Deployment
```bash
# Via GitHub Actions
Actions → Deploy Frontend to AWS S3 → Run workflow

# Via Terminal (lokal)
cd frontend
npm run build
aws s3 sync dist/ s3://proovid-frontend-hosting --delete
```

### 📊 Deployment Status

#### ✅ Live URLs
- **S3 Website:** http://proovid-frontend-hosting.s3-website-eu-central-1.amazonaws.com
- **CloudFront:** (falls konfiguriert) https://deine-domain.cloudfront.net

#### 📝 Workflow Files
- `.github/workflows/deploy-frontend.yml` - Automatisches Frontend Deployment
- `.github/workflows/setup-aws-infrastructure.yml` - AWS Setup (einmalig)

### 🔍 Monitoring & Debugging

#### GitHub Actions Logs
1. Gehe zu **Actions** Tab
2. Klicke auf den letzten Workflow Run
3. Schaue dir die Logs an für Details

#### Häufige Probleme
```bash
# Problem: Build Failed
# Lösung: Lokaler Test
cd frontend
npm install
npm run build

# Problem: AWS Permissions
# Lösung: Überprüfe GitHub Secrets

# Problem: S3 Bucket nicht gefunden
# Lösung: Führe Setup Workflow aus
```

### 🎨 Workflow Anpassungen

#### Andere Branch deployen
```yaml
# In .github/workflows/deploy-frontend.yml
on:
  push:
    branches: [ master, staging ]  # Füge branches hinzu
```

#### Deployment-Pfad ändern
```yaml
# S3 Bucket Name ändern
run: aws s3 sync dist/ s3://mein-neuer-bucket --delete
```

### 📈 Nächste Schritte

1. **CloudFront Setup** für bessere Performance
2. **Custom Domain** konfigurieren
3. **HTTPS/SSL** Certificate
4. **Staging Environment** für Tests

---
**🔗 Useful Links:**
- [AWS S3 Static Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vite Deployment Guide](https://vite.dev/guide/static-deploy.html)