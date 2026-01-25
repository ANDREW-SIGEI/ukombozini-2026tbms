const axios = require('axios');

async function testLoanApplication() {
    const payload = {
        memberId: 1,
        groupId: 1,
        loanType: "STL",
        amount: 5000,
        duration: 3,
        purpose: "Inventory purchase",
        monthly_installment: 1700,
        principal_portion: 1666,
        interest_portion: 34,
        shares_contribution: 0,
        officerId: 1
    };

    try {
        console.log('Submitting loan application...');
        const response = await axios.post('http://localhost:5000/api/loan-applications', payload);
        console.log('Submission Response:', response.data);

        console.log('\nFetching loan applications...');
        const listResponse = await axios.get('http://localhost:5000/api/loan-applications');
        const apps = listResponse.data;
        const testApp = apps.find(a => a.application_number === response.data.application_number);

        if (testApp) {
            console.log('SUCCESS: Application found in list:', testApp.application_number);
            console.log('Status:', testApp.status);
            console.log('Member Name:', testApp.member.name);
        } else {
            console.log('FAILURE: Application not found in list.');
        }

    } catch (error) {
        console.error('Error during test:', error.response ? error.response.data : error.message);
    }
}

testLoanApplication();
