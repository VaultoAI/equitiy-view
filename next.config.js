/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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


