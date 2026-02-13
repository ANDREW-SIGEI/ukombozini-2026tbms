# 🚀 UKOMBOZINI Production Deployment - Institutional Guide

## ✅ DEPLOYMENT STATUS: READY FOR INSTITUTIONAL ROLLOUT

**Date:** 13 February 2026  
**System:** UKOMBOZINI Table Banking Platform  
**Architecture:** MTE v2 + Triple-Entry Ledger  
**Primary Tech Stack:** Node.js (Backend) + React (Frontend) + PostgreSQL 15 (Database)

---

## 🎯 DEPLOYMENT STRATEGY: DOCKER COMPOSE

The institutional version of UKOMBOZINI is designed to run as a set of containerized microservices. This ensures data sovereignty and zero-config deployment on any cloud provider (AWS, DigitalOcean, or Local Servers).

### **Core Stack:**
1.  **ukombozini-api:** Node.js backend running the transaction engine.
2.  **ukombozini-ui:** Nginx-hosted React production build.
3.  **ukombozini-db:** PostgreSQL 15 instance with automatic schema initialization.

---

## 🚀 DEPLOYMENT STEPS

### **STEP 1: Environment Hardening**

Configure your production environment variables in the root `.env` file:

```env
# SECURITY
JWT_SECRET=your_production_secret_key_here
NODE_ENV=production

# DATABASE
POSTGRES_USER=ukombozini_admin
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=ukombozini_prod
DATABASE_URL=postgresql://ukombozini_admin:secure_password_here@ukombozini-db:5432/ukombozini_prod

# BRANDING & SMS
APP_NAME=UKOMBOZINI
SMS_PROVIDER=AT
SMS_API_KEY=your_key
```

---

### **STEP 2: Build & Launch (Docker)**

UKOMBOZINI uses a multi-stage Docker workflow for maximum performance.

1.  **Pull Repository:**
    ```bash
    git clone https://github.com/your-org/ukombozini-2026tbms.git
    cd ukombozini-2026tbms
    ```

2.  **Launch Stack:**
    ```bash
    docker-compose up -d --build
    ```

3.  **Verify Services:**
    ```bash
    docker ps
    ```
    *You should see three running containers: `ukombozini-api`, `ukombozini-ui`, and `ukombozini-db`.*

---

### **STEP 3: Database Initialisation**

The system automatically runs `backend/database/postgres_init.sql` on the first launch of the PostgreSQL container.

To manually trigger a schema update or seed data:
```bash
docker exec -i ukombozini-db psql -U ukombozini_admin -d ukombozini_prod < backend/database/postgres_init.sql
```

---

## 🔐 SECURITY CHECKLIST

- [ ] **SSL/TLS:** Ensure the system is behind an Nginx Reverse Proxy with Let's Encrypt certificates.
- [ ] **JWT Rotation:** Change the `JWT_SECRET` every 90 days.
- [ ] **Database Access:** The PostgreSQL port (5432) is NOT exposed to the public internet by default (Internal network only).
- [ ] **Audit Trail:** Regularly monitor `audit_logs` for sensitive governance actions (locks/reversals).

---

## 🔄 BACKUP & RECOVERY

### **1. Automated Backups**
The system includes a script for daily PostgreSQL dumps.
```bash
cd backend
node backup.js --type=scheduled
```

### **2. Manual Dump**
```bash
docker exec ukombozini-db pg_dump -U ukombozini_admin ukombozini_prod > backup_$(date +%F).sql
```

---

## ✅ CONCLUSION

**UKOMBOZINI is now deployed with Institutional Integrity.**

✅ **Data Sovereignty:** You own 100% of the financial data.  
✅ **Resiliency:** Docker auto-restart prevents downtime.  
✅ **Compliance:** Triple-entry ledger ensures zero-variance reporting.  

---

**Guide Version:** 2.1  
**Last Updated:** 13 February 2026  
**Stack:** Docker Compose / PostgreSQL  
**Confidence:** Production Ready 🚀
