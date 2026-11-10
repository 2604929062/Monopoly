FROM node:24-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/game-web/package.json apps/game-web/package.json
COPY apps/game-server/package.json apps/game-server/package.json
COPY apps/progress-web/package.json apps/progress-web/package.json
COPY apps/progress-api/package.json apps/progress-api/package.json
COPY packages/game-rules/package.json packages/game-rules/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY apps/game-web apps/game-web
COPY apps/game-server apps/game-server
COPY apps/progress-web apps/progress-web
COPY apps/progress-api apps/progress-api
COPY packages packages
RUN pnpm --filter progress-web exec tsc -b && pnpm --filter progress-web exec vite build --base=/progress/

FROM nginx:1.27-alpine
COPY --from=build /workspace/apps/progress-web/dist/ /usr/share/nginx/html/progress/
COPY deploy/progress-static.conf /etc/nginx/conf.d/default.conf
