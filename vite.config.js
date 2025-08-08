import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Pre-compiled regex for better performance
const MEDIA_REGEX = /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i;
const IMAGE_REGEX = /\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;
const FONT_REGEX = /\.(woff2?|eot|ttf|otf)(\?.*)?$/i;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // React optimization - babel config removed, using esbuild drop instead
    }),
    tailwindcss(),
  ],

  // Development server optimization
  server: {
    port: 3000,
    open: true,
    cors: true,
    hmr: {
      overlay: false, // Disable error overlay for better UX
    },
  },

  // Preview server configuration
  preview: {
    port: 4173,
    open: true,
  },

  // Build optimization
  build: {
    target: 'esnext', // Modern browsers
    minify: 'esbuild', // Fast minification
    cssMinify: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    
    // Output directory
    outDir: 'dist',
    assetsDir: 'assets',
    
    // Bundle optimization
    rollupOptions: {
      output: {
        // Chunk splitting for better caching
        manualChunks: {
          // React vendor chunk
          'react-vendor': ['react', 'react-dom'],
          // Router chunk
          'router': ['react-router-dom'],
        },
        
        // Asset naming for better caching
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          try {
            // Use modern Rollup API - assetInfo.fileName is the standard way
            const fileName = assetInfo.fileName || 'unknown';
            
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
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },

  // Testing configuration (Vitest)
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}',
        'vite.config.js',
        'tailwind.config.js',
        'eslint.config.js',
      ],
    },
  },

  // Performance optimization
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})