#!/bin/bash

# Quick Deploy Script for Image Optimization Fix
# Run this to commit and prepare for deployment

echo "🚀 Image Optimization Fix - Quick Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "next.config.js" ]; then
  echo "❌ Error: Must run from project root (where next.config.js is located)"
  exit 1
fi

# Show what files will be committed
echo "📁 Files to be committed:"
echo "   - next.config.js (added images.unoptimized)"
echo "   - netlify.toml (added /_next/image redirect)"
echo "   - IMAGE_OPTIMIZATION_FIX.md (documentation)"
echo "   - IMAGE_FIX_DEPLOYMENT_CHECKLIST.md (checklist)"
echo "   - IMAGE_FIX_SUMMARY.md (summary)"
echo "   - verify-images.sh (verification script)"
echo "   - deploy-image-fix.sh (this script)"
echo ""

# Verify images exist
echo "🔍 Verifying all images exist..."
./verify-images.sh
if [ $? -ne 0 ]; then
  echo "❌ Image verification failed. Please check the output above."
  exit 1
fi
echo ""

# Test build
echo "🔨 Testing build..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please run 'npm run build' to see errors."
  exit 1
fi
echo "✅ Build successful"
echo ""

# Show git status
echo "📊 Current git status:"
git status --short
echo ""

# Prompt for confirmation
read -p "Do you want to commit these changes? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Add files
git add next.config.js \
        netlify.toml \
        IMAGE_OPTIMIZATION_FIX.md \
        IMAGE_FIX_DEPLOYMENT_CHECKLIST.md \
        IMAGE_FIX_SUMMARY.md \
        verify-images.sh \
        deploy-image-fix.sh

# Commit
git commit -m "fix: disable Next.js image optimization for Netlify static hosting

- Add images.unoptimized config to next.config.js
- Block /_next/image requests in netlify.toml  
- Fixes 400 errors for all image assets (vaultodark.png, vaultolight.png, nav icons)
- All images now load directly from /public folder
- Includes comprehensive documentation and verification scripts

Root Cause: Next.js Image Optimization API requires Node.js server runtime,
which is not available on Netlify static hosting. This caused 400 errors
for all /_next/image requests.

Solution: Disable optimization (images.unoptimized: true) so images load
directly from /public folder without needing the optimization endpoint.

Tested:
- ✅ Build completes successfully
- ✅ All 13 images verified present
- ✅ No linter errors

After deployment, verify:
- No 400 errors in console
- All images display correctly
- Check both light/dark mode logos"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Changes committed successfully!"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Next Steps:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1. Push to remote:"
  echo "   git push origin main"
  echo ""
  echo "2. Netlify will automatically deploy"
  echo ""
  echo "3. After deployment, verify at https://stake.vaulto.ai:"
  echo "   - Open DevTools → Console"
  echo "   - Should see NO 400 errors"
  echo "   - All images should display correctly"
  echo "   - Check Network tab: images load from /vaultodark.png (not /_next/image)"
  echo ""
  echo "4. Test checklist:"
  echo "   - [ ] Logo appears (light/dark mode)"
  echo "   - [ ] Navigation icons display (ETH, SOL)"
  echo "   - [ ] Mobile view works"
  echo "   - [ ] Console is clean"
  echo ""
  echo "📚 Documentation available in:"
  echo "   - IMAGE_FIX_SUMMARY.md (quick overview)"
  echo "   - IMAGE_OPTIMIZATION_FIX.md (technical details)"
  echo "   - IMAGE_FIX_DEPLOYMENT_CHECKLIST.md (full checklist)"
  echo ""
else
  echo "❌ Commit failed"
  exit 1
fi
