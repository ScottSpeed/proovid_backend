# 🚀 Schnellstart: Lokale Entwicklung

## Problem → Lösung

| Problem | Vorher | Nachher |
|---------|--------|---------|
| **Feedback-Loop** | 10 Min Deployment | 5 Sek Hot Reload |
| **Videos nicht gequed** | Blind debuggen | `.\scripts\fix-queueing.ps1` |
| **Chat liefert alte Videos** | Keine Logs | `.\scripts\fix-multitenant.ps1` |
| **Debugging** | CloudWatch | Echtzeit-Logs |

---

## ⚡ Quick Start (3 Minuten)

```powershell
# 1. Setup (einmalig)
.\scripts\dev-setup.ps1

# 2. .env bearbeiten (AWS Credentials einfügen)
notepad .env

# 3. Starten
.\scripts\dev-start.ps1

# ✅ Fertig! Backend läuft auf http://localhost:8000
```

---

## 🛠️ Tägliche Workflows

### Entwickeln

```powershell
# Starten
.\scripts\dev-start.ps1

# Code ändern → SOFORT aktiv! (Hot Reload)
# Keine Builds, keine Deployments

# Logs live
.\scripts\dev-logs.ps1 backend
.\scripts\dev-logs.ps1 worker

# Stoppen
.\scripts\dev-stop.ps1
```

### Debuggen

```powershell
# Problem: Videos werden nicht gequed
.\scripts\fix-queueing.ps1
.\scripts\debug-queue.ps1

# Problem: Chat liefert alte Videos
.\scripts\fix-multitenant.ps1
.\scripts\debug-session.ps1

# Problem: Jobs hängen
.\scripts\requeue-stale.ps1
```

### Testen

```powershell
# End-to-End Test
.\scripts\test-e2e.ps1 -Token "YOUR_JWT_TOKEN"

# API Docs öffnen
start http://localhost:8000/docs
```

---

## 📁 Wichtige Dateien

```
📦 proovid_backend/
├── 📄 docker-compose.dev.yml    # Lokales Setup
├── 📄 .env.example               # Template für Credentials
├── 📄 DEVELOPMENT_GUIDE.md       # Ausführliche Dokumentation
│
├── 📂 backend/
│   ├── api.py                    # FastAPI Backend
│   └── worker/
│       └── worker.py             # Job Processor
│
└── 📂 scripts/                   # Entwicklungs-Tools
    ├── dev-setup.ps1             # Einmalig: Setup
    ├── dev-start.ps1             # Starten
    ├── dev-stop.ps1              # Stoppen
    ├── dev-logs.ps1              # Logs anschauen
    │
    ├── fix-queueing.ps1          # Debug: Queue-Probleme
    ├── fix-multitenant.ps1       # Debug: Multi-Tenant
    ├── debug-queue.ps1           # SQS & DynamoDB Status
    ├── debug-session.ps1         # Session Isolation
    ├── requeue-stale.ps1         # Stale Jobs neu starten
    └── test-e2e.ps1              # End-to-End Test
```

---

## 🎯 Typische Szenarien

### Szenario 1: "Videos werden nicht verarbeitet"

```powershell
# 1. Diagnose
.\scripts\fix-queueing.ps1

# Zeigt:
# ✅ Enqueue attempts
# ❌ Errors in backend logs
# ⚠️  SQS queue status
# ✅ Worker processing status

# 2. Fix anwenden (meist)
docker-compose -f docker-compose.dev.yml restart worker

# 3. Oder: Stale Jobs neu starten
.\scripts\requeue-stale.ps1
```

### Szenario 2: "Chat liefert falsche Videos"

```powershell
# 1. Diagnose
.\scripts\fix-multitenant.ps1

# Zeigt:
# ❌ Jobs ohne user_id
# ⚠️  Vector DB ohne Isolation

# 2. In Code prüfen (bereits implementiert):
# - api.py Line 520: user_id Parameter
# - api.py Line 2090: user_id wird gesetzt
# - Logs: "🔒 Filtering search by user_id"

# 3. Testen
.\scripts\dev-logs.ps1 backend | Select-String "user_id"
```

### Szenario 3: "Code-Änderung testen"

```powershell
# 1. Services starten
.\scripts\dev-start.ps1

# 2. Code in backend/api.py ändern
# → SOFORT aktiv! (Hot Reload)

# 3. Testen: http://localhost:8000/docs

# 4. Logs prüfen
.\scripts\dev-logs.ps1

# 5. Wenn OK → Deployen
git add .
git commit -m "Fix: ..."
git push
```

---

## 🔍 Wichtige Log-Patterns

```powershell
# User Isolation
docker-compose -f docker-compose.dev.yml logs -f | Select-String "user_id"
# → "🔒 Filtering search by user_id: xyz"

# Video Queueing
docker-compose -f docker-compose.dev.yml logs -f | Select-String "Enqueuing job"
# → "Enqueuing job abc to SQS"

# Job Processing
docker-compose -f docker-compose.dev.yml logs -f | Select-String "Job.*completed"
# → "Job abc completed successfully"

# Chat Queries
docker-compose -f docker-compose.dev.yml logs -f | Select-String "Chat request"
# → "Chat request from user xyz with session_id: 123"
```

---

## ✅ Vorher-Nachher Vergleich

### Entwicklungszyklus

**❌ Vorher:**
```
Code ändern → Git Push → GitHub Actions (2 Min)
→ ECR Build (3 Min) → ECS Deploy (5 Min)
→ Testen → Fehler → Repeat
⏱️ 10 Minuten pro Iteration
```

**✅ Nachher:**
```
Code ändern → Hot Reload (5 Sek) → Testen → Fix
⏱️ 5 Sekunden pro Iteration
```

### Debugging

**❌ Vorher:**
```
Fehler → CloudWatch Logs durchsuchen
→ 5 Min später → "Fehler gefunden"
→ Code ändern → Deployment → 10 Min warten
```

**✅ Nachher:**
```
Fehler → Echtzeit-Logs → Sofort Fix
→ Hot Reload → Sofort testen
```

---

## 🆘 Häufige Probleme

### "Docker Container startet nicht"

```powershell
# Logs prüfen
docker-compose -f docker-compose.dev.yml logs

# Häufig: Port 8000 belegt
netstat -ano | findstr :8000

# Fix: Anderen Port nutzen oder Prozess beenden
```

### "AWS Credentials nicht gefunden"

```powershell
# AWS CLI testen
aws sts get-caller-identity

# Falls Fehler: Configure
aws configure

# Credentials in .env eintragen
notepad .env
```

### "Worker bekommt keine Messages"

```powershell
# Queue Status
.\scripts\debug-queue.ps1

# Worker Logs
.\scripts\dev-logs.ps1 worker

# Worker neu starten
docker-compose -f docker-compose.dev.yml restart worker
```

---

## 📚 Weitere Ressourcen

- 📖 **Ausführliche Docs:** [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- 🐳 **Docker Compose:** [docker-compose.dev.yml](docker-compose.dev.yml)
- 🔧 **Alle Scripts:** [scripts/](scripts/)

---

## 🎓 Nächste Schritte

1. ✅ Setup ausführen: `.\scripts\dev-setup.ps1`
2. ✅ Credentials eintragen: `notepad .env`
3. ✅ Starten: `.\scripts\dev-start.ps1`
4. ✅ Problem debuggen: `.\scripts\fix-queueing.ps1`
5. ✅ Deployment nur nach lokalem Test!

---

**🚀 Viel Erfolg beim Entwickeln!**
