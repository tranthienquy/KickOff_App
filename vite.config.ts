import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true // Cho phép truy cập qua LAN (cần thiết cho test trên iPad)
  }
})