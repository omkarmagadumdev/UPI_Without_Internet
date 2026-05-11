FROM node:18-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Install build tools and SQLite headers so better-sqlite3 can compile
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 g++ libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --production || npm install --production

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
