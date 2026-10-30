FROM node:22-alpine
WORKDIR /app
RUN corepack enable

# 前端在 build 時需要的變數（Railway 會把同名的 Variables 當 build arg 傳入）
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_FRONTEND_FORGE_API_KEY
ARG VITE_FRONTEND_FORGE_API_URL

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
