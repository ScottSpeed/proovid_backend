# 🚀 Proovid Development Guide

## Problembeschreibung

**Aktuelle Herausforderungen:**
1. ❌ Videos werden nicht alle zu SQS gequed
2. ❌ Chat liefert Videos aus alten Sessions (Multi-Tenant-Problem)
3. ❌ Deployment dauert 5-10 Minuten (GitHub Actions → ECR → ECS)
4. ❌ Ineffizientes Debugging ohne lokale Tests

## ✅ Lösung: Hybrid-Entwicklung

**Lokales Docker + AWS Services** = Schnelles Feedback + Produktionsnahe Umgebung

### Vorteile

| Aspekt | Vorher (Cloud-Only) | Nachher (Hybrid) |
|--------|---------------------|------------------|
| **Feedback-Loop** | 5-10 Min (Deployment) | 5 Sekunden (Hot Reload) |
| **Debugging** | CloudWatch Logs | Echtzeit-Logs, Breakpoints |
| **Kosten** | Jede Änderung = Build | Nur finale Deployments |
| **Testing** | Direkt in Production | Lokal vor Deployment |

---

## 🛠️ Setup (Einmalig)

### 1. Voraussetzungen installieren

```powershell
# Docker Desktop
# Download: https://www.docker.com/products/docker-desktop/

# AWS CLI (falls noch nicht installiert)
# Download: https://aws.amazon.com/cli/

# AWS CLI konfigurieren
aws configure
```

### 2. Development Environment aufsetzen

```powershell
# Im Projekt-Root
cd C:\Users\chris\proovid_backend

# Setup-Script ausführen
.\scripts\dev-setup.ps1
```

Das Script:
- ✅ Prüft Docker, AWS CLI
- ✅ Erstellt `.env` Datei
- ✅ Baut Docker Images
- ✅ Zeigt nächste Schritte

### 3. `.env` Datei anpassen

Öffne `.env` und füge deine AWS Credentials ein:

```env
AWS_ACCESS_KEY_ID=dein_access_key
AWS_SECRET_ACCESS_KEY=dein_secret_key
COGNITO_CLIENT_ID=deine_client_id
```

---

## 🚀 Tägliche Entwicklung

### Services starten

```powershell
.\scripts\dev-start.ps1
```

**Services laufen auf:**
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Worker: Läuft im Hintergrund

### Code ändern → Sofort aktiv! 🔥

```python
# backend/api.py ändern
# Änderungen sind SOFORT aktiv (Hot Reload)
```

**Kein Rebuild nötig!** Uvicorn erkennt Änderungen automatisch.

### Logs anschauen

```powershell
# Alle Logs
docker-compose -f docker-compose.dev.yml logs -f

# Nur Backend
docker-compose -f docker-compose.dev.yml logs -f backend

# Nur Worker
docker-compose -f docker-compose.dev.yml logs -f worker
```

### Services stoppen

```powershell
.\scripts\dev-stop.ps1
```

---

## 🐛 Debugging-Strategien

### Problem 1: Videos werden nicht gequed

**Debug-Script:**
```powershell
.\scripts\debug-queue.ps1
```

**Zeigt:**
- ✅ SQS Queue Status
- ✅ Anzahl Nachrichten in Queue
- ✅ Jobs in DynamoDB mit Status "queued"
- ⚠️ Warnung bei Jobs älter als 2 Minuten

**Häufige Ursachen:**
1. **Worker läuft nicht** → `docker-compose -f docker-compose.dev.yml ps`
2. **SQS Enqueue schlägt fehl** → Logs prüfen: `api.py:start_worker_container`
3. **Falscher Queue URL** → `.env` prüfen

**Fix im Code:**
```python
# backend/api.py - Zeile ~1730
def start_worker_container(bucket: str, key: str, job_id: str, tool: str):
    # ✅ Retry-Logik ist bereits implementiert (2 Versuche)
    # ✅ Error-Logging in DynamoDB
    
    # Wenn immer noch Fehler: Logs prüfen
    logger.info(f"Enqueuing job {job_id} to SQS...")
```

### Problem 2: Chat liefert alte Videos

**Debug-Script:**
```powershell
# Alle Jobs ohne user_id finden
.\scripts\debug-session.ps1

# Jobs für spezifischen User
.\scripts\debug-session.ps1 -UserId "user-sub-from-cognito"

# Jobs für spezifische Session
.\scripts\debug-session.ps1 -SessionId "session-uuid"
```

**Root Cause:** 
- DynamoDB Scan ohne `user_id` Filter
- Vector DB ohne `user_id` Filter

**Fix:**

```python
# backend/api.py - Zeile ~520
async def call_bedrock_chatbot(message: str, user_id: str = None, session_id: str = None):
    # ✅ user_id wird bereits übergeben
    # ✅ DynamoDB Scan mit user_id Filter
    # ⚠️ Vector DB muss auch filtern!
```

**Testen:**
```powershell
# 1. Video hochladen (User A)
# 2. Chat-Query stellen
# 3. Logs prüfen: "🔒 Filtering search by user_id: ..."

docker-compose -f docker-compose.dev.yml logs -f backend | Select-String "user_id"
```

### Problem 3: Worker verarbeitet Jobs nicht

**Symptome:**
- Jobs bleiben in "queued" Status
- SQS Queue füllt sich
- Keine "running" → "done" Transitions

**Debug:**
```powershell
# Worker Logs live
docker-compose -f docker-compose.dev.yml logs -f worker

# Sollte zeigen:
# "Polling SQS for messages..."
# "Received X messages from SQS"
# "Processing message with job_id=..."
```

**Häufige Ursachen:**
1. **Worker crashed** → Container neu starten
2. **SQS Credentials fehlen** → `.env` prüfen
3. **DynamoDB Timeout** → Logs: "Timeout fetching job"

**Fix:**
```powershell
# Worker neu starten
docker-compose -f docker-compose.dev.yml restart worker
```

---

## 🧪 Testing-Workflow

### 1. Änderung lokal testen

```powershell
# 1. Services starten
.\scripts\dev-start.ps1

# 2. Code in backend/api.py ändern
# 3. Sofort testen: http://localhost:8000/docs
# 4. Logs prüfen: .\scripts\dev-logs.ps1 backend
```

### 2. Mit echten AWS Services testen

```powershell
# Test: Video hochladen und analysieren
curl -X POST http://localhost:8000/analyze `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d @test_video.json

# Logs verfolgen
.\scripts\dev-logs.ps1
```

### 3. Deployment nur wenn lokal funktioniert

```powershell
# Stoppe lokale Services
.\scripts\dev-stop.ps1

# Push zu GitHub
git add .
git commit -m "Fix: Multi-tenant isolation in chat"
git push origin master

# GitHub Actions deployed automatisch
```

---

## 🔧 Häufige Entwicklungsaufgaben

### Neue Abhängigkeit hinzufügen

```powershell
# 1. backend/requirements.txt bearbeiten
# 2. Image neu bauen
docker-compose -f docker-compose.dev.yml build

# 3. Services neu starten
.\scripts\dev-start.ps1
```

### DynamoDB Schema ändern

```python
# Lokal testen mit echtem DynamoDB!
# Keine Emulation nötig - nutzt produktive Tabelle

# ACHTUNG: Entwicklungs-Daten in Production!
# Lösung: Separate Test-Tabelle
os.environ["JOB_TABLE"] = "proov_jobs_dev"
```

### Vector DB testen

```python
# backend/cost_optimized_aws_vector.py
# Läuft lokal aber nutzt echtes DynamoDB

# Test:
python -c "from cost_optimized_aws_vector import CostOptimizedAWSVectorDB; db = CostOptimizedAWSVectorDB(); print(db.semantic_search('BMW'))"
```

---

## 🎯 Best Practices

### 1. Immer lokal testen vor Deployment

```
❌ NICHT: Code ändern → Git Push → 10 Min warten → Fehler → Repeat
✅ BESSER: Code ändern → Lokal testen → Fix → Dann deployen
```

### 2. Logs strukturiert lesen

```powershell
# Nur Errors
docker-compose -f docker-compose.dev.yml logs | Select-String "ERROR"

# Nur user_id related
docker-compose -f docker-compose.dev.yml logs | Select-String "user_id"

# Nur BMW queries
docker-compose -f docker-compose.dev.yml logs | Select-String "BMW"
```

### 3. Debug-Logs aktivieren

```python
# In Code temporär:
logger.setLevel(logging.DEBUG)
logger.debug(f"DEBUG: user_id={user_id}, session_id={session_id}")
```

### 4. DynamoDB Queries testen

```powershell
# Direkt mit AWS CLI
aws dynamodb scan `
  --table-name proov_jobs `
  --filter-expression "user_id = :uid" `
  --expression-attribute-values '{":uid":{"S":"test-user-123"}}' `
  --region eu-central-1
```

---

## 🚨 Troubleshooting

### Docker Container startet nicht

```powershell
# Logs prüfen
docker-compose -f docker-compose.dev.yml logs backend

# Häufige Ursachen:
# 1. Port 8000 bereits belegt → Anderen Port nutzen
# 2. AWS Credentials fehlen → .env prüfen
# 3. Dependencies fehlen → Image neu bauen
```

### Worker bekommt keine Messages

```powershell
# 1. SQS Queue prüfen
.\scripts\debug-queue.ps1

# 2. Worker Logs prüfen
docker-compose -f docker-compose.dev.yml logs -f worker

# 3. Queue URL korrekt?
docker-compose -f docker-compose.dev.yml exec worker env | Select-String "SQS"
```

### Hot Reload funktioniert nicht

```powershell
# 1. Uvicorn läuft mit --reload?
docker-compose -f docker-compose.dev.yml exec backend ps aux | Select-String "uvicorn"

# 2. Volume gemounted?
docker-compose -f docker-compose.dev.yml exec backend ls -la /app

# 3. Neustart erzwingen
docker-compose -f docker-compose.dev.yml restart backend
```

---

## 📊 Vergleich: Vorher vs. Nachher

### Entwicklungszyklus

**Vorher (Cloud-Only):**
```
Code ändern → Git Push → GitHub Actions → ECR Build → ECS Deploy → Testen
⏱️ 5-10 Minuten pro Iteration
```

**Nachher (Hybrid):**
```
Code ändern → Hot Reload → Sofort testen
⏱️ 5 Sekunden pro Iteration
```

### Debugging

**Vorher:**
```
Fehler → CloudWatch Logs durchsuchen → Rate Limited → Keine Breakpoints
```

**Nachher:**
```
Fehler → Echtzeit-Logs → Breakpoints → Schnelle Iteration
```

### Kosteneffizienz

**Vorher:**
- Jede Code-Änderung = ECR Build = $0.10
- 10 Iterationen/Tag = $1.00/Tag
- 20 Arbeitstage = $20/Monat

**Nachher:**
- Lokal entwickeln = $0
- Nur finale Deployments = $0.50/Tag
- 20 Arbeitstage = $10/Monat

**Ersparnis: 50%**

---

## 🎓 Nächste Schritte

1. ✅ **Setup ausführen:** `.\scripts\dev-setup.ps1`
2. ✅ **Services starten:** `.\scripts\dev-start.ps1`
3. ✅ **Ersten Fix testen:** Multi-Tenant Isolation
4. ✅ **Queue-Problem debuggen:** `.\scripts\debug-queue.ps1`
5. ✅ **Deployment nur wenn lokal OK**

---

## 📚 Weiterführende Resourcen

- Docker Compose Docs: https://docs.docker.com/compose/
- AWS CLI Docs: https://docs.aws.amazon.com/cli/
- FastAPI Debugging: https://fastapi.tiangolo.com/tutorial/debugging/
- DynamoDB Best Practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html

---

## 🆘 Support

Bei Problemen:
1. Debug-Scripts ausführen
2. Logs prüfen
3. Docker Container Status: `docker-compose -f docker-compose.dev.yml ps`
4. AWS Connectivity: `aws sts get-caller-identity`
