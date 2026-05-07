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
    https: true,
  },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    public: {
      operationsApiBase: 'http://localhost:5001',
      appVersion: version,
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
