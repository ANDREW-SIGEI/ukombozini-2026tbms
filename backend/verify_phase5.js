const db = require('./db');
const { calculateNextMeeting } = require('./utils/dates');

async function verifyPhase5() {
    console.log("🚀 Starting Phase 5 Verification...");

    // 1. Test Next Meeting Calculation
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    console.log("--- Testing Next Meeting Calculation ---");
    days.forEach(day => {
        console.log(`${day}: ${calculateNextMeeting(day)}`);
    });

    // 2. Mock a Bulk Message Injection
    console.log("\n--- Simulating Bulk Message Injection ---");
    const person = {
        name: 'John Member',
        meetingDay: 'Wednesday',
        current_savings: 5600,
        project_balance: 1500,
        active_loan_balance: 12000,
        group_name: 'Victory Women'
    };

    const template = "Jambo [NAME]! Your Sav: KES [SAVINGS] | Projects: [PROJECT_BAL] | Loan: [LOAN_BAL]. Next Meeting: [NEXT_MEETING]. - UKOMBOZI";

    const nextMeeting = calculateNextMeeting(person.meetingDay);
    const finalMessage = template
        .replace(/\[NAME\]/g, person.name)
        .replace(/\[SAVINGS\]/g, (person.current_savings).toLocaleString())
        .replace(/\[PROJECT_BAL\]/g, (person.project_balance).toLocaleString())
        .replace(/\[LOAN_BAL\]/g, (person.active_loan_balance).toLocaleString())
        .replace(/\[NEXT_MEETING\]/g, nextMeeting);

    console.log("Template:", template);
    console.log("Resolved:", finalMessage);

    if (finalMessage.includes('5,600') && finalMessage.includes('1,500') && finalMessage.includes('12,000')) {
        console.log("✅ Variable injection logic confirmed.");
    } else {
        console.error("❌ Variable injection logic failed!");
    }

    process.exit(0);
}

verifyPhase5();
