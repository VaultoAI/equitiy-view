#!/bin/bash

# Comprehensive verification and test script for cache system
# This script verifies code structure and tests endpoints once server is running

BASE_URL="${1:-http://localhost:3000}"
MAX_RETRIES=5
RETRY_DELAY=2

echo "🔍 Cache System Verification & Testing"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint with retries
# expected_status: single code (e.g. 200) or space-separated (e.g. "200 503")
test_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $description... "
    
    for i in $(seq 1 $MAX_RETRIES); do
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if echo " $expected_status " | grep -q " $http_code "; then
            echo -e "${GREEN}✓${NC} (HTTP $http_code)"
            if echo " $expected_status " | grep -q " 200 " && [ "$http_code" = "200" ] && echo "$body" | grep -q "json"; then
                echo "$body" | python3 -m json.tool 2>/dev/null | head -15 || echo "$body" | head -5
            fi
            return 0
        elif [ "$http_code" = "404" ] && [ $i -lt $MAX_RETRIES ]; then
            echo -n "(retry $i/$MAX_RETRIES) "
            sleep $RETRY_DELAY
        else
            echo -e "${RED}✗${NC} (HTTP $http_code)"
            if [ "$http_code" != "404" ]; then
                echo "$body" | head -3
            fi
            return 1
        fi
    done
    
    if [ "$http_code" = "404" ]; then
        echo -e "${YELLOW}⚠ Server may need restart to recognize new routes${NC}"
    fi
    return 1
}

# Verify file structure
echo "1. Verifying file structure..."
files=(
    "app/api/cache/status/route.ts"
    "app/api/cache/refresh/route.ts"
    "app/api/cache/tokenized-stock-pools/route.ts"
    "app/api/cache/solana-pools/route.ts"
    "lib/cache/serverCache.ts"
    "lib/cache/refreshCache.ts"
)

all_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (MISSING)"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    echo -e "\n${RED}Error: Some required files are missing!${NC}"
    exit 1
fi

echo ""
echo "2. Testing endpoints (server must be running)..."
echo ""

# Test cache status endpoint
test_endpoint "$BASE_URL/api/cache/status" "Cache Status Endpoint"

echo ""

# Test cache refresh endpoint
echo "Testing Cache Refresh Endpoint (this may take 30-60 seconds)..."
test_endpoint "$BASE_URL/api/cache/refresh" "Cache Refresh Endpoint" "200"

echo ""

# Wait a bit for cache to be populated
if [ $? -eq 0 ]; then
    echo "Waiting for cache to be populated..."
    sleep 3
    
    # Test cache status again
    test_endpoint "$BASE_URL/api/cache/status" "Cache Status (after refresh)"
    
    echo ""
    
    # Test pool endpoints (tokenized-stock-pools: 200 = OK, 503 = subgraph unavailable)
    test_endpoint "$BASE_URL/api/cache/tokenized-stock-pools" "Tokenized Stock Pools Endpoint" "200 503"
    echo ""
    test_endpoint "$BASE_URL/api/cache/solana-pools" "Solana Pools Endpoint"
fi

echo ""
echo "======================================"
echo "✅ Verification complete!"
echo ""
echo "If endpoints returned 404, restart the server:"
echo "  npm run dev"
echo ""
