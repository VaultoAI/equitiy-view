#!/bin/bash

# Test script for cache refresh and status
# Usage: ./test-cache.sh [base_url]
# Example: ./test-cache.sh http://localhost:3000

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Testing Cache System"
echo "======================"
echo ""

echo "1. Checking cache status (before refresh)..."
curl -s "${BASE_URL}/api/cache/status" | jq '.' || echo "Failed to get cache status"
echo ""
echo ""

echo "2. Triggering cache refresh..."
REFRESH_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/cache/refresh")
echo "$REFRESH_RESPONSE" | jq '.' || echo "$REFRESH_RESPONSE"
echo ""
echo ""

echo "3. Checking cache status (after refresh)..."
sleep 2
curl -s "${BASE_URL}/api/cache/status" | jq '.' || echo "Failed to get cache status"
echo ""
echo ""

echo "4. Testing tokenized stock pools endpoint..."
curl -s "${BASE_URL}/api/cache/tokenized-stock-pools" | jq '.pools | length' && echo " pools found" || echo "Failed or no cache"
echo ""

echo "5. Testing Solana pools endpoint..."
curl -s "${BASE_URL}/api/cache/solana-pools" | jq '.pools | length' && echo " pools found" || echo "Failed or no cache"
echo ""

echo "✅ Test complete!"
