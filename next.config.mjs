import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['mupdf', 'pg', 'bullmq', 'undici'],
  },
  webpack: (config) => {
    // Tambahkan alias @lib → root/lib/ agar Next.js webpack bisa resolve
    config.resolve.alias['@lib'] = path.resolve(__dirname, 'lib');
    return config;
  },
};

export default nextConfig;
