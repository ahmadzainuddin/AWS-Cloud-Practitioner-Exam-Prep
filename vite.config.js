import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const isGitHubPages = process.env.DEPLOY_TARGET === 'github'
const isCloudflarePages = process.env.CF_PAGES === '1'

export default defineConfig({
  plugins: [vue()],
  base: isCloudflarePages ? '/' : isGitHubPages ? '/AWS-Cloud-Practitioner-Exam-Prep/' : '/',
})