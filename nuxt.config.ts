import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },

  ssr: false,

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
