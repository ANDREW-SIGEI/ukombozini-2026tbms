import { useState, useMemo, useEffect } from "react";
import { api } from "../services/api"; // Real API
import MemberTransactionTable from "../components/MemberTransactionTable";
import PdfService from "../services/pdfService";
import { FaFilePdf, FaCheckCircle, FaPrint, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";

export default function DailyCashReport() {
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [status, setStatus] = useState("draft");
    const [sessionData, setSessionData] = useState([]);
    const [physicalCash, setPhysicalCash] = useState(0);
    const [reportId, setReportId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [members, setMembers] = useState([]);

    // Fetch Groups on Mount
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const data = await api.getGroups();
                setGroups(data);
                if (data.length > 0) setSelectedGroup(data[0]);
            } catch (error) {
                console.error("Failed to load groups", error);
            }
        };
        fetchGroups();
    }, []);

    // Check for existing report or fetch members when params change
    useEffect(() => {
        if (!selectedGroup) return;

        const loadSessionContext = async () => {
            setIsLoading(true);
            try {
                // 1. Check if report exists
                const existingReports = await api.getDailyReports({
                    groupId: selectedGroup.id,
                    date: meetingDate
                });

                if (existingReports && existingReports.length > 0) {
                    const report = existingReports[0];
                    setReportId(report.id);
                    setOpeningBalance(report.morning_balance);
                    setPhysicalCash(report.physical_cash_counted);
                    setStatus(report.status);

                    // If previously saved, we might need to load transaction details
                    // For now, we'll assume we re-initialize session data from members or fetch saved state if extended in future
                    // Currently, only report totals are persisted in `daily_cash_reports`, transaction details should be in `transactions` 
                    // But here we are building the report aggregation. 
                    // Optimization: We will load members and let user re-enter for now OR fetch actual transactions if they exist.
                    // For this iteration, we treat "draft" as re-editable.

                    const groupMembers = await api.getMembers(selectedGroup.id);
                    setMembers(groupMembers);
                    // If status is submitted, we should probably fetch the computed values or lock it down
                } else {
                    // New Report Context
                    setReportId(null);
                    setStatus("draft");
                    const groupMembers = await api.getMembers(selectedGroup.id);
                    setMembers(groupMembers);
                    // attempt to get previous closing balance as opening?
                    // setOpeningBalance(0); // Default or derive
                }
            } catch (error) {
                console.error("Context load failed", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSessionContext();
    }, [selectedGroup, meetingDate]);

    // Initialize session data for members
    const initializeSessionData = () => {
        if (members.length === 0) {
            toast.warn("No members found in this group.");
            return;
        }
        const initialData = members.map(member => ({
            member_id: member.id,
            name: member.name, // Keep name for display
            savings_amount: 0,
            stl_repayment: 0,
            ltl_repayment: 0,
            loan_interest: 0,
            loan_principal: 0,
            welfare: 0,
            project: 0,
            fines: 0,
            withdrawals: 0,
            loans_issued: 0
        }));
        setSessionData(initialData);
        // setPhysicalCash(0); // Don't reset if loading
    };


    // Update transaction for a member
    const updateTransaction = (memberId, field, value) => {
        if (status !== "draft") return;
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
            totalWithdrawals: acc.totalWithdrawals + (transaction.withdrawals || 0),
            totalLoansIssued: acc.totalLoansIssued + (transaction.loans_issued || 0),
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
            totalWithdrawals: 0,
            totalLoansIssued: 0,
            totalCashIn: 0
        });
    }, [sessionData]);

    const totalOut = calculatedTotals.totalWithdrawals + calculatedTotals.totalLoansIssued;
    const expectedClosingBalance = openingBalance + calculatedTotals.totalCashIn - totalOut;
    const variance = physicalCash - expectedClosingBalance;

    const handleSaveDraft = async () => {
        if (!selectedGroup) return;

        const reportPayload = {
            id: reportId,
            group_id: selectedGroup.id,
            report_date: meetingDate,
            morning_balance: openingBalance,
            total_cash_in: calculatedTotals.totalCashIn,
            total_cash_out: totalOut,
            expected_closing_balance: expectedClosingBalance,
            physical_cash_counted: physicalCash,
            variance: variance,
            status: 'draft',
            // In a real app, we'd also batch save the sessionData transactions here
            officer_id: 1, // TODO: Get from auth context
            transactions: sessionData // Include transaction details for backend
        };

        try {
            const res = await api.saveDailyReport(reportPayload);
            if (res.success) {
                setReportId(res.id);
                toast.success("Draft Saved Successfully");
            }
        } catch (error) {
            toast.error("Failed to save draft");
        }
    };

    const handleSubmit = async () => {
        if (calculatedTotals.totalCashIn === 0 && totalOut === 0) {
            toast.warn("No transactions entered. Cannot submit an empty report.");
            return;
        }
        if (expectedClosingBalance < 0) {
            toast.error("Cash Out exceeds available balance! Please check your entries.");
            return;
        }

        const confirmMsg = Math.abs(variance) > 0
            ? `Warning: There is a variance of KES ${variance.toLocaleString()}. Submit anyway?`
            : "Are you sure you want to submit this balanced report?";

        if (!window.confirm(confirmMsg)) return;

        // 1. First Save/Update
        const reportPayload = {
            id: reportId,
            group_id: selectedGroup.id,
            report_date: meetingDate,
            morning_balance: openingBalance,
            total_cash_in: calculatedTotals.totalCashIn,
            total_cash_out: totalOut,
            expected_closing_balance: expectedClosingBalance,
            physical_cash_counted: physicalCash,
            variance: variance,
            status: 'draft', // Save as draft first
            officer_id: 1, // TODO: Get from auth context
            transactions: sessionData // Include transactions
        };

        try {
            let currentReportId = reportId;
            const saveRes = await api.saveDailyReport(reportPayload);
            if (saveRes.success) {
                currentReportId = saveRes.id;
                setReportId(currentReportId);
            }

            // 2. Submit (Lock)
            await api.submitDailyReport(currentReportId);
            setStatus("submitted");
            toast.success("Report Submitted & Locked!");

        } catch (error) {
            console.error(error);
            toast.error("Submission Failed");
        }
    };


    const handleDownloadSlip = () => {
        const report = {
            date: meetingDate,
            sys_ref: `SESS-${selectedGroup.id}-${Date.now().toString().slice(-6)}`,
            isBalanced: variance === 0
        };

        const summary = {
            totalIn: calculatedTotals.totalCashIn,
            totalOut: totalOut,
            netCash: expectedClosingBalance,
            banked: physicalCash
        };

        const user = { name: "System User" }; // Default

        PdfService.generateDailyClosingSlip(report, summary, user, selectedGroup.name);
    };

    if (isLoading) return <div className="p-10 text-center">Loading Report Context...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white shadow rounded space-y-8">

            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Daily Cash Report</h1>
                    <p className="text-gray-500 font-medium">Ukombozi TBMS • Institutional Governance</p>
                    <div className="mt-3 flex gap-2">
                        <span className={`inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${status === "draft" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                            status === "submitted" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                "bg-green-100 text-green-700 border border-green-200"
                            }`}>
                            {status}
                        </span>
                        {variance !== 0 && status === "draft" && (
                            <span className="bg-red-100 text-red-700 border border-red-200 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                                UNBALANCED
                            </span>
                        )}
                    </div>
                </div>
                {status === "submitted" && (
                    <button
                        onClick={handleDownloadSlip}
                        className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black no-print flex items-center gap-3 shadow-lg transition-transform hover:scale-105"
                    >
                        <FaFilePdf /> Export Official Slip
                    </button>
                )}
            </div>

            {/* Session Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Partner Group</label>
                    <select
                        className="border-gray-200 p-3 rounded-xl w-full bg-white shadow-sm font-bold text-gray-700"
                        value={selectedGroup?.id || ''}
                        disabled={status !== "draft"}
                        onChange={(e) => {
                            const group = groups.find(g => g.id === parseInt(e.target.value));
                            setSelectedGroup(group);
                            setSessionData([]); // Reset session on group change
                        }}
                    >
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name || g.group_name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Meeting Date</label>
                    <input
                        type="date"
                        value={meetingDate}
                        disabled={status !== "draft"}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="border-gray-200 p-3 rounded-xl w-full bg-white shadow-sm font-bold text-gray-700"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Morning Balance (KES)</label>
                    <input
                        type="number"
                        value={openingBalance}
                        disabled={status !== "draft"}
                        onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        className="border-gray-200 p-3 rounded-xl w-full bg-white shadow-sm font-black text-blue-600"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Reporting Officer</label>
                    <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm font-bold text-gray-500 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Hilda Sigei (#4052)
                    </div>
                </div>
            </div>

            {/* Initialize Button */}
            {
                status === "draft" && sessionData.length === 0 && (
                    <div className="bg-blue-600 p-8 rounded-3xl text-center text-white shadow-xl shadow-blue-200 transition-all hover:scale-[1.01]">
                        <h2 className="text-2xl font-black mb-2">Start Daily Data Entry</h2>
                        <p className="text-blue-100 mb-6 font-medium">Initialize member list for {selectedGroup?.name} to record transactions.</p>
                        <button
                            onClick={initializeSessionData}
                            className="bg-white text-blue-600 px-10 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-50 transition-colors"
                        >
                            YES, BEGIN SESSION
                        </button>
                    </div>
                )
            }

            {/* Member Transaction Table */}
            {
                sessionData.length > 0 && (
                    <div className={status !== "draft" ? "opacity-75 pointer-events-none" : ""}>
                        <MemberTransactionTable
                            members={members}
                            sessionData={sessionData}
                            onUpdateTransaction={updateTransaction}
                        />
                    </div>
                )
            }

            {/* RECONCILIATION SECTION (CRITICAL) */}
            {sessionData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 1. Cash Flow Summary */}
                    <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
                        <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                            System Cash Calculation
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-bold uppercase tracking-wider">A. Morning Balance</span>
                                <span className="font-black">KES {openingBalance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-green-600 font-bold uppercase tracking-wider">B. Total Collections (Cash In)</span>
                                <span className="font-black text-green-600">+ KES {calculatedTotals.totalCashIn.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-red-600 font-bold uppercase tracking-wider">C. Total Payments (Cash Out)</span>
                                <span className="font-black text-red-600">- KES {totalOut.toLocaleString()}</span>
                            </div>
                            <div className="pt-4 border-t border-dashed flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                                <span className="text-blue-900 font-black uppercase tracking-widest text-xs">Expected Closing Cash (A+B-C)</span>
                                <span className="text-2xl font-black text-blue-900">KES {expectedClosingBalance.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Physical Count & Variance */}
                    <div className={`rounded-3xl p-8 border-2 transition-all ${variance === 0 ? "bg-green-50 border-green-200" :
                        variance < 0 ? "bg-red-50 border-red-200" :
                            "bg-blue-50 border-blue-200"
                        }`}>
                        <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2 border-b pb-4 border-black/5">
                            <div className={`w-1.5 h-6 rounded-full ${variance === 0 ? "bg-green-600" : "bg-orange-500"
                                }`}></div>
                            Physical Cash Verification
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Physical Cash Counted (Actual Handheld)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">KES</span>
                                    <input
                                        type="number"
                                        value={physicalCash}
                                        disabled={status !== "draft"}
                                        onChange={(e) => setPhysicalCash(parseFloat(e.target.value) || 0)}
                                        className="w-full text-3xl font-black border-2 border-gray-200 p-5 pl-16 rounded-2xl focus:border-blue-500 focus:outline-none shadow-inner"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/50 rounded-2xl backdrop-blur-sm">
                                <div>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Reconciliation Variance</p>
                                    <p className={`text-2xl font-black ${variance === 0 ? "text-green-600" : "text-red-600 font-black italic underline decoration-red-200"
                                        }`}>
                                        {variance === 0 ? "BALANCED" : `KES ${variance.toLocaleString()}`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</p>
                                    <p className={`font-black text-xs px-3 py-1 rounded-full ${variance === 0 ? "bg-green-600 text-white" : "bg-red-600 text-white animate-pulse"
                                        }`}>
                                        {variance === 0 ? "GO" : variance < 0 ? "SHORTAGE" : "SURPLUS"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Submit Button */}
            {
                status === "draft" && sessionData.length > 0 && (
                    <div className="flex justify-center pt-8">
                        <button
                            onClick={handleSubmit}
                            className="bg-green-600 text-white px-12 py-5 rounded-3xl font-black text-xl hover:bg-green-700 transition-all shadow-xl shadow-green-200 hover:scale-[1.02] flex items-center gap-4"
                        >
                            <FaCheckCircle /> SUBMIT DAILY REPORT
                        </button>
                        <button
                            onClick={handleSaveDraft}
                            className="bg-gray-100 text-gray-600 px-8 py-5 rounded-3xl font-bold text-lg hover:bg-gray-200 transition-all flex items-center gap-3 ml-4"
                        >
                            <FaSave /> Save Draft
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
