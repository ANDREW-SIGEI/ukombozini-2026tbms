export const mockGroups = [
    { id: 1, name: 'Ukombozi Group A', location: 'Section A', openingBalance: 15450 },
    { id: 2, name: 'Ukombozi Group B', location: 'Section B', openingBalance: 10000 },
    { id: 3, name: 'Victory Women Group', location: 'Market Center', openingBalance: 25000 },
];

export const mockMembers = [
    { id: 1, name: 'Hilda Sigei', groupId: 1, phone: '+254712345678', status: 'Active', balance: 45000 },
    { id: 2, name: 'John Doe', groupId: 1, phone: '+254722345678', status: 'Active', balance: 12500 },
    { id: 3, name: 'Jane Smith', groupId: 1, phone: '+254733345678', status: 'Active', balance: 8900 },
    { id: 4, name: 'Alice Johnson', groupId: 2, phone: '+254744345678', status: 'Inactive', balance: 0 },
    { id: 5, name: 'Bob Brown', groupId: 2, phone: '+254755345678', status: 'Active', balance: 56000 },
];

export const mockLoans = [
    { id: 'L-001', memberName: 'Hilda Sigei', amount: 50000, interest: 5000, dueDate: '2026-02-15', status: 'Active' },
    { id: 'L-002', memberName: 'Bob Brown', amount: 20000, interest: 2000, dueDate: '2026-01-20', status: 'Overdue' },
    { id: 'L-003', memberName: 'John Doe', amount: 100000, interest: 10000, dueDate: '2026-06-30', status: 'Active' },
    { id: 'L-004', memberName: 'Jane Smith', amount: 30000, interest: 3000, dueDate: '2025-12-30', status: 'Paid' },
];

export const mockContributions = [
    { id: 1, memberId: 1, groupId: 1, memberName: 'Hilda Sigei', date: '2026-01-05', amount: 5000, type: 'Monthly Saving' },
    { id: 2, memberId: 5, groupId: 2, memberName: 'Bob Brown', date: '2026-01-05', amount: 10000, type: 'Monthly Saving' },
    { id: 3, memberId: 2, groupId: 1, memberName: 'John Doe', date: '2026-01-04', amount: 2500, type: 'Special Contribution' },
];

export const mockOfficers = [
    { id: 1, name: 'Sarah Wanjiku', role: 'Chairman', group: 'Ukombozi Group A', phone: '+254711111111' },
    { id: 2, name: 'David Omari', role: 'Secretary', group: 'Ukombozi Group A', phone: '+254722222222' },
    { id: 3, name: 'Mary Atieno', role: 'Treasurer', group: 'Ukombozi Group B', phone: '+254733333333' },
];

export const mockDividends = [
    { id: 1, memberName: 'Hilda Sigei', amount: 15400, date: '2025-12-31', status: 'Paid' },
    { id: 2, memberName: 'Bob Brown', amount: 18200, date: '2025-12-31', status: 'Pending' },
    { id: 3, memberName: 'John Doe', amount: 5600, date: '2025-12-31', status: 'Paid' },
];

export const mockLedgerEntries = [
    { id: 1, memberId: 1, date: '2026-01-05', description: 'Monthly Saving', type: 'Credit', amount: 5000, reference: 'TRX-101' },
    { id: 2, memberId: 1, date: '2026-01-02', description: 'Loan Disbursement (L-001)', type: 'Debit', amount: 50000, reference: 'TRX-102' },
    { id: 3, memberId: 1, date: '2025-12-31', description: 'Annual Dividend', type: 'Credit', amount: 15400, reference: 'TRX-103' },
    { id: 4, memberId: 5, date: '2026-01-05', description: 'Monthly Saving', type: 'Credit', amount: 10000, reference: 'TRX-104' },
    { id: 5, memberId: 2, date: '2026-01-04', description: 'Special Contribution', type: 'Credit', amount: 2500, reference: 'TRX-105' },
];
