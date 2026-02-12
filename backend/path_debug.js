const path = require('path');
const fs = require('fs');

const governancePath = path.resolve(__dirname, 'routes/governance.js');
const riskServicePath = path.resolve(__dirname, 'services/RiskService.js');

console.log('Governance Path:', governancePath);
console.log('Governance Exists:', fs.existsSync(governancePath));
console.log('RiskService Path:', riskServicePath);
console.log('RiskService Exists:', fs.existsSync(riskServicePath));

try {
    require('./routes/governance');
    console.log('Successfully required governance');
} catch (err) {
    console.error('Failed to require governance:', err.message);
    if (err.stack) console.error(err.stack);
}
