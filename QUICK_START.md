# 🚀 UKOMBOZI TBMS - QUICK START GUIDE

## ✅ WHAT'S READY

Your Table Banking Management System now has:
- ✅ Backend API (SQLite database)
- ✅ Frontend UI (React app)
- ✅ Group Registration
- ✅ Member Registration with Opening Balances
- ✅ Role-Based Access Control
- ✅ Audit Trail

---

## ⚡ START THE SYSTEM

### Terminal 1: Start Backend
```powershell
cd backend
node server.js
```
**Expected Output**:
```
Server running on http://localhost:5000
Connected to the SQLite database.
```

### Terminal 2: Start Frontend
```powershell
cd frontend
npm start
```
**Expected Output**:
```
Compiled successfully!
Local: http://localhost:3000
```

---

## 🎯 TEST SCENARIOS

### Scenario 1: Register a New Group
1. Navigate to `http://localhost:3000/admin`
2. Click "Groups Management" tab
3. Fill form:
   - Name: "Upendo Women Group"
   - Location: "Kibera"
   - Meeting Day: "Thursday"
4. Submit
✅ **Group created with zero opening balance**

### Scenario 2: Register New Member (Zero Opening Balance)
1. Go to Members page
2. Click "New Member"
3. Fill:
   - Name: "Mary Wanjiku"
   - Phone: "0712345678"
   - Group: "Upendo Women Group"
4. Leave opening balances at 0
5. Submit
✅ **Member created successfully**

### Scenario 3: Register Migrated Member (With Opening Balance)
**Role Required**: ADMIN or SUPERVISOR

1. Go to Members page
2. Click "New Member"
3. Fill basic details
4. **Opening Balances Section** (visible to Admin/Supervisor):
   - Savings: 50000
   - LTL: 0
   - STL: 0
   - Reason: "Migrated from Victory Group"
5. Submit
✅ **Member created with locked opening balance**

### Scenario 4: Field Officer Limitation
**Login as**: FIELD OFFICER

1. Go to Members page
2. Click "New Member"
✅ **Opening balance fields NOT visible**
✅ **Can only register members with zero opening balance**

---

## 📊 VERIFY DATA

### Check Groups
```sql
-- In backend directory
sqlite3 ukombozi.sqlite
SELECT * FROM groups;
```

### Check Members
```sql
SELECT 
    name, 
    opening_balance_savings as savings,
    opening_balance_reason as reason,
    opening_balance_locked as locked
FROM members;
```

---

## 🔧 TROUBLESHOOTING

### Backend won't start?
```powershell
cd backend
npm install
node server.js
```

### Frontend won't compile?
```powershell
cd frontend
npm install
npm start
```

### Database needs reset?
```powershell
cd backend
Remove-Item ukombozi.sqlite
node initDb.js
node server.js
```

---

## 📚 DOCUMENTATION

| Document | Purpose |
|----------|---------|
| `OPENING_BALANCE_RULES.md` | Complete specification of opening balance logic |
| `BACKEND_INTEGRATION_COMPLETE.md` | Backend implementation summary |
| `MEMBER_REGISTRATION_COMPLETE.md` | Member registration features |
| `README.md` | Project overview |

---

## 🎓 WHAT TO DO NEXT

### Immediate Testing:
1. ✅ Register 2-3 groups
2. ✅ Register members in each group
3. ✅ Test with different roles
4. ✅ Verify opening balances are locked

### Next Features to Implement:
1. **Meeting Workflow**
   - Start meeting
   - Enter transactions
   - Close meeting
   - Approve meeting

2. **Group Monthly Report**
   - View aggregated data
   - BF → CF flow
   - Transaction history

3. **Member Migrations**
   - Transfer between groups
   - Preserve opening balances
   - Audit trail

---

## 💪 YOU'RE READY!

Your system is now a **production-ready foundation** for Table Banking.

**The core principle is enforced**:
> Groups start at zero. Members have explicit opening balances. All changes are audited. No imaginary money.

**Go test it!** 🚀
