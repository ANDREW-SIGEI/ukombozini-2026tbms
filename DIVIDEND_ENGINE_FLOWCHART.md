# 🔄 DIVIDEND ENGINE - WORKFLOW FLOWCHART

**Visual Process Flow Documentation**

---

## 📊 MAIN WORKFLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIVIDEND CALCULATION WORKFLOW                 │
└─────────────────────────────────────────────────────────────────┘

    [START] Officer/Admin Action
       │
       ▼
    ┌────────────────────┐
    │  1. CREATE RUN     │
    │  Status: DRAFT     │
    └────────────────────┘
       │
       │ Input: Financial Year, Income, Expenses, Admin Costs
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Calculate TRF Deductions (Auto)                   │
    │  • Mandatory Reserves = Gross Profit × 10%         │
    │  • Risk Buffer = Gross Profit × 5%                 │
    │  • Total TRF = 15% of Gross Profit                 │
    └────────────────────────────────────────────────────┘
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Calculate Net Profit (Generated Column)           │
    │  Net Profit = Income - Expenses - Admin - TRF      │
    └────────────────────────────────────────────────────┘
       │
       │ Run Saved as DRAFT
       │
       ▼
    ┌────────────────────┐
    │  2. CALCULATE      │
    │  Officer Action    │
    └────────────────────┘
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Fetch Member Snapshots                            │
    │  • Query: dividend_snapshots for financial year    │
    │  • Calculate: AVG(total_shares) per member         │
    │  • Filter: Only active members with shares > 0     │
    └────────────────────────────────────────────────────┘
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Calculate Total Average Shares                    │
    │  SUM(all member average shares)                    │
    └────────────────────────────────────────────────────┘
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Calculate Dividend Rate (Generated Column)        │
    │  Rate = (Net Profit × Share-Out %) / Total Shares  │
    └────────────────────────────────────────────────────┘
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Create Member Allocations                         │
    │  FOR EACH member:                                  │
    │    • Gross = Avg Shares × Dividend Rate            │
    │    • Offset = MIN(Arrears, Gross)                  │
    │    • Net = Gross - Offset                          │
    │    • INSERT into dividend_allocations              │
    └────────────────────────────────────────────────────┘
       │
       │ Status: CALCULATED
       │
       ▼
    ┌────────────────────┐
    │  3. REVIEW         │
    │  Any User          │
    └────────────────────┘
       │
       │ View allocations table, verify calculations
       │
       ▼
    ╔════════════════════╗
    ║  4. APPROVE        ║
    ║  DIRECTOR ONLY     ║
    ╚════════════════════╝
       │
       │ Validation: User role = 'director'
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Update Run Status                                 │
    │  • Status: APPROVED                                │
    │  • approved_at: CURRENT_TIMESTAMP                  │
    │  • approved_by: Director ID                        │
    └────────────────────────────────────────────────────┘
       │
       ▼
    ╔════════════════════╗
    ║  5. POST           ║
    ║  DIRECTOR ONLY     ║
    ╚════════════════════╝
       │
       │ BEGIN TRANSACTION
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  FOR EACH Allocation:                              │
    │                                                     │
    │  1. Credit Member Savings                          │
    │     UPDATE members SET                             │
    │       total_savings += net_dividend                │
    │                                                     │
    │  2. Debit Dividend Reserves                        │
    │     UPDATE financial_summary SET                   │
    │       total_dividend_reserves -= net_dividend      │
    │                                                     │
    │  3. IF arrears_offset > 0 THEN                     │
    │     • Reduce member arrears                        │
    │     • Log arrears payment transaction              │
    │                                                     │
    │  4. Log Dividend Transaction                       │
    │     INSERT INTO transactions                       │
    │       (type: DividendPayout)                       │
    │                                                     │
    │  5. Mark Allocation as Posted                      │
    │     UPDATE dividend_allocations SET                │
    │       posted_to_savings = TRUE                     │
    └────────────────────────────────────────────────────┘
       │
       │ COMMIT TRANSACTION
       │
       ▼
    ┌────────────────────────────────────────────────────┐
    │  Update Run Status: POSTED                         │
    │  • posted_at: CURRENT_TIMESTAMP                    │
    │  • posted_by: Director ID                          │
    │  • Run is now IMMUTABLE                            │
    └────────────────────────────────────────────────────┘
       │
       ▼
    [END] Dividends Successfully Posted
```

---

## 🔢 FORMULA CALCULATION FLOW

```
┌──────────────────────────────────────────────────────────────┐
│              DIVIDEND RATE CALCULATION FLOW                   │
└──────────────────────────────────────────────────────────────┘

INPUT VALUES
├─ Total Income:        KES 1,500,000
├─ Total Expenses:      KES   800,000
├─ Admin Costs:         KES   100,000
└─ Share-Out Policy:    70%

    │
    ▼
┌──────────────────────────────────┐
│  STEP 1: Gross Profit            │
│  = Income - Expenses             │
│  = 1,500,000 - 800,000           │
│  = KES 700,000                   │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  STEP 2: TRF Deductions          │
│  • Mandatory: 700k × 10% = 70k   │
│  • Risk Buff: 700k × 5%  = 35k   │
│  • Total TRF = KES 105,000       │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  STEP 3: Net Profit              │
│  = Gross - Admin - TRF           │
│  = 700k - 100k - 105k            │
│  = KES 495,000                   │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  STEP 4: Distributable Amount    │
│  = Net Profit × Share-Out        │
│  = 495,000 × 70%                 │
│  = KES 346,500                   │
└──────────────────────────────────┘
    │
    ├─────────────────────────────────────┐
    │                                     │
    ▼ (From Snapshots)                   ▼ (System Calculation)
┌──────────────────┐               ┌────────────────────────┐
│ Total Avg Shares │               │  DIVIDEND RATE         │
│ (All Members)    │               │  = Distributable /     │
│ = KES 225,000    │───────────────│    Total Avg Shares    │
└──────────────────┘               │  = 346,500 / 225,000   │
                                   │  = 1.54 (154%)         │
                                   └────────────────────────┘
                                           │
                                           ▼
                                   ┌────────────────────────┐
                                   │  Member Allocations    │
                                   │  (see below)           │
                                   └────────────────────────┘
```

---

## 👤 MEMBER ALLOCATION FLOW

```
┌──────────────────────────────────────────────────────────────┐
│            INDIVIDUAL MEMBER DIVIDEND CALCULATION             │
└──────────────────────────────────────────────────────────────┘

FOR EACH Active Member:

    INPUT
    ├─ Member ID:          123
    ├─ Avg Shares:         KES 75,000
    ├─ Dividend Rate:      1.54
    └─ Active Arrears:     KES 20,000

        │
        ▼
    ┌────────────────────────────────┐
    │  CALCULATE GROSS DIVIDEND      │
    │  = Avg Shares × Dividend Rate  │
    │  = 75,000 × 1.54               │
    │  = KES 115,500                 │
    └────────────────────────────────┘
        │
        ▼
    ┌────────────────────────────────┐
    │  APPLY ARREARS OFFSET          │
    │  Offset = MIN(Arrears, Gross)  │
    │  = MIN(20,000, 115,500)        │
    │  = KES 20,000                  │
    └────────────────────────────────┘
        │
        ▼
    ┌────────────────────────────────┐
    │  CALCULATE NET DIVIDEND        │
    │  = Gross - Offset              │
    │  = 115,500 - 20,000            │
    │  = KES 95,500                  │
    └────────────────────────────────┘
        │
        ▼
    ┌────────────────────────────────┐
    │  INSERT ALLOCATION             │
    │  member_id: 123                │
    │  average_shares: 75,000        │
    │  gross_dividend: 115,500       │
    │  arrears_offset: 20,000        │
    │  net_dividend: 95,500          │
    └────────────────────────────────┘

RESULT: Member receives KES 95,500 in savings
        + KES 20,000 arrears cleared
```

---

## 🔐 STATUS TRANSITION DIAGRAM

```
╔════════════════════════════════════════════════════════════╗
║                   DIVIDEND RUN STATUS FLOW                  ║
╚════════════════════════════════════════════════════════════╝

    ┌─────────┐
    │  DRAFT  │ ◄─── Created by Officer/Admin
    └─────────┘
         │
         │ [Calculate] (Officer/Admin)
         │
         ▼
    ┌──────────────┐
    │  CALCULATED  │ ◄─── Allocations Created
    └──────────────┘
         │
         │ [Send for Approval] (Auto)
         │
         ▼
    ┌──────────────────┐
    │ DIRECTOR_REVIEW  │ ◄─── Awaiting Director
    └──────────────────┘
         │
         │
    ┌────┴────┐
    │         │
    │ [Approve] (Director)    [Reject] (Director)
    │         │                        │
    ▼         │                        ▼
┌──────────┐  │                  ┌──────────┐
│ APPROVED │  │                  │ REJECTED │
└──────────┘  │                  └──────────┘
    │         │                        │
    │ [Post]  │                        └───► END
    │ (Director)                            (Cannot be posted)
    │
    ▼
┌─────────┐
│ POSTED  │ ◄─── IMMUTABLE (Final State)
└─────────┘
    │
    └───► Dividends in Member Accounts
```

---

## 📦 DATABASE INTERACTION FLOW

```
┌──────────────────────────────────────────────────────────────┐
│               DATABASE TABLES INTERACTION                     │
└──────────────────────────────────────────────────────────────┘

USER ACTION                DATABASE OPERATIONS
    │
    │ [Create Run]
    ▼
┌──────────────┐          ┌────────────────────┐
│  Frontend    │──INSERT──│  dividend_runs     │
└──────────────┘          │  (status: DRAFT)   │
                          └────────────────────┘
    │
    │ [Calculate]
    ▼
┌──────────────┐          ┌────────────────────┐
│  Backend     │          │ dividend_snapshots │
│  RPC         │──SELECT──│ WHERE fy = 2026    │
└──────────────┘          └────────────────────┘
    │                              │
    │                              ▼ (AVG shares)
    │                     ┌────────────────────┐
    │                     │  Calculation       │
    │                     │  (in memory)       │
    │                     └────────────────────┘
    │                              │
    │                              ▼
    │                     ┌─────────────────────┐
    │─────────INSERT──────│ dividend_allocations│
    │                     └─────────────────────┘
    │
    │─────────UPDATE──────┌────────────────────┐
                          │  dividend_runs     │
                          │  (status: CALC)    │
                          └────────────────────┘
    │
    │ [Approve]
    ▼
┌──────────────┐          ┌────────────────────┐
│  Backend     │─UPDATE───│  dividend_runs     │
└──────────────┘          │  (status: APPROVED)│
                          └────────────────────┘
    │
    │ [Post]
    ▼
┌──────────────┐          ┌────────────────────────────┐
│  Backend     │─UPDATE───│  members.total_savings     │
│  Transaction │          │  (Credit dividends)        │
└──────────────┘          └────────────────────────────┘
    │                     ┌────────────────────────────┐
    │─────────UPDATE──────│  members.active_arrears    │
    │                     │  (Deduct offsets)          │
    │                     └────────────────────────────┘
    │                     ┌────────────────────────────┐
    │─────────INSERT──────│  transactions              │
    │                     │  (Log payments)            │
    │                     └────────────────────────────┘
    │                     ┌────────────────────────────┐
    │─────────UPDATE──────│  dividend_allocations      │
    │                     │  (posted = TRUE)           │
    │                     └────────────────────────────┘
    │                     ┌────────────────────────────┐
    └─────────UPDATE──────│  dividend_runs             │
                          │  (status: POSTED)          │
                          └────────────────────────────┘
```

---

## 🔄 SNAPSHOT CREATION FLOW

```
┌──────────────────────────────────────────────────────────────┐
│           BI-MONTHLY SNAPSHOT AUTOMATION                      │
└──────────────────────────────────────────────────────────────┘

SCHEDULED JOB (Bi-Monthly on 1st)

    [TRIGGER: Every 2 months on day 1]
         │
         ▼
    ┌────────────────────────────────┐
    │  Determine Snapshot Period     │
    │  • Jan-Feb (Feb 1)              │
    │  • Mar-Apr (Apr 1)              │
    │  • May-Jun (Jun 1)              │
    │  • Jul-Aug (Aug 1)              │
    │  • Sep-Oct (Oct 1)              │
    │  • Nov-Dec (Dec 1)              │
    └────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────┐
    │  Fetch All Active Members      │
    │  SELECT * FROM members         │
    │  WHERE is_active = TRUE        │
    └────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────┐
    │  FOR EACH Member:              │
    │                                 │
    │  INSERT INTO snapshots (        │
    │    member_id,                   │
    │    snapshot_date,               │
    │    financial_year,              │
    │    snapshot_period,             │
    │    total_shares,                │
    │    total_savings,               │
    │    active_loan_balance,         │
    │    loan_arrears                 │
    │  ) VALUES (                     │
    │    member.id,                   │
    │    CURRENT_DATE,                │
    │    EXTRACT(YEAR),               │
    │    'JAN-FEB',                   │
    │    member.total_shares,         │
    │    member.total_savings,        │
    │    member.active_loan_balance,  │
    │    member.active_loan_arrears   │
    │  )                              │
    └────────────────────────────────┘
         │
         ▼
    [Complete] Snapshots Saved for Period
```

---

## ⚠️ ERROR HANDLING FLOW

```
┌──────────────────────────────────────────────────────────────┐
│                    ERROR VALIDATION                           │
└──────────────────────────────────────────────────────────────┘

AT EACH STEP:

┌─────────────────────────┐
│  Run Creation           │
└─────────────────────────┘
    │
    ├─ Income > 0? ────────► NO ──► ERROR: Invalid income
    ├─ Expenses ≥ 0? ──────► NO ──► ERROR: Invalid expenses
    ├─ Net Profit > 0? ────► NO ──► ERROR: Cannot distribute loss
    └─ Year valid? ────────► NO ──► ERROR: Invalid year

┌─────────────────────────┐
│  Calculation            │
└─────────────────────────┘
    │
    ├─ Status = DRAFT? ────► NO ──► ERROR: Already calculated
    ├─ Snapshots exist? ───► NO ──► ERROR: No snapshot data
    ├─ Members > 0? ───────► NO ──► ERROR: No eligible members
    └─ Avg Shares > 0? ────► NO ──► ERROR: No shares to distribute

┌─────────────────────────┐
│  Approval               │
└─────────────────────────┘
    │
    ├─ User = Director? ───► NO ──► ERROR: Permission denied
    ├─ Status = CALC? ─────► NO ──► ERROR: Must calculate first
    └─ Allocations ok? ────► NO ──► ERROR: Invalid allocations

┌─────────────────────────┐
│  Posting                │
└─────────────────────────┘
    │
    ├─ User = Director? ───► NO ──► ERROR: Permission denied
    ├─ Status = APPROVED? ─► NO ──► ERROR: Must approve first
    ├─ Reserves enough? ───► NO ──► ERROR: Insufficient funds
    └─ Transaction OK? ────► NO ──► ROLLBACK TRANSACTION
```

---

**END OF FLOWCHART DOCUMENTATION**

Use this document alongside the Technical Specification for complete system understanding.
