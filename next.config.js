/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Disable Image Optimization for Netlify static deployment
  // This prevents 400 errors from /_next/image endpoint
  images: {
    unoptimized: true,
  },
  
  webpack: (config, { isServer }) => {
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
      { module: /shared-memory-mcp/ },
    ];
    
    // Exclude shared-memory-mcp directory from compilation
    if (!isServer) {
      config.module.rules.push({
        test: /\.ts$/,
        include: /shared-memory-mcp/,
        loader: 'ignore-loader',
      });
    }
    
    return config;
  },
};

module.exports = nextConfig;


