import { useState, useMemo } from "react";

const MemberTransactionTable = ({ members, sessionData, onUpdateTransaction }) => {
    const [editingRow, setEditingRow] = useState(null);

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
            const stlCf = (transaction.stl_repayment || 0) + (transaction.loan_interest || 0) + (transaction.loan_principal || 0);
            const ltlCf = transaction.ltl_repayment || 0;

            return {
                ...member,
                ...transaction,
                totalPaid,
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
            totalCashIn: acc.totalCashIn + member.totalPaid
        }), {
            totalSavings: 0,
            totalStl: 0,
            totalLtl: 0,
            totalWelfare: 0,
            totalFines: 0,
            totalCashIn: 0
        });
    }, [memberTotals]);

    const handleCellEdit = (memberId, field, value) => {
        onUpdateTransaction(memberId, field, parseFloat(value) || 0);
    };

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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                STL
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                LTL
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Savings
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Repaid
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Principal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Interest
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Welfare
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Project
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fines
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Balance
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                STL C/F
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                LTL C/F
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {/* STL balance - would come from member data */}
                                    0
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {/* LTL balance - would come from member data */}
                                    0
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.savings_amount}
                                        memberId={member.id}
                                        field="savings_amount"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.stl_repayment + member.ltl_repayment}
                                        memberId={member.id}
                                        field="total_repaid"
                                        isEditable={false}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.loan_principal}
                                        memberId={member.id}
                                        field="loan_principal"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.loan_interest}
                                        memberId={member.id}
                                        field="loan_interest"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.welfare}
                                        memberId={member.id}
                                        field="welfare"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.project}
                                        memberId={member.id}
                                        field="project"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.fines}
                                        memberId={member.id}
                                        field="fines"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {/* Member balance - would come from member data */}
                                    0
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.stlCf}
                                        memberId={member.id}
                                        field="stl_cf"
                                        isEditable={false}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EditableCell
                                        value={member.ltlCf}
                                        memberId={member.id}
                                        field="ltl_cf"
                                        isEditable={false}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                        <tr>
                            <td colSpan="4" className="px-6 py-4 text-sm font-medium text-gray-900">
                                GROUP TOTALS
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalSavings.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {(groupTotals.totalStl + groupTotals.totalLtl).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {/* Principal total */}
                                {memberTotals.reduce((sum, m) => sum + (m.loan_principal || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {/* Interest total */}
                                {memberTotals.reduce((sum, m) => sum + (m.loan_interest || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalWelfare.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {/* Project total */}
                                {memberTotals.reduce((sum, m) => sum + (m.project || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalFines.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {/* Balance total */}
                                0
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalStl.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {groupTotals.totalLtl.toLocaleString()}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Summary Cards */}
            <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-xs text-gray-500 uppercase">Total Cash In</div>
                        <div className="text-lg font-bold text-green-600">
                            KES {groupTotals.totalCashIn.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-xs text-gray-500 uppercase">Total STL</div>
                        <div className="text-lg font-bold text-blue-600">
                            KES {groupTotals.totalStl.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-xs text-gray-500 uppercase">Total LTL</div>
                        <div className="text-lg font-bold text-blue-600">
                            KES {groupTotals.totalLtl.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-xs text-gray-500 uppercase">Total Welfare</div>
                        <div className="text-lg font-bold text-purple-600">
                            KES {groupTotals.totalWelfare.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberTransactionTable;
