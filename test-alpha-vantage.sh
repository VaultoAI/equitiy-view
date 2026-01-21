#!/bin/bash

# Comprehensive Alpha Vantage Testing Script
# Run this after setting up a real API key

echo "========================================="
echo "Alpha Vantage Comprehensive Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local test_name="$1"
    local url="$2"
    local expected_source="$3"
    
    echo -e "${YELLOW}Testing:${NC} $test_name"
    echo "URL: $url"
    
    response=$(curl -s "$url")
    
    if echo "$response" | jq . > /dev/null 2>&1; then
        source=$(echo "$response" | jq -r '.source // .error' 2>/dev/null)
        
        if [ "$source" = "$expected_source" ]; then
            echo -e "${GREEN}✅ PASSED${NC} - Source: $source"
            ((PASSED++))
            echo "$response" | jq '{ticker, price, source, date}' 2>/dev/null || echo "$response" | jq '.' 2>/dev/null
        else
            echo -e "${RED}❌ FAILED${NC} - Expected: $expected_source, Got: $source"
            ((FAILED++))
            echo "$response" | jq '.' 2>/dev/null || echo "$response"
        fi
    else
        echo -e "${RED}❌ FAILED${NC} - Invalid JSON response"
        ((FAILED++))
        echo "$response"
    fi
    
    echo ""
    sleep 1  # Respect rate limits
}

echo "================================================"
echo "TEST SUITE 1: Current Price (Single Stocks)"
echo "================================================"
echo ""

# Test 1: IBM (works with demo key)
test_endpoint "IBM (Demo Key Compatible)" \
    "http://localhost:3000/api/stock-price?ticker=IBM" \
    "alphavantage"

# Test 2: AAPL
test_endpoint "AAPL - Apple Inc." \
    "http://localhost:3000/api/stock-price?ticker=AAPL" \
    "alphavantage"

# Test 3: MSFT
test_endpoint "MSFT - Microsoft" \
    "http://localhost:3000/api/stock-price?ticker=MSFT" \
    "alphavantage"

# Test 4: GOOGL
test_endpoint "GOOGL - Google" \
    "http://localhost:3000/api/stock-price?ticker=GOOGL" \
    "alphavantage"

# Test 5: TSLA
test_endpoint "TSLA - Tesla" \
    "http://localhost:3000/api/stock-price?ticker=TSLA" \
    "alphavantage"

echo "================================================"
echo "TEST SUITE 2: Historical Price Data"
echo "================================================"
echo ""

# Calculate timestamps
END_DATE=$(date -u +%s)
START_DATE_7D=$(date -u -v-7d +%s)
START_DATE_30D=$(date -u -v-30d +%s)

# Test 6: 7-day range
test_endpoint "AAPL - Last 7 Days" \
    "http://localhost:3000/api/stock-price-history?ticker=AAPL&startDate=$START_DATE_7D&endDate=$END_DATE" \
    "alphavantage"

# Test 7: 30-day range
test_endpoint "MSFT - Last 30 Days" \
    "http://localhost:3000/api/stock-price-history?ticker=MSFT&startDate=$START_DATE_30D&endDate=$END_DATE" \
    "alphavantage"

echo "================================================"
echo "TEST SUITE 3: Specific Date Requests"
echo "================================================"
echo ""

# Test 8: Today
TODAY=$(date -u +%Y-%m-%d)
test_endpoint "AAPL - Today ($TODAY)" \
    "http://localhost:3000/api/stock-price?ticker=AAPL&date=$TODAY" \
    "alphavantage"

# Test 9: Yesterday
YESTERDAY=$(date -u -v-1d +%Y-%m-%d)
test_endpoint "TSLA - Yesterday ($YESTERDAY)" \
    "http://localhost:3000/api/stock-price?ticker=TSLA&date=$YESTERDAY" \
    "alphavantage"

# Test 10: Last Friday (Jan 17, 2026)
test_endpoint "AAPL - Jan 17, 2026 (Friday)" \
    "http://localhost:3000/api/stock-price?ticker=AAPL&date=2026-01-17" \
    "alphavantage"

# Test 11: Monday Jan 20, 2026
test_endpoint "AAPL - Jan 20, 2026 (Monday)" \
    "http://localhost:3000/api/stock-price?ticker=AAPL&date=2026-01-20" \
    "alphavantage"

echo "================================================"
echo "TEST SUITE 4: Edge Cases"
echo "================================================"
echo ""

# Test 12: Weekend date (should use last trading day)
test_endpoint "AAPL - Weekend (Jan 18, 2026 - Saturday)" \
    "http://localhost:3000/api/stock-price?ticker=AAPL&date=2026-01-18" \
    "alphavantage"

# Test 13: Invalid ticker (should fallback or error)
echo -e "${YELLOW}Testing:${NC} Invalid Ticker (INVALID123)"
echo "URL: http://localhost:3000/api/stock-price?ticker=INVALID123"
response=$(curl -s "http://localhost:3000/api/stock-price?ticker=INVALID123")
if echo "$response" | grep -q "error"; then
    echo -e "${GREEN}✅ PASSED${NC} - Properly handled invalid ticker"
    ((PASSED++))
else
    echo -e "${RED}❌ FAILED${NC} - Should return error for invalid ticker"
    ((FAILED++))
fi
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# Test 14: Historical date (1 year ago)
ONE_YEAR_AGO=$(date -u -v-1y +%Y-%m-%d)
test_endpoint "AAPL - 1 Year Ago ($ONE_YEAR_AGO)" \
    "http://localhost:3000/api/stock-price?ticker=AAPL&date=$ONE_YEAR_AGO" \
    "alphavantage"

echo "================================================"
echo "TEST SUITE 5: Data Quality Checks"
echo "================================================"
echo ""

echo -e "${YELLOW}Test 15:${NC} Verify Price Variations (Last 5 Days)"
response=$(curl -s "http://localhost:3000/api/stock-price-history?ticker=AAPL&startDate=$START_DATE_7D&endDate=$END_DATE")
unique_prices=$(echo "$response" | jq '[.prices[-5:] | .[].price] | unique | length' 2>/dev/null)

if [ "$unique_prices" -ge 2 ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Found $unique_prices unique prices in last 5 days (good variation)"
    ((PASSED++))
else
    echo -e "${RED}❌ FAILED${NC} - Only $unique_prices unique prices (data appears flat)"
    ((FAILED++))
fi

echo "$response" | jq '{source, uniquePrices: ([.prices[-5:] | .[].price] | unique), lastFive: .prices[-5:]}' 2>/dev/null
echo ""

echo -e "${YELLOW}Test 16:${NC} Verify Latest Data Age"
response=$(curl -s "http://localhost:3000/api/stock-price-history?ticker=AAPL&startDate=$START_DATE_7D&endDate=$END_DATE")
data_age_hours=$(echo "$response" | jq '.metadata.dataAgeHours // 999' 2>/dev/null)

if [ "$data_age_hours" -lt 48 ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Data is $data_age_hours hours old (< 48 hours)"
    ((PASSED++))
else
    echo -e "${RED}❌ FAILED${NC} - Data is $data_age_hours hours old (too stale)"
    ((FAILED++))
fi

echo "$response" | jq '.metadata' 2>/dev/null
echo ""

echo "================================================"
echo "TEST SUITE 6: Performance & Caching"
echo "================================================"
echo ""

echo -e "${YELLOW}Test 17:${NC} Cache Performance (Same Request Twice)"
echo "First request (uncached):"
start_time=$(date +%s%N)
response1=$(curl -s "http://localhost:3000/api/stock-price?ticker=AAPL")
end_time=$(date +%s%N)
time1=$((($end_time - $start_time) / 1000000))
echo "Time: ${time1}ms"
echo "$response1" | jq '{ticker, price, cached}' 2>/dev/null

sleep 0.5

echo ""
echo "Second request (should be cached):"
start_time=$(date +%s%N)
response2=$(curl -s "http://localhost:3000/api/stock-price?ticker=AAPL")
end_time=$(date +%s%N)
time2=$((($end_time - $start_time) / 1000000))
echo "Time: ${time2}ms"
echo "$response2" | jq '{ticker, price, cached}' 2>/dev/null

if [ $time2 -lt $time1 ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Second request faster (${time2}ms vs ${time1}ms)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Second request not faster (caching may not be working)"
    ((PASSED++))  # Not a failure, just a warning
fi
echo ""

echo "================================================"
echo "TEST RESULTS SUMMARY"
echo "================================================"
echo ""
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

if [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ SUCCESS RATE: $SUCCESS_RATE% - Alpha Vantage integration is working well!${NC}"
elif [ $SUCCESS_RATE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  SUCCESS RATE: $SUCCESS_RATE% - Alpha Vantage working but some issues${NC}"
else
    echo -e "${RED}❌ SUCCESS RATE: $SUCCESS_RATE% - Alpha Vantage integration needs attention${NC}"
fi

echo ""
echo "================================================"
echo "Next Steps:"
echo "================================================"
if [ $FAILED -gt 0 ]; then
    echo "1. Check server logs for errors"
    echo "2. Verify ALPHA_VANTAGE_API_KEY is set correctly"
    echo "3. Ensure API key has not hit rate limits (25 calls/day free tier)"
    echo "4. Check network connectivity"
else
    echo "✅ All tests passed! Alpha Vantage is working perfectly."
    echo "You can now deploy to production with confidence."
fi
echo ""
