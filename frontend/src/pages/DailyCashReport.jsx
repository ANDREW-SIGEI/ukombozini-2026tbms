import { useState, useMemo } from "react";
import { mockGroups, mockMembers } from "../data/mockData";
import MemberTransactionTable from "../components/MemberTransactionTable";
import PdfService from "../services/pdfService";
import { FaFilePdf, FaCheckCircle, FaPrint } from "react-icons/fa";

export default function DailyCashReport() {
    const [selectedGroup, setSelectedGroup] = useState(mockGroups[0]);
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [openingBalance, setOpeningBalance] = useState(selectedGroup.openingBalance);
    const [status, setStatus] = useState("draft");
    const [sessionData, setSessionData] = useState([]);

    // Filter members for selected group
    const groupMembers = useMemo(() => {
        return mockMembers.filter(member => member.groupId === selectedGroup.id);
    }, [selectedGroup]);

    // Initialize session data for members
    const initializeSessionData = () => {
        const initialData = groupMembers.map(member => ({
            member_id: member.id,
            savings_amount: 0,
            stl_repayment: 0,
            ltl_repayment: 0,
            loan_interest: 0,
            loan_principal: 0,
            welfare: 0,
            project: 0,
            fines: 0
        }));
        setSessionData(initialData);
    };

    // Update transaction for a member
    const updateTransaction = (memberId, field, value) => {
        setSessionData(prevData =>
            prevData.map(item =>
                item.member_id === memberId
                    ? { ...item, [field]: value }
                    : item
            )
        );
    };

    // Calculate totals
    const calculatedTotals = useMemo(() => {
        return sessionData.reduce((acc, transaction) => ({
            totalSavings: acc.totalSavings + (transaction.savings_amount || 0),
            totalStl: acc.totalStl + ((transaction.stl_repayment || 0) + (transaction.loan_interest || 0) + (transaction.loan_principal || 0)),
            totalLtl: acc.totalLtl + (transaction.ltl_repayment || 0),
            totalWelfare: acc.totalWelfare + (transaction.welfare || 0),
            totalFines: acc.totalFines + (transaction.fines || 0),
            totalCashIn: acc.totalCashIn + (
                (transaction.savings_amount || 0) +
                (transaction.stl_repayment || 0) +
                (transaction.ltl_repayment || 0) +
                (transaction.loan_interest || 0) +
                (transaction.loan_principal || 0) +
                (transaction.welfare || 0) +
                (transaction.project || 0) +
                (transaction.fines || 0)
            )
        }), {
            totalSavings: 0,
            totalStl: 0,
            totalLtl: 0,
            totalWelfare: 0,
            totalFines: 0,
            totalCashIn: 0
        });
    }, [sessionData]);

    const closingBalance = openingBalance + calculatedTotals.totalCashIn;

    const handleSubmit = () => {
        if (calculatedTotals.totalCashIn === 0) {
            alert("No transactions entered. Cannot submit an empty report.");
            return;
        }
        if (closingBalance < 0) {
            alert("Cash Out exceeds available balance! Please check your entries.");
            return;
        }
        setStatus("submitted");
        // alert("Report submitted successfully!");
    };

    const handleDownloadSlip = () => {
        const report = {
            date: meetingDate,
            sys_ref: `SESS-${selectedGroup.id}-${Date.now().toString().slice(-6)}`,
            isBalanced: true // Assuming balanced if we allow submission
        };

        const summary = {
            totalIn: calculatedTotals.totalCashIn,
            totalOut: Math.abs(closingBalance - openingBalance - calculatedTotals.totalCashIn), // Approximation for demo
            netCash: closingBalance,
            banked: closingBalance // Assuming full banking for now
        };

        const user = { name: "Hilda Sigei" }; // Mock User

        PdfService.generateDailyClosingSlip(report, summary, user, selectedGroup.name);
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white shadow rounded space-y-6">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Daily Cash Report</h1>
                    <p className="text-gray-600 mt-1">
                        Ukombozi TBMS • Field Officer Portal
                    </p>
                    <div className="mt-3 flex gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${status === "draft" ? "bg-yellow-100 text-yellow-700" :
                            status === "submitted" ? "bg-blue-100 text-blue-700" :
                                "bg-green-100 text-green-700"
                            }`}>
                            {status.toUpperCase()}
                        </span>
                    </div>
                </div>
                {status === "submitted" && (
                    <button
                        onClick={handleDownloadSlip}
                        className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900 no-print flex items-center gap-2"
                    >
                        <FaFilePdf /> Export Copy
                    </button>
                )}
            </div>

            {/* Session Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Group</label>
                    <select
                        className="border p-2 rounded w-full bg-gray-50"
                        value={selectedGroup.id}
                        disabled={status !== "draft"}
                        onChange={(e) => {
                            const group = mockGroups.find(g => g.id === parseInt(e.target.value));
                            setSelectedGroup(group);
                            setOpeningBalance(group.openingBalance);
                            initializeSessionData();
                        }}
                    >
                        {mockGroups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meeting Date</label>
                    <input
                        type="date"
                        value={meetingDate}
                        disabled={status !== "draft"}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="border p-2 rounded w-full bg-gray-50"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Opening Balance</label>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">KES</span>
                        <input
                            type="number"
                            value={openingBalance}
                            disabled={status !== "draft"}
                            onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                            className="border p-2 rounded flex-1 bg-gray-50"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Field Officer</label>
                    <div className="p-2 bg-gray-50 rounded border">Hilda Sigei (ID #4052)</div>
                </div>
            </div>

            {/* Initialize Button */}
            {
                status === "draft" && sessionData.length === 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                        <p className="text-blue-800 mb-3">Ready to start data entry for {selectedGroup.name}?</p>
                        <button
                            onClick={initializeSessionData}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            Initialize Member Transactions
                        </button>
                    </div>
                )
            }

            {/* Member Transaction Table */}
            {
                sessionData.length > 0 && (
                    <MemberTransactionTable
                        members={groupMembers}
                        sessionData={sessionData}
                        onUpdateTransaction={updateTransaction}
                    />
                )
            }

            {/* Cash In Summary */}
            {
                sessionData.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded p-4">
                        <h3 className="text-lg font-semibold text-green-800 mb-3">Cash In Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded shadow-sm">
                                <div className="text-xs text-gray-500 uppercase">Savings</div>
                                <div className="text-lg font-bold text-green-600">
                                    KES {calculatedTotals.totalSavings.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <div className="text-xs text-gray-500 uppercase">STL Repayments</div>
                                <div className="text-lg font-bold text-green-600">
                                    KES {calculatedTotals.totalStl.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <div className="text-xs text-gray-500 uppercase">LTL Repayments</div>
                                <div className="text-lg font-bold text-green-600">
                                    KES {calculatedTotals.totalLtl.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <div className="text-xs text-gray-500 uppercase">Welfare</div>
                                <div className="text-lg font-bold text-green-600">
                                    KES {calculatedTotals.totalWelfare.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                            <span className="text-lg font-semibold text-green-800">Total Cash In:</span>
                            <span className="text-2xl font-bold text-green-700">
                                KES {calculatedTotals.totalCashIn.toLocaleString()}
                            </span>
                        </div>
                    </div>
                )
            }

            {/* Control Section */}
            <div className="bg-gray-50 p-4 rounded border">
                <h3 className="text-lg font-semibold mb-3 text-blue-700">Control Section</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex justify-between md:flex-col items-center md:items-start border-b md:border-b-0 md:border-r pb-2 md:pb-0">
                        <span className="text-sm text-gray-500">Opening Balance</span>
                        <strong className="text-lg">KES {openingBalance.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between md:flex-col items-center md:items-start border-b md:border-b-0 md:border-r pb-2 md:pb-0 px-0 md:px-4">
                        <span className="text-sm text-gray-500">Cash In</span>
                        <strong className="text-lg text-green-600">KES {calculatedTotals.totalCashIn.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between md:flex-col items-center md:items-start px-0 md:px-4">
                        <span className="text-sm text-gray-500">Closing Balance</span>
                        <strong className="text-lg text-blue-600">KES {closingBalance.toLocaleString()}</strong>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            {
                status === "draft" && sessionData.length > 0 && (
                    <div className="flex justify-center">
                        <button
                            onClick={handleSubmit}
                            className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors shadow-lg"
                        >
                            Submit Daily Cash Report
                        </button>
                    </div>
                )
            }

            {/* Status Messages */}
            {
                status === "submitted" && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-8 rounded-xl text-center shadow-lg animate-in fade-in slide-in-from-bottom-5">
                        <div className="text-5xl mb-4 text-green-500"><FaCheckCircle className="mx-auto" /></div>
                        <h3 className="text-2xl font-black text-blue-900 mb-2">Report Submitted Successfully!</h3>
                        <p className="text-blue-700 font-medium mb-6">Your daily cash report has been secured and sent for supervisor approval.</p>

                        <button
                            onClick={handleDownloadSlip}
                            className="bg-safaricom-green text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 hover:scale-105 transition-all flex items-center gap-3 mx-auto"
                        >
                            <FaFilePdf className="text-xl" />
                            <span>Download Official Closing Slip</span>
                        </button>
                    </div>
                )
            }

        </div >
    );
}
