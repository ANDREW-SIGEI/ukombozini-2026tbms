# 📱 SMS AUTOMATION TESTING GUIDE - AfricasTalking Setup

## ✅ STATUS: READY FOR TESTING

**Created:** 20 January 2026  
**Test Page:** `/sms-automation-test`  
**Service:** AfricasTalking Sandbox (FREE testing)

---

## 🎯 WHAT WE'VE PREPARED:

1. ✅ **SMSAutomationTest page** created
2. ✅ **Route added** (`/sms-automation-test`)
3. ✅ **AutomatedReminderService** integrated
4. ✅ **8 SMS templates** ready
5. ✅ **Test interface** with live preview

---

## 🚀 QUICK START (5 MINUTES):

### **STEP 1: Create AfricasTalking Account** (2 minutes)

1. **Go to AfricasTalking:**
   - Open: [https://account.africastalking.com/auth/register](https://account.africastalking.com/auth/register)
   
2. **Sign Up (FREE):**
   - Enter your details
   - Verify email
   - Login to dashboard

3. **Activate Sandbox (Automatic):**
   - You'll automatically get sandbox account
   - **Free SMS credits** for testing!
   - No credit card required

---

### **STEP 2: Get Your API Key** (1 minute)

1. **In AfricasTalking Dashboard:**
   - Click **"Go to Sandbox App"** (top right)
   - Or go to: Settings → API Key

2. **Generate/Copy API Key:**
   - Click **"Generate API Key"**
   - Copy the key (looks like: `atsk_xxxxxxxxxxxxxxxxxxxx`)
   - **IMPORTANT:** Save it somewhere safe!

3. **Note Your Username:**
   - For sandbox, username is always: `sandbox`
   - For production, you'll create a custom username

---

### **STEP 3: Add Your Phone Number** (1 minute)

**IMPORTANT:** Sandbox only sends to pre-registered numbers!

1. **In Sandbox Dashboard:**
   - Go to **"Launch Simulator"**
   - Or: Settings → Phone Numbers

2. **Add Your Number:**
   - Click **"Add Phone Number"**
   - Enter: `+254712345678` (your actual number with country code)
   - Verify via SMS code sent to your phone

3. **Confirm Added:**
   - You should see your number in the list
   - Status: "Verified"

---

### **STEP 4: Configure UKOMBOZI** (1 minute)

1. **Open .env file:**
   ```bash
   notepad "c:\Users\HILDA SIGEI\OneDrive\Desktop\ukombozini-2026tbms\frontend\.env"
   ```

2. **Add Your Credentials:**
   Replace these lines:
   ```env
   REACT_APP_SMS_API_KEY=your-africastalking-api-key-here
   REACT_APP_SMS_USERNAME=sandbox
   ```
   
   With YOUR actual API key:
   ```env
   REACT_APP_SMS_API_KEY=atsk_xxxxxxxxxxxxxxxxxxxx
   REACT_APP_SMS_USERNAME=sandbox
   ```

3. **Save the file** (Ctrl+S)

---

### **STEP 5: Restart Server** (30 seconds)

1. **Stop the server:**
   - Press `Ctrl+C` in terminal

2. **Start again:**
   ```bash
   npm start
   ```

3. **Wait for:**
   ```
   Compiled successfully!
   ```

---

### **STEP 6: Test SMS!** (1 minute)

1. **Open Test Page:**
   - Go to: `http://localhost:3000/sms-automation-test`
   - Or add link to sidebar

2. **Configuration Check:**
   - Should see **"✓ Ready"** status
   - If yellow "⚠ Pending", check .env file

3. **Send Test SMS:**
   - Enter your phone number (the one you added to sandbox)
   - Select a template (e.g., "Contribution Reminder")
   - Click **"Send Test SMS"**
   - **Wait 10-30 seconds**
   - **Check your phone!** 📱

---

## 📱 TEST SCENARIOS:

### **Test 1: Single SMS**
✅ **What:** Send one test message  
✅ **How:** Use "Test Single SMS" section  
✅ **Expected:** SMS received in 10-30 seconds

---

### **Test 2: Contribution Reminders**
✅ **What:** Test bulk sending to 3 members  
✅ **How:** Click "Contribution Reminders" card  
✅ **Expected:** 3 SMS sent (to mock member numbers)

---

### **Test 3: Loan Repayment Reminders**
✅ **What:** Test loan payment alerts  
✅ **How:** Click "Loan Reminders" card  
✅ **Expected:** 1 SMS with loan details

---

### **Test 4: Meeting Notifications**
✅ **What:** Test meeting invitations  
✅ **How:** Click "Meeting Notification" card  
✅ **Expected:** 2 SMS with meeting info

---

## 📋 AVAILABLE SMS TEMPLATES:

| Template | Use Case | Variables |
|----------|----------|-----------|
| **Contribution Reminder** | Monthly payment reminder | name, month, amount |
| **Loan Reminder** | 3 days before due date | name, amount, date |
| **Overdue Alert** | Missed payments | name, amount, days |
| **Meeting Notification** | Upcoming meetings | date, time, venue |
| **Welcome Member** | New member signup | name, amount |
| **Loan Approved** | Approval notification | name, amount, date |
| **Loan Rejected** | Rejection notification | name, reason |
| **Contribution Confirmed** | Payment received | amount, newBalance |

---

## 🎨 SAMPLE MESSAGES:

### **Contribution Reminder:**
```
Dear Hilda Sigei,

🔔 REMINDER: Your January 2026 contribution of KES 2,000 is due.

Group: Ukombozi Group A
Current Savings: KES 95,000

Pay at the next meeting or mobile money.

UKOMBOZI Table Banking
```

### **Loan Repayment Reminder:**
```
Dear John Doe,

⏰ LOAN PAYMENT DUE IN 3 DAYS

Loan ID: L-001
Amount Due: KES 2,000
Due Date: 25 Jan 2026
Remaining Balance: KES 14,000

Please ensure payment is made on time to avoid penalties.

UKOMBOZI Table Banking
```

### **Meeting Notification:**
```
📅 MEETING REMINDER

Dear Jane Smith,

Group: Ukombozi Group A
Meeting #14
Date: Saturday, 25 January 2026
Time: 2:00 PM
Venue: Community Hall

Please bring:
✓ Monthly contribution (KES 2,000)
✓ Loan repayments (if applicable)
✓ Member ID

UKOMBOZI Table Banking
```

---

## 🐛 TROUBLESHOOTING:

### **Problem: "API key not configured"**
**Solution:**
1. Check `.env` file exists
2. Verify `REACT_APP_SMS_API_KEY` is set
3. Restart server (Ctrl+C, then `npm start`)

---

### **Problem: "Failed to send: Invalid credentials"**
**Solution:**
1. Verify API key is correct
2. Check you copied the full key (starts with `atsk_`)
3. Username should be `sandbox` (not your email)

---

### **Problem: "SMS not received"**
**Solution:**
1. Verify phone number is added to sandbox
2. Check you used correct format: `+254712345678`
3. Wait up to 2 minutes (sometimes delayed)
4. Check spam/unknown senders folder

---

### **Problem: "Phone number not in sandbox"**
**Solution:**
1. Go to AfricasTalking Sandbox
2. Add phone number with country code
3. Verify via SMS code
4. Try again

---

### **Problem: "Out of sandbox credits"**
**Solution:**
1. Sandbox gives limited free credits
2. Check balance in AfricasTalking dashboard
3. Option 1: Wait 24 hours for reset
4. Option 2: Upgrade to paid account (very cheap)

---

## 💰 COST INFORMATION:

### **Sandbox (Testing):**
- **Cost:** FREE ✅
- **Credits:** Limited (usually 100 SMS)
- **Numbers:** Must add to sandbox
- **Use:** Testing only

### **Production:**
- **Cost:** KES 0.80 per SMS
- **Credits:** Pay as you go
- **Numbers:** Send to any number
- **Use:** Live deployment

**Example:**
- 100 members × 4 SMS/month = 400 SMS
- Cost: 400 × KES 0.80 = **KES 320/month**
- Very affordable! 💰

---

## 🔄 PRODUCTION DEPLOYMENT:

When ready to go live:

1. **Upgrade to Production:**
   - In AfricasTalking dashboard
   - Create production app
   - Add funds (M-PESA/Card)

2. **Get Production Credentials:**
   - Create username (not "sandbox")
   - Get production API key
   - Update shortcode (optional)

3. **Update .env:**
   ```env
   REACT_APP_SMS_API_KEY=your-production-api-key
   REACT_APP_SMS_USERNAME=your-production-username
   ```

4. **No Code Changes Needed!**
   - Same code works for production
   - Just update credentials
   - Restart server

---

## 📊 MONITORING & LOGS:

### **In UKOMBOZI:**
- Test page shows results in real-time
- Success/failure status for each SMS
- Error messages if failed

### **In AfricasTalking Dashboard:**
- Go to: Reports → SMS
- See all sent messages
- Delivery status
- Cost breakdown
- Failed message reasons

---

## ✅ SUCCESS CHECKLIST:

- [ ] AfricasTalking account created
- [ ] Sandbox activated
- [ ] API key generated and saved
- [ ] Phone number added to sandbox
- [ ] Phone number verified
- [ ] Credentials added to `.env`
- [ ] Server restarted
- [ ] Test page accessible (`/sms-automation-test`)
- [ ] Configuration shows "✓ Ready"
- [ ] Test SMS sent successfully
- [ ] SMS received on phone

**All checked?** 🎉 **You're ready to automate SMS!**

---

## 🚀 NEXT STEPS:

### **After Testing Works:**

1. **Integrate into Dashboards:**
   - Add "Send Reminder" buttons
   - One-click SMS from compliance dashboard
   - Automatic triggers

2. **Set Up Scheduler (Backend):**
   - Cron job for monthly reminders
   - Daily loan reminders
   - Meeting notifications

3. **Production Deployment:**
   - Upgrade to production API
   - Add funds
   - Go live!

---

## 📞 SUPPORT:

### **AfricasTalking:**
- Documentation: [https://developers.africastalking.com/docs/sms/overview](https://developers.africastalking.com/docs/sms/overview)
- Support: support@africastalking.com
- Phone: +254-20-5172800

### **UKOMBOZI:**
- Check `ADDITIONAL_FEATURES_COMPLETE.md` for detailed docs
- Test page: `/sms-automation-test`
- Service file: `AutomatedReminderService.js`

---

## 🎯 TESTING TIPS:

1. **Start Small:** Test with 1 SMS first
2. **Use Your Number:** Always test on yourself
3. **Check Logs:** Monitor in both UKOMBOZI and AfricasTalking
4. **Rate Limiting:** Service waits 1 second between messages
5. **Sandbox Limits:** Don't exhaust free credits in one test

---

**Ready to test? Let's send your first automated SMS!** 🚀

**Test Page:** `http://localhost:3000/sms-automation-test`

---

**Guide Version:** 1.0  
**Last Updated:** 20 January 2026  
**Estimated Setup Time:** 5-10 minutes  
**Difficulty:** Easy ✅
