import {defineConfig} from 'vite';

export default defineConfig({
  server: {proxy: {'/api': 'http://localhost:8787', '/media': 'http://localhost:8787', '/download': 'http://localhost:8787'}},
});
