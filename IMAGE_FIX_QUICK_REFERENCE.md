# 🎯 Image Fix - Quick Reference

## Problem
```
❌ GET /_next/image?url=%2Fvaultodark.png 400 (Bad Request)
❌ Images broken on Netlify deployment
```

## Cause
Next.js Image Optimization API needs Node.js server → Netlify uses static export → No `/_next/image` endpoint exists

## Solution
```javascript
// next.config.js
images: { unoptimized: true }
```

## Files Changed
- ✅ `next.config.js` - Disable image optimization
- ✅ `netlify.toml` - Block `/_next/image` requests
- ✅ Documentation created

## Deploy

### Option 1: Automated (Recommended)
```bash
./deploy-image-fix.sh
git push origin main
```

### Option 2: Manual
```bash
git add next.config.js netlify.toml *.md *.sh
git commit -m "fix: disable Next.js image optimization for Netlify"
git push origin main
```

## Verify After Deploy

1. Open https://stake.vaulto.ai
2. DevTools → Console → Should be clean ✅
3. Network → Img → Images load from `/vaultodark.png` (not `/_next/image`) ✅
4. Check logo displays (light/dark mode) ✅
5. Check nav icons (ETH, SOL) ✅

## Documentation

- `IMAGE_FIX_SUMMARY.md` → Overview
- `IMAGE_OPTIMIZATION_FIX.md` → Technical details
- `IMAGE_FIX_DEPLOYMENT_CHECKLIST.md` → Full checklist

## Status
✅ **READY TO DEPLOY** - Build tested, images verified, no errors

---

**Quick Test**: Run `./verify-images.sh` to check all images exist  
**Quick Deploy**: Run `./deploy-image-fix.sh` to commit changes
