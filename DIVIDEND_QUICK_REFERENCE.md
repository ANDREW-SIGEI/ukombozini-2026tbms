# 🎯 DIVIDEND ENGINE - QUICK REFERENCE CARD

**Ultra-Quick Guide for Daily Operations**

---

## 📋 5-STEP WORKFLOW

```
1️⃣ CREATE    → Officer creates run with financial data
2️⃣ CALCULATE → System computes dividends for all members
3️⃣ REVIEW    → Anyone can view allocations
4️⃣ APPROVE   → Director authorizes the run
5️⃣ POST      → Director posts to member accounts
```

---

## 🔢 CORE FORMULAS

```
TRF = Gross Profit × 15%
Net Profit = Income - Expenses - Admin - TRF
Dividend Rate = (Net Profit × 70%) / Total Avg Shares
Member Dividend = Avg Shares × Rate - Arrears
```

---

## 📊 DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `dividend_snapshots` | Bi-monthly member balances |
| `dividend_runs` | Annual calculation runs |
| `dividend_allocations` | Per-member payouts |

---

## 🚦 STATUS FLOW

```
DRAFT → CALCULATED → APPROVED → POSTED
```

---

## 🔐 PERMISSIONS

| Role | Can Do |
|------|--------|
| Officer | Create, Calculate, View |
| Admin | Create, Calculate, View |
| Director | Approve, Post (+ Admin rights) |

---

## ⚙️ API METHODS

```javascript
// In api.js (lines 789-873)
api.getDividendRuns()
api.createDividendRun(data)
api.calculateDividend(runId)
api.getDividendAllocations(runId)
api.approveDividendRun(runId)
api.postDividendRun(runId)
```

---

## 🎯 QUICK VALIDATION

**Before Creating:**
- ✓ Income > Expenses?
- ✓ All amounts are KES?
- ✓ Correct financial year?

**Before Calculating:**
- ✓ Status is DRAFT?
- ✓ Snapshots exist for year?

**Before Approving:**
- ✓ You are a Director?
- ✓ Status is CALCULATED?
- ✓ Allocations look correct?

**Before Posting:**
- ✓ Status is APPROVED?
- ✓ Sufficient dividend reserves?

---

## 🐛 COMMON ERRORS

| Error | Solution |
|-------|----------|
| "No snapshots found" | Run snapshot creation for financial year |
| "Permission denied" | Ensure user has Director role |
| "Already posted" | Cannot modify POSTED runs |
| "Insufficient reserves" | Check `total_dividend_reserves` balance |

---

## 📁 KEY FILES

```
Frontend:
  src/pages/DividendManagement.jsx  (543 lines)
  src/services/api.js               (lines 789-873)

Database:
  migrations/012_dividend_engine_proper.sql  (MAIN)

Documentation:
  DIVIDEND_ENGINE_COMPLETE_GUIDE.md         (Index)
  DIVIDEND_ENGINE_TECHNICAL_SPEC.md         (Schema + Code)
  DIVIDEND_ENGINE_FLOWCHART.md              (Diagrams)
  DIVIDEND_FORMULAS_INSTITUTIONAL.md        (Formulas)
  DIVIDEND_ENGINE_DEPLOYMENT.md             (Testing)
```

---

## 🚀 FIRST TIME SETUP

```sql
-- 1. Run in Supabase SQL Editor
\i migrations/012_dividend_engine_proper.sql

-- 2. Create test snapshots (optional)
INSERT INTO dividend_snapshots (member_id, financial_year, total_shares)
SELECT id, 2026, total_savings FROM members WHERE is_active = true;

-- 3. Verify
SELECT COUNT(*) FROM dividend_snapshots WHERE financial_year = 2026;
```

---

## 💡 PRO TIPS

1. **Always use snapshots** - Never calculate from live member data
2. **TRF is automatic** - System calculates 15%, don't override
3. **Director approval is mandatory** - No shortcuts allowed
4. **POSTED runs are final** - Cannot edit or delete
5. **Check allocations before approving** - Review member list carefully

---

## 📞 SUPPORT

- **Technical Issues**: Check `DIVIDEND_ENGINE_DEPLOYMENT.md` troubleshooting section
- **Formula Questions**: See `DIVIDEND_FORMULAS_INSTITUTIONAL.md`
- **Workflow Confusion**: Review `DIVIDEND_ENGINE_FLOWCHART.md`

---

**Print this card for quick desk reference!**
