import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Next.js 14.2+: top-level (NOT inside experimental)
  // Prevents webpack from bundling server-only native/WASM packages
  serverExternalPackages: ['mupdf', 'pg', 'bullmq', 'undici'],

  webpack: (config, { isServer }) => {
    // Alias @lib → root/lib/
    config.resolve.alias['@lib'] = path.resolve(__dirname, 'lib');

    // Extra safety: explicitly externalize mupdf on server to avoid WASM bundling errors
    if (isServer) {
      config.externals = [...(config.externals || []), 'mupdf'];
    }

    // Prevent client-side bundle from trying to resolve Node.js built-ins
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    return config;
  },
};

export default nextConfig;
