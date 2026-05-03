/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@estoque/db', '@estoque/shared', '@estoque/ui'],
  output: 'standalone',
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
