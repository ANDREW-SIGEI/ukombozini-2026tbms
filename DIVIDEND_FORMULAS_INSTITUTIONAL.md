# UKOMBOZI DIVIDEND ENGINE - INSTITUTIONAL FORMULAS
## Policy-Driven, Automated, Auditable

---

## 📊 CALCULATION FLOW (The Only Correct Way)

```
STEP 1: Lock Snapshots → STEP 2: Calculate Averages → 
STEP 3: Compute Profit → STEP 4: Derive Rate → 
STEP 5: Allocate Dividends → STEP 6: Director Approves
```

---

## 1️⃣ SNAPSHOT LOCKING (Bi-Monthly)

### When to Lock:
- **January 31** - First snapshot
- **March 31** - Second snapshot
- **May 31** - Third snapshot
- **July 31** - Fourth snapshot
- **September 30** - Fifth snapshot
- **November 30** - Final snapshot

### What Gets Locked:
```sql
FOR EACH member WHERE status = 'ACTIVE':
  LOCK savings_balance AS snapshot_balance
  LOCK timestamp
  SET is_locked = TRUE
```

### Business Rule:
❌ **No edits allowed after lock**
❌ **Missing snapshot = member excluded from dividends**
✅ **System-controlled, no officer override**

---

## 2️⃣ AVERAGE SHARES CALCULATION

### Formula (Per Member):
```
Average_Shares = (Jan + Mar + May + Jul + Sep + Nov) / 6
```

### Example:
```
Member: John Doe
Jan: 5,500
Mar: 33,950
May: 35,450
Jul: 36,950
Sep: 38,350
Nov: 39,850

Average_Shares = (5,500 + 33,950 + 35,450 + 36,950 + 38,350 + 39,850) / 6
               = 190,050 / 6
               = 31,675
```

### Implementation:
```sql
-- This is a GENERATED column in dividend_allocations table
average_shares DECIMAL(12,2) GENERATED ALWAYS AS (
    (jan_balance + mar_balance + may_balance + 
     jul_balance + sep_balance + nov_balance) / 6.0
) STORED
```

### Business Rule:
✅ **Auto-calculated**
❌ **No manual override**
✅ **Rounded to 2 decimal places**

---

## 3️⃣ PROFIT CALCULATION (TRF → AP)

### Step A: Total Revenue Forecasted (TRF)
```
TRF = Banking_Interest + STL_Interest + LTL_Interest + 
      Penalties + Other_Income
```

### Example:
```
Banking Interest:    0
STL Interest:        94,300
LTL Interest:        241,750
Penalties:           0
Other Income:        0
------------------------
TRF = 336,050
```

### Step B: Total Deductions
```
Total_Deductions = Operating_Expenses + Mandatory_Reserves + 
                   Risk_Buffer + Reinvested_Capital
```

### UKOMBOZI Standard Deductions:
```
Operating Expenses:     20,000  (stationary, transport, etc.)
Mandatory Reserves:     33,605  (10% of TRF for statutory reserve)
Risk Buffer:            16,803  (5% of TRF for bad debts)
Reinvested Capital:     0       (optional: keep for growth)
------------------------
Total Deductions = 70,408
```

### Step C: Allocable Profit (AP)
```
AP = TRF - Total_Deductions
   = 336,050 - 70,408
   = 265,642
```

### Implementation:
```sql
-- All GENERATED columns in dividend_runs table
total_revenue_forecasted DECIMAL(12,2) GENERATED ALWAYS AS (
    banking_interest + stl_interest + ltl_interest + 
    penalties + other_income
) STORED,

total_deductions DECIMAL(12,2) GENERATED ALWAYS AS (
    operating_expenses + mandatory_reserves + 
    risk_buffer + reinvested_capital
) STORED,

allocable_profit DECIMAL(12,2) GENERATED ALWAYS AS (
    (total_revenue_forecasted - total_deductions)
) STORED
```

### Business Rule:
⚠️ **IF AP < 0 → Block dividend run**
✅ **Expenses MUST be realistic (auditable)**
✅ **Reserves MUST comply with SACCO Act (10% minimum)**

---

## 4️⃣ PROFIT SHARE-OUT POLICY

### Formula:
```
Profit_Share_Out = AP × Share_Percentage
```

### UKOMBOZI Policy:
```
IF group_age >= 12 months:
    Share_Percentage = 75%
ELSE:
    Share_Percentage = 50%
```

### Example (Mature Group):
```
AP = 265,642
Share_Percentage = 75%

Profit_Share_Out = 265,642 × 0.75
                  = 199,232
```

### Implementation:
```sql
profit_share_out DECIMAL(12,2) GENERATED ALWAYS AS (
    allocable_profit * (profit_share_percentage / 100)
) STORED
```

### Business Rule:
✅ **Policy-driven** (stored in system settings)
❌ **Not manually editable per run**
✅ **Can be overridden ONLY by Director with audit log**

---

## 5️⃣ DIVIDEND RATE (THE CRITICAL FORMULA)

### Formula:
```
Dividend_Rate = Profit_Share_Out / Total_Average_Shares
```

### Example:
```
Profit_Share_Out = 199,232
Total_Average_Shares = 373,390 (sum of all member averages)

Dividend_Rate = 199,232 / 373,390
              = 0.533658 (or 53.37%)
```

### Implementation:
```sql
dividend_rate DECIMAL(10,6) GENERATED ALWAYS AS (
    CASE 
        WHEN total_average_shares > 0 THEN 
            profit_share_out / total_average_shares
        ELSE 0
    END
) STORED
```

### Business Rule:
🚫 **NEVER ACCEPT MANUAL INPUT**
🚫 **REMOVE INPUT FIELD FROM UI**
✅ **Display as READ-ONLY result**
✅ **Precision: 6 decimal places**

---

## 6️⃣ MEMBER DIVIDEND ALLOCATION

### Formula (Per Member):
```
Gross_Dividend = Average_Shares × Dividend_Rate
```

### Example:
```
Member: John Doe
Average_Shares = 31,675
Dividend_Rate = 0.533658

Gross_Dividend = 31,675 × 0.533658
                = 16,903.16
```

### With Deductions:
```
Net_Dividend = Gross_Dividend - (Withholding_Tax + Arrears + Other_Deductions)
```

### Implementation:
```sql
gross_dividend DECIMAL(12,2) GENERATED ALWAYS AS (
    average_shares * dividend_rate
) STORED,

net_dividend DECIMAL(12,2) GENERATED ALWAYS AS (
    gross_dividend - (withholding_tax + outstanding_arrears + other_deductions)
) STORED
```

### Business Rule:
✅ **All dividends rounded to 2 decimal places**
✅ **Arrears auto-deducted if configured**
✅ **Withholding tax (if applicable) auto-calculated**

---

## 7️⃣ VALIDATION CHECKS (System-Enforced)

### Before Calculation:
```
✓ All 6 snapshots exist for all active members
✓ No snapshot has negative balance
✓ Profit > 0
✓ All income sources validated
✓ Expenses have supporting documents
```

### After Calculation:
```
✓ Sum(Member Dividends) = Profit_Share_Out (±0.01 for rounding)
✓ No negative dividends
✓ Total payout does not exceed allocable profit share
```

### If Validation Fails:
```
STATUS = 'FAILED'
BLOCK approval
GENERATE error report
```

---

## 8️⃣ WORKFLOW STATUS

```
DRAFT → CALCULATED → DIRECTOR_REVIEW → APPROVED → POSTED
   ↓                                        ↓
REJECTED ←----------------------------------+
```

### State Transitions:
- **DRAFT**: Officer entering income/expense data
- **CALCULATED**: System computed all formulas
- **DIRECTOR_REVIEW**: Awaiting approval
- **APPROVED**: Director signed off
- **POSTED**: Dividends transferred to member accounts
- **REJECTED**: Director rejected (requires revision)

---

## 9️⃣ AUDIT TRAIL (Immutable)

### Every dividend run MUST log:
```
- Who created the run
- Income sources (with references)
- Expense sources (with receipts)
- All snapshot dates
- Calculation timestamp
- Director approval (name, ID, timestamp)
- Posting timestamp
- PDF generation timestamp
```

### PDF MUST Include:
1. Full TRF breakdown
2. All deductions with references
3. Allocable profit calculation
4. Share-out policy used
5. Derived dividend rate (highlighted)
6. Per-member allocation table
7. Director signature
8. Issue date

---

## 🔐 SUMMARY OF CONTROLS

| What                  | Manual Entry | Auto-Calculated | Director Only | Read-Only |
|-----------------------|--------------|-----------------|---------------|-----------|
| Income sources        | ❌ No        | ✅ Yes (from ledger) | ✅ Override | ❌ No |
| Expenses              | ❌ No        | ✅ Yes (from ledger) | ✅ Override | ❌ No |
| Reserves %            | ❌ No        | ✅ Yes (policy)      | ✅ Override | ❌ No |
| Share-out %           | ❌ No        | ✅ Yes (policy)      | ✅ Override | ❌ No |
| Dividend Rate         | 🚫 NEVER     | ✅ ALWAYS           | ❌ No       | ✅ YES    |
| Member Averages       | 🚫 NEVER     | ✅ ALWAYS           | ❌ No       | ✅ YES    |
| Snapshots             | ❌ No        | ✅ Yes (auto-lock)   | ❌ No       | ✅ YES    |
| Approval              | ❌ No        | ❌ No               | ✅ YES      | ❌ No     |

---

## ✅ IMPLEMENTATION CHECKLIST

Before going live:
- [ ] Remove "Final Dividend Rate" input field from UI
- [ ] Make dividend_rate a **display-only** field
- [ ] Auto-lock snapshots on schedule
- [ ] Block dividend run if snapshots incomplete
- [ ] Block dividend run if profit < 0
- [ ] Require Director approval before posting
- [ ] Generate immutable PDF with full breakdown
- [ ] Create audit trail for all changes
- [ ] Test with real 2025 data
- [ ] Compare with manual calculation (should match)

---

## 🎯 EXPECTED RESULT (Using Your 2025 Data)

Based on the paper you showed:

### Current (Wrong):
```
Dividend Rate: 0.6750 (MANUALLY ENTERED - DANGEROUS)
Total Payout: 252,037.50
```

### Correct (System-Calculated):
```
TRF = 336,050
Deductions = 70,408 (20% of TRF for reserves/expenses)
AP = 265,642
Profit Share-Out (75%) = 199,232
Total Average Shares = 373,390
Dividend Rate = 199,232 / 373,390 = 0.533658 (53.37%)
Total Payout = 199,232
```

### Key Difference:
❌ Old: Rate pulled from thin air (0.6750)
✅ New: Rate derived from profit (0.5337)

**This protects your members and your directors.**

---

Would you like me to now:
- **A)** Build the UI for this proper engine
- **B)** Create the PDF template
- **C)** Write the API functions for dividend calculation
- **D)** All of the above

Reply: **PROCEED + [Letter]**
