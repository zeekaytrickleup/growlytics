# Container image for the Growlytics API.
# Works on any container host (Koyeb, Fly.io, Railway, etc.) — no card-gated platform required.
FROM node:22

WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
# Host port. Koyeb/Fly route to this; override with the platform's PORT if it sets one.
ENV PORT=8000
EXPOSE 8000

# start:prod runs `prisma db push` (creates tables if missing) then boots; the app self-seeds.
CMD ["npm", "run", "start:prod"]
