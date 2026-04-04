# Multi-stage build for MOV to GIF Converter

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy backend
COPY backend/package*.json ./
RUN npm install --production

COPY backend/src ./src

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./public

# Create directories for uploads and output
RUN mkdir -p uploads output temp

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the server
CMD ["node", "src/index.js"]
