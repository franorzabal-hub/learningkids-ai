# LearnKids AI - Cloud Run Dockerfile
# Optimized for Google Cloud Run deployment
# v2.6.0: Uses pre-built widget (run `npm run build:widget` before deploying)

FROM node:20-slim

# Set production environment
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY server.js ./
COPY lib ./lib
COPY mcp-server ./mcp-server

# Copy pre-built widget (run `npm run build:widget` locally before deploying)
COPY web-component/dist ./web-component/dist

# Cloud Run sets PORT environment variable
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["npm", "start"]
