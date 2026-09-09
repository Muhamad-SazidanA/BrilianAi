import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Next.js 14.x — packages excluded from Server Components bundle
  experimental: {
    serverComponentsExternalPackages: ['mupdf', 'pg', 'bullmq', 'undici'],
  },

  // Suppress ESLint during Docker build (img warnings etc. handled at component level)
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { isServer }) => {
    const webpack = require('webpack');

    // Alias @lib → root/lib/
    config.resolve.alias['@lib'] = path.resolve(__dirname, 'lib');

    if (isServer) {
      // mupdf is an ESM module with top-level await.
      // Next.js 14 "Collecting page data" step uses require() which cannot
      // handle ESM + top-level await (ERR_REQUIRE_ASYNC_MODULE).
      //
      // Solution: declare mupdf as an ESM external so webpack emits
      //   import('mupdf') instead of require('mupdf') at runtime.
      //
      // This requires experiments.outputModule support. Since Next.js uses
      // CJS output for server bundles, we use a custom externals function
      // that returns 'node-commonjs' for mupdf so it stays as a plain
      // Node.js require — but combined with serverComponentsExternalPackages
      // above, the actual loading is deferred to Node.js natively.
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        ...existingExternals,
        // Externalize mupdf and all its sub-paths
        ({ request }: { request: string }, callback: Function) => {
          if (request === 'mupdf' || request.startsWith('mupdf/')) {
            // Return as commonjs external — Node loads it natively via require()
            // which works because serverComponentsExternalPackages already marks
            // this module to not be bundled by webpack at all.
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }

    // Ignore optional bullmq peer dep @valkey/valkey-glide
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
