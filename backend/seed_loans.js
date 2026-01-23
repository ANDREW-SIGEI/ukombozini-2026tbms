const db = require('./db');

const seedLoans = () => {
    console.log("Seeding sample loans...");

    // Get members first
    db.all("SELECT id FROM members", [], (err, members) => {
        if (err || !members || members.length === 0) {
            console.log("No members found. Run main seed first.");
            return;
        }

        const member1 = members[0].id;
        const member2 = members[1] ? members[1].id : member1;

        const stmt = db.prepare(`INSERT INTO loans (
            member_id, group_id, loan_type, principal_amount, interest_rate, 
            issued_date, due_date, status, issued_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        // Loan 1: Active STL
        stmt.run(member1, 1, 'STL', 5000, 10, '2026-01-01', '2026-02-01', 'active', 1);

        // Loan 2: Active LTL
        stmt.run(member2, 1, 'LTL', 50000, 15, '2025-12-01', '2027-12-01', 'active', 1);

        // Loan 3: Closed
        stmt.run(member1, 1, 'STL', 2000, 10, '2025-10-01', '2025-11-01', 'completed', 1);

        // Loan 4: Defaulted
        stmt.run(member2, 1, 'STL', 10000, 10, '2025-06-01', '2025-07-01', 'defaulted', 1);

        stmt.finalize();
        console.log("Loans seeded successfully.");
    });
};

seedLoans();
