# Partnership Hub End-to-End Test Protocol

This protocol guides you through testing the entire lifecycle of a group partnership, from initial security deposit to member financing.

## 1. Test Subjects
*   **Target Group:** EVERGREEN (ID: 1)
*   **Target Member:** Bob (ID: 2)

## 2. Test Workflow

### Step A: Capital Injection (Security)
1.  Navigate to **Partnership Hub** > **Capital Injection** tab.
2.  In **Section 1 (Record Security Deposit)**:
    *   Amount: `10,000`
    *   Notes: `Initial E2E Test Deposit`
3.  Click **SECURE DEPOSIT NOW**.
4.  **Verification:** Success toast appears. The "Physical Deposits" table below should show a new entry for 10,000.

### Step B: Capital Injection (Matching Top-Up)
1.  Still in the **Capital Injection** tab, go to **Section 2 (Request Company Top-Up)**.
2.  Basis: `10,000`
3.  **Verification:** The blue box should automatically show `KES 50,000` (5x leverage).
4.  Click **SUBMIT TOP-UP REQUEST**.
5.  **Verification:** The "Top-Up Requests" table below should show a `PENDING` request for 50,000.

### Step C: Administrative Approval
1.  Navigate to the **Approval Queue** tab.
2.  Locate the request for **EVERGREEN**.
3.  Click **✅ APPROVE**.
4.  **Verification:** Success toast appear.

### Step D: Portfolio Verification
1.  Navigate to the **Overview** tab.
2.  **Verification**:
    *   **Total Company Investment** should have increased by `50,000`.
    *   **Group Commitments Held** should have increased by `10,000`.
    *   **Net Exposure** (in the top-right card) should reflect a more positive security surplus.

### Step E: Product Financing (Member Level)
1.  Navigate to the **Product Financing** tab.
2.  Select **Bob** from the member dropdown.
    *   Product: `Solar Kit X5`
    *   Total Value: `15,000`
    *   Deposit Paid: `3,000`
    *   Monthly Installment: `1,250`
3.  Click **AUTHORIZE FINANCING & DISPATCH**.
4.  **Verification:** Success toast appear.

---
> [!TIP]
> This test covers the full integration between the **Frontend UI**, **Partnership API**, and the **MTE v2 financial core**.
