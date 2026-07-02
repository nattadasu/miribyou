# syntax=docker/dockerfile:1

FROM node:22-slim

ENV HOME=/app \
    NODE_ENV=production \
    PORT=7860
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

RUN npm install --no-save @hono/node-server

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 7860

CMD ["npx", "tsx", "src/server.ts"]
