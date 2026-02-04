const { initCashControl } = require('./database/cash_control_schema');

initCashControl()
    .then(() => {
        console.log("SUCCESS: Cash Control Tables Initialized.");
        process.exit(0);
    })
    .catch(err => {
        console.error("FAILURE:", err);
        process.exit(1);
    });
