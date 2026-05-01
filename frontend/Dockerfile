# 이 파일은 ARIAD 프론트엔드 정적 서버 컨테이너 이미지를 빌드합니다.

FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY recommendation/package.json ./recommendation/package.json
COPY shared/package.json ./shared/package.json

RUN yarn install --immutable

FROM deps AS builder

ARG VITE_APP_ENV=staging-like
ARG VITE_API_BASE_URL=/api
ARG VITE_AUTH_CALLBACK_PATH=/auth/callback
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_STORAGE_PREFIX=ARIAD

ENV VITE_APP_ENV=${VITE_APP_ENV}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_AUTH_CALLBACK_PATH=${VITE_AUTH_CALLBACK_PATH}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_STORAGE_PREFIX=${VITE_STORAGE_PREFIX}

COPY tsconfig.base.json ./
COPY frontend ./frontend
COPY recommendation ./recommendation
COPY shared ./shared

RUN yarn workspace @scenaairo/shared build \
  && yarn workspace @scenaairo/recommendation build \
  && yarn workspace @scenaairo/frontend build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV ARIAD_FRONTEND_HOST=0.0.0.0
ENV ARIAD_FRONTEND_PORT=5173
ENV ARIAD_BACKEND_HOST=backend
ENV ARIAD_BACKEND_PORT=3001

WORKDIR /app

COPY --chown=node:node --from=builder /app/frontend/dist ./frontend/dist
COPY --chown=node:node --from=builder /app/frontend/scripts/serve-dist.mjs ./frontend/scripts/serve-dist.mjs

USER node

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:5173/service.html').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "frontend/scripts/serve-dist.mjs"]
