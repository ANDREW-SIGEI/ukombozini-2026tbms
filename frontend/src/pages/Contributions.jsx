import React, { useState, useEffect, useMemo } from 'react';
import {
    FaMoneyBillWave,
    FaUsers,
    FaCalendarAlt,
    FaCheckCircle,
    FaSearch,
    FaPlay,
    FaBolt,
    FaArrowLeft,
    FaRegCheckCircle,
    FaCoins,
    FaShieldAlt,
    FaChartLine,
    FaLeaf,
    FaGraduationCap
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SearchableGroupSelector from '../components/SearchableGroupSelector';
import offlineManager from '../services/OfflineManager';

/**
 * TransactionInput Component for grid-based entry
 */
const TransactionInput = ({ value, onChange, disabled, rowIndex, colIndex, totalRows, totalCols, placeholder = "0" }) => {
    const handleKeyDown = (e) => {
        const { key } = e;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
            e.preventDefault();

            let nextRow = rowIndex;
            let nextCol = colIndex;

            if (key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
            if (key === 'ArrowDown' || key === 'Enter') {
                if (colIndex === totalCols - 1 || key === 'Enter') {
                    if (rowIndex < totalRows - 1) {
                        nextRow = rowIndex + 1;
                        nextCol = 0;
                    }
                } else {
                    nextRow = Math.min(totalRows - 1, rowIndex + 1);
                }
            }
            if (key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1);
            if (key === 'ArrowRight') nextCol = Math.min(totalCols - 1, colIndex + 1);

            const nextInput = document.querySelector(`input[data-contrib-row="${nextRow}"][data-cockpit-col="${nextCol}"]`); // Fixed selector key
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        }
    };

    return (
        <input
            type="number"
            min="0"
            step="10"
            value={value === 0 ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            data-contrib-row={rowIndex}
            data-cockpit-col={colIndex}
            className={`w-full px-3 py-2 text-right border-2 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all text-sm ${disabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white border-slate-100 text-slate-700'
                }`}
            placeholder={placeholder}
        />
    );
};

const Contributions = () => {
    const { user } = useAuth();
    const [activeSessions, setActiveSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isStandardMode, setIsStandardMode] = useState(true);
    const [riskMetrics, setRiskMetrics] = useState({});

    // Bulk Grid State
    const [gridData, setGridData] = useState([]); // [{ memberId, memberName, savings, welfare, agri, edu, committed }]

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setIsLoading(true);
        try {
            const sessions = await api.getMeetingSessions();
            setActiveSessions(sessions.filter(s => s.status === 'ACTIVE'));
        } catch (error) {
            toast.error("Failed to load active sessions");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSessionSelect = async (session) => {
        setSelectedSession(session);
        setIsLoading(true);
        try {
            const [groupMembers, groupDetails, riskData] = await Promise.all([
                api.getMembersByGroup(session.group_id),
                api.getGroupById(session.group_id),
                api.getGroupExposure(session.group_id).catch(() => ({}))
            ]);

            setRiskMetrics(riskData?.memberMetrics || {});

            const initialGrid = groupMembers.map(m => ({
                memberId: m.id,
                memberName: m.name || m.full_name,
                phone: m.phone,
                savings: isStandardMode ? (groupDetails?.default_savings || 500) : 0,
                welfare: isStandardMode ? (groupDetails?.default_welfare || 100) : 0,
                agri: 0,
                edu: 0,
                committed: false
            }));

            // [NEW] Merge pending offline transactions
            const pendingTxs = await offlineManager.getPendingTransactions();
            const sessionPending = pendingTxs.filter(tx =>
                (tx.data?.meetingId === session.id || tx.data?.sessionId === session.id)
            );

            sessionPending.forEach(tx => {
                const data = tx.data;
                const m = initialGrid.find(row => row.memberId === data.memberId);
                if (m) {
                    const type = data.type?.toLowerCase() || data.transaction_type?.toLowerCase() || '';
                    if (type === 'contribution' || type === 'savings') m.savings = data.amount;
                    else if (type === 'welfare') m.welfare = data.amount;
                    else if (type === 'project_savings' && data.project_type === 'AGRICULTURE') m.agri = data.amount;
                    else if (type === 'project_savings' && data.project_type === 'EDUCATION') m.edu = data.amount;
                    m.committed = true;
                }
            });

            setGridData(initialGrid);
        } catch (error) {
            toast.error("Failed to load session members");
        } finally {
            setIsLoading(false);
        }
    };

    const updateGridValue = (memberId, field, value) => {
        setGridData(prev => prev.map(m =>
            m.memberId === memberId ? { ...m, [field]: value } : m
        ));
    };

    const handleCommitRow = async (m) => {
        const total = parseFloat(m.savings || 0) + parseFloat(m.welfare || 0) + parseFloat(m.agri || 0) + parseFloat(m.edu || 0);
        if (total === 0) return toast.warning(`No amounts for ${m.memberName}`);

        toast.info(`💾 Saving entries for ${m.memberName}...`);
        try {
            const promises = [];
            if (parseFloat(m.savings) > 0) promises.push(api.postContribution({
                memberId: m.memberId,
                meetingId: selectedSession.id,
                groupId: selectedSession.group_id,
                type: 'CONTRIBUTION',
                amount: parseFloat(m.savings),
                savings_amount: parseFloat(m.savings)
            }));
            if (parseFloat(m.welfare) > 0) promises.push(api.postContribution({
                memberId: m.memberId,
                meetingId: selectedSession.id,
                groupId: selectedSession.group_id,
                type: 'WELFARE',
                amount: parseFloat(m.welfare),
                welfare: parseFloat(m.welfare)
            }));
            if (parseFloat(m.agri) > 0) promises.push(api.postTransaction({
                memberId: m.memberId,
                sessionId: selectedSession.id,
                groupId: selectedSession.group_id,
                transaction_type: 'PROJECT_SAVINGS',
                project_type: 'AGRICULTURE',
                amount: parseFloat(m.agri)
            }));
            if (parseFloat(m.edu) > 0) promises.push(api.postTransaction({
                memberId: m.memberId,
                sessionId: selectedSession.id,
                groupId: selectedSession.group_id,
                transaction_type: 'PROJECT_SAVINGS',
                project_type: 'EDUCATION',
                amount: parseFloat(m.edu)
            }));

            await Promise.all(promises);
            updateGridValue(m.memberId, 'committed', true);
            toast.success(`✓ ${m.memberName} records persisted!`);
        } catch (error) {
            toast.error(`Error saving ${m.memberName}`);
        }
    };

    const handleBatchPost = async () => {
        const pending = gridData.filter(m => !m.committed && (parseFloat(m.savings) > 0 || parseFloat(m.welfare) > 0));
        if (pending.length === 0) return toast.info("No pending records to post.");

        setIsPosting(true);
        for (const m of pending) {
            await handleCommitRow(m);
        }
        setIsPosting(false);
        toast.success("All pending contributions posted!");
    };

    const filteredGrid = useMemo(() => {
        return gridData.filter(m =>
            m.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone?.includes(searchTerm)
        );
    }, [gridData, searchTerm]);

    const totals = useMemo(() => {
        return gridData.reduce((acc, curr) => {
            acc.savings += parseFloat(curr.savings || 0);
            acc.welfare += parseFloat(curr.welfare || 0);
            acc.agri += parseFloat(curr.agri || 0);
            acc.edu += parseFloat(curr.edu || 0);
            return acc;
        }, { savings: 0, welfare: 0, agri: 0, edu: 0 });
    }, [gridData]);

    if (isLoading && !selectedSession) return <div className="p-20 text-center animate-pulse font-black text-slate-300">SCANNING SESSIONS...</div>;

    return (
        <div className="space-y-6">
            {!selectedSession ? (
                <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 max-w-2xl mx-auto text-center">
                    <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8">
                        <FaCalendarAlt size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter">Contribution Hub</h2>
                    <p className="text-slate-500 font-bold mb-10 px-8">Select an active meeting session to begin high-speed bulk data entry.</p>

                    <div className="space-y-4">
                        {activeSessions.length === 0 ? (
                            <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 font-bold border border-amber-100">
                                No active sessions found. Start a meeting first.
                            </div>
                        ) : (
                            activeSessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSessionSelect(s)}
                                    className="w-full p-6 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-3xl text-left transition-all group shadow-xl shadow-slate-100"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-lg">{s.group_name}</p>
                                            <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Session #{s.session_number} • {s.meeting_date}</p>
                                        </div>
                                        <FaPlay className="transform group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col bg-slate-50 min-h-screen">
                    {/* Header */}
                    <div className="bg-slate-900 text-white p-8 sticky top-0 z-50 shadow-2xl">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-6">
                                <button onClick={() => setSelectedSession(null)} className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                                    <FaArrowLeft />
                                </button>
                                <div>
                                    <h1 className="text-3xl font-black tracking-tight">{selectedSession.group_name}</h1>
                                    <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">Global Bulk Entry Mode • Session {selectedSession.session_number}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 text-center">
                                    <p className="text-[9px] font-black uppercase text-blue-300">Bulk Total</p>
                                    <p className="text-xl font-black">KES {(totals.savings + totals.welfare + totals.agri + totals.edu).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => setIsStandardMode(!isStandardMode)}
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isStandardMode ? 'bg-safaricom-green text-white shadow-lg' : 'bg-white/10 text-white'
                                        }`}
                                >
                                    <FaBolt /> {isStandardMode ? 'Standard' : 'Manual'}
                                </button>
                                <button
                                    onClick={handleBatchPost}
                                    disabled={isPosting}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center gap-2"
                                >
                                    {isPosting ? 'Posting...' : <><FaRegCheckCircle /> Commit Bulk Entry</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="bg-slate-800 px-8 py-3 flex gap-8 border-b border-slate-700 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400"><FaCoins className="text-blue-400" /> SLP: <span className="text-white">KES {totals.savings.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400"><FaShieldAlt className="text-teal-400" /> WLF: <span className="text-white">KES {totals.welfare.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400"><FaLeaf className="text-green-400" /> AGRI: <span className="text-white">KES {totals.agri.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400"><FaGraduationCap className="text-blue-300" /> EDU: <span className="text-white">KES {totals.edu.toLocaleString()}</span></div>
                    </div>

                    {/* Filter */}
                    <div className="p-8 bg-white border-b sticky top-[108px] z-40">
                        <div className="relative max-w-md">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Locate member in session..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="p-8 flex-1">
                        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Member / Risk</th>
                                        <th className="px-4 py-5 text-right text-[10px] font-black text-blue-600 uppercase tracking-widest w-40">Savings (SLP)</th>
                                        <th className="px-4 py-5 text-right text-[10px] font-black text-teal-600 uppercase tracking-widest w-40">Welfare (WLF)</th>
                                        <th className="px-4 py-5 text-right text-[10px] font-black text-green-600 uppercase tracking-widest w-40">Agriculture</th>
                                        <th className="px-4 py-5 text-right text-[10px] font-black text-blue-400 uppercase tracking-widest w-40">Education</th>
                                        <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredGrid.map((m, idx) => {
                                        const risk = riskMetrics[m.memberId] || { score: 0, status: 'Healthy' };
                                        return (
                                            <tr key={m.memberId} className={`hover:bg-blue-50/20 transition-colors group ${m.committed ? 'bg-green-50/30' : ''}`}>
                                                <td className="px-8 py-4">
                                                    <div className="font-black text-slate-800">{m.memberName}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${risk.status === 'At Risk' ? 'bg-red-100 text-red-600' :
                                                            risk.status === 'Stable' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                                            }`}>
                                                            {risk.score}% Risk • {risk.status}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-slate-400 font-mono">{m.phone}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <TransactionInput
                                                        value={m.savings} onChange={(v) => updateGridValue(m.memberId, 'savings', v)}
                                                        rowIndex={idx} colIndex={0} totalRows={filteredGrid.length} totalCols={4}
                                                        disabled={m.committed}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <TransactionInput
                                                        value={m.welfare} onChange={(v) => updateGridValue(m.memberId, 'welfare', v)}
                                                        rowIndex={idx} colIndex={1} totalRows={filteredGrid.length} totalCols={4}
                                                        disabled={m.committed}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <TransactionInput
                                                        value={m.agri} onChange={(v) => updateGridValue(m.memberId, 'agri', v)}
                                                        rowIndex={idx} colIndex={2} totalRows={filteredGrid.length} totalCols={4}
                                                        disabled={m.committed}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <TransactionInput
                                                        value={m.edu} onChange={(v) => updateGridValue(m.memberId, 'edu', v)}
                                                        rowIndex={idx} colIndex={3} totalRows={filteredGrid.length} totalCols={4}
                                                        disabled={m.committed}
                                                    />
                                                </td>
                                                <td className="px-8 py-4 text-center">
                                                    {m.committed ? (
                                                        <span className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                                                            <FaCheckCircle />
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCommitRow(m)}
                                                            className="w-10 h-10 border-2 border-slate-100 text-slate-300 hover:border-blue-500 hover:text-blue-500 rounded-full flex items-center justify-center mx-auto transition-all"
                                                        >
                                                            <FaRegCheckCircle />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contributions;
