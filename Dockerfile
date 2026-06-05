# Stage 1: Build environment
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src
RUN npm run build

# Stage 2: Production run environment
FROM node:20-slim
WORKDIR /app

# Install LibreOffice and core font packages for high-fidelity rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    fonts-liberation \
    fonts-dejavu \
    fonts-freefont-ttf \
    fontconfig \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript from build stage
COPY --from=builder /app/dist ./dist

# Setup temporary directory inside the workspace for uploads & conversions
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Set default production environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV CONVERTER_ENGINE=office
ENV LIBREOFFICE_BINARY_PATH=/usr/bin/soffice
ENV TEMPORARY_DIR=/app/temp
ENV CONVERSION_TIMEOUT_MS=15000

EXPOSE 3000

CMD ["node", "dist/server.js"]
