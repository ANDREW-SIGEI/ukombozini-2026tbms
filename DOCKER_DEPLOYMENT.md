# Docker Deployment Guide

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git (optional, for cloning)

### Starting the Application

1. **Navigate to project directory:**
   ```bash
   cd ukombozini-2026tbms
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Check service status:**
   ```bash
   docker-compose ps
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - PostgreSQL: localhost:5432

### Stopping the Application

```bash
docker-compose down
```

To also remove volumes (database data):
```bash
docker-compose down -v
```

## Container Architecture

### Services

1. **ukombozi-db** (PostgreSQL 15)
   - Database with persistent storage
   - Automatically initializes schema on first run
   - Health checks every 10s

2. **ukombozi-backend** (Node.js 20)
   - Express API server
   - Connects to PostgreSQL
   - Auto-restarts on failure

3. **ukombozi-frontend** (React + Nginx)
   - Production React build
   - Nginx serves static files
   - Proxies /api requests to backend

### Port Mapping

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| Frontend | 3000 | 3000 |
| Backend | 5000 | 5000 |
| PostgreSQL | 5432 | 5432 |

## Environment Variables

The `.env` file in the project root contains:

```env
DB_USER=ukombozi_user
DB_PASSWORD=ukombozi_pass
DB_NAME=ukombozi_tbms
JWT_SECRET=ukombozi-secret-key-2026
```

**Security Note:** Change these values for production deployment.

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ukombozi-backend
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build ukombozi-backend
```

### Database Management
```bash
# Access PostgreSQL shell
docker exec -it ukombozi-db psql -U ukombozi_user -d ukombozi_tbms

# Backup database
docker exec ukombozi-db pg_dump -U ukombozi_user ukombozi_tbms > backup.sql

# Restore database
cat backup.sql | docker exec -i ukombozi-db psql -U ukombozi_user ukombozi_tbms
```

### Execute Backend Commands
```bash
# Run database initialization
docker exec ukombozi-backend node initDb.js

# Run migrations
docker exec ukombozi-backend node migrate_project.js
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs ukombozi-backend

# Restart specific service
docker-compose restart ukombozi-backend
```

### Database connection issues
- Ensure PostgreSQL health check passes: `docker-compose ps`
- Verify DATABASE_URL in backend logs
- Check `.env` file contains correct credentials

### Frontend can't reach backend
- Verify nginx.conf proxy settings
- Check backend is running: `docker-compose ps ukombozi-backend`
- Inspect frontend logs: `docker-compose logs ukombozi-frontend`

### Reset everything
```bash
# Stop and remove all containers, networks, volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

## Production Deployment

For production deployment:

1. **Update .env with secure credentials**
2. **Use production database** instead of local PostgreSQL
3. **Configure HTTPS** (add reverse proxy like Traefik or Nginx)
4. **Enable logging** to external service
5. **Set resource limits** in docker-compose.yml

## Health Checks

All services include health checks:
- **Database:** `pg_isready` every 10s
- **Backend:** HTTP GET to `/health` every 30s  
- **Frontend:** wget to localhost:3000 every 30s

Docker will automatically restart unhealthy containers.
