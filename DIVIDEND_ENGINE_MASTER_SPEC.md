# ✅ UKOMBOZI DIVIDEND ENGINE – PROPER UI REDESIGN

**Policy-Driven • Audit-Safe • Profit-Based**

This document outlines the **FINAL UI DESIGN + LOGIC** for the institutional-grade Dividend Engine.

---

## 🔷 1. DIVIDEND ENGINE HOME (READ-ONLY BY DEFAULT)

### Header

```
UKOMBOZI Dividend Management Engine
Financial Year: 2026
Status: DRAFT | CALCULATED | APPROVED | POSTED
```

### Key Rule

> ⚠️ All calculations are system-derived. Manual rate entry is disabled.

---

## 🔷 2. SECTION A: SHARE SNAPSHOT PANEL (LOCK FIRST)

### UI Block: **Bi-Monthly Share Snapshots**

| Period | Snapshot Date | Status    |
| ------ | ------------- | --------- |
| Jan    | 31 Jan        | 🔒 Locked |
| Mar    | 31 Mar        | 🔒 Locked |
| May    | 31 May        | 🔒 Locked |
| Jul    | 31 Jul        | 🔒 Locked |
| Sep    | 30 Sep        | 🔒 Locked |
| Nov    | 30 Nov        | 🔒 Locked |

✅ **Button:** `Validate Snapshots`

**System Rules**

* ❌ Cannot proceed if any snapshot is missing
* ❌ No editing after lock
* ✅ Snapshot is taken automatically from ledger

---

## 🔷 3. SECTION B: PROFIT COMPUTATION (NO GUESSING)

### UI Block: **Revenue & Profit Calculator**

| Item                    | Amount (KES) | Source  |
| ----------------------- | ------------ | ------- |
| Banking Interest        | Auto         | Ledger  |
| STL Interest            | Auto         | Loans   |
| LTL Interest            | Auto         | Loans   |
| Penalties               | Auto         | Arrears |
| Other Income            | Optional     | Admin   |
| **Total Revenue (TRF)** | **AUTO**     | System  |

⬇️

| Deductions              | Amount |
| ----------------------- | ------ |
| Operating Expenses      | Admin  |
| Risk Reserve (e.g. 10%) | Auto   |
| Reinvested Funds        | Admin  |

### Output (Read-Only)

```
Available Profit (AP): KES XXXXX
```

🚫 **If AP ≤ 0 → System blocks dividends**

---

## 🔷 4. SECTION C: PROFIT SHARING POLICY (FIXED RULES)

### UI Block: **Dividend Policy**

```
Group Age: 18 Months
Applicable Share-Out Rate: 75%
```

**System Output**

```
Profit to Share Out (PSO): KES XXXXX
```

🚫 No editable percentage
🚫 No manual override

---

## 🔷 5. SECTION D: DIVIDEND RATE (DERIVED, NOT ENTERED)

### UI Block: **Dividend Rate Engine**

```
Total Average Shares (All Members): 373,390
Dividend Rate: 0.6750  (AUTO)
```

📌 Rate is **display only**
📌 Cannot be typed anywhere in the system

---

## 🔷 6. SECTION E: MEMBER DIVIDEND TABLE (THE CORE)

### UI Block: **Member Dividend Distribution**

| Member    | Avg Shares  | Rate   | Dividend (KES) |
| --------- | ----------- | ------ | -------------- |
| Member 1  | 31,675      | 0.6750 | 21,381         |
| Member 2  | 7,550       | 0.6750 | 5,096          |
| Member 3  | 34,708      | 0.6750 | 23,428         |
| …         | …           | …      | …              |
| **TOTAL** | **373,390** |        | **252,038**    |

🔒 Table is read-only
📄 Button: `Preview Member Dividend Statement (PDF)`

---

## 🔷 7. SECTION F: APPROVAL & POSTING WORKFLOW

### UI Block: **Approval Chain**

```
Prepared By: System
Reviewed By: Admin
Approved By: Director
```

Buttons (Role-Based):

* `Approve Dividends` (Director only)
* `Post to Member Ledgers`
* `Generate Final PDF`

🚫 Once posted → **system locks permanently**

---

## 🔷 8. AUDIT & TRANSPARENCY PANEL (VERY IMPORTANT)

### UI Block: **Audit Trail**

* Calculation timestamp
* Snapshot IDs used
* Policy version
* Approved by
* Posted date

📌 This protects **you as director**.

---

# 🔐 CRITICAL RULES (BACKEND ENFORCED)

1. **Remove manual dividend rate input entirely.**
2. **Lock bi-monthly share snapshots before calculation.**
3. **Derive dividend rate strictly from profit and total average shares.** (Enforced via Generated Column)
4. **Block dividend processing if profit is zero or negative.**
5. **Enforce director-only approval and one dividend run per year.**
6. **Make all dividend tables read-only after posting.**
7. **Ensure every dividend has a full audit trail and PDF report.**

---

# 🚨 WHY THIS FIXES THE PROBLEM

| Old System        | New Engine          |
| ----------------- | ------------------- |
| Manual rate       | Derived rate        |
| Editable shares   | Locked snapshots    |
| Forced payout     | Profit-driven       |
| Spreadsheet logic | Institutional logic |
| Audit risk        | Audit-safe          |
