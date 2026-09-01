/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['mupdf', 'pg', 'bullmq'],
  },
};

export default nextConfig;

