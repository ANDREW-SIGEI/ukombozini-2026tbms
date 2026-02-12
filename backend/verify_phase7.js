const { getSeasonalGreeting } = require('./utils/dates');

function verifySeasonalGreetings() {
    console.log("🚀 Starting Phase 7: Seasonal Greetings Verification...");

    const testCases = [
        { date: '2026-12-10', expected: "", name: "Pre-Xmas" },
        { date: '2026-12-15', expected: " 🎄 Merry Xmas!", name: "Xmas Start" },
        { date: '2026-12-25', expected: " 🎄 Merry Xmas!", name: "Xmas Day" },
        { date: '2026-12-26', expected: " 🎄 Merry Xmas!", name: "Xmas End" },
        { date: '2026-12-27', expected: " 🥳 Happy New Year!", name: "NY Start" },
        { date: '2027-01-01', expected: " 🥳 Happy New Year!", name: "NY Day" },
        { date: '2027-01-05', expected: " 🥳 Happy New Year!", name: "NY End" },
        { date: '2027-01-10', expected: "", name: "Post-NY" }
    ];

    let allPassed = true;

    testCases.forEach(tc => {
        // Mock Date
        const originalDate = global.Date;
        global.Date = class extends originalDate {
            constructor() {
                super(tc.date);
            }
            getDate() { return new originalDate(tc.date).getDate(); }
            getMonth() { return new originalDate(tc.date).getMonth(); }
        };

        const result = getSeasonalGreeting();
        const status = result === tc.expected ? "✅" : "❌";
        console.log(`${status} [${tc.name} - ${tc.date}]: Result: "${result}" | Expected: "${tc.expected}"`);

        if (result !== tc.expected) allPassed = false;

        // Restore Date
        global.Date = originalDate;
    });

    if (allPassed) {
        console.log("\n🎊 All seasonal greeting test cases PASSED!");
    } else {
        console.error("\n💀 Some seasonal greeting test cases FAILED!");
        process.exit(1);
    }

    process.exit(0);
}

verifySeasonalGreetings();
