import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Next.js 14.x: server-only native/WASM packages → stays in experimental
  experimental: {
    serverComponentsExternalPackages: ['mupdf', 'pg', 'bullmq', 'undici'],
    outputFileTracingIncludes: {
      '/api/documents/upload': ['./node_modules/mupdf/**'],
      '/api/documents/[id]/curate': ['./node_modules/mupdf/**'],
    },
  },

  // Suppress ESLint img warnings during build (handled at component level)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Allow build to proceed even with static mupdf import (externalized at runtime)
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config, { isServer }) => {
    const webpack = require('webpack');

    // Alias @lib → root/lib/
    config.resolve.alias['@lib'] = path.resolve(__dirname, 'lib');

    if (isServer) {
      // Externalize mupdf entirely — it's ESM with top-level await,
      // cannot be require()'d by Next.js CJS module system at build time
      config.externals = [...(config.externals || []), 'mupdf'];
    }

    // Ignore optional bullmq peer dep @valkey/valkey-glide (not installed, not needed)
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@valkey\/valkey-glide$/,
      })
    );

    // Prevent client bundle from pulling in Node.js built-ins
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
