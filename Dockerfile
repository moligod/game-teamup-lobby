FROM node:22-bookworm-slim AS build

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci --registry=$NPM_REGISTRY

COPY . .

ARG VITE_GAME_NAME=
ENV VITE_GAME_NAME=$VITE_GAME_NAME
ARG VITE_API_BASE_URL=
ARG VITE_WS_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
