FROM node:22-bookworm-slim AS deps

WORKDIR /app/server

ARG DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian
ARG DEBIAN_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security
ARG NPM_REGISTRY=https://registry.npmmirror.com

RUN set -eux; \
  sed -i "s|http://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR}|g; s|http://deb.debian.org/debian|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
  apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci --omit=dev --registry=$NPM_REGISTRY

FROM node:22-bookworm-slim

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/data/uploads

COPY --from=deps /app/server/node_modules ./node_modules
COPY server/ ./

RUN mkdir -p /data/uploads

EXPOSE 3000

CMD ["node", "server.js"]
