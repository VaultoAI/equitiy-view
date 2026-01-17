/**
 * Netlify Function: StockData.org API Proxy
 * 
 * This serverless function acts as a secure proxy to the StockData.org API.
 * It handles authentication with the API token and adds CORS headers to responses.
 * 
 * Environment Variables Required:
 * - STOCKDATA_ORG_API_TOKEN: Your API token from https://www.stockdata.org/
 */

const https = require('https');
const { URL } = require('url');

/**
 * Main handler function
 */
exports.handler = async function(event, context) {
  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed. Only GET requests are supported.' }),
    };
  }

  // Extract query parameters
  const { symbol, date_from, date_to } = event.queryStringParameters || {};

  // Validate required parameters
  if (!symbol) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Symbol parameter is required' }),
    };
  }

  // Check for API token in environment
  const apiToken = process.env.STOCKDATA_ORG_API_TOKEN;
  if (!apiToken) {
    console.error('❌ [StockData Proxy] STOCKDATA_ORG_API_TOKEN environment variable is not set');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'API token not configured. Please contact support.' }),
    };
  }

  // Build API URL
  const baseUrl = 'https://api.stockdata.org/v1/data/eod';
  const params = new URLSearchParams({
    api_token: apiToken,
    symbols: symbol.toUpperCase(),
    interval: 'day',
    sort: 'asc',
  });

  // Add optional date parameters
  if (date_from) {
    params.append('date_from', date_from);
  }
  if (date_to) {
    params.append('date_to', date_to);
  }

  const apiUrl = `${baseUrl}?${params.toString()}`;

  console.log(`📊 [StockData Proxy] Fetching data for ${symbol}${date_from ? ` from ${date_from}` : ''}${date_to ? ` to ${date_to}` : ''}`);

  try {
    // Make request to StockData.org API
    const apiResponse = await makeHttpsRequest(apiUrl);

    console.log(`✅ [StockData Proxy] Successfully fetched data for ${symbol}`);

    // Return response with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: apiResponse,
    };
  } catch (error) {
    console.error(`❌ [StockData Proxy] Error fetching data for ${symbol}:`, error.message);

    // Determine appropriate status code based on error
    let statusCode = 500;
    let errorMessage = 'Failed to fetch stock data';

    if (error.statusCode) {
      statusCode = error.statusCode;
    }

    if (error.message) {
      errorMessage = error.message;
    }

    // Handle specific error types
    if (error.message && error.message.includes('Invalid symbol')) {
      statusCode = 404;
      errorMessage = `Invalid ticker or no data available: ${symbol}`;
    } else if (error.message && (error.message.includes('rate limit') || error.message.includes('429'))) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (error.message && (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))) {
      statusCode = 504;
      errorMessage = 'Request timeout. Please try again.';
    }

    return {
      statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};

/**
 * Makes an HTTPS request and returns the response body
 * @param {string} url - The URL to request
 * @returns {Promise<string>} Response body
 */
function makeHttpsRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Vaulto-Earn/1.0',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          const error = new Error(`API request failed with status ${res.statusCode}`);
          error.statusCode = res.statusCode;
          
          try {
            const errorData = JSON.parse(data);
            if (errorData.error || errorData.message) {
              error.message = errorData.error || errorData.message;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
          
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Set timeout (30 seconds)
    req.setTimeout(30000);

    req.end();
  });
}
