#!/bin/bash

# Image Verification Script
# Checks that all referenced images exist in the public folder

echo "🖼️  Verifying image files..."
echo ""

MISSING=0
FOUND=0

# Array of images to check
declare -a images=(
  "public/vaultodark.png"
  "public/vaultolight.png"
  "public/nav-icons/ethicon.png"
  "public/nav-icons/solicon.png"
  "public/nav-icons/Power-icon.png"
  "public/favicon.png"
  "public/solana/anduril.webp"
  "public/solana/anthropic.webp"
  "public/solana/openai.webp"
  "public/solana/solana-sol-logo-png_seeklogo-423095.png"
  "public/solana/spacex.webp"
  "public/solana/USD_Coin_logo.png"
  "public/solana/xai.webp"
)

# Check each image
for img in "${images[@]}"; do
  if [ -f "$img" ]; then
    echo "✅ Found: $img"
    ((FOUND++))
  else
    echo "❌ Missing: $img"
    ((MISSING++))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "  Found: $FOUND"
echo "  Missing: $MISSING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $MISSING -eq 0 ]; then
  echo "🎉 All images verified successfully!"
  exit 0
else
  echo "⚠️  Some images are missing. Please add them to the public folder."
  exit 1
fi
