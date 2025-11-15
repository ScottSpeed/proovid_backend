# 🔧 Quick Fix: Multi-Tenant Isolation
# Dieses Script analysiert und behebt das Problem, dass Chat alte Videos ausliefert

Write-Host "🔒 Multi-Tenant Isolation Fix" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. Problem identifizieren
Write-Host "`n1. Analyzing current issues..." -ForegroundColor Yellow

# Check: Jobs ohne user_id
$missingUserId = aws dynamodb scan `
    --table-name proov_jobs `
    --filter-expression "attribute_not_exists(user_id)" `
    --region eu-central-1 `
    --output json 2>$null | ConvertFrom-Json

if ($missingUserId.Items.Count -gt 0) {
    Write-Host "   ❌ Found $($missingUserId.Items.Count) jobs WITHOUT user_id!" -ForegroundColor Red
    Write-Host "   These jobs will appear in ALL user searches!" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ All jobs have user_id" -ForegroundColor Green
}

# Check: Vector DB entries
Write-Host "`n2. Checking Vector DB isolation..." -ForegroundColor Yellow
Write-Host "   Run this test query locally:" -ForegroundColor Cyan
Write-Host "   curl http://localhost:8000/chat -H 'Authorization: Bearer TOKEN' -d '{""message"":""BMW""}'" -ForegroundColor White

# 3. Fix-Vorschläge
Write-Host "`n3. Required code fixes:" -ForegroundColor Yellow

Write-Host "`n   ✅ ALREADY FIXED in api.py:" -ForegroundColor Green
Write-Host "   - Line ~520: call_bedrock_chatbot accepts user_id" -ForegroundColor White
Write-Host "   - Line ~1348: save_job_entry saves user_id & session_id" -ForegroundColor White
Write-Host "   - Line ~2090: /analyze endpoint passes user info" -ForegroundColor White

Write-Host "`n   ⚠️  NEEDS VERIFICATION:" -ForegroundColor Yellow
Write-Host "   - Vector DB search MUST filter by user_id" -ForegroundColor White
Write-Host "   - DynamoDB scan MUST use user_id in FilterExpression" -ForegroundColor White

# 4. Test-Plan
Write-Host "`n4. Testing steps:" -ForegroundColor Yellow
Write-Host "   1. Start local dev: .\scripts\dev-start.ps1" -ForegroundColor White
Write-Host "   2. Upload video as User A" -ForegroundColor White
Write-Host "   3. Query: 'Welche Videos habe ich?'" -ForegroundColor White
Write-Host "   4. Check logs: Should ONLY show User A's videos" -ForegroundColor White
Write-Host "   5. Login as User B" -ForegroundColor White
Write-Host "   6. Query: 'Welche Videos habe ich?'" -ForegroundColor White
Write-Host "   7. Check logs: Should show EMPTY or User B's videos" -ForegroundColor White

# 5. Log grep commands
Write-Host "`n5. Debug commands:" -ForegroundColor Yellow
Write-Host "   # Watch for user_id filtering" -ForegroundColor Cyan
Write-Host "   docker-compose -f docker-compose.dev.yml logs -f | Select-String 'user_id'" -ForegroundColor White
Write-Host ""
Write-Host "   # Watch chat queries" -ForegroundColor Cyan
Write-Host "   docker-compose -f docker-compose.dev.yml logs -f | Select-String 'Chat request'" -ForegroundColor White

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review code changes in backend/api.py" -ForegroundColor White
Write-Host "2. Start local dev and test" -ForegroundColor White
Write-Host "3. Monitor logs for user_id filtering" -ForegroundColor White
Write-Host "4. Deploy only after local verification" -ForegroundColor White
