import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 같은 와이파이의 다른 기기(휴대폰 등)에서도 PC의 로컬 IP로 접속할 수 있게 함
  },
});
