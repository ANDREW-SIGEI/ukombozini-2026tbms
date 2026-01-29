const db = require('./db');
const fs = require('fs');
const path = require('path');

const seedLoanProducts = () => {
    console.log("Seeding Loan Products...");

    const sqlPath = path.join(__dirname, '011_loan_products.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    db.exec(sql, (err) => {
        if (err) {
            console.error("Seeding failed:", err.message);
        } else {
            console.log("Loan Products seeded successfully.");
        }
        process.exit();
    });
};

seedLoanProducts();
