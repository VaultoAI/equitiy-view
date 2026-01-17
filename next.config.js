/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Disable Image Optimization for Netlify static deployment
  // This prevents 400 errors from /_next/image endpoint
  images: {
    unoptimized: true,
  },
  
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Suppress warnings for optional dependencies that aren't needed in web builds
    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { module: /node_modules\/pino/ },
    ];
    
    return config;
  },
};

module.exports = nextConfig;


