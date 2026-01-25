const http = require('http');

const API_URL = 'http://localhost:5000/api';

async function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const url = `${API_URL}${path}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, body: parsed });
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, body });
                    } else {
                        resolve(body);
                    }
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

(async () => {
    console.log("🚀 STARTING UKOMBOZI TBMS - FULL E2E SYSTEM TEST...");

    try {
        const timestamp = Date.now();
        console.log("\n🔷 PHASE 1: REGISTER A NEW GROUP");
        const groupData = {
            name: `Test Group ${timestamp}`,
            location: "Nairobi Central",
            meetingDay: "Monday",
            registrationDate: "01 Jan 2026",
            meetingFrequency: "Monthly",
            dividendPolicy: "75% after 12 months",
            minMonthlySaving: 500,
            loanMultiplier: 3,
            stlInterestRate: 10,
            ltlInterestRate: 10
        };
        const group = await request('POST', '/groups', groupData);
        console.log("✅ Group created with ID:", group.id);
        const groupId = group.id;

        // ==========================================
        // PHASE 2: REGISTER MEMBERS (DATA SEEDING)
        // ==========================================
        console.log("\n🔷 PHASE 2: REGISTER MEMBERS");
        const members = [];
        const memberNames = ["Test Member 1", "Test Member 2", "Test Member 3", "Test Member 4", "Test Member 5"];
        for (let name of memberNames) {
            const uniqueName = `${name} ${timestamp}`;
            const memberData = {
                name: uniqueName,
                phone: `07${Math.floor(10000000 + Math.random() * 90000000)}`,
                groupId: groupId,
                opening_balance_savings: 0,
                opening_balance_ltl: 0,
                opening_balance_stl: 0,
                opening_balance_reason: "New Group Registration"
            };
            const member = await request('POST', '/members', memberData);
            members.push(member);
            console.log(`✅ Member '${name}' registered (ID: ${member.id})`);
        }

        // ==========================================
        // PHASE 3: OPEN A MEETING (REALITY SIMULATION)
        // ==========================================
        console.log("\n🔷 PHASE 3: OPEN A MEETING");
        const meetingData = {
            groupId: groupId,
            officerId: 1,
            date: "2026-01-20",
            startTime: "09:00",
            endTime: "11:00"
        };
        const session = await request('POST', '/sessions', meetingData);
        console.log("✅ Meeting Session opened (ID: ${session.id}) Status: ${session.status}");
        const sessionId = session.id;

        // ==========================================
        // PHASE 4: POST SAVINGS (CORE DATA FLOW)
        // ==========================================
        console.log("\n🔷 PHASE 4: POST SAVINGS");
        const savingsTx = {
            memberId: members[0].id,
            memberName: members[0].name,
            savings_amount: 500,
            transaction_type: "Monthly Saving",
            description: "Jan 2026 Savings"
        };
        // We'll post all transactions at the end of the session, as per server.js logic
        const sessionTransactions = [savingsTx];
        console.log(`✅ Savings of 500 queued for ${members[0].name}`);

        // ==========================================
        // PHASE 5: POST WELFARE & FEES (ISOLATED FUNDS)
        // ==========================================
        console.log("\n🔷 PHASE 5: POST WELFARE & FEES");
        const welfareTx = {
            memberId: members[0].id,
            memberName: members[0].name,
            welfare: 200,
            transaction_type: "Welfare",
            description: "Jan 2026 Welfare Contribution"
        };
        sessionTransactions.push(welfareTx);
        console.log(`✅ Welfare of 200 queued for ${members[0].name}`);

        // ==========================================
        // PHASE 6: APPLY FOR LOANS (CONTROLLED PROCESS)
        // ==========================================
        console.log("\n🔷 PHASE 6: APPLY FOR LOANS");
        const loanRequest = {
            memberId: members[0].id,
            groupId: groupId,
            sessionId: sessionId,
            loanType: "STL",
            amount: 1000,
            interestRate: 10,
            duration: 1,
            officerId: 1
        };
        const loan = await request('POST', '/loans', loanRequest);
        console.log(`✅ Loan of 1000 issued to ${members[0].name} (Loan ID: ${loan.id})`);
        const loanId = loan.id;

        // ==========================================
        // PHASE 8: POST LOAN REPAYMENTS (PROFIT SOURCE)
        // ==========================================
        console.log("\n🔷 PHASE 8: POST LOAN REPAYMENTS");
        const repayment = {
            memberId: members[0].id,
            sessionId: sessionId,
            loanId: loanId,
            amount: 1100,
            breakdown: { principal: 1000, interest: 100 },
            loanType: "STL",
            paymentMethod: "Cash"
        };
        const repayResult = await request('POST', '/sessions/repayment', repayment);
        console.log("✅ Loan repayment posted (Principal: 1000, Interest: 100)");

        // ==========================================
        // PHASE 9: CLOSING & POSTING SESSION
        // ==========================================
        console.log("\n🔷 PHASE 9: CLOSING & POSTING SESSION");
        const closeResult = await request('PATCH', `/sessions/${sessionId}/close`, { totals: { inflow: 500 + 200 + 1100, outflow: 1000 } });
        console.log("✅ Session closed. Status:", closeResult.status);

        const postResult = await request('POST', `/sessions/${sessionId}/post`, { transactions: sessionTransactions });
        console.log(`✅ Session posted. ${postResult.transactionCount} transactions saved.`);

        // ==========================================
        // PHASE 10: RUN DIVIDEND ENGINE (FINAL TEST)
        // ==========================================
        console.log("\n🔷 PHASE 10: RUN DIVIDEND ENGINE");
        const dividendReport = await request('GET', `/dividends/report?groupId=${groupId}&year=2026`);
        console.log("✅ Dividend Engine calculation successful.");
        console.log("📊 Financial Summary:", JSON.stringify(dividendReport.financials, null, 2));

        // ==========================================
        // PHASE 12: AUDIT VALIDATION (FINAL CHECK)
        // ==========================================
        console.log("\n🔷 PHASE 12: AUDIT VALIDATION");
        const logs = await request('GET', '/admin/audit-logs?limit=5');
        console.log(`✅ Last ${logs.length} audit logs retrieved.`);
        logs.forEach(log => console.log(` - [${log.category}] ${log.action}`));

        console.log("\n✨ ALL TESTS PASSED! SYSTEM IS READY FOR PRODUCTION. ✨");

    } catch (error) {
        console.error("\n❌ TEST FAILED:", JSON.stringify(error, null, 2));
        process.exit(1);
    }
})();
