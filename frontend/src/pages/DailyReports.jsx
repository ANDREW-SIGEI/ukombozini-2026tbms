import { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { validateCashReport, checkSystemAccessBlock } from '../utils/cashReportEnforcement';
import { useAuth } from '../context/AuthContext';

const Widget = ({ title, value, green, red }) => (
    <div className="p-4 bg-white shadow rounded">
        <p className="text-sm text-gray-500">{title}</p>
        <p
            className={`text-xl font-bold ${green ? "text-green-600" : red ? "text-red-600" : ""
                }`}
        >
            KES {value.toLocaleString()}
        </p>
    </div>
);

const InputRow = ({ label, value, onChange, status }) => (
    <div className="flex justify-between items-center py-2 border-b">
        <span className="capitalize">{label}</span>
        <div className="flex items-center gap-2">
            <span className="text-sm">KES</span>
            <input
                type="number"
                value={value !== null && value !== undefined ? value : ""}
                min="0"
                disabled={status === "APPROVED"}
                onChange={(e) => onChange(e.target.value)}
                className={`w-40 border rounded px-2 py-1 text-right ${status === "APPROVED" ? "bg-gray-100 cursor-not-allowed" : ""}`}
            />
        </div>
    </div>
);

export default function DailyReports() {
    const { user } = useAuth();

    const [status, setStatus] = useState("DRAFT");
    const [approvedBy, setApprovedBy] = useState(null);
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [varianceExplanation, setVarianceExplanation] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Opening Balance & Financial Totals from API
    const [openingBalance, setOpeningBalance] = useState(0);
    const [cashIn, setCashIn] = useState({
        banking: 0,
        shortTermRepayment: 0,
        longTermRepayment: 0,
        savings: 0,
        welfare: 0,
        education: 0,
        agriculture: 0,
        ukombozini: 0,
        applicationFee: 0,
        appreciationFee: 0
    });
    const [cashOut, setCashOut] = useState({
        serviceFee: 0,
        welfarePayout: 0,
        loanToUkombozini: 0,
        shortTermIssued: 0,
        longTermIssued: 0
    });

    const [manualPhysicalBalance, setManualPhysicalBalance] = useState(null);

    // Initial Fetch: Groups
    useEffect(() => {
        const fetchGroups = async () => {
            const data = await api.getGroups();
            setGroups(data);
            if (data.length > 0 && !selectedGroupId) {
                setSelectedGroupId(data[0].id);
            }
        };
        fetchGroups();
    }, []);

    // Fetch Report Context on Group/Date Change
    useEffect(() => {
        if (!selectedGroupId || !reportDate) return;

        const fetchContext = async () => {
            setIsLoading(true);
            try {
                const context = await api.getDailyReportContext(selectedGroupId, reportDate);
                if (context) {
                    setOpeningBalance(context.opening_balance || 0);

                    // Map API inflows to our structure
                    setCashIn({
                        banking: 0, // Not explicitly in context yet
                        shortTermRepayment: context.inflows?.repayments || 0,
                        longTermRepayment: 0,
                        savings: context.inflows?.savings || 0,
                        welfare: context.inflows?.welfare || 0,
                        education: 0,
                        agriculture: 0,
                        ukombozini: context.inflows?.projects || 0,
                        applicationFee: context.inflows?.fines || 0, // Using fines as proxy for fees if needed
                        appreciationFee: 0
                    });

                    // Map API outflows
                    setCashOut({
                        serviceFee: 0,
                        welfarePayout: 0,
                        loanToUkombozini: 0,
                        shortTermIssued: context.outflows?.disbursements || 0,
                        longTermIssued: 0
                    });

                    setManualPhysicalBalance(null); // Reset override on context change
                }
            } catch (err) {
                console.error("Failed to fetch report context", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchContext();
    }, [selectedGroupId, reportDate]);

    const totalCashIn = useMemo(
        () => Object.values(cashIn).reduce((a, b) => a + Number(b || 0), 0),
        [cashIn]
    );

    const totalCashOut = useMemo(
        () => Object.values(cashOut).reduce((a, b) => a + Number(b || 0), 0),
        [cashOut]
    );

    const expectedClosing = openingBalance + totalCashIn - totalCashOut;
    const physicalBalance = manualPhysicalBalance !== null ? manualPhysicalBalance : expectedClosing;
    const variance = physicalBalance - expectedClosing;

    const handleStatusChange = async (newStatus) => {
        if (newStatus === "SUBMITTED") {
            const validation = validateCashReport({
                openingBalance: openingBalance,
                cashCollected: totalCashIn,
                cashIssued: totalCashOut,
                expectedClosing: expectedClosing,
                actualClosing: physicalBalance,
                variance: variance,
                varianceExplanation: varianceExplanation,
                requireVarianceExplanation: Math.abs(variance) > 0,
            });

            if (!validation.valid) {
                alert(validation.errors.join('\n'));
                return;
            }

            // Prepare Payload
            const reportData = {
                group_id: selectedGroupId,
                officer_id: user?.id || 1, // Fallback for dev
                report_date: reportDate,
                morning_balance: openingBalance,
                total_cash_in: totalCashIn,
                total_cash_out: totalCashOut,
                expected_closing_balance: expectedClosing,
                physical_cash_counted: physicalBalance,
                variance: variance,
                status: 'submitted',
                officer_declaration: true,
                transactions: [] // Optional: if we want to send specific line items in future
            };

            setIsLoading(true);
            try {
                await api.submitDailyReport(reportData);
                setStatus("SUBMITTED");
            } catch (error) {
                console.error("Submission failed", error);
                alert("Failed to submit report. Please try again.");
                return;
            } finally {
                setIsLoading(false);
            }
        } else {
            setStatus(newStatus);
        }
    };



    return (
        <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded space-y-6 relative">
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-2 font-bold text-blue-600">Syncing Data...</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold">Ukombozi TBMS</h1>
                    <p className="text-gray-600">
                        Field Officer Portal • {new Date(reportDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <div className="mt-2 flex gap-2">
                        <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${status === "DRAFT" ? "bg-yellow-100 text-yellow-700" :
                            status === "SUBMITTED" ? "bg-blue-100 text-blue-700" :
                                "bg-green-100 text-green-700"
                            }`}>
                            {status}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => window.print()}
                    className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900 no-print"
                >
                    Export Cashbook PDF
                </button>
            </div>

            {/* Officer, Group & Date Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Group</label>
                    <select
                        className="border p-2 rounded w-full bg-gray-50"
                        value={selectedGroupId}
                        disabled={status === "APPROVED"}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name || g.group_name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Report Date</label>
                    <input
                        type="date"
                        className="border p-2 rounded w-full bg-gray-50"
                        value={reportDate}
                        disabled={status === "APPROVED"}
                        onChange={(e) => setReportDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Field Officer</label>
                    <div className="p-2 bg-gray-50 rounded border">{user?.name || "Hilda Sigei"} (ID #{user?.id || "4052"})</div>
                </div>
            </div>

            {/* Dashboard Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Widget title="Opening Balance" value={openingBalance} />
                <Widget title="Cash In" value={totalCashIn} green />
                <Widget title="Cash Out" value={totalCashOut} red />
                <Widget title="Expected Closing" value={expectedClosing} />
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* CASH IN */}
                <section>
                    <h2 className="text-lg font-semibold mb-2 text-green-700 border-b-2 border-green-700 pb-1">A. Cash In (Money Received)</h2>
                    {Object.entries(cashIn).map(([key, val]) => (
                        <InputRow
                            key={key}
                            label={key.replace(/([A-Z])/g, " $1")}
                            value={val}
                            status={status}
                            onChange={(v) => setCashIn({ ...cashIn, [key]: v })}
                        />
                    ))}
                    <div className="flex justify-between font-bold pt-4 text-green-800">
                        <span>Total Cash In</span>
                        <span>KES {totalCashIn.toLocaleString()}</span>
                    </div>
                </section>

                {/* CASH OUT */}
                <section>
                    <h2 className="text-lg font-semibold mb-2 text-red-700 border-b-2 border-red-700 pb-1">B. Cash Out (Money Paid Out)</h2>
                    {Object.entries(cashOut).map(([key, val]) => (
                        <InputRow
                            key={key}
                            label={key.replace(/([A-Z])/g, " $1")}
                            value={val}
                            status={status}
                            onChange={(v) => setCashOut({ ...cashOut, [key]: v })}
                        />
                    ))}
                    <div className="flex justify-between font-bold pt-4 text-red-800">
                        <span>Total Cash Out</span>
                        <span>KES {totalCashOut.toLocaleString()}</span>
                    </div>
                </section>
            </div>

            {/* TRF Control Section */}
            <section className="bg-gray-50 p-4 rounded border">
                <h2 className="text-lg font-semibold mb-2 text-blue-700">C. TRF (Control Section)</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex justify-between md:flex-col items-center md:items-start border-b md:border-b-0 md:border-r pb-2 md:pb-0">
                        <span className="text-sm text-gray-500 font-bold uppercase text-[10px]">Physical Cash Count</span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-gray-400">KES</span>
                            <input
                                type="number"
                                value={physicalBalance}
                                onChange={(e) => setManualPhysicalBalance(Number(e.target.value))}
                                disabled={status === "APPROVED"}
                                className="w-32 border-b-2 border-blue-600 outline-none font-bold text-lg bg-transparent"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between md:flex-col items-center md:items-start border-b md:border-b-0 md:border-r pb-2 md:pb-0 px-0 md:px-4">
                        <span className="text-sm text-gray-500">Balance of A/c</span>
                        <strong className="text-lg">KES {expectedClosing.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between md:flex-col items-center md:items-start border-b md:border-b-0 md:border-r pb-2 md:pb-0 px-0 md:px-4">
                        <span className="text-sm text-gray-500">STL Arrears</span>
                        <strong className="text-lg text-red-600">KES 0</strong>
                    </div>
                    <div className="flex justify-between md:flex-col items-center md:items-start px-0 md:px-4">
                        <span className="text-sm text-gray-500">LTL C/F</span>
                        <strong className="text-lg text-blue-600">KES 45,000</strong>
                    </div>
                </div>
            </section>

            {/* Variance Explanation Section */}
            {Math.abs(variance) > 0 && (
                <section className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <h2 className="text-lg font-semibold mb-2 text-yellow-700">D. Variance Explanation</h2>
                    <p className="text-sm text-yellow-800 mb-2">
                        Variance detected: KES {Math.abs(variance).toLocaleString()} ({variance > 0 ? 'Surplus' : 'Deficit'})
                    </p>
                    <textarea
                        className="w-full p-3 border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                        rows="3"
                        placeholder="Please explain the reason for the variance..."
                        value={varianceExplanation}
                        onChange={(e) => setVarianceExplanation(e.target.value)}
                        disabled={status === "APPROVED"}
                    />
                </section>
            )}

            {/* SUPERVISOR APPROVAL PANEL */}
            <div className="no-print space-y-4">
                {status === "DRAFT" && (
                    <button
                        className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                        onClick={() => handleStatusChange("SUBMITTED")}
                    >
                        Submit Final Report for Approval
                    </button>
                )}

                {status === "SUBMITTED" && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">!</div>
                            <h3 className="text-lg font-bold text-blue-900">Supervisor Verification Required</h3>
                        </div>
                        <p className="text-sm text-blue-700 mb-6">
                            This report has been submitted. As a supervisor, please review all entries and ensure they match the physical cashbook before locking.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setStatus("APPROVED");
                                    setApprovedBy("Supervisor Jane Doe");
                                }}
                                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                            >
                                Approve & Lock Report
                            </button>
                            <button
                                onClick={() => setStatus("DRAFT")}
                                className="px-6 py-3 border-2 border-blue-600 text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                Reject / Edit
                            </button>
                        </div>
                    </div>
                )}

                {status === "APPROVED" && (
                    <div className="bg-green-100 border-2 border-green-500 p-5 rounded-xl flex items-center justify-between shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center text-xl">✔</div>
                            <div>
                                <p className="font-bold text-green-900 text-lg">Report Officially Locked</p>
                                <p className="text-sm text-green-700 font-medium italic">Approved by {approvedBy} on {new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                        <p className="text-xs font-bold text-green-700 bg-green-200 px-3 py-1 rounded-full uppercase tracking-tighter">Audit Safe</p>
                    </div>
                )}
            </div>

        </div>
    );
}

