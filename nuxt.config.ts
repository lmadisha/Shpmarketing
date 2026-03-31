import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },

  ssr: false,

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
    },
  },

  css: ['~/assets/css/index.css'],

  colorMode: {
    classSuffix: '',
  },

  imports: {
    dirs: ['stores'],
  },
})
