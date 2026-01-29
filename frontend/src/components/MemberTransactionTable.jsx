import { useState, useMemo } from "react";
import { toast } from 'react-toastify';

const MemberTransactionTable = ({ members, sessionData, onUpdateTransaction }) => {
    const [editingRow, setEditingRow] = useState(null);

    const handleCellEdit = (memberId, field, value) => {
        const numValue = parseFloat(value) || 0;

        if (field === 'project') {
            const member = members.find(m => m.id === memberId);
            const currentBalance = member.project_balance || 0;
            const remaining = 2000 - currentBalance;

            if (numValue > remaining) {
                toast.warn(`Project limit exceeded! Max allowed for ${member.name}: KES ${remaining.toLocaleString()}`);
                return; // Block update
            }
        }

        onUpdateTransaction(memberId, field, numValue);
    };

    // Calculate totals for each member
    const memberTotals = useMemo(() => {
        return members.map(member => {
            const transaction = sessionData.find(t => t.member_id === member.id) || {};
            const totalPaid = (
                (transaction.savings_amount || 0) +
                (transaction.stl_repayment || 0) +
                (transaction.ltl_repayment || 0) +
                (transaction.loan_interest || 0) +
                (transaction.loan_principal || 0) +
                (transaction.welfare || 0) +
                (transaction.project || 0) +
                (transaction.fines || 0)
            );
            const totalOut = (transaction.withdrawals || 0) + (transaction.loans_issued || 0);
            const stlCf = (transaction.stl_repayment || 0) + (transaction.loan_interest || 0) + (transaction.loan_principal || 0);
            const ltlCf = transaction.ltl_repayment || 0;

            return {
                ...member,
                ...transaction,
                totalPaid,
                totalOut,
                stlCf,
                ltlCf
            };
        });
    }, [members, sessionData]);

    // Calculate group totals
    const groupTotals = useMemo(() => {
        return memberTotals.reduce((acc, member) => ({
            totalSavings: acc.totalSavings + (member.savings_amount || 0),
            totalStl: acc.totalStl + member.stlCf,
            totalLtl: acc.totalLtl + member.ltlCf,
            totalWelfare: acc.totalWelfare + (member.welfare || 0),
            totalFines: acc.totalFines + (member.fines || 0),
            totalCashIn: acc.totalCashIn + member.totalPaid,
            totalWithdrawals: acc.totalWithdrawals + (member.withdrawals || 0),
            totalLoansIssued: acc.totalLoansIssued + (member.loans_issued || 0)
        }), {
            totalSavings: 0,
            totalStl: 0,
            totalLtl: 0,
            totalWelfare: 0,
            totalFines: 0,
            totalCashIn: 0,
            totalWithdrawals: 0,
            totalLoansIssued: 0
        });
    }, [memberTotals]);


    const EditableCell = ({ value, memberId, field, isEditable = true }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [editValue, setEditValue] = useState((value || 0).toString());

        if (!isEditable) {
            return <span className="font-medium">{value?.toLocaleString() || 0}</span>;
        }

        return (
            <div className="relative">
                {isEditing ? (
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                            handleCellEdit(memberId, field, editValue);
                            setIsEditing(false);
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleCellEdit(memberId, field, editValue);
                                setIsEditing(false);
                            }
                        }}
                        className="w-full px-2 py-1 text-right border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                ) : (
                    <span
                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block text-right"
                        onClick={() => setIsEditing(true)}
                    >
                        {value?.toLocaleString() || 0}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Member Transactions</h3>
                <p className="text-sm text-gray-600">Enter amounts for each member (click to edit)</p>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Member No
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                Savings
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                Principal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                Interest
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                Welfare
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                Project
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                Fines
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                                Withdrawals
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                                Loans Issued
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total In
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-red-600">
                                Total Out
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {memberTotals.map((member, index) => (
                            <tr key={member.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {member.id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {member.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-green-50/20">
                                    <EditableCell
                                        value={member.savings_amount}
                                        memberId={member.id}
                                        field="savings_amount"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-green-50/20">
                                    <EditableCell
                                        value={member.loan_principal}
                                        memberId={member.id}
                                        field="loan_principal"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-green-50/20">
                                    <EditableCell
                                        value={member.loan_interest}
                                        memberId={member.id}
                                        field="loan_interest"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-green-50/20">
                                    <EditableCell
                                        value={member.welfare}
                                        memberId={member.id}
                                        field="welfare"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-green-50/20">
                                    <EditableCell
                                        value={member.project}
                                        memberId={member.id}
                                        field="project"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-green-50/20">
                                    <EditableCell
                                        value={member.fines}
                                        memberId={member.id}
                                        field="fines"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-red-50/20">
                                    <EditableCell
                                        value={member.withdrawals}
                                        memberId={member.id}
                                        field="withdrawals"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap bg-red-50/20">
                                    <EditableCell
                                        value={member.loans_issued}
                                        memberId={member.id}
                                        field="loans_issued"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                                    {member.totalPaid.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                                    {member.totalOut.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                        <tr>
                            <td colSpan="2" className="px-6 py-4 text-sm font-black text-gray-900 uppercase">
                                GROUP TOTALS
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalSavings.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {memberTotals.reduce((sum, m) => sum + (m.loan_principal || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {memberTotals.reduce((sum, m) => sum + (m.loan_interest || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalWelfare.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {memberTotals.reduce((sum, m) => sum + (m.project || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalFines.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                                {groupTotals.totalWithdrawals.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                                {groupTotals.totalLoansIssued.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-green-700">
                                {groupTotals.totalCashIn.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-red-700">
                                {(groupTotals.totalWithdrawals + groupTotals.totalLoansIssued).toLocaleString()}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Summary Cards */}
            <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded shadow-sm border-l-4 border-green-500">
                        <div className="text-xs text-gray-500 uppercase font-black">Total Cash In</div>
                        <div className="text-lg font-black text-green-600">
                            KES {groupTotals.totalCashIn.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm border-l-4 border-red-500">
                        <div className="text-xs text-gray-500 uppercase font-black">Total Cash Out</div>
                        <div className="text-lg font-black text-red-600">
                            KES {(groupTotals.totalWithdrawals + groupTotals.totalLoansIssued).toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                        <div className="text-xs text-gray-500 uppercase font-black">Net Session Cash</div>
                        <div className="text-lg font-black text-blue-600">
                            KES {(groupTotals.totalCashIn - (groupTotals.totalWithdrawals + groupTotals.totalLoansIssued)).toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm border-l-4 border-purple-500">
                        <div className="text-xs text-gray-500 uppercase font-black">Welfare Collection</div>
                        <div className="text-lg font-black text-purple-600">
                            KES {groupTotals.totalWelfare.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberTransactionTable;
