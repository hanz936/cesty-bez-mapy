/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { Plugin, Rollup } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { umamiPlugin } from './vite/umami-plugin.js'

// Pre-compiled regex for better performance
const MEDIA_REGEX = /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i;
const IMAGE_REGEX = /\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;
const FONT_REGEX = /\.(woff2?|eot|ttf|otf)(\?.*)?$/i;

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Vercel base path (root deployment)
  plugins: [
    react({
      // React optimization - babel config removed, using esbuild drop instead
    }),
    tailwindcss(),
    sentryVitePlugin({
      org: 'cesty-bez-mapy',
      project: 'cesty-bez-mapy-web',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      disable: !process.env.SENTRY_AUTH_TOKEN, // active only on CI/Vercel, not local
    }),
    // Type assertion: umami-plugin.js stays plain JS (out of TS migration scope), so its
    // inferred return type widens `apply: 'build'` to `apply: string`, which doesn't
    // structurally match Vite's Plugin['apply']. No runtime change — the plugin object
    // itself is untouched; only the type-checker's view of it is corrected here.
    umamiPlugin() as Plugin,
  ],

  // Development server optimization
  server: {
    port: 3000,
    open: true,
    cors: true,
    hmr: {
      overlay: false, // Disable error overlay for better UX
    },
    // Security headers for development
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },

  // Preview server configuration
  preview: {
    port: 4173,
    open: true,
    // Security headers for preview
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
  },

  // Build optimization
  build: {
    target: 'esnext', // Modern browsers
    minify: 'esbuild', // Fast minification
    cssMinify: true,
    sourcemap: 'hidden', // emit maps for Sentry upload but omit //# sourceMappingURL (maps deleted after upload; avoids 404s)
    
    // Output directory
    outDir: 'dist',
    assetsDir: 'assets',
    
    // Bundle optimization
    rollupOptions: {
      output: {
        // Chunk splitting for better caching
        manualChunks(id: string) {
          // react + react-dom + react-router(-dom) pohromadě (init-order).
          // Funkční forma — objektová generovala prázdný react-vendor chunk.
          // Žádný catch-all vendor: eager-loadl by deps lazy app-flow rout (#5189).
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router') // react-router i react-router-dom
          ) {
            return 'react-vendor'
          }
        },
        
        // Asset naming for better caching
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          try {
            // Use modern Rollup API - assetInfo.fileName is the standard way
            // TS strict note (Task 3 latent finding): Rollup 4's PreRenderedAsset type
            // does not declare `fileName` (only deprecated `name`/`names`,
            // `originalFileName(s)`, `source`, `type`) — the property access below has
            // therefore always been `undefined` at the type level; cast preserves the
            // exact pre-existing runtime behavior (including the 'unknown' fallback).
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string/falsy must fall through to fallback (?? would change behavior)
            const fileName = (assetInfo as Rollup.PreRenderedAsset & { fileName?: string }).fileName || 'unknown';
            
            // Pre-compiled regex for better performance
            if (MEDIA_REGEX.test(fileName)) {
              return 'media/[name]-[hash][extname]';
            }
            if (IMAGE_REGEX.test(fileName)) {
              return 'images/[name]-[hash][extname]';
            }
            if (FONT_REGEX.test(fileName)) {
              return 'fonts/[name]-[hash][extname]';
            }
            
            return 'assets/[name]-[hash][extname]';
          } catch (error) {
            console.warn('Asset naming error:', error);
            return 'assets/[name]-[hash][extname]';
          }
        },
      },
    },
    
    // Chunk size warning
    chunkSizeWarningLimit: 1000,
    
    // Asset optimization
    assetsInlineLimit: 4096, // 4kb inline limit
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
    ],
    exclude: [
      // Exclude large dependencies that should be loaded separately
    ],
  },

  // CSS optimization
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      // Add global CSS imports if needed
    },
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },

  // Environment variables
  define: {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string/falsy must fall through to fallback (?? would change behavior)
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA),
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV),
  },

  // Testing configuration (Vitest)
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    // Edge Function tests use https:// imports and run under `deno test`, not Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'supabase/functions/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}',
        'vite.config.js',
        'eslint.config.js',
      ],
    },
  },

  // Performance optimization
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})