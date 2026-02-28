#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting GameStake Arena Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run as root${NC}"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
    echo -e "${GREEN}✓ Environment variables loaded${NC}"
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites satisfied${NC}"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p nginx/conf.d nginx/ssl backups logs
echo -e "${GREEN}✓ Directories created${NC}"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans || true
echo -e "${GREEN}✓ Containers stopped${NC}"

# Pull latest images
echo "📦 Pulling latest images..."
docker-compose pull
echo -e "${GREEN}✓ Images pulled${NC}"

# Build images
echo "🏗️  Building images..."
docker-compose build --no-cache
echo -e "${GREEN}✓ Images built${NC}"

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose run --rm backend npm run migrate
echo -e "${GREEN}✓ Migrations complete${NC}"

# Start services
echo "🚀 Starting services..."
docker-compose up -d
echo -e "${GREEN}✓ Services started${NC}"

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
services=("postgres" "redis" "backend" "frontend-web")
for service in "${services[@]}"; do
    if [ "$(docker-compose ps -q $service)" ]; then
        echo -e "${GREEN}✓ $service is running${NC}"
    else
        echo -e "${RED}❌ $service failed to start${NC}"
        docker-compose logs $service --tail=50
        exit 1
    fi
done

# Show running containers
echo ""
echo "📊 Running containers:"
docker-compose ps

# Show logs
echo ""
echo "📝 Recent logs:"
docker-compose logs --tail=20

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "🌐 Access the application at:"
echo "   Web: http://localhost:3000"
echo "   API: http://localhost:5000"
echo ""
echo "📚 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   Check status: docker-compose ps"