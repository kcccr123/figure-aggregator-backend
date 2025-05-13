# ────────────────────────────────────────────────────────────────
# Figure‑aggregator Dockerfile – optimized for Puppeteer + Alpine
# ────────────────────────────────────────────────────────────────
FROM node:18-alpine

# 1. OS packages required by headless Chromium + Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 2. Let Puppeteer know to use the system Chromium we just installed
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 3. App source
WORKDIR /app
COPY package*.json ./
RUN npm ci          # reproducible install (needs package‑lock.json)

COPY . .

# 4. Expose the API port & run the start script in package.json
EXPOSE 8080
CMD ["npm", "start"]
