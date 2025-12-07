#!/bin/bash
set -e

# SmartOfficeCRM Deployment Script
# Usage: ./scripts/deploy.sh

REPO_URL="https://github.com/lgscvb/20251206-smart-crm.git"
APP_DIR="/opt/smartoffice-crm"
CONTAINER_NAME="smartoffice-crm"

echo "🚀 Starting SmartOfficeCRM deployment..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo"
    exit 1
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create app directory
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull latest code
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git fetch origin
    git reset --hard origin/main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Create web network if not exists
docker network create web 2>/dev/null || true

# Stop existing container
echo "🛑 Stopping existing container..."
docker-compose down 2>/dev/null || true

# Build and start
echo "🔨 Building and starting container..."
docker-compose build --no-cache
docker-compose up -d

# Cleanup old images
echo "🧹 Cleaning up old images..."
docker image prune -f

# Health check
echo "⏳ Waiting for health check..."
sleep 5

if curl -s http://localhost:3000/health | grep -q "OK"; then
    echo "✅ SmartOfficeCRM deployed successfully!"
    echo "🌐 Available at: https://hj.yourspce.org"
else
    echo "❌ Health check failed. Check logs:"
    docker-compose logs --tail=50
    exit 1
fi

echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME
