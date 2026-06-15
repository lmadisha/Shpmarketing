import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { version } = JSON.parse(readFileSync(resolve('./package.json'), 'utf-8')) as { version: string }

export default defineNuxtConfig({
  devtools: { enabled: false },

  ssr: false,

  experimental: {
    viteEnvironmentApi: true,
  },

  devServer: {
    // HTTPS by default for local dev; set NUXT_DEV_HTTPS=false to serve plain
    // HTTP (e.g. for headless preview/screenshot tools that reject self-signed certs).
    https: process.env.NUXT_DEV_HTTPS !== 'false',
  },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
  ],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'lucide-vue-next',
        '@vueuse/core',
      ]
    }
  },

  runtimeConfig: {
    public: {
      operationsApiBase: 'http://localhost:5001',
      appVersion: version,
      analyticsApiBase: 'http://localhost:5002',
    },
  },

  css: ['~/assets/css/index.css'],

  colorMode: {
    preference: 'light',
    classSuffix: '',
  },

  imports: {
    dirs: ['stores'],
  },
})
