# 이 파일은 ARIAD 백엔드 API 컨테이너 이미지를 빌드합니다.

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

COPY tsconfig.base.json ./
COPY backend ./backend
COPY recommendation ./recommendation
COPY shared ./shared

RUN yarn workspace @scenaairo/shared build \
  && yarn workspace @scenaairo/recommendation build \
  && yarn workspace @scenaairo/backend build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable \
  && mkdir -p /app/.data \
  && chown -R node:node /app

COPY --chown=node:node --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/backend/package.json ./backend/package.json
COPY --chown=node:node --from=builder /app/backend/dist ./backend/dist
COPY --chown=node:node --from=builder /app/recommendation/package.json ./recommendation/package.json
COPY --chown=node:node --from=builder /app/recommendation/dist ./recommendation/dist
COPY --chown=node:node --from=builder /app/shared/package.json ./shared/package.json
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "backend/dist/server.js"]
