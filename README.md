# 🏦 UKOMBOZINI TBMS
### Universal Knowledge Optimization for Member Based Organizations & Zealous Institutional Network Integration

**UKOMBOZINI** is a high-performance, institutional-grade Treasury and Business Management System (TBMS) designed for SACCOs, Investment Groups (Chamas), and Micro-finance institutions. It features a robust offline-first digital cashbook, triple-entry ledger integrity, and automated surplus allocation.

---

## 🚀 Core Features

### 💵 Institutional Finance
- **Digital Cashbook**: Excel-like, high-performance data entry for daily collections.
- **Surplus Allocation Matrix**: Automated distribution of session growth into STL, LTL, Dividend, and Project reserves.
- **Triple-Entry Ledger**: Immutable financial logs ensuring 100% audit accuracy.

### 📶 Resilience
- **Offline-First Workflow**: Full data entry and recovery support using IndexedDB for rural field operations.
- **Auto-Recovery**: Automatic draft persistence to prevent data loss during power/network failures.

### 📱 Communication Hub
- **Automated Receipting**: SMS receipts sent instantly for every transaction.
- **Official Summaries**: Real-time meeting closeout reports sent to Group Officials.
- **Variable Injection**: Bulk messaging support with dynamic member data (Savings, Loans, Next Meeting).

### 🛡️ Governance & Security
- **Auditor Mode**: Traceable read-only access for internal/external audits.
- **Dual Control**: Secure reversal workflows requiring administrative approval.
- **Risk Command Center**: Live monitoring of group liquidity and member risk scores.

---

## 🛠️ Tech Stack
- **Frontend**: React, Tailwind CSS, Chart.js, IndexedDB.
- **Backend**: Node.js, Express, SQLite (Local) / PostgreSQL (Cloud).
- **Messaging**: AfricasTalking Gateway Integration.
- **Containerization**: Docker & Docker Compose.

---

## 🏁 Quick Start

### Windows (Recommended)
1. Ensure **Docker Desktop** is running.
2. Double-click `start_ukombozini.bat`.
3. The dashboard will open automatically at [http://localhost](http://localhost).

### Manual (Development)
```bash
# Start Backend
cd backend
npm install
npm run dev

# Start Frontend
cd frontend
npm install
npm run start
```

---

## 📁 Project Structure
- `/backend`: Express API, Allocation Logic, and Database Services.
- `/frontend`: React Dashboard, Digital Cashbook, and Financial Visualizations.
- `/scripts`: Database migrations and system verification utilities.

---
*© 2026 UKOMBOZINI TBMS. Optimized for Institutional Excellence.*
