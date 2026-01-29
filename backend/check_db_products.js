const db = require('./db');

console.log("Checking loan_products table...");
db.all("SELECT * FROM loan_products", [], (err, rows) => {
    if (err) {
        console.error("Query failed:", err.message);
    } else {
        console.log(`Found ${rows.length} products.`);
        rows.forEach(r => {
            console.log(`[${r.code}] ${r.name}: Amount=${r.loan_amount}, Installment=${r.monthly_installment}, Months=${r.repayment_period_months}`);
        });
    }
    process.exit();
});
