# --- Build Frontend Stage ---
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Production Backend & Serve Stage ---
FROM node:18-alpine
WORKDIR /app

# Install native compilation dependencies for SQLite if needed (sqlite3 usually has prebuilt binaries)
RUN apk add --no-cache python3 make g++

# Install backend dependencies
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# Copy built frontend assets
COPY --from=client-builder /app/client/dist ./client/dist

# Copy backend source files
COPY server/ ./server/

# Expose port
EXPOSE 3001

# Run command
CMD ["node", "server/index.js"]
