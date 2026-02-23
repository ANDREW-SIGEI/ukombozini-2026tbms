import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import SearchableGroupSelector from '../components/SearchableGroupSelector';

const CashControlModule = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);

    // Session State
    const [session, setSession] = useState(null);
    const [context, setContext] = useState(null);
    const [loading, setLoading] = useState(false);

    // Input State
    const [physicalCount, setPhysicalCount] = useState('');
    const [explanation, setExplanation] = useState('');
    const [confirmCheck, setConfirmCheck] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        if (selectedGroup) {
            checkLatestSession();
        }
    }, [selectedGroup, meetingDate]);

    const loadGroups = async () => {
        const data = await api.getGroups();
        setGroups(data);
    };

    const checkLatestSession = async () => {
        setLoading(true);
        try {
            const latest = await api.getLatestCashSession(selectedGroup.id);
            if (latest && latest.meeting_date === meetingDate) {
                setSession(latest);
                loadContext(latest.id);
            } else {
                setSession(null);
                setContext(null);
            }
        } catch (err) {
            console.error("Session check failed", err);
        } finally {
            setLoading(false);
        }
    };

    const loadContext = async (sessionId) => {
        const data = await api.getCashSessionContext(sessionId);
        setContext(data);
        if (data?.session?.status === 'LOCKED') {
            setPhysicalCount(data.session.physical_cash_count);
            setExplanation(data.session.variance_explanation || '');
        }
    };

    const handleOpenSession = async () => {
        setIsProcessing(true);
        try {
            const res = await api.openCashSession(selectedGroup.id, meetingDate);
            if (res) {
                toast.success("Cash Control Session Initialized");
                setSession(res);
                loadContext(res.id);
            }
        } catch (error) {
            console.error("Open Session Failed:", error);
            // Error toast is handled by api.js
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVerifyAndLock = async () => {
        setIsProcessing(true);
        try {
            const res = await api.verifyAndLockCashSession(session.id, {
                physical_cash_count: parseFloat(physicalCount),
                explanation
            });
            if (res) {
                toast.success("Session Verified & Locked Successfully");
                checkLatestSession();
            }
        } catch (error) {
            console.error("Verify Lock Failed:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("UKOMBOZI CASH CONTROL SLIP", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`SESSION ID: ${session.id}`, pageWidth / 2, 28, { align: "center" });

        // Governance Info
        doc.setDrawColor(200);
        doc.line(20, 35, pageWidth - 20, 35);

        doc.setFont("helvetica", "bold");
        doc.text("ENTITY:", 20, 45);
        doc.setFont("helvetica", "normal");
        doc.text(selectedGroup.name, 50, 45);

        doc.setFont("helvetica", "bold");
        doc.text("DATE:", 120, 45);
        doc.setFont("helvetica", "normal");
        doc.text(meetingDate, 140, 45);

        doc.setFont("helvetica", "bold");
        doc.text("OFFICER:", 20, 52);
        doc.setFont("helvetica", "normal");
        doc.text(`${user.name} (#${user.id})`, 50, 52);

        doc.setFont("helvetica", "bold");
        doc.text("STATUS:", 120, 52);
        doc.setFont("helvetica", "normal");
        doc.text(session.status, 140, 52);

        // Position Summary
        doc.setFillColor(245, 247, 250);
        doc.rect(20, 60, pageWidth - 40, 30, 'F');

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("INSTITUTIONAL POSITION SNAPSHOT", 25, 68);

        doc.setFontSize(9);
        doc.text(`OPENING CASH: KES ${context.session.opening_balance.toLocaleString()}`, 25, 78);
        doc.text(`TOTAL INFLOWS: KES ${context.summary.total_in.toLocaleString()}`, 25, 83);
        doc.text(`TOTAL OUTFLOWS: KES ${context.summary.total_out.toLocaleString()}`, 110, 78);
        doc.text(`EXPECTED BALANCE: KES ${context.summary.expected_closing.toLocaleString()}`, 110, 83);

        // Physical Count
        doc.setFontSize(11);
        doc.text(`PHYSICAL COUNT: KES ${context.session.physical_cash_count.toLocaleString()}`, 25, 95);
        doc.text(`VARIANCE: KES ${context.session.variance.toLocaleString()}`, 110, 95);

        // Ledger Table
        doc.autoTable({
            startY: 105,
            head: [['Source', 'Direction', 'Amount (KES)', 'Reference', 'Time']],
            body: context.ledger.map(item => [
                item.source,
                item.direction,
                item.amount.toLocaleString(),
                item.reference_id?.substring(0, 15),
                new Date(item.created_at).toLocaleTimeString()
            ]),
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
            styles: { fontSize: 8 }
        });

        // Audit Hash
        const finalY = doc.previousAutoTable.finalY + 15;
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        doc.text("AUDIT HASH:", 20, finalY);
        doc.text(session.audit_hash || "N/A", 20, finalY + 5);

        doc.save(`CashControl_${selectedGroup.name}_${meetingDate}.pdf`);
    };

    const expectedClosing = context?.summary?.expected_closing || 0;
    const physical = Number(physicalCount || 0);
    const variance = physical - expectedClosing;
    const isLocked = session?.status === 'LOCKED';
    const isAuditor = user?.role === 'auditor';

    // Validation Logic from User JS
    const isVarianceValid = Math.abs(variance) <= 100;
    const isBtnDisabled = !(confirmCheck && isVarianceValid) || isLocked || isProcessing;

    const getVarianceClass = () => {
        if (variance === 0) return "variance good";
        if (Math.abs(variance) <= 100) return "variance neutral";
        return "variance bad";
    };

    return (
        <div className="cash-control-container">
            <style>{`
                .cash-control-container {
                    font-family: 'Inter', sans-serif;
                    padding: 30px;
                    background: #f4f6fa;
                    min-height: 100vh;
                    color: #1f2937;
                }

                /* GOVERNANCE BAR */
                .gov-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 25px;
                    border-radius: 12px;
                    margin-bottom: 25px;
                    background: #e9f6ef;
                    border-left: 6px solid #22c55e;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.02);
                }
                .gov-bar.locked {
                    background: #f3f4f6;
                    border-left: 6px solid #6b7280;
                }
                .gov-bar.frozen {
                    background: #fee2e2;
                    border-left: 6px solid #dc2626;
                }
                .gov-bar strong { font-size: 1.1rem; color: #111827; }
                .meta { color: #6b7280; font-size: 0.85rem; margin-left: 10px; font-weight: 600; }
                .status { font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }

                /* SELECTORS SECTION */
                .selectors {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 25px;
                }
                .selectors select, .selectors input {
                    padding: 10px 15px;
                    border-radius: 10px;
                    border: 1px solid #d1d5db;
                    background: #fff;
                    font-weight: 600;
                    color: #374151;
                }

                /* SNAPSHOT GRID */
                .snapshot-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 18px;
                    margin-bottom: 30px;
                }
                .card {
                    background: #fff;
                    border-radius: 15px;
                    padding: 24px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
                    border: 1px solid #f1f5f9;
                }
                .card h4 {
                    margin: 0 0 10px 0;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #94a3b8;
                    font-weight: 700;
                }
                .amount { font-size: 1.75rem; font-weight: 800; color: #1e293b; }
                .amount.green { color: #16a34a; }
                .amount.red { color: #dc2626; }
                .card.highlight { background: #2563eb; color: #fff; border: none; }
                .card.highlight h4 { color: rgba(255,255,255,0.7); }
                .card.highlight .amount { color: #fff; }

                /* LEDGER */
                .ledger {
                    background: #fff;
                    border-radius: 15px;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.03);
                    border: 1px solid #e5e7eb;
                    margin-bottom: 30px;
                }
                .ledger h3 { margin: 20px 25px; font-size: 1rem; font-weight: 800; text-transform: uppercase; color: #475569; }
                .ledger table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .ledger th, .ledger td {
                    padding: 15px 25px;
                    text-align: left;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.9rem;
                }
                .ledger th { 
                    background: #f8fafc; 
                    font-size: 0.7rem; 
                    text-transform: uppercase; 
                    letter-spacing: 1px; 
                    color: #64748b; 
                }
                .ledger tr:last-child td { border-bottom: none; }
                .ledger td { font-weight: 600; color: #334155; }

                /* VERIFICATION PANEL */
                .verification-panel {
                    background: #fff;
                    padding: 30px;
                    border-radius: 18px;
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.08);
                    border: 1px solid #e5e7eb;
                }
                .verification-panel h3 { margin: 0 0 20px 0; font-size: 1.1rem; font-weight: 800; color: #111827; }
                .verification-panel label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748b;
                    margin-bottom: 8px;
                }
                .verification-panel input[type="number"] {
                    width: 100%;
                    padding: 15px;
                    border-radius: 12px;
                    border: 2px solid #e2e8f0;
                    font-size: 1.5rem;
                    font-weight: 800;
                    margin-bottom: 20px;
                    transition: border-color 0.2s;
                }
                .verification-panel input:focus { border-color: #2563eb; outline: none; }
                
                .checkbox {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    margin-top: 20px;
                    user-select: none;
                }
                .checkbox input { width: 20px; height: 20px; cursor: pointer; }
                .checkbox span { font-size: 0.9rem; font-weight: 600; color: #4b5563; }

                .variance {
                    padding: 14px 20px;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .variance.neutral { background: #f3f4f6; color: #374151; }
                .variance.good { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                .variance.bad { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

                /* FOOTER */
                .action-footer {
                    margin-top: 30px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 15px;
                }
                .btn {
                    padding: 14px 30px;
                    border-radius: 12px;
                    border: none;
                    cursor: pointer;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .btn.cancel { background: #fff; color: #64748b; border: 1px solid #e2e8f0; }
                .btn.primary {
                    background: #2563eb;
                    color: #fff;
                    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
                }
                .btn.primary:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); }
                .btn.primary:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                    box-shadow: none;
                    transform: none;
                }

                /* EMPTY STATE */
                .empty-init {
                    background: #fff;
                    padding: 60px;
                    border-radius: 20px;
                    text-align: center;
                    border: 2px dashed #e2e8f0;
                }
                .empty-init h2 { font-weight: 900; color: #1e293b; margin-bottom: 15px; }
                .empty-init p { color: #64748b; margin-bottom: 30px; }
            `}</style>

            {/* GOVERNANCE WATERMARK (Auditor Mode) */}
            {isAuditor && (
                <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '10rem', color: 'rgba(0,0,0,0.03)', fontWeight: 900, pointerEvents: 'none', zIndex: 0, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Auditor Review
                </div>
            )}

            {/* SELECTORS */}
            <div className="selectors relative z-[100]">
                <SearchableGroupSelector
                    groups={groups}
                    selectedGroupId={selectedGroup?.id}
                    disabled={isProcessing || isLocked}
                    onSelect={(id) => setSelectedGroup(groups.find(g => g.id === id))}
                    label="Select Group Entity"
                />
                <h1 className="text-xl font-bold text-white">UKOMBOZINI <span className="text-blue-400">FINANCE</span></h1>
                <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-2">Meeting Date</label>
                    <input
                        type="date"
                        className="p-2 border rounded-xl font-bold"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        disabled={isProcessing || isLocked || isAuditor}
                    />
                </div>
            </div>

            {!session && selectedGroup && (
                <div className="empty-init">
                    <h2>Institutional Initialization Required</h2>
                    {isAuditor ? (
                        <p>No active cash session found. Auditors cannot initialize new sessions.</p>
                    ) : (
                        <>
                            <p>No cash session exists for this entity on this date. Open a session to begin reconciliation.</p>
                            <button onClick={handleOpenSession} className="btn primary" disabled={isProcessing}>
                                {isProcessing ? "Initialzing..." : "Open Cash Session"}
                            </button>
                        </>
                    )}
                </div>
            )}

            {session && context && (
                <div className="cash-control-content">
                    {/* RISK ALERT BANNER */}
                    {selectedGroup?.status === 'suspended' && (
                        <div style={{ background: '#7f1d1d', color: '#fff', padding: '15px 25px', borderRadius: '12px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                ⚠️ INSTITUTIONAL LOCKDOWN: Critical Cash Variance Detected
                            </div>
                            {user?.role === 'director' && (
                                <button
                                    className="btn"
                                    style={{ background: '#fff', color: '#7f1d1d', padding: '8px 15px', fontSize: '0.7rem' }}
                                    onClick={async () => {
                                        if (window.confirm("Director Overrule: Are you sure you want to clear this risk flag?")) {
                                            await api.toggleFreeze('GROUP', selectedGroup.id, 'UNFREEZE', 'Director Overrule: Cash Control Clearance');
                                            toast.success("Risk Flag Cleared. System Normal.");
                                            loadGroups();
                                        }
                                    }}
                                >
                                    Director Overrule
                                </button>
                            )}
                        </div>
                    )}

                    {/* GOVERNANCE BAR */}
                    <div className={`gov-bar ${isLocked ? 'locked' : selectedGroup?.status === 'suspended' ? 'frozen' : 'open'}`}>
                        <div>
                            <strong>{selectedGroup?.name || 'ENTITY'}</strong> • Cash Control
                            <span className="meta">{new Date(meetingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="status">
                            {isLocked ? '🔴 LOCKED' : isAuditor ? '🔍 AUDIT' : '🟢 OPEN'} | Officer: {user?.name || 'Authorized'} (#{user?.id || '4052'})
                        </div>
                    </div>

                    {!isLocked && !isAuditor && (
                        <div className="impact-preview">
                            <span style={{ fontSize: '1.2rem' }}>💡</span>
                            <div>
                                <strong>Institutional Impact Preview:</strong> Locking this session will atomically recalculate the
                                <span style={{ color: '#0284c7' }}> {new Date(meetingDate).toLocaleString('default', { month: 'long' })} {new Date(meetingDate).getFullYear()} Monthly Institutional Report</span>.
                            </div>
                        </div>
                    )}

                    {/* SNAPSHOT CARDS */}
                    <div className="snapshot-grid">
                        <div className="card">
                            <h4>Opening Balance</h4>
                            <p className="amount">KES {context.session.opening_balance.toLocaleString()}</p>
                        </div>
                        <div className="card">
                            <h4>Total Inflows</h4>
                            <p className="amount green">KES {context.summary.total_in.toLocaleString()}</p>
                        </div>
                        <div className="card">
                            <h4>Total Outflows</h4>
                            <p className="amount red">KES {context.summary.total_out.toLocaleString()}</p>
                        </div>
                        <div className="card highlight">
                            <h4>Expected Closing</h4>
                            <p className="amount">KES {context.summary.expected_closing.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* LEDGER */}
                    <div className="ledger">
                        <h3>Transaction Ledger</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Reference</th>
                                    <th>In</th>
                                    <th>Out</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {context.ledger.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No transactions recorded for this session.</td></tr>
                                ) : context.ledger.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.source}</td>
                                        <td>{item.reference_id?.substring(0, 12)}...</td>
                                        <td className="green">{item.direction === 'IN' ? `KES ${item.amount.toLocaleString()}` : '-'}</td>
                                        <td className="red">{item.direction === 'OUT' ? `KES ${item.amount.toLocaleString()}` : '-'}</td>
                                        <td>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* PHYSICAL CASH VERIFICATION */}
                    <div className="verification-panel">
                        <h3>Physical Cash Verification</h3>

                        <label>Physical Cash Count (KES)</label>
                        <input
                            type="number"
                            id="physicalCash"
                            placeholder="e.g. 21300"
                            value={physicalCount}
                            onChange={(e) => setPhysicalCount(e.target.value)}
                            readOnly={isLocked}
                        />

                        <div id="varianceBox" className={getVarianceClass()}>
                            <span>Variance:</span>
                            <span>KES {variance.toLocaleString()}</span>
                        </div>

                        {Math.abs(variance) > 0 && Math.abs(variance) <= 100 && !isLocked && (
                            <div style={{ marginTop: '20px' }}>
                                <label>Institutional Explanation</label>
                                <textarea
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontFamily: 'inherit' }}
                                    placeholder="Explain the minor variance..."
                                    value={explanation}
                                    onChange={(e) => setExplanation(e.target.value)}
                                />
                            </div>
                        )}

                        <label className="checkbox">
                            <input
                                type="checkbox"
                                id="confirmCheck"
                                checked={confirmCheck || isLocked}
                                onChange={(e) => setConfirmCheck(e.target.checked)}
                                disabled={isLocked}
                            />
                            <span>I confirm the physical cash has been counted accurately and reflects the actual holdings.</span>
                        </label>

                        {/* ACTION FOOTER */}
                        <div className="action-footer">
                            <button className="btn cancel" onClick={() => window.history.back()}>Close View</button>
                            {!isLocked && !isAuditor && (
                                <button
                                    className="btn primary"
                                    id="verifyBtn"
                                    disabled={isBtnDisabled}
                                    onClick={handleVerifyAndLock}
                                >
                                    {isProcessing ? "Processing..." : "Verify & Lock Session"}
                                </button>
                            )}
                            {isLocked && (
                                <button className="btn primary" onClick={generatePDF}>
                                    Download Closing Slip
                                </button>
                            )}
                            {isLocked && (user?.role === 'admin' || user?.role === 'director') && (
                                <button
                                    className="btn"
                                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                                    onClick={async () => {
                                        const reason = window.prompt("Enter MANDATORY reason for force-unlocking this institutional session:");
                                        if (!reason) return;
                                        try {
                                            const res = await api.unlockSession(context.session.id, reason);
                                            if (res.success) {
                                                toast.success("Session Unlocked. Re-syncing data...");
                                                loadContext(context.session.id);
                                            }
                                        } catch (err) {
                                            toast.error("Unlock Failed: Security Constraint");
                                        }
                                    }}
                                >
                                    Master Key: Unlock Session
                                </button>
                            )}
                            {isAuditor && !isLocked && (
                                <button className="btn" style={{ background: '#fef3c7', color: '#92400e' }} disabled>
                                    Review Mode: Read-Only
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashControlModule;
