FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY experiments/ai-experiment-001/agent/package.json ./package.json
COPY experiments/ai-experiment-001/agent/package-lock.json ./package-lock.json
RUN npm ci
COPY src/domain /app/src/domain
COPY experiments/ai-experiment-001/agent/index.ts /app/experiments/ai-experiment-001/agent/index.ts
COPY experiments/ai-experiment-001/agent/pipeline.ts /app/experiments/ai-experiment-001/agent/pipeline.ts
COPY experiments/ai-experiment-001/agent/roles.ts /app/experiments/ai-experiment-001/agent/roles.ts

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/experiments/ai-experiment-001/agent
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/experiments/ai-experiment-001/agent/index.ts ./index.ts
COPY --from=builder /app/experiments/ai-experiment-001/agent/pipeline.ts ./pipeline.ts
COPY --from=builder /app/experiments/ai-experiment-001/agent/roles.ts ./roles.ts
COPY --from=builder /app/src/domain /app/src/domain
USER node
CMD ["npm", "start"]