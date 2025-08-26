# Stage 0: Shared deps
FROM node:18-alpine AS deps
WORKDIR /usr/src/app

# Copy package files and install all deps (dev & prod)
COPY package*.json ./
RUN npm install

# Stage 1: Development
FROM deps AS dev
WORKDIR /usr/src/app

# Copy everything and expose for live reload
COPY . .
EXPOSE 4000

# Use your existing dev script
CMD ["./start.sh"]

# Stage 2: Build for production
FROM deps AS builder
WORKDIR /usr/src/app

# Install PM2 globally
RUN npm install -g pm2

# Copy source & compile TS
COPY . .
RUN npm run build


# Stage 3: Production runtime
FROM node:18-alpine AS prod
WORKDIR /usr/src/app

# Install PM2 globally
RUN npm install -g pm2

# Install only prod deps + PM2
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g pm2

# Copy built output and config files
COPY --from=builder /usr/src/app/dist ./dist
COPY prisma ./prisma
COPY ecosystem.config.js ./

EXPOSE 4000

# Start under PM2 (uses your start:pm2 script)
CMD ["npm", "run", "start:pm2"]