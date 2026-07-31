import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    define: {
      __MAPS_KEY__: JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY)
    },
    root: 'public'
  }
})