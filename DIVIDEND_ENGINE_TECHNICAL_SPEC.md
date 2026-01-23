# 🏦 DIVIDEND ENGINE - TECHNICAL SPECIFICATION
## Database Schema + Formula Pseudocode

**Version**: 2.0 (Institutional Grade)  
**Date**: January 20, 2026  
**Standard**: SACCO/Table Banking Best Practices

---

## 📊 DATABASE SCHEMA

### 1. `dividend_snapshots` - Member Balance Snapshots

Captures bi-monthly member balance history for dividend calculations.

```sql
CREATE TABLE dividend_snapshots (
    -- Identity
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    
    -- Temporal
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    financial_year INTEGER NOT NULL,
    snapshot_period VARCHAR(20) NOT NULL,  -- 'JAN-FEB', 'MAR-APR', etc.
    
    -- Financial Data (Point-in-Time)
    total_savings DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_shares DECIMAL(12, 2) NOT NULL DEFAULT 0,
    active_loan_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    loan_arrears DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(member_id, snapshot_date),
    CHECK(total_savings >= 0),
    CHECK(total_shares >= 0),
    CHECK(active_loan_balance >= 0),
    CHECK(loan_arrears >= 0)
);

-- Indexes for Performance
CREATE INDEX idx_snapshots_member ON dividend_snapshots(member_id);
CREATE INDEX idx_snapshots_year ON dividend_snapshots(financial_year);
CREATE INDEX idx_snapshots_period ON dividend_snapshots(snapshot_period);
```

**Purpose**: Store historical member balances at regular intervals (bi-monthly) to calculate average shares accurately.

---

### 2. `dividend_runs` - Annual Dividend Calculations

Stores institutional-grade dividend run metadata with policy-driven calculations.

```sql
CREATE TABLE dividend_runs (
    -- Identity
    id BIGSERIAL PRIMARY KEY,
    run_number VARCHAR(50) UNIQUE NOT NULL,  -- 'DIV-2026-001'
    
    -- Temporal
    financial_year INTEGER NOT NULL,
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Income Statement (Input)
    total_income DECIMAL(14, 2) NOT NULL,
    total_expenses DECIMAL(14, 2) NOT NULL,
    admin_costs DECIMAL(14, 2) NOT NULL DEFAULT 0,
    
    -- TRF Deductions (Calculated - 15% Policy)
    mandatory_reserves DECIMAL(14, 2) NOT NULL,      -- 10% of net profit
    risk_buffer DECIMAL(14, 2) NOT NULL,             -- 5% of net profit
    reinvested_capital DECIMAL(14, 2) DEFAULT 0,     -- Optional
    trf_deductions DECIMAL(14, 2) GENERATED ALWAYS AS 
        (mandatory_reserves + risk_buffer + reinvested_capital) STORED,
    
    -- Profit Calculation (Generated)
    gross_profit DECIMAL(14, 2) GENERATED ALWAYS AS 
        (total_income - total_expenses) STORED,
    net_profit DECIMAL(14, 2) GENERATED ALWAYS AS 
        (total_income - total_expenses - admin_costs - trf_deductions) STORED,
    
    -- Share-Out Policy (Input)
    share_out_percentage DECIMAL(5, 2) NOT NULL DEFAULT 70.00,  -- % of profit to distribute
    
    -- Dividend Calculation (System-Generated)
    total_avg_shares DECIMAL(14, 2),                  -- Sum of all member avg shares
    dividend_rate DECIMAL(10, 6) GENERATED ALWAYS AS 
        (CASE 
            WHEN total_avg_shares > 0 THEN 
                ((net_profit * share_out_percentage / 100.0) / total_avg_shares)
            ELSE 0 
        END) STORED,
    
    -- Payout Summary
    total_gross_payout DECIMAL(14, 2),                -- Sum of gross dividends
    total_arrears_offset DECIMAL(14, 2),              -- Sum of arrears deducted
    total_net_payout DECIMAL(14, 2),                  -- Sum of net dividends
    total_members INTEGER,                             -- Count of eligible members
    
    -- Workflow Status
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- Status Flow: DRAFT → CALCULATED → DIRECTOR_REVIEW → APPROVED → POSTED
    
    -- Approval Tracking
    calculated_at TIMESTAMP,
    calculated_by BIGINT REFERENCES officers(id),
    approved_at TIMESTAMP,
    approved_by BIGINT REFERENCES officers(id),
    posted_at TIMESTAMP,
    posted_by BIGINT REFERENCES officers(id),
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK(status IN ('DRAFT', 'CALCULATED', 'DIRECTOR_REVIEW', 'APPROVED', 'POSTED', 'REJECTED')),
    CHECK(total_income >= 0),
    CHECK(total_expenses >= 0),
    CHECK(share_out_percentage BETWEEN 0 AND 100),
    CHECK(dividend_rate >= 0)
);

-- Indexes
CREATE INDEX idx_runs_year ON dividend_runs(financial_year);
CREATE INDEX idx_runs_status ON dividend_runs(status);
CREATE INDEX idx_runs_date ON dividend_runs(run_date);
```

**Purpose**: Store comprehensive dividend run data with automated formula calculations.

---

### 3. `dividend_allocations` - Per-Member Dividend Payouts

Stores individual member dividend calculations with arrears offsets.

```sql
CREATE TABLE dividend_allocations (
    -- Identity
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES dividend_runs(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    
    -- Share Calculation (From Snapshots)
    average_shares DECIMAL(12, 2) NOT NULL,
    snapshot_count INTEGER NOT NULL,  -- Number of snapshots used
    
    -- Dividend Calculation (Generated)
    gross_dividend DECIMAL(12, 2) GENERATED ALWAYS AS 
        (average_shares * (
            SELECT dividend_rate 
            FROM dividend_runs 
            WHERE id = run_id
        )) STORED,
    
    -- Arrears Offset (From Loan Data)
    arrears_offset DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Net Payout (Generated)
    net_dividend DECIMAL(12, 2) GENERATED ALWAYS AS 
        (GREATEST(
            (average_shares * (
                SELECT dividend_rate 
                FROM dividend_runs 
                WHERE id = run_id
            )) - arrears_offset, 
            0
        )) STORED,
    
    -- Posting Status
    posted_to_savings BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(run_id, member_id),
    CHECK(average_shares >= 0),
    CHECK(arrears_offset >= 0),
    CHECK(snapshot_count > 0)
);

-- Indexes
CREATE INDEX idx_allocations_run ON dividend_allocations(run_id);
CREATE INDEX idx_allocations_member ON dividend_allocations(member_id);
CREATE INDEX idx_allocations_posted ON dividend_allocations(posted_to_savings);
```

**Purpose**: Store per-member dividend calculations with automatic arrears deduction.

---

## 🧮 FORMULA PSEUDOCODE

### **STEP 1: Create Dividend Run**

```pseudocode
FUNCTION createDividendRun(financialYear, income, expenses, adminCosts, shareOutPolicy):
    
    // 1. Generate Run Number
    runNumber = "DIV-" + financialYear + "-" + padded(sequenceNumber, 3)
    
    // 2. Calculate TRF Deductions (15% Policy)
    grossProfit = income - expenses
    mandatoryReserves = grossProfit * 0.10    // 10% of gross profit
    riskBuffer = grossProfit * 0.05           // 5% of gross profit
    reinvestedCapital = 0                      // Optional, user-defined
    trfDeductions = mandatoryReserves + riskBuffer + reinvestedCapital
    
    // 3. Calculate Net Profit
    netProfit = income - expenses - adminCosts - trfDeductions
    
    // 4. Validate Net Profit
    IF netProfit <= 0 THEN
        THROW ERROR "Net profit must be positive to distribute dividends"
    END IF
    
    // 5. Insert Run Record
    INSERT INTO dividend_runs (
        run_number,
        financial_year,
        total_income,
        total_expenses,
        admin_costs,
        mandatory_reserves,
        risk_buffer,
        reinvested_capital,
        share_out_percentage,
        status
    ) VALUES (
        runNumber,
        financialYear,
        income,
        expenses,
        adminCosts,
        mandatoryReserves,
        riskBuffer,
        reinvestedCapital,
        shareOutPolicy,
        'DRAFT'
    )
    
    RETURN runId
END FUNCTION
```

---

### **STEP 2: Calculate Dividends**

```pseudocode
FUNCTION calculateDividend(runId):
    
    // 1. Fetch Run Data
    run = SELECT * FROM dividend_runs WHERE id = runId
    
    IF run.status NOT IN ('DRAFT', 'CALCULATED') THEN
        THROW ERROR "Run already approved or posted"
    END IF
    
    // 2. Fetch Member Snapshots for Financial Year
    snapshots = SELECT 
        member_id,
        AVG(total_shares) as avg_shares,
        COUNT(*) as snapshot_count
    FROM dividend_snapshots
    WHERE financial_year = run.financial_year
        AND member_id IN (SELECT id FROM members WHERE is_active = TRUE)
    GROUP BY member_id
    HAVING AVG(total_shares) > 0
    
    IF snapshots.isEmpty() THEN
        THROW ERROR "No member snapshots found for this financial year"
    END IF
    
    // 3. Calculate Total Average Shares (for dividend rate)
    totalAvgShares = SUM(snapshots.avg_shares)
    
    // 4. Update Run with Total Avg Shares
    UPDATE dividend_runs 
    SET total_avg_shares = totalAvgShares
    WHERE id = runId
    
    // 5. Calculate Dividend Rate (Auto-Generated by DB)
    // dividend_rate = (net_profit * share_out_percentage / 100) / total_avg_shares
    
    run.refresh()  // Reload to get generated dividend_rate
    
    // 6. Create Member Allocations
    totalGrossPayout = 0
    totalArrearsOffset = 0
    totalNetPayout = 0
    memberCount = 0
    
    FOR EACH member IN snapshots:
        
        // 6a. Get Member's Active Loan Arrears
        arrears = SELECT active_loan_arrears 
                  FROM members 
                  WHERE id = member.member_id
        
        // 6b. Calculate Gross Dividend (Auto by DB)
        // gross_dividend = avg_shares * dividend_rate
        
        grossDividend = member.avg_shares * run.dividend_rate
        arrearsOffset = MIN(arrears, grossDividend)  // Can't offset more than dividend
        netDividend = MAX(grossDividend - arrearsOffset, 0)
        
        // 6c. Insert Allocation
        INSERT INTO dividend_allocations (
            run_id,
            member_id,
            average_shares,
            snapshot_count,
            arrears_offset
        ) VALUES (
            runId,
            member.member_id,
            member.avg_shares,
            member.snapshot_count,
            arrearsOffset
        )
        
        // 6d. Accumulate Totals
        totalGrossPayout += grossDividend
        totalArrearsOffset += arrearsOffset
        totalNetPayout += netDividend
        memberCount += 1
    END FOR
    
    // 7. Update Run Summary
    UPDATE dividend_runs SET
        total_gross_payout = totalGrossPayout,
        total_arrears_offset = totalArrearsOffset,
        total_net_payout = totalNetPayout,
        total_members = memberCount,
        status = 'CALCULATED',
        calculated_at = CURRENT_TIMESTAMP,
        calculated_by = currentUserId
    WHERE id = runId
    
    // 8. Return Summary
    RETURN {
        success: TRUE,
        run_id: runId,
        total_members: memberCount,
        dividend_rate: run.dividend_rate,
        total_payout: totalNetPayout
    }
END FUNCTION
```

---

### **STEP 3: Calculate Average Shares (Detail)**

```pseudocode
FUNCTION calculateAverageShares(memberId, financialYear):
    
    // 1. Fetch All Snapshots for Member in Financial Year
    snapshots = SELECT total_shares 
                FROM dividend_snapshots
                WHERE member_id = memberId
                    AND financial_year = financialYear
                ORDER BY snapshot_date ASC
    
    IF snapshots.isEmpty() THEN
        RETURN 0
    END IF
    
    // 2. Calculate Simple Average
    totalShares = 0
    snapshotCount = 0
    
    FOR EACH snapshot IN snapshots:
        totalShares += snapshot.total_shares
        snapshotCount += 1
    END FOR
    
    averageShares = totalShares / snapshotCount
    
    RETURN {
        average_shares: averageShares,
        snapshot_count: snapshotCount
    }
END FUNCTION
```

**Example Calculation:**

```
Member: John Doe
Financial Year: 2026
Snapshots:
  - Jan-Feb: KES 50,000
  - Mar-Apr: KES 60,000
  - May-Jun: KES 70,000
  - Jul-Aug: KES 80,000
  - Sep-Oct: KES 90,000
  - Nov-Dec: KES 100,000

Average Shares = (50k + 60k + 70k + 80k + 90k + 100k) / 6
               = 450,000 / 6
               = KES 75,000
```

---

### **STEP 4: Calculate Dividend Rate**

```pseudocode
FUNCTION calculateDividendRate(netProfit, shareOutPercentage, totalAvgShares):
    
    // 1. Calculate Distributable Amount
    distributableAmount = netProfit * (shareOutPercentage / 100)
    
    // 2. Calculate Rate per Share
    IF totalAvgShares > 0 THEN
        dividendRate = distributableAmount / totalAvgShares
    ELSE
        dividendRate = 0
    END IF
    
    RETURN dividendRate
END FUNCTION
```

**Example Calculation:**

```
Net Profit: KES 1,000,000
Share-Out Policy: 70%
Total Avg Shares (All Members): KES 5,000,000

Distributable Amount = 1,000,000 * 0.70 = KES 700,000
Dividend Rate = 700,000 / 5,000,000 = 0.14 (14%)

Interpretation: Each KES 1 in average shares earns KES 0.14 dividend
```

---

### **STEP 5: Calculate Member Dividend**

```pseudocode
FUNCTION calculateMemberDividend(averageShares, dividendRate, arrears):
    
    // 1. Calculate Gross Dividend
    grossDividend = averageShares * dividendRate
    
    // 2. Apply Arrears Offset (Limited to Gross Amount)
    arrearsOffset = MIN(arrears, grossDividend)
    
    // 3. Calculate Net Dividend (Cannot be negative)
    netDividend = MAX(grossDividend - arrearsOffset, 0)
    
    RETURN {
        gross_dividend: grossDividend,
        arrears_offset: arrearsOffset,
        net_dividend: netDividend
    }
END FUNCTION
```

**Example Calculation:**

```
Member: Jane Smith
Average Shares: KES 75,000
Dividend Rate: 0.14 (14%)
Active Loan Arrears: KES 5,000

Gross Dividend = 75,000 * 0.14 = KES 10,500
Arrears Offset = MIN(5,000, 10,500) = KES 5,000
Net Dividend = 10,500 - 5,000 = KES 5,500

Result: KES 5,500 posted to savings, KES 5,000 deducted from arrears
```

---

### **STEP 6: Approve Dividend Run (Director)**

```pseudocode
FUNCTION approveDividendRun(runId, directorId):
    
    // 1. Validate User Role
    IF currentUser.role != 'director' THEN
        THROW ERROR "Only directors can approve dividend runs"
    END IF
    
    // 2. Validate Run Status
    run = SELECT * FROM dividend_runs WHERE id = runId
    
    IF run.status != 'CALCULATED' THEN
        THROW ERROR "Run must be calculated before approval"
    END IF
    
    // 3. Update Run Status
    UPDATE dividend_runs SET
        status = 'APPROVED',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = directorId
    WHERE id = runId
    
    RETURN {success: TRUE, message: "Dividend run approved"}
END FUNCTION
```

---

### **STEP 7: Post Dividends to Member Accounts**

```pseudocode
FUNCTION postDividendRun(runId, userId):
    
    // 1. Validate Run Status
    run = SELECT * FROM dividend_runs WHERE id = runId
    
    IF run.status != 'APPROVED' THEN
        THROW ERROR "Run must be approved before posting"
    END IF
    
    // 2. Fetch All Allocations
    allocations = SELECT * FROM dividend_allocations 
                  WHERE run_id = runId 
                    AND posted_to_savings = FALSE
    
    // 3. Begin Transaction
    BEGIN TRANSACTION
    
    totalPosted = 0
    
    FOR EACH allocation IN allocations:
        
        // 3a. Credit Member Savings
        UPDATE members 
        SET total_savings = total_savings + allocation.net_dividend
        WHERE id = allocation.member_id
        
        // 3b. Deduct from Dividend Reserves
        UPDATE financial_summary 
        SET total_dividend_reserves = total_dividend_reserves - allocation.net_dividend
        
        // 3c. If Arrears Offset Applied
        IF allocation.arrears_offset > 0 THEN
            
            // Reduce Member Arrears
            UPDATE members 
            SET active_loan_arrears = active_loan_arrears - allocation.arrears_offset
            WHERE id = allocation.member_id
            
            // Log Arrears Payment
            INSERT INTO transactions (
                member_id,
                transaction_type,
                amount,
                description,
                reference_number
            ) VALUES (
                allocation.member_id,
                'DividendArrearsOffset',
                allocation.arrears_offset,
                'Dividend offset for loan arrears',
                'DIV-' + runId
            )
        END IF
        
        // 3d. Log Dividend Payment
        INSERT INTO transactions (
            member_id,
            transaction_type,
            amount,
            description,
            reference_number
        ) VALUES (
            allocation.member_id,
            'DividendPayout',
            allocation.net_dividend,
            'Annual dividend payout for ' + run.financial_year,
            run.run_number
        )
        
        // 3e. Mark Allocation as Posted
        UPDATE dividend_allocations 
        SET posted_to_savings = TRUE,
            posted_at = CURRENT_TIMESTAMP
        WHERE id = allocation.id
        
        totalPosted += allocation.net_dividend
    END FOR
    
    // 4. Update Run Status
    UPDATE dividend_runs SET
        status = 'POSTED',
        posted_at = CURRENT_TIMESTAMP,
        posted_by = userId
    WHERE id = runId
    
    COMMIT TRANSACTION
    
    RETURN {
        success: TRUE,
        members_credited: allocations.count,
        total_amount: totalPosted
    }
    
CATCH ERROR:
    ROLLBACK TRANSACTION
    THROW ERROR "Posting failed: " + error.message
END FUNCTION
```

---

## 🔐 ROW LEVEL SECURITY (RLS) POLICIES

### Dividend Runs

```sql
-- Director Approval Required
CREATE POLICY "Directors can approve runs"
ON dividend_runs FOR UPDATE
USING (auth.jwt() ->> 'role' = 'director')
WITH CHECK (status IN ('CALCULATED', 'APPROVED'));

-- Read Access for All Authenticated
CREATE POLICY "Authenticated users can view runs"
ON dividend_runs FOR SELECT
USING (auth.role() = 'authenticated');

-- Create Access for Admin/Director
CREATE POLICY "Admin/Director can create runs"
ON dividend_runs FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'director'));
```

### Dividend Allocations

```sql
-- Members can view their own allocations
CREATE POLICY "Members view own allocations"
ON dividend_allocations FOR SELECT
USING (
    member_id = (auth.jwt() ->> 'member_id')::BIGINT
    OR auth.jwt() ->> 'role' IN ('admin', 'director', 'officer')
);

-- System-only modifications
CREATE POLICY "System manages allocations"
ON dividend_allocations FOR ALL
USING (auth.jwt() ->> 'role' IN ('admin', 'system'));
```

---

## 📈 COMPLETE EXAMPLE CALCULATION

### Scenario:
- **Financial Year**: 2026
- **Income**: KES 1,500,000
- **Expenses**: KES 800,000
- **Admin Costs**: KES 100,000
- **Share-Out Policy**: 70%

### Step-by-Step:

```
1. GROSS PROFIT
   = Income - Expenses
   = 1,500,000 - 800,000
   = KES 700,000

2. TRF DEDUCTIONS (15% Policy)
   Mandatory Reserves = 700,000 * 0.10 = KES 70,000
   Risk Buffer = 700,000 * 0.05 = KES 35,000
   Reinvested Capital = KES 0
   Total TRF = 70,000 + 35,000 + 0 = KES 105,000

3. NET PROFIT
   = Gross Profit - Admin Costs - TRF
   = 700,000 - 100,000 - 105,000
   = KES 495,000

4. DISTRIBUTABLE AMOUNT
   = Net Profit * Share-Out Policy
   = 495,000 * 0.70
   = KES 346,500

5. TOTAL AVERAGE SHARES (All Members)
   Member A: KES 50,000
   Member B: KES 75,000
   Member C: KES 100,000
   Total = KES 225,000

6. DIVIDEND RATE
   = Distributable Amount / Total Avg Shares
   = 346,500 / 225,000
   = 1.54 (154% return on shares)

7. MEMBER DIVIDENDS

   Member A:
   - Avg Shares: KES 50,000
   - Arrears: KES 0
   - Gross Dividend: 50,000 * 1.54 = KES 77,000
   - Arrears Offset: KES 0
   - Net Dividend: KES 77,000
   
   Member B:
   - Avg Shares: KES 75,000
   - Arrears: KES 20,000
   - Gross Dividend: 75,000 * 1.54 = KES 115,500
   - Arrears Offset: KES 20,000
   - Net Dividend: 115,500 - 20,000 = KES 95,500
   
   Member C:
   - Avg Shares: KES 100,000
   - Arrears: KES 5,000
   - Gross Dividend: 100,000 * 1.54 = KES 154,000
   - Arrears Offset: KES 5,000
   - Net Dividend: 154,000 - 5,000 = KES 149,000

8. TOTALS
   Total Gross Payout: 77,000 + 115,500 + 154,000 = KES 346,500 ✓
   Total Arrears Offset: 0 + 20,000 + 5,000 = KES 25,000
   Total Net Payout: 77,000 + 95,500 + 149,000 = KES 321,500
```

---

## 🎯 VALIDATION RULES

### Business Rules Enforced

1. **TRF Must Be 15%**: 10% Mandatory + 5% Risk Buffer
2. **Dividend Rate is System-Calculated**: No manual entry allowed
3. **Arrears Auto-Deducted**: Members with arrears get offset automatically
4. **Approval Required**: Director must approve before posting
5. **Immutable After Posting**: No changes allowed to POSTED runs
6. **Snapshot-Based**: Average shares must come from snapshots, not live data

### Data Integrity Checks

```sql
-- Ensure TRF is 15% of gross profit
CHECK (trf_deductions = gross_profit * 0.15)

-- Ensure net payout doesn't exceed distributable amount
CHECK (total_net_payout <= net_profit * share_out_percentage / 100)

-- Ensure all allocations sum up correctly
CHECK ((SELECT SUM(net_dividend) FROM dividend_allocations WHERE run_id = id) 
       = total_net_payout)
```

---

**END OF TECHNICAL SPECIFICATION**

This document provides the complete database schema and calculation pseudocode for implementing an institutional-grade dividend engine. All formulas are auditable, transparent, and policy-compliant.
