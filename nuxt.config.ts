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
      operationsApiBase: 'http://192.168.0.121:5001',
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
