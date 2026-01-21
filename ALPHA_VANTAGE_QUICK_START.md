# 🚀 Alpha Vantage Quick Start

## ✅ Implementation Status: COMPLETE

---

## 📝 What You Need to Do (3 Steps)

### 1. Get API Key (2 minutes)

Visit: **https://www.alphavantage.co/support/#api-key**

Fill out form → Get instant free API key

### 2. Add to Environment (30 seconds)

```bash
# Edit .env.local
nano .env.local

# Replace this line:
ALPHA_VANTAGE_API_KEY=demo

# With your real key:
ALPHA_VANTAGE_API_KEY=ABC123XYZ456
```

### 3. Restart Server (10 seconds)

```bash
# In terminal with dev server running:
Ctrl+C  (stop)
npm run dev  (restart)
```

---

## ✅ Verification

### Quick Test

```bash
# Should return today's price with "source": "alphavantage"
curl "http://localhost:3000/api/stock-price?ticker=AAPL" | jq '.source'
```

Expected: `"alphavantage"`

### Check Logs

```bash
tail -20 ~/.cursor/projects/Users-charliebc-Vaulto-Earn/terminals/1.txt | grep "Alpha Vantage"
```

Should see: `✅ [Alpha Vantage] Got quote for AAPL: $XXX.XX (2026-01-20)`

---

## 🎯 What This Fixes

| Before | After |
|--------|-------|
| ❌ Jan 17 (Fri): Missing | ✅ Jan 17: $255.51 |
| ❌ Jan 20 (Mon): Missing | ✅ Jan 20: $258.45 |
| ❌ Data 5+ days old | ✅ Data 15 min old |

---

## 🆘 Troubleshooting

**Problem**: Still showing old data  
**Solution**: Hard refresh browser (`Cmd+Shift+R`)

**Problem**: "API key not set"  
**Solution**: Check `.env.local` exists and has key, restart server

**Problem**: "Rate limit"  
**Solution**: Free tier = 25 calls/day. Caching should keep you under this.

---

## 📚 More Info

- **Full Setup Guide**: `ALPHA_VANTAGE_SETUP.md`
- **Implementation Details**: `ALPHA_VANTAGE_IMPLEMENTATION_COMPLETE.md`

---

**Time to Complete**: < 5 minutes  
**Cost**: $0 (free tier)  
**Result**: Fresh stock data!
