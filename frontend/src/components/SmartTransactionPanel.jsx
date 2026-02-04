import React, { useState, useEffect, useMemo } from 'react';
import {
    FaMoneyBillWave, FaHandHoldingDollar, FaCoins, FaGraduationCap,
    FaLeaf, FaFileInvoiceDollar, FaBuildingColumns, FaTriangleExclamation,
    FaArrowRight, FaSpinner, FaCircleCheck, FaSackDollar, FaBoxArchive,
    FaShieldHalved, FaMoneyBillTransfer, FaUserShield, FaChartLine,
    FaFilePdf
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import offlineManager from '../services/OfflineManager';
import ReceiptService from '../services/ReceiptService';

const TRANSACTION_GROUPS = [
    {
        name: 'Contributions',
        icon: FaCoins,
        types: [
            { id: 'savings', label: 'Savings Deposit', icon: FaCoins, color: 'text-blue-600', bg: 'bg-blue-50', ledgers: ['Member Savings (+)', 'Group Cash (+)'] },
            { id: 'welfare', label: 'Welfare Fund', icon: FaShieldHalved, color: 'text-teal-600', bg: 'bg-teal-50', ledgers: ['Member Welfare Tracker (+)', 'Group Welfare Fund (+)', 'Group Cash (+)'] }
        ]
    },
    {
        name: 'Projects',
        icon: FaGraduationCap,
        types: [
            { id: 'education', label: 'Education Project', icon: FaGraduationCap, color: 'text-blue-600', bg: 'bg-blue-50', ledgers: ['Member_Education_Project (+)', 'Group_Project_Pool (+)', 'Group_Cash (+)'] },
            { id: 'agriculture', label: 'Agriculture Project', icon: FaLeaf, color: 'text-green-600', bg: 'bg-green-50', ledgers: ['Member_Agriculture_Project (+)', 'Group_Project_Pool (+)', 'Group_Cash (+)'] }
        ]
    },
    {
        name: 'Loans',
        icon: FaHandHoldingDollar,
        types: [
            { id: 'stl', label: 'Short-Term Loan (STL)', icon: FaHandHoldingDollar, color: 'text-orange-600', bg: 'bg-orange-50', ledgers: ['Member_Loan_STL (+)', 'Group_Cash (-)'] },
            { id: 'ltl', label: 'Long-Term Loan (LTL)', icon: FaSackDollar, color: 'text-orange-600', bg: 'bg-orange-50', ledgers: ['Member_Loan_LTL (+)', 'Group_Cash (-)'] }
        ]
    },
    {
        name: 'Repayments',
        icon: FaFileInvoiceDollar,
        types: [
            { id: 'loanrepayment', label: 'Loan Repayment', icon: FaFileInvoiceDollar, color: 'text-indigo-600', bg: 'bg-indigo-50', ledgers: ['Member_Loan (-)', 'Group_Cash (+)'] }
        ]
    },
    {
        name: 'Assets',
        icon: FaBoxArchive,
        types: [
            { id: 'productfinancing', label: 'Product Financing', icon: FaBoxArchive, color: 'text-amber-600', bg: 'bg-amber-50', ledgers: ['Member_Asset_Loan (+)', 'Company_Asset_Inventory (-)'] }
        ]
    },
    {
        name: 'Penalties',
        icon: FaTriangleExclamation,
        types: [
            { id: 'penalty', label: 'Member Fine / Late Fee', icon: FaTriangleExclamation, color: 'text-red-600', bg: 'bg-red-50', ledgers: ['Member_Penalty (+)', 'Group_Cash (+)'] }
        ]
    },
    {
        name: 'Adjustments',
        icon: FaMoneyBillTransfer,
        types: [
            { id: 'withdrawal', label: 'Savings Withdrawal', icon: FaMoneyBillTransfer, color: 'text-purple-600', bg: 'bg-purple-50', ledgers: ['Member_Savings (-)', 'Group_Cash (-)'] }
        ]
    }
];

const SmartTransactionPanel = ({ member: initialMember, isOpen, onClose, onRefresh }) => {
    const { activeSession } = useTransactions();
    const { user } = useAuth();

    // Context Data (Real-time financial snapshot)
    const [memberContext, setMemberContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);

    // Transaction State
    const [selectedType, setSelectedType] = useState(TRANSACTION_GROUPS[0].types[0]);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [lastTxData, setLastTxData] = useState(null);

    // Dynamic Data Helpers
    const [loans, setLoans] = useState([]);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [groupRules, setGroupRules] = useState(null);
    const [dailyLimit, setDailyLimit] = useState(null);
    const [guarantors, setGuarantors] = useState({ g1: '', g2: '' });
    const [groupMembers, setGroupMembers] = useState([]);
    const [assetDetails, setAssetDetails] = useState({ productName: '', value: '' });
    const [latestCashSession, setLatestCashSession] = useState(null);

    // 🔄 Bootstrapping: Fetch FRESH context when opened
    useEffect(() => {
        if (isOpen && initialMember) {
            fetchFullContext();
            setAmount('');
            setNotes('');
            setSelectedType(TRANSACTION_GROUPS[0].types[0]);
            setGuarantors({ g1: '', g2: '' });
            setSelectedLoan(null);
            setAssetDetails({ productName: '', value: '' });
            setIsSuccess(false);
            setLastTxData(null);
        }
    }, [isOpen, initialMember]);

    const fetchFullContext = async () => {
        setLoadingContext(true);
        try {
            console.log("Fetching context for member:", initialMember.id);
            const [freshMember, loansData, groupData, membersData, limitData, latestSession] = await Promise.all([
                api.getMember(initialMember.id).catch(err => { console.error("getMember failed:", err); return null; }),
                api.getLoans(initialMember.id).catch(err => { console.error("getLoans failed:", err); return []; }),
                api.getGroup(initialMember.group_id).catch(err => { console.error("getGroup failed:", err); return null; }),
                api.getMembersByGroup(initialMember.group_id).catch(err => { console.error("getMembersByGroup failed:", err); return []; }),
                api.getProjectMemberDayLimit(initialMember.id).catch(() => null),
                api.getLatestCashSession(initialMember.group_id).catch(() => null)
            ]);

            console.log("Context Results:", { freshMember, loansData, groupData, membersData, limitData, latestSession });

            setMemberContext(freshMember || initialMember); // Fallback to initial if getMember fails
            setLoans(loansData || []);
            setGroupRules(groupData);
            setGroupMembers(membersData?.filter(m => m.id !== (initialMember.id || freshMember?.id)) || []);
            setDailyLimit(limitData);
            setLatestCashSession(latestSession);
        } catch (error) {
            console.error("Context Load Failed", error);
            toast.error("Failed to load member financial context");
        } finally {
            setLoadingContext(false);
        }
    };

    // 🧮 CALCULATION ENGINE
    const calculationPreview = useMemo(() => {
        if (!memberContext || !amount) return null;
        const val = parseFloat(amount) || 0;
        const savingsBefore = memberContext.current_savings || 0;
        const projBefore = (memberContext.education_savings || 0) + (memberContext.agriculture_savings || 0);
        const loansBefore = memberContext.active_loan_balance || 0;
        const penaltiesBefore = memberContext.penalties || 0;
        const riskBefore = memberContext.risk_score || 0;
        const netBefore = (savingsBefore + projBefore) - (loansBefore + penaltiesBefore);

        let savingsAfter = savingsBefore;
        let projAfter = projBefore;
        let loansAfter = loansBefore;
        let penAfter = penaltiesBefore;
        let riskAfter = riskBefore;
        let split = null;

        // Welfare Trust Metrics
        const welfareBefore = memberContext.welfare_balance || 0;
        const poolBefore = memberContext.group_welfare_pool || 0;
        const cashBefore = latestCashSession?.expected_closing_balance || 0;

        let welfareAfter = welfareBefore;
        let poolAfter = poolBefore;
        let cashAfter = cashBefore;

        // Project Trust Metrics
        const isProject = selectedType.id === 'education' || selectedType.id === 'agriculture';
        const projectBefore = selectedType.id === 'education' ? (memberContext.education_savings || 0) : (memberContext.agriculture_savings || 0);
        const projectPoolBefore = selectedType.id === 'education' ? (memberContext.group_edu_pool || 0) : (memberContext.group_agri_pool || 0);

        let projectAfter = projectBefore;
        let projectPoolAfter = projectPoolBefore;

        const assetsBefore = memberContext.active_asset_balance || 0;
        let assetsAfter = assetsBefore;

        switch (selectedType.id) {
            case 'savings':
                savingsAfter += val;
                riskAfter = Math.max(0, riskAfter - 1); // Baseline savings buffer
                break;
            case 'welfare':
                welfareAfter += val;
                poolAfter += val;
                cashAfter += val;
                break;
            case 'education':
            case 'agriculture':
                projectAfter += val;
                projectPoolAfter += val;
                cashAfter += val;
                riskAfter = Math.max(0, riskAfter - 5); // Guide: High Savings -5
                break;
            case 'productfinancing':
                const financed = (parseFloat(assetDetails.value) || 0) - (val || 0);
                assetsAfter += Math.max(0, financed);
                riskAfter = Math.min(100, riskAfter + 5); // Guide: Asset loan +5
                break;
            case 'stl':
            case 'ltl':
                loansAfter += val;
                riskAfter = Math.min(100, riskAfter + 25); // Guide: Loan Issued +25
                break;
            case 'loanrepayment':
                if (selectedLoan) {
                    let rem = val;
                    const p = Math.min(rem, selectedLoan.outstanding_penalty || 0);
                    rem -= p;
                    const i = Math.min(rem, selectedLoan.outstanding_interest || 0);
                    rem -= i;
                    const pr = rem;
                    split = { penalty: p, interest: i, principal: pr };
                    penAfter -= p;
                    loansAfter -= pr;
                    riskAfter = Math.max(0, riskAfter - 10); // Guide: On-time Repayment -10
                }
                break;
            case 'penalty':
                penAfter += val;
                riskAfter = Math.min(100, riskAfter + 10); // Guide: Penalty +10
                break;
            case 'withdrawal':
                savingsAfter -= val;
                riskAfter = Math.min(100, riskAfter + 2); // Guide: Sensistive operation guard
                break;
            default: break;
        }

        const netAfter = (savingsAfter + projectAfter) - (loansAfter + penAfter) - assetsAfter;

        if (selectedType.id === 'productfinancing') {
            const valNum = parseFloat(assetDetails.value) || 0;
            const commitment = val || 0;
            const remainder = Math.max(0, valNum - commitment);

            return {
                metrics: [
                    { label: 'Asset Value', before: 0, after: valNum, color: 'text-indigo-600' },
                    { label: 'Immediate Commitment', before: 0, after: commitment, color: 'text-green-600' },
                    { label: 'Asset Loan Created', before: assetsBefore, after: assetsBefore + remainder, color: 'text-rose-600', isBold: true },
                    { label: 'Risk Adjustment', before: riskBefore, after: riskAfter, isRisk: true }
                ],
                split: null
            };
        }

        if (isProject) {
            const isEdu = selectedType.id === 'education';
            const isReg = isEdu ? memberContext.is_registered_edu : memberContext.is_registered_agri;
            const seasonalMonth = new Date().getMonth() + 1;
            const isWindowOpen = seasonalMonth <= 8;

            return {
                metrics: [
                    { label: `My ${isEdu ? 'Education' : 'Agri'} Savings`, before: projectBefore, after: projectAfter, color: isEdu ? 'text-blue-600' : 'text-emerald-600' },
                    { label: `Group ${isEdu ? 'Education' : 'Agri'} Pool`, before: projectPoolBefore, after: projectPoolAfter, color: isEdu ? 'text-blue-900' : 'text-emerald-900', isBold: true },
                    { label: 'Seasonal Window', val: isWindowOpen ? 'OPEN (Jan-Aug)' : 'CLOSED', isText: true, text: isWindowOpen ? 'text-green-600' : 'text-red-600' },
                    { label: 'Registration Status', val: isReg ? 'REGISTERED' : 'NOT REGISTERED', isText: true, text: isReg ? 'text-green-600' : 'text-red-600' }
                ],
                rules: [
                    { label: '1:1 Rule Compliance', status: val <= (memberContext.current_savings || 0) + (val && selectedType.id === 'savings' ? val : 0) ? 'PASS' : 'WARN' }
                ],
                isRestricted: (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'director') ? false : (!isReg || !isWindowOpen),
                split: null
            };
        }

        if (selectedType.id === 'welfare') {
            return {
                metrics: [
                    { label: 'Member Welfare', before: welfareBefore, after: welfareAfter, color: 'text-teal-600' },
                    { label: 'Group Welfare Pool', before: poolBefore, after: poolAfter, color: 'text-teal-900', isBold: true },
                    { label: 'Group Cash Contribution', before: cashBefore, after: cashAfter, color: 'text-green-600' }
                ],
                split: null
            };
        }

        return {
            metrics: [
                { label: 'Savings', before: savingsBefore, after: savingsAfter, color: 'text-green-600' },
                { label: 'Projects', before: projBefore, after: projAfter, color: 'text-blue-600' },
                { label: 'Loans', before: loansBefore, after: loansAfter, color: 'text-orange-600' },
                { label: 'Penalties', before: penaltiesBefore, after: penAfter, color: 'text-red-600' },
                { label: 'Net Position', before: netBefore, after: netAfter, color: 'text-slate-900', isBold: true },
                { label: 'Risk Score', before: riskBefore, after: riskAfter, isRisk: true }
            ],
            split
        };

    }, [memberContext, amount, selectedType, selectedLoan]);

    const handlePost = async (e) => {
        if (e) e.preventDefault();
        if (isProcessing) return;

        setIsProcessing(true);
        try {
            // Check internet connectivity
            if (!navigator.onLine) {
                console.log("✈️ OFFLINE DETECTED: Redirecting to Offline Storage...");
                const offlinePayload = {
                    type: selectedType.id === 'stl' || selectedType.id === 'ltl' ? 'loan' : 'contribution',
                    data: {
                        memberId: memberContext.id,
                        sessionId: activeSession?.id || latestCashSession?.id,
                        amount: parseFloat(amount),
                        officerId: user?.id,
                        description: notes,
                        type: selectedType.id,
                        breakdown: calculationPreview?.split,
                        // Specific for loans/assets if needed
                        loanType: selectedType.id.toUpperCase(),
                        guarantors: selectedType.id === 'stl' || selectedType.id === 'ltl' ? { g1: guarantors.g1, g2: guarantors.g2 } : null,
                        productName: assetDetails.productName,
                        totalValue: assetDetails.value
                    }
                };

                await offlineManager.saveOfflineTransaction(offlinePayload);

                setTimeout(() => {
                    if (onRefresh) onRefresh();
                    onClose();
                }, 500);
                return;
            }

            console.log("Committing transaction through MTE...", { type: selectedType?.id, amount });

            const commonPayload = {
                memberId: memberContext.id,
                sessionId: activeSession?.id || latestCashSession?.id,
                amount: parseFloat(amount),
                officerId: user?.id,
                description: notes,
                type: selectedType.id,
                breakdown: calculationPreview?.split
            };

            let result = null;
            if (selectedType.id === 'stl' || selectedType.id === 'ltl') {
                // Loans still use their own engine for now due to complexity of schedule creation
                result = await api.issueLoan({
                    memberId: memberContext.id,
                    groupId: memberContext.group_id,
                    sessionId: activeSession?.id || latestCashSession?.id,
                    amount: commonPayload.amount,
                    loanType: selectedType.id.toUpperCase(),
                    interestRate: selectedType.id === 'stl' ? (groupRules?.stlInterestRate || 10) : (groupRules?.ltlInterestRate || 12),
                    duration: selectedType.id === 'stl' ? 1 : 12,
                    purpose: notes,
                    officerId: user.id || 1,
                    guarantor1_id: guarantors.g1,
                    guarantor2_id: guarantors.g2
                });
            } else if (selectedType.id === 'productfinancing') {
                // Asset financing using the unified engine payload extension
                result = await api.postTransaction({
                    ...commonPayload,
                    productName: assetDetails.productName,
                    totalValue: parseFloat(assetDetails.value) || parseFloat(amount),
                    commitmentPaid: parseFloat(amount)
                });
            } else {
                // Unified Savings / Welfare / Penalty / Project / Repayment / Withdrawal
                result = await api.postTransaction(commonPayload);
            }

            toast.success("Transaction Posted Successfully");

            // Set success state for overlay
            setLastTxData({
                id: result?.id || Date.now(),
                amount: commonPayload.amount,
                type: selectedType.label,
                date: new Date().toISOString(),
                officer: user?.name,
                notes: notes
            });
            setIsSuccess(true);

            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("MTE Post Failed:", error);
            const errorMsg = error.response?.data?.error || error.message || "Posting Failed";
            toast.error(errorMsg);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    const isWelfare = selectedType.id === 'welfare';
    const isProject = selectedType.id === 'education' || selectedType.id === 'agriculture';
    const isAsset = selectedType.id === 'productfinancing';

    let snapshot = [];
    if (isWelfare) {
        snapshot = [
            { label: 'My Welfare Balance', val: memberContext?.welfare_balance, color: 'text-teal-400' },
            { label: 'Group Welfare Pool', val: memberContext?.group_welfare_pool, color: 'text-teal-500' },
            { label: 'Eligibility Status', val: (memberContext?.welfare_balance || 0) > 0 ? 'ELIGIBLE' : 'PROBATION', isStatus: true, color: (memberContext?.welfare_balance || 0) > 0 ? 'text-green-400' : 'text-amber-400' },
            { label: 'Last Welfare Date', val: memberContext?.last_welfare_date ? new Date(memberContext.last_welfare_date).toLocaleDateString() : 'N/A', isText: true, text: 'text-slate-300' },
            { label: 'Group Liquidity', val: latestCashSession?.expected_closing_balance || 0, color: 'text-slate-200' },
            { label: 'Trust Rating', val: memberContext?.risk_score, isRisk: true }
        ];
    } else if (isProject) {
        const isEdu = selectedType.id === 'education';
        snapshot = [
            { label: `My ${isEdu ? 'Edu' : 'Agri'} Savings`, val: isEdu ? memberContext?.education_savings : memberContext?.agriculture_savings, color: isEdu ? 'text-blue-400' : 'text-emerald-400' },
            { label: `Group ${isEdu ? 'Edu' : 'Agri'} Pool`, val: isEdu ? memberContext?.group_edu_pool : memberContext?.group_agri_pool, color: isEdu ? 'text-blue-500' : 'text-emerald-500' },
            { label: 'Registration', val: (isEdu ? memberContext?.is_registered_edu : memberContext?.is_registered_agri) ? 'ACTIVE' : 'NONE', isStatus: true, color: (isEdu ? memberContext?.is_registered_edu : memberContext?.is_registered_agri) ? 'text-green-400' : 'text-red-400' },
            { label: 'Seasonal Status', val: (new Date().getMonth() + 1) <= 8 ? 'OPEN' : 'CLOSED', isText: true, text: (new Date().getMonth() + 1) <= 8 ? 'text-green-400' : 'text-red-400' },
            { label: 'Net Position', val: (memberContext?.current_savings || 0) + (memberContext?.education_savings || 0) + (memberContext?.agriculture_savings || 0) - (memberContext?.active_loan_balance || 0) - (memberContext?.penalties || 0), color: 'text-white' },
            { label: 'Risk Score', val: memberContext?.risk_score, isRisk: true }
        ];
    } else if (isAsset) {
        snapshot = [
            { label: 'Active Asset Loans', val: memberContext?.active_asset_balance, color: 'text-rose-400' },
            { label: 'Owned Assets (Est)', val: (memberContext?.active_asset_balance || 0) * 0.4, color: 'text-indigo-400' }, // Valuation heuristic
            { label: 'Collateral Value', val: (memberContext?.current_savings || 0) * 2, color: 'text-green-400' },
            { label: 'Max Financing', val: 5000, isText: true, text: 'text-slate-300' }, // Hard limit
            { label: 'Net Position', val: (memberContext?.current_savings || 0) + (memberContext?.education_savings || 0) + (memberContext?.agriculture_savings || 0) - (memberContext?.active_loan_balance || 0) - (memberContext?.penalties || 0) - (memberContext?.active_asset_balance || 0), color: 'text-white' },
            { label: 'Risk Score', val: memberContext?.risk_score, isRisk: true }
        ];
    } else {
        snapshot = [
            { label: 'Savings', val: memberContext?.current_savings, color: 'text-green-500' },
            { label: 'Projects', val: (memberContext?.education_savings || 0) + (memberContext?.agriculture_savings || 0), color: 'text-blue-500' },
            { label: 'Active Loans', val: memberContext?.active_loan_balance, color: 'text-orange-500' },
            { label: 'Penalties', val: memberContext?.penalties, color: 'text-red-500' },
            { label: 'Net Position', val: (memberContext?.current_savings || 0) + (memberContext?.education_savings || 0) + (memberContext?.agriculture_savings || 0) - (memberContext?.active_loan_balance || 0) - (memberContext?.penalties || 0) - (memberContext?.active_asset_balance || 0), color: 'text-white' },
            { label: 'Risk Score', val: memberContext?.risk_score, isRisk: true }
        ];
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-50 duration-200">

                {/* 🔹 ZONE A: FINANCIAL SNAPSHOT CARDS */}
                <div className="bg-slate-900 grid grid-cols-2 md:grid-cols-6 gap-0.5 p-0.5 shrink-0 border-b border-slate-700">
                    {snapshot.map((card, i) => (
                        <div key={i} className={`p - 4 ${card.isRisk ? 'bg-slate-800' : 'bg-slate-900'} `}>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">{card.label}</div>
                            {card.isRisk ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h - full transition - all duration - 1000 ${card.val > 70 ? 'bg-red-500' : card.val > 40 ? 'bg-amber-500' : 'bg-green-500'} `} style={{ width: `${card.val}% ` }} />
                                    </div>
                                    <span className="text-sm font-black text-white">{card.val || 0}%</span>
                                </div>
                            ) : card.isStatus ? (
                                <div className={`text - sm font - black ${card.color} flex items - center gap - 2`}>
                                    <span className={`w - 1.5 h - 1.5 rounded - full animate - pulse ${card.val === 'ELIGIBLE' ? 'bg-green-400' : 'bg-amber-400'} `}></span>
                                    {card.val}
                                </div>
                            ) : card.isText ? (
                                <div className={`text - sm font - black ${card.text} `}>
                                    {card.val}
                                </div>
                            ) : (
                                <div className={`text - lg font - black ${card.color || card.text} `}>
                                    {loadingContext ? "..." : `KES ${Number(card.val || 0).toLocaleString()} `}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Header Information */}
                <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                            {initialMember?.name?.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 leading-tight">{initialMember?.name}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {memberContext?.group_role || 'Member'} • Member ID: {initialMember?.id}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">✖</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* 🔹 ZONE B: OPERATION SELECTOR (SIDEBAR) */}
                    <div className="w-64 bg-slate-50 border-r border-gray-200 overflow-y-auto shrink-0 flex flex-col">
                        {TRANSACTION_GROUPS.map((group, idx) => (
                            <div key={idx} className="p-2 border-b border-gray-100 last:border-0">
                                <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{group.name}</div>
                                <div className="mt-1 space-y-1">
                                    {group.types.map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => setSelectedType(type)}
                                            className={`w - full flex items - center gap - 3 p - 2.5 rounded - lg transition - all text - left
                                                ${selectedType.id === type.id
                                                    ? 'bg-white shadow-sm ring-1 ring-slate-200 border-l-4 border-slate-900 scale-[1.02]'
                                                    : 'hover:bg-slate-200/50 text-slate-600'
                                                } `}
                                        >
                                            <div className={`w - 7 h - 7 rounded flex items - center justify - center text - xs ${type.bg} ${type.color} `}>
                                                <type.icon />
                                            </div>
                                            <span className={`text - [11px] font - bold ${selectedType.id === type.id ? 'text-slate-900' : 'text-slate-500'} `}>
                                                {type.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 🔹 ZONE C: WORKBENCH (FORM + PREVIEW) */}
                    <form onSubmit={handlePost} className="flex-1 flex overflow-hidden">
                        <div className="flex-1 p-10 overflow-y-auto">
                            <div className="max-w-xl mx-auto space-y-8">
                                <header className="flex items-center gap-4">
                                    <div className={`w - 14 h - 14 rounded - 2xl flex items - center justify - center text - 2xl shadow - inner ${selectedType.bg} ${selectedType.color} `}>
                                        <selectedType.icon />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900">{selectedType.label}</h3>
                                        <p className="text-xs font-bold text-slate-400">Institutional Financial Entry</p>
                                    </div>
                                </header>

                                <div className="space-y-6">
                                    {/* Amount Input (Mandatory) */}
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 focus-within:ring-2 focus-within:ring-slate-900 transition-all">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Transaction Amount</label>
                                        <div className="flex items-center gap-3">
                                            <span className="text-4xl font-black text-slate-300">KES</span>
                                            <input
                                                type="number"
                                                autoFocus
                                                required
                                                placeholder="0"
                                                className="w-full text-6xl font-black bg-transparent border-none focus:outline-none placeholder-slate-200 text-slate-900"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Contextual Fields */}
                                    {selectedType.id === 'loanrepayment' && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Target Loan</label>
                                            <div className="grid gap-2">
                                                {loans.map(loan => (
                                                    <div key={loan.id} onClick={() => setSelectedLoan(loan)}
                                                        className={`p - 4 rounded - xl border - 2 transition - all cursor - pointer flex justify - between items - center ${selectedLoan?.id === loan.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200 bg-white'} `}>
                                                        <div>
                                                            <div className="font-black text-slate-800 text-sm">{loan.loan_type} LOAN #{loan.id}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">Bal: KES {(loan.principal_amount + (loan.outstanding_interest || 0) + (loan.outstanding_penalty || 0)).toLocaleString()}</div>
                                                        </div>
                                                        <div className="font-black text-indigo-600 text-sm">KES {loan.principal_amount.toLocaleString()} Pr.</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedType.id === 'productfinancing' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name</label>
                                                <input type="text" className="w-full p-3 rounded-xl border border-slate-200 font-bold" value={assetDetails.productName} onChange={e => setAssetDetails({ ...assetDetails, productName: e.target.value })} placeholder="e.g. Solar Lamp" required />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Asset Value</label>
                                                <input type="number" className="w-full p-3 rounded-xl border border-slate-200 font-bold" value={assetDetails.value} onChange={e => setAssetDetails({ ...assetDetails, value: e.target.value })} placeholder="Value KES" required />
                                            </div>
                                        </div>
                                    )}

                                    {(selectedType.id === 'stl' || selectedType.id === 'ltl') && (
                                        <div className="grid grid-cols-2 gap-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                            <div className="col-span-2 text-[10px] font-black text-amber-600 uppercase mb-1">Guarantor Verification Required</div>
                                            <select className="p-3 rounded-xl border border-amber-200 font-bold text-sm" value={guarantors.g1} onChange={e => setGuarantors({ ...guarantors, g1: e.target.value })} required>
                                                <option value="">Guarantor 1</option>
                                                {groupMembers.map(m => m.id !== initialMember.id && <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                            <select className="p-3 rounded-xl border border-amber-200 font-bold text-sm" value={guarantors.g2} onChange={e => setGuarantors({ ...guarantors, g2: e.target.value })} required>
                                                <option value="">Guarantor 2</option>
                                                {groupMembers.map(m => m.id !== initialMember.id && <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Audit Memo / Notes</label>
                                        <textarea
                                            rows="2"
                                            className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white transition-all font-medium text-sm outline-none"
                                            placeholder="Purpose of this entry..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 🔹 ZONE C (RIGHT): IMPACT PREVIEW */}
                        <div className="w-96 border-l border-gray-200 bg-slate-50 p-8 flex flex-col shrink-0 overflow-y-auto">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Financial Impact Preview</h4>

                            {calculationPreview ? (
                                <div className="space-y-6 flex-1">
                                    <div className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
                                        {calculationPreview.metrics.map((m, i) => (
                                            <div key={i} className="flex justify-between items-center group">
                                                <span className={`text - xs font - bold ${m.isBold ? 'text-slate-900 text-sm' : 'text-slate-500'} `}>{m.label}</span>
                                                <div className="text-right">
                                                    {m.isRisk ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-300 line-through font-bold">{m.before}%</span>
                                                            <span className={`text - xs font - black ${m.after > m.before ? 'text-red-500' : 'text-green-500'} `}>{m.after}%</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="text-[10px] text-slate-300 line-through font-bold">KES {Number(m.before).toLocaleString()}</div>
                                                            <div className={`text - xs font - black ${m.after > m.before && !m.label.includes('Loan') ? 'text-green-600' : m.after < m.before && m.label.includes('Loan') ? 'text-green-600' : 'text-slate-900'} `}>{m.after < 0 ? '-' : ''}KES {Number(Math.abs(m.after)).toLocaleString()}</div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {calculationPreview.split && (
                                        <div className="bg-indigo-900 text-white p-5 rounded-3xl space-y-3">
                                            <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">Decision Matrix: Repayment Split</p>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs"><span>1. Penalties Cleared</span> <span className="font-black">KES {calculationPreview.split.penalty}</span></div>
                                                <div className="flex justify-between text-xs"><span>2. Interest Serving</span> <span className="font-black">KES {calculationPreview.split.interest}</span></div>
                                                <div className="flex justify-between text-xs border-t border-indigo-800 pt-1.5 mt-1.5"><span className="font-bold">3. Principal Reduction</span> <span className="text-safaricom-green font-black">KES {calculationPreview.split.principal}</span></div>
                                            </div>
                                        </div>
                                    )}

                                    {calculationPreview.rules && (
                                        <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-3">
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Business Rule Validation</p>
                                            {calculationPreview.rules.map((rule, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs">
                                                    <span>{rule.label}</span>
                                                    <span className={`font - black px - 2 py - 0.5 rounded - full ${rule.status === 'PASS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} `}>{rule.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {calculationPreview.isRestricted && (
                                        <div className="bg-rose-100 text-rose-600 p-5 rounded-3xl border border-rose-200">
                                            <p className="text-[10px] font-black uppercase mb-1">Entry Blocked</p>
                                            <p className="text-xs font-bold leading-tight">Member must be REGISTERED and seasonal window (Jan-Aug) must be OPEN.</p>
                                        </div>
                                    )}

                                    <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-1">
                                        <p className="text-[10px] font-black uppercase text-slate-500">Stability Verdict</p>
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            <span className={`w - 2 h - 2 rounded - full animate - pulse ${calculationPreview.metrics.find(m => m.isBold).after > calculationPreview.metrics.find(m => m.isBold).before ? 'bg-green-500' : 'bg-red-500'} `}></span>
                                            {calculationPreview.metrics.find(m => m.isBold).after > calculationPreview.metrics.find(m => m.isBold).before ? 'POSITIVE ASSET GROWTH' : 'LIABILITY INCREASED'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-20 grayscale">
                                    <FaChartLine className="text-6xl mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest">Awaiting Decision Inputs</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isProcessing || !amount || !calculationPreview || calculationPreview.isRestricted}
                                className={`w - full py - 5 rounded - 3xl font - black text - white shadow - 2xl transition - all flex items - center justify - center gap - 3 active: scale - 95
                                    ${isProcessing || !calculationPreview || calculationPreview.isRestricted ? 'bg-slate-400' : 'bg-slate-900 hover:bg-black uppercase tracking-widest text-sm'}
`}
                            >
                                {isProcessing ? <FaSpinner className="animate-spin" /> : <FaCircleCheck className="text-lg" />}
                                {isProcessing ? "Processing Vault..." : "APPROVE & POST"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* 🔹 SUCCESS OVERLAY (Z-LAYER) */}
                {isSuccess && lastTxData && (
                    <div className="absolute inset-0 z-[110] bg-white flex items-center justify-center animate-in fade-in duration-300">
                        <div className="max-w-md w-full p-8 text-center space-y-8">
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-5xl mb-6 shadow-sm border-4 border-white animate-bounce">
                                    <FaCircleCheck />
                                </div>
                                <h1 className="text-4xl font-black text-slate-900 leading-tight">Post Confirmed!</h1>
                                <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">Transaction ID: UKB-TX-{lastTxData.id}</p>
                            </div>

                            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 text-left space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-bold">Transaction Type</span>
                                    <span className="font-black text-slate-900 uppercase">{lastTxData.type}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold text-sm">Amount Paid</span>
                                    <span className="text-2xl font-black text-safaricom-green">KES {Number(lastTxData.amount).toLocaleString()}</span>
                                </div>
                                <div className="pt-4 border-t border-slate-200 text-xs text-slate-400 font-medium italic">
                                    "{lastTxData.notes || 'Official table banking entry recorded'}"
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => ReceiptService.generateReceipt(memberContext, lastTxData)}
                                    className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <FaFilePdf className="text-xl" /> DOWNLOAD PDF RECEIPT
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full py-5 bg-white border-2 border-slate-200 text-slate-600 rounded-3xl font-black hover:bg-slate-50 transition-all"
                                >
                                    DONE & CLOSE
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Digital Field Operations Terminal • 2026</p>
                        </div>
                    </div>
                )}

                {/* 🔹 ZONE D: GOVERNANCE STRIP */}
                <div className="bg-slate-200 p-3 px-6 flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] shrink-0">
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-1.5"><FaUserShield className="text-slate-400" /> AUTH: {user?.name || 'ADMIN'}</span>
                        <span className="flex items-center gap-1.5 text-slate-400"><FaBuildingColumns className="text-slate-400" /> STATUS: {activeSession ? `LIVE SESSION #${activeSession.id} ` : 'GENERAL LEDGER'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {!navigator.onLine && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500 text-white rounded-full animate-pulse">
                                <FaTriangleExclamation /> OFFLINE MODE ACTIVE
                            </span>
                        )}
                        <span className="flex items-center gap-1.5"><FaShieldHalved className="text-indigo-400" /> AUDIT TRACE ACTIVE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartTransactionPanel;
