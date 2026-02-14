import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dheeraj bhai, ye raha tera final merged code
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: [
      'subcheliform-tentier-lanie.ngrok-free.dev'
    ]
  }
})