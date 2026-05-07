import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const isGitHubPages = process.env.DEPLOY_TARGET === 'github'

export default defineConfig({
  plugins: [vue()],
  base: isGitHubPages ? '/AWS-Cloud-Practitioner-Exam-Prep/' : '/',
})
