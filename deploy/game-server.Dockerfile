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
RUN pnpm --filter game-server build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /workspace
RUN corepack enable
COPY --from=build /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/apps/game-server/package.json apps/game-server/package.json
COPY --from=build /workspace/apps/game-server/dist apps/game-server/dist
COPY --from=build /workspace/packages/game-rules packages/game-rules
COPY --from=build /workspace/packages/shared packages/shared
RUN pnpm install --prod --frozen-lockfile --filter game-server...
USER node
EXPOSE 3001
CMD ["node", "apps/game-server/dist/index.js"]
