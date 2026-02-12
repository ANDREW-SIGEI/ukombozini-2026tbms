import React, { useState, useEffect } from 'react';
import {
    FaGear, FaUsers, FaUserTie, FaChartLine, FaDatabase,
    FaFileExport, FaShieldHalved, FaPlus, FaPenToSquare, FaTrash,
    FaSpinner, FaCircleCheck, FaCalendarDays, FaMoneyBillWave,
    FaLocationDot, FaEnvelope, FaPhone, FaFloppyDisk, FaClockRotateLeft, FaUserPlus,
    FaXmark, FaHandHoldingDollar
} from 'react-icons/fa6';
import { FaUndo } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);

    // System Stats
    const [stats, setStats] = useState({
        totalGroups: 0,
        totalMembers: 0,
        totalSavings: 0,
        totalLoans: 0,
        activeOfficers: 0
    });

    // Groups State
    const [groups, setGroups] = useState([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [newGroup, setNewGroup] = useState({
        group_name: '',
        meeting_day: 'Monday',
        meeting_frequency: 'WEEKLY',
        location: '',
        chairperson: '',
        chairperson_phone: '',
        secretary: '',
        secretary_phone: '',
        treasurer: '',
        treasurer_phone: '',
        minMonthlySaving: 500,
        loanMultiplier: 3,
        dividendPolicy: 0.75,
        financial_year: new Date().getFullYear()
    });

    // Officers State
    const [officers, setOfficers] = useState([]);
    const [showOfficerModal, setShowOfficerModal] = useState(false);
    const [newOfficer, setNewOfficer] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'Field Officer'
    });

    // Loan Products State
    const [loanProducts, setLoanProducts] = useState([]);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        code: '',
        interest_rate: 10,
        duration_months: 1,
        max_amount: 100000,
        description: ''
    });

    // Audit Logs State
    const [auditLogs, setAuditLogs] = useState([]);

    // System Settings State
    const [settings, setSettings] = useState([]);

    // Pending Requests for Approvals Tab
    const [pendingTopups, setPendingTopups] = useState([]);

    // Treasury State
    const [treasuryData, setTreasuryData] = useState([]);

    // Institutional Analytics State
    const [institutionalStats, setInstitutionalStats] = useState({
        totalSavings: 0,
        activeLoans: 0,
        totalMembers: 0,
        totalGroups: 0,
        complianceRate: 0,
        historical: []
    });

    useEffect(() => {
        fetchSystemData();
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            const [logs, setts, products, topups, treasury, instStats] = await Promise.all([
                api.getAuditLogs({ limit: 15 }),
                api.getAdminSettings(),
                api.getLoanProducts(),
                api.getPendingTopUpRequests(),
                api.getTreasuryStatus(),
                api.getInstitutionalStats()
            ]);
            setAuditLogs(Array.isArray(logs) ? logs : []);
            setSettings(setts);
            setLoanProducts(products);
            setPendingTopups(topups || []);
            setTreasuryData(Array.isArray(treasury) ? treasury : []);
            if (instStats) setInstitutionalStats(instStats);
        } catch (error) {
            console.error("Admin Data Fetch Error:", error);
        }
    };

    const fetchSystemData = async () => {
        setLoading(true);
        try {
            const [groupsData, membersData, loansData, officersData] = await Promise.all([
                api.getGroups(),
                api.getMembers(),
                api.getLoans(),
                api.getOfficers()
            ]);

            setGroups(groupsData || []);
            setOfficers(officersData || []);

            // Calculate stats
            const totalSavings = (membersData || []).reduce((sum, m) => sum + (m.current_savings || 0), 0);
            const totalLoans = (loansData || []).reduce((sum, l) => sum + (l.principal || 0), 0);

            setStats({
                totalGroups: groupsData?.length || 0,
                totalMembers: membersData?.length || 0,
                totalSavings: totalSavings,
                totalLoans: totalLoans,
                activeOfficers: officersData?.length || 0
            });
        } catch (error) {
            console.error(error);
            toast.error("Failed to load system data");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadBoardReport = async () => {
        setLoading(true);
        try {
            const data = await api.getBoardReport();
            if (!data || data.length === 0) {
                toast.error("No data available for board report");
                return;
            }

            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text('UKOMBOZI INSTITUTIONAL BOARD REPORT', 14, 22);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
            doc.text(`Institutional Assets: KES ${institutionalStats.totalSavings.toLocaleString()}`, 14, 38);
            doc.text(`Portfolio at Risk: KES ${institutionalStats.activeLoans.toLocaleString()}`, 14, 44);

            const tableRows = data.map(group => [
                group.name,
                group.member_count,
                `KES ${parseFloat(group.total_savings || 0).toLocaleString()}`,
                `KES ${parseFloat(group.loan_portfolio || 0).toLocaleString()}`,
                `KES ${parseFloat(group.last_variance || 0).toLocaleString()}`,
                group.session_status
            ]);

            autoTable(doc, {
                startY: 55,
                head: [['Group Name', 'Members', 'Total Savings', 'Loan Portfolio', 'Last Variance', 'Status']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [0, 128, 0] } // Safaricom Green
            });

            doc.save(`UKOMBOZI_BOARD_REPORT_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("Board Report generated successfully");
        } catch (error) {
            console.error("Report Generation Error:", error);
            toast.error("Failed to generate board report");
        } finally {
            setLoading(false);
        }
    };

    const handleEditGroup = (group) => {
        setEditingGroup(group);
        setNewGroup({
            group_name: group.group_name || group.name,
            meeting_day: group.meeting_day || group.meetingDay || 'Monday',
            meeting_frequency: (group.meeting_frequency || group.meetingFrequency || 'WEEKLY').toUpperCase(),
            location: group.location || '',
            chairperson: group.chairperson || '',
            chairperson_phone: group.chairperson_phone || '',
            secretary: group.secretary || '',
            secretary_phone: group.secretary_phone || '',
            treasurer: group.treasurer || '',
            treasurer_phone: group.treasurer_phone || '',
            minMonthlySaving: group.minMonthlySaving || 500,
            loanMultiplier: group.loanMultiplier || 3,
            dividendPolicy: group.dividendPolicy || 0.75,
            financial_year: group.financial_year || new Date().getFullYear()
        });
        setShowGroupModal(true);
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingGroup) {
                await api.updateGroup(editingGroup.id, {
                    ...newGroup,
                    id: editingGroup.id
                });
                toast.success(`✅ ${newGroup.group_name} updated successfully!`);
            } else {
                await api.createGroup({
                    ...newGroup,
                    registration_date: new Date().toISOString().split('T')[0]
                });
                toast.success(`✅ ${newGroup.group_name} created successfully!`);
            }
            setShowGroupModal(false);
            setEditingGroup(null);
            setNewGroup({
                group_name: '',
                meeting_day: 'Monday',
                meeting_frequency: 'WEEKLY',
                location: '',
                chairperson: '',
                chairperson_phone: '',
                secretary: '',
                secretary_phone: '',
                treasurer: '',
                treasurer_phone: '',
                minMonthlySaving: 500,
                loanMultiplier: 3,
                dividendPolicy: 0.75,
                financial_year: new Date().getFullYear()
            });
            fetchSystemData();
        } catch (error) {
            console.error(error);
            toast.error(editingGroup ? "Failed to update group" : "Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGroup = async (groupId, groupName) => {
        if (!window.confirm(`⚠️ Are you sure you want to delete "${groupName}"?`)) {
            return;
        }
        try {
            await api.deleteGroup(groupId);
            toast.success(`Group "${groupName}" deleted`);
            fetchSystemData();
        } catch (error) {
            toast.error(error.message || "Failed to delete group");
        }
    };

    // ========================================
    // OFFICERS MANAGEMENT FUNCTIONS
    // ========================================
    const handleCreateOfficer = async (e) => {
        e.preventDefault();
        try {
            await api.saveOfficer(newOfficer);
            toast.success(`✅ Field Officer ${newOfficer.name} registered with generated password!`);
            setShowOfficerModal(false);
            setNewOfficer({ name: '', email: '', phone: '', role: 'Field Officer', password: '' });
            fetchSystemData();
        } catch (error) {
            console.error("Create Officer Error", error);
            toast.error(error.message || "Failed to create officer");
        }
    };

    const generateRandomPassword = () => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let retVal = "";
        for (let i = 0, n = charset.length; i < 8; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        setNewOfficer(prev => ({ ...prev, password: retVal }));
    };


    // ========================================
    // LOAN PRODUCTS FUNCTIONS
    // ========================================
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        try {
            await api.saveLoanProduct(newProduct);
            toast.success(`✅ Loan product saved!`);
            setShowProductModal(false);
            setNewProduct({
                name: '',
                code: '',
                interest_rate: 10,
                duration_months: 1,
                max_amount: 100000,
                description: ''
            });
            fetchAdminData();
        } catch (error) {
            toast.error("Failed to save loan product");
        }
    };

    const handleBackup = () => {
        toast.info("Preparing backup...");
        api.downloadBackup();
    };

    const handleUpdateSetting = async (key, value, description) => {
        try {
            await api.saveAdminSetting({ key, value, description });
            toast.success(`Setting updated`);
            fetchAdminData();
        } catch (error) {
            toast.error("Failed to update setting");
        }
    };

    const handleDeleteProduct = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete the "${name}" template?`)) return;
        try {
            await api.deleteLoanProduct(id);
            toast.success("Product template deleted");
            fetchAdminData();
        } catch (error) {
            toast.error(error.message || "Failed to delete product");
        }
    };

    // ========================================
    // TABS CONFIGURATION
    // ========================================
    const tabs = [
        { id: 'overview', name: 'System Overview', icon: <FaChartLine /> },
        { id: 'approvals', name: 'Approvals Hub', icon: <FaCircleCheck /> },
        { id: 'groups', name: 'Groups', icon: <FaUsers /> },
        { id: 'officers', name: 'Officers', icon: <FaUserTie /> },
        { id: 'products', name: 'Loan Products', icon: <FaMoneyBillWave /> },
        { id: 'settings', name: 'Settings', icon: <FaGear /> },
        { id: 'treasury', name: 'Treasury Control', icon: <FaDatabase /> },
        { id: 'audit', name: 'Audit Logs', icon: <FaClockRotateLeft /> },
        { id: 'backup', name: 'Backup & Export', icon: <FaDatabase /> }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaShieldHalved className="text-red-600" /> Admin Control Panel
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        System Administration & Configuration
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex overflow-x-auto border-b border-gray-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold whitespace-nowrap transition-colors ${activeTab === tab.id
                                ? 'bg-safaricom-green text-white border-b-4 border-green-700'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {tab.icon}
                            {tab.name}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {/* APPROVALS HUB TAB */}
                    {activeTab === 'approvals' && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-gray-800">Approvals Control Tower</h3>
                                    <p className="text-sm text-gray-500 font-bold uppercase">Pending Institutional Authorizations</p>
                                </div>
                                <button
                                    onClick={fetchAdminData}
                                    className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                                    title="Refresh Content"
                                >
                                    <FaClockRotateLeft className={loading ? "animate-spin" : ""} />
                                </button>
                            </div>

                            {/* Approval Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Top-up Requests */}
                                <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                                        <h4 className="font-black text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2">
                                            <FaMoneyBillWave /> Pending Partnership Top-ups
                                        </h4>
                                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                            {pendingTopups.length} PENDING
                                        </span>
                                    </div>
                                    <div className="p-0">
                                        {pendingTopups.length === 0 ? (
                                            <div className="p-10 text-center text-gray-400 font-bold italic">
                                                No pending top-up requests at this time.
                                            </div>
                                        ) : (
                                            <div className="divide-y">
                                                {pendingTopups.map(req => (
                                                    <div key={req.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                                        <div>
                                                            <p className="font-black text-gray-800 text-sm">{req.group_name}</p>
                                                            <div className="flex gap-3 text-[10px] mt-1 font-bold">
                                                                <span className="text-gray-400 uppercase">DEP: KES {parseFloat(req.commitment_amount).toLocaleString()}</span>
                                                                <span className="text-emerald-600 uppercase">TOPUP: KES {parseFloat(req.topup_amount).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                        <a
                                                            href="/partnership-manager?tab=approval-queue"
                                                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                                                        >
                                                            GO TO QUEUE
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Other Approval Shortcuts */}
                                <div className="space-y-4">
                                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest mb-4">Other Workflows</h4>

                                    <ApprovalShortcut
                                        icon={<FaHandHoldingDollar />}
                                        label="Loan Applications"
                                        desc="Approve STL/LTL funding"
                                        path="/loan-approvals"
                                        color="blue"
                                    />

                                    <ApprovalShortcut
                                        icon={<FaUndo />}
                                        label="Reversal Center"
                                        desc="Audit transaction corrections"
                                        path="/reversal-center"
                                        color="orange"
                                    />

                                    <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                        <p className="text-[10px] font-black text-blue-800 uppercase mb-2">Governance Note</p>
                                        <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                                            Approvals are permanent and trigger real-time financial updates across all group ledgers and the institutional balance sheet.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Institutional KPIs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard
                                    title="System Savings"
                                    value={`KES ${institutionalStats.totalSavings.toLocaleString()}`}
                                    icon={<FaMoneyBillWave />}
                                    color="green"
                                    trend={`+${institutionalStats.complianceRate}% Compliance`}
                                />
                                <StatCard
                                    title="Loan Portfolio"
                                    value={`KES ${institutionalStats.activeLoans.toLocaleString()}`}
                                    icon={<FaHandHoldingDollar />}
                                    color="blue"
                                />
                                <StatCard
                                    title="Total Members"
                                    value={institutionalStats.totalMembers}
                                    icon={<FaUserTie />}
                                    color="orange"
                                />
                                <StatCard
                                    title="Active Groups"
                                    value={institutionalStats.totalGroups}
                                    icon={<FaUsers />}
                                    color="purple"
                                />
                            </div>

                            {/* Analytics Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 flex justify-between items-center">
                                        <span>Institutional Growth</span>
                                        <span className="text-[10px] text-gray-400 font-bold">Last 6 Months</span>
                                    </h4>
                                    <div className="h-64">
                                        <Line
                                            data={{
                                                labels: institutionalStats.historical.map(h => h.month),
                                                datasets: [
                                                    {
                                                        label: 'Savings In',
                                                        data: institutionalStats.historical.map(h => h.savings_in),
                                                        borderColor: '#10b981',
                                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                        fill: true,
                                                        tension: 0.4
                                                    },
                                                    {
                                                        label: 'Loans Issued',
                                                        data: institutionalStats.historical.map(h => h.loans_out),
                                                        borderColor: '#3b82f6',
                                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                        fill: true,
                                                        tension: 0.4
                                                    }
                                                ]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 10 } } } },
                                                scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Portfolio Allocation</h4>
                                    <div className="h-64 flex items-center justify-center">
                                        <Doughnut
                                            data={{
                                                labels: ['Savings', 'Active Loans'],
                                                datasets: [{
                                                    data: [institutionalStats.totalSavings, institutionalStats.activeLoans],
                                                    backgroundColor: ['#10b981', '#3b82f6'],
                                                    hoverOffset: 4
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 10 } } } }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Executive Reporting</h4>
                                    <p className="text-[10px] text-gray-500 font-bold">Consolidated performance insights for board review</p>
                                </div>
                                <button
                                    onClick={() => handleDownloadBoardReport()}
                                    className="px-6 py-2 bg-gray-800 text-white text-xs font-black rounded-xl hover:bg-gray-900 transition-all flex items-center gap-2"
                                >
                                    <FaFileExport /> Download Board Report
                                </button>
                            </div>

                            {/* Activity & Quick Actions Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Timeline Column */}
                                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h4 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                                        <FaClockRotateLeft className="text-safaricom-green" /> Recent Institutional Activity
                                    </h4>
                                    <div className="relative pl-6 border-l-2 border-gray-100 space-y-8">
                                        {auditLogs.length === 0 ? (
                                            <div className="p-10 text-center text-gray-400 font-bold italic">
                                                No recent system logs identified.
                                            </div>
                                        ) : (
                                            auditLogs.slice(0, 8).map(log => (
                                                <div key={log.id} className="relative group">
                                                    <span className={`absolute -left-[35px] w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm group-hover:scale-110 transition-transform ${log.category === 'SECURITY' ? 'bg-red-100 text-red-600' :
                                                        log.category === 'ADMIN' ? 'bg-blue-100 text-blue-600' :
                                                            'bg-green-100 text-green-600'
                                                        }`}>
                                                        {log.category === 'SECURITY' ? <FaShieldHalved size={14} /> :
                                                            log.category === 'ADMIN' ? <FaGear size={14} /> :
                                                                <FaClockRotateLeft size={14} />}
                                                    </span>
                                                    <div className="bg-gray-50 p-4 rounded-xl hover:bg-white transition-all border border-transparent hover:border-gray-200">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h5 className="font-black text-gray-800 text-sm">{log.action}</h5>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    Performed by <span className="font-black text-gray-700">{log.officer_name}</span>.
                                                                    {log.details && <span className="block italic mt-0.5 text-[10px]">{typeof log.details === 'string' && log.details.startsWith('{') ? 'System data update' : log.details}</span>}
                                                                </p>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100 whitespace-nowrap">
                                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Quick Actions Column */}
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-br from-safaricom-green to-green-700 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group">
                                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-110 transition-transform duration-500"></div>
                                        <h4 className="font-black text-lg mb-4 relative z-10">Quick Actions</h4>
                                        <div className="space-y-3 relative z-10">
                                            <button
                                                onClick={() => setShowOfficerModal(true)}
                                                className="w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border border-white/10"
                                            >
                                                <FaUserTie /> Assign Officer
                                            </button>
                                            <button
                                                onClick={() => setShowGroupModal(true)}
                                                className="w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border border-white/10"
                                            >
                                                <FaUsers /> Register Group
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-100">
                                        <h4 className="font-black text-red-800 mb-4 flex items-center gap-2 text-sm">
                                            <FaShieldHalved className="text-red-500" /> Security Hub
                                        </h4>
                                        <div className="space-y-3">
                                            {auditLogs.filter(l => l.category === 'SECURITY').length === 0 ? (
                                                <p className="text-[10px] text-gray-400 italic">No critical security events detected.</p>
                                            ) : (
                                                auditLogs.filter(l => l.category === 'SECURITY').slice(0, 3).map(log => (
                                                    <div key={log.id} className="p-3 bg-white rounded-xl border border-red-50">
                                                        <p className="text-[10px] font-black text-red-700">{log.action}</p>
                                                        <p className="text-[9px] text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h4 className="font-black text-gray-800 mb-4 flex items-center gap-2 text-sm">
                                            <FaFloppyDisk className="text-blue-500" /> System Health
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                                    <span>Storage Usage</span>
                                                    <span>45%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className="bg-blue-500 h-2 rounded-full w-[45%]"></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                                    <span>API Latency</span>
                                                    <span className="text-green-600">Total: 45ms</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className="bg-green-500 h-2 rounded-full w-[95%]"></div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleBackup}
                                                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-xs font-bold hover:border-safaricom-green hover:text-safaricom-green transition-colors mt-2"
                                            >
                                                Run Manual Backup
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* GROUPS TAB */}
                    {activeTab === 'groups' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h1 className="text-2xl font-bold text-white tracking-tight">UKOMBOZINI <span className="text-gray-400 font-normal">ADMIN</span></h1>
                                <button
                                    onClick={() => setShowGroupModal(true)}
                                    className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors"
                                >
                                    <FaPlus /> New Group
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {groups.map(group => (
                                    <div
                                        key={group.id}
                                        className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-safaricom-green/30 transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="overflow-hidden">
                                                    <h4 className="font-black text-gray-800 truncate">{group.group_name || group.name}</h4>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">
                                                        Registered: {new Date(group.created_at || group.registration_date || group.registrationDate).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <FaCircleCheck className={group.is_frozen || group.status === 'frozen' ? "text-red-500" : "text-green-500"} />
                                            </div>
                                            <div className="space-y-1 text-xs text-gray-600 mb-4">
                                                <p className="flex items-center gap-2">
                                                    <FaCalendarDays className="text-gray-400 shrink-0" />
                                                    <span className="truncate">{group.meeting_day || group.meetingDay} ({group.meeting_frequency || group.meetingFrequency})</span>
                                                </p>
                                                {group.location && (
                                                    <p className="flex items-center gap-2">
                                                        <FaLocationDot className="text-gray-400 shrink-0" />
                                                        <span className="truncate">{group.location}</span>
                                                    </p>
                                                )}
                                                <p className="flex items-center gap-2 text-[10px] bg-gray-50 p-1 rounded">
                                                    <FaUserTie className="text-safaricom-green" />
                                                    <span className="truncate font-semibold">{group.chairperson || 'No Chair'}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditGroup(group)}
                                                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold text-xs flex items-center justify-center gap-1"
                                            >
                                                <FaPenToSquare /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(group.id, group.group_name || group.name)}
                                                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-bold text-xs"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* OFFICERS TAB */}
                    {activeTab === 'officers' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-800">Officers Management</h3>
                                <button
                                    onClick={() => setShowOfficerModal(true)}
                                    className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors"
                                >
                                    <FaPlus /> Add Officer
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {officers.length === 0 ? (
                                    <div className="col-span-full bg-gray-50 p-6 rounded-xl text-center text-gray-500">
                                        <FaShieldHalved className="text-purple-300 transform scale-150 rotate-12 opacity-50" />
                                        <p className="font-bold">No officers found</p>
                                    </div>
                                ) : (
                                    officers.map(officer => (
                                        <div key={officer.id} className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-safaricom-green/30 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-black text-gray-800">{officer.full_name}</h4>
                                                    <p className="text-xs text-gray-500">{officer.email}</p>
                                                </div>
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded uppercase">
                                                    {officer.role.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-sm text-gray-600 mb-4">
                                                <p className="flex items-center gap-2">
                                                    <FaPhone className="text-gray-400" />
                                                    {officer.phone || 'N/A'}
                                                </p>
                                            </div>
                                            <button className="w-full px-3 py-2 bg-safaricom-green/10 text-safaricom-green rounded-lg hover:bg-safaricom-green/20 transition-colors font-bold text-sm">
                                                Manage Assignments
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* LOAN PRODUCTS TAB */}
                    {activeTab === 'products' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-800">Loan Products Configuration</h3>
                                <button
                                    onClick={() => setShowProductModal(true)}
                                    className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors"
                                >
                                    <FaPlus /> New Product
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {loanProducts.length === 0 ? (
                                    <div className="col-span-full text-center py-10 text-gray-400 font-bold">
                                        No loan products configured.
                                    </div>
                                ) : (
                                    loanProducts.map(product => (
                                        <LoanProductCard
                                            key={product.id}
                                            product={product}
                                            onEdit={() => {
                                                setNewProduct(product);
                                                setShowProductModal(true);
                                            }}
                                            onDelete={() => handleDeleteProduct(product.id, product.name)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-gray-800">System Settings</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SettingsSection title="Active Configuration">
                                    {settings.length === 0 ? (
                                        <p className="text-sm text-gray-400">No settings found.</p>
                                    ) : (
                                        settings.map(s => (
                                            <div key={s.key} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                                                <div>
                                                    <p className="text-sm font-black text-gray-700">{s.key.replace(/_/g, ' ').toUpperCase()}</p>
                                                    <p className="text-xs text-gray-500">{s.description}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        defaultValue={s.value}
                                                        onBlur={(e) => handleUpdateSetting(s.key, e.target.value, s.description)}
                                                        className="px-3 py-1 bg-gray-50 border border-gray-200 rounded font-bold text-sm text-right focus:border-safaricom-green outline-none w-24"
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </SettingsSection>

                                <SettingsSection title="Display & Region">
                                    <SettingRow label="Default Currency" value="KES" />
                                    <SettingRow label="Timezone" value="Nairobi (GMT+3)" />
                                </SettingsSection>
                            </div>
                        </div>
                    )}

                    {/* AUDIT LOGS TAB */}
                    {activeTab === 'audit' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-gray-800">System Audit Logs</h3>
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 font-black text-gray-600">Timestamp</th>
                                            <th className="px-4 py-3 font-black text-gray-600">User</th>
                                            <th className="px-4 py-3 font-black text-gray-600">Action</th>
                                            <th className="px-4 py-3 font-black text-gray-600">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {auditLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-10 text-center text-gray-400 font-bold">
                                                    No audit logs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditLogs.map(log => (
                                                <AuditLogRow
                                                    key={log.id}
                                                    time={new Date(log.created_at).toLocaleString()}
                                                    user={log.officer_name}
                                                    action={log.action}
                                                    details={log.details}
                                                />
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TREASURY CONTROL TAB */}
                    {activeTab === 'treasury' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-gray-800">Treasury & Cash Control</h3>
                                    <p className="text-sm text-gray-500 font-bold uppercase">Real-time Liquidity & Variance Monitoring</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={fetchAdminData}
                                        className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        <FaClockRotateLeft className={loading ? "animate-spin" : ""} />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 font-black text-gray-600">Group Name</th>
                                            <th className="px-4 py-3 font-black text-gray-600">Expected (Ledger)</th>
                                            <th className="px-4 py-3 font-black text-gray-600">Physical Count</th>
                                            <th className="px-4 py-3 font-black text-gray-600 text-right">Variance</th>
                                            <th className="px-4 py-3 font-black text-gray-600">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-gray-700">
                                        {treasuryData.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-4 py-10 text-center text-gray-400 font-bold italic">
                                                    No treasury data available. Ensure groups have performed initial daily reporting.
                                                </td>
                                            </tr>
                                        ) : (
                                            treasuryData.map(group => (
                                                <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-black text-gray-800">{group.name}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase italic">Last Meeting: {group.last_meeting || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold">KES {parseFloat(group.expected).toLocaleString()}</td>
                                                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">KES {parseFloat(group.physical).toLocaleString()}</td>
                                                    <td className={`px-4 py-3 font-mono font-black text-right ${Math.abs(group.variance) > 100 ? 'text-red-500 bg-red-50' : group.variance !== 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                                                        {group.variance > 0 ? '+' : ''}{parseFloat(group.variance).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${group.is_frozen || group.status === 'suspended' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                            {group.is_frozen || group.status === 'suspended' ? 'SUSPENDED/FROZEN' : 'ACTIVE'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-4 items-start">
                                <FaShieldHalved className="text-orange-600 text-2xl mt-1" />
                                <div>
                                    <h4 className="font-black text-orange-800 text-xs uppercase mb-1">Institutional Liquidity Enforcement</h4>
                                    <p className="text-[11px] text-orange-700 leading-relaxed font-bold">
                                        The Treasury Dashboard aggregates the physical "Cash Bag" counts against digital ledger balances.
                                        Variances exceeding KES 100 trigger an automatic risk freeze on the group to prevent unauthorized outflows.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BACKUP & EXPORT TAB */}
                    {activeTab === 'backup' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-gray-800">Data Backup & Export</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-blue-50 p-6 rounded-xl">
                                    <FaDatabase className="text-4xl text-blue-600 mb-3" />
                                    <h4 className="font-black text-gray-800 mb-2">Full System Backup</h4>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Export complete database backup including all groups, members, and transactions
                                    </p>
                                    <button
                                        onClick={handleBackup}
                                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        Download Backup
                                    </button>
                                    <p className="text-xs text-gray-500 mt-2">Last backup: Today 3:00 AM</p>
                                </div>

                                <div className="bg-green-50 p-6 rounded-xl">
                                    <FaFileExport className="text-4xl text-green-600 mb-3" />
                                    <h4 className="font-black text-gray-800 mb-2">Export Reports</h4>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Generate Excel/CSV exports for financial reports and member data
                                    </p>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => api.downloadTableExport('members')}
                                            className="w-full bg-white text-green-700 px-4 py-2 rounded-xl font-bold hover:bg-green-100 transition-colors border-2 border-green-200 text-left flex justify-between items-center"
                                        >
                                            Export Members List <FaFileExport className="text-xs" />
                                        </button>
                                        <button
                                            onClick={() => api.downloadTableExport('transactions')}
                                            className="w-full bg-white text-green-700 px-4 py-2 rounded-xl font-bold hover:bg-green-100 transition-colors border-2 border-green-200 text-left flex justify-between items-center"
                                        >
                                            Export Transactions <FaFileExport className="text-xs" />
                                        </button>
                                        <button
                                            onClick={() => api.downloadTableExport('loans')}
                                            className="w-full bg-white text-green-700 px-4 py-2 rounded-xl font-bold hover:bg-green-100 transition-colors border-2 border-green-200 text-left flex justify-between items-center"
                                        >
                                            Export Loans Data <FaFileExport className="text-xs" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showGroupModal && (
                <Modal
                    title={editingGroup ? `Edit Group: ${editingGroup.group_name || editingGroup.name}` : "Register New Group"}
                    onClose={() => {
                        setShowGroupModal(false);
                        setEditingGroup(null);
                    }}
                    onSubmit={handleCreateGroup}
                    maxWidth="max-w-4xl"
                    isProcessing={loading}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-safaricom-green uppercase tracking-wider mb-4 border-b pb-2">Basic Information</h4>
                            <InputField
                                label="Group Name *"
                                value={newGroup.group_name}
                                onChange={(e) => setNewGroup({ ...newGroup, group_name: e.target.value })}
                                placeholder="e.g., Ukombozi Group A"
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <SelectField
                                    label="Meeting Day *"
                                    value={newGroup.meeting_day}
                                    onChange={(e) => setNewGroup({ ...newGroup, meeting_day: e.target.value })}
                                    options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']}
                                />
                                <SelectField
                                    label="Frequency *"
                                    value={newGroup.meeting_frequency}
                                    onChange={(e) => setNewGroup({ ...newGroup, meeting_frequency: e.target.value })}
                                    options={[
                                        { value: 'WEEKLY', label: 'Weekly' },
                                        { value: 'BIWEEKLY', label: 'Bi-Weekly' },
                                        { value: 'MONTHLY', label: 'Monthly' }
                                    ]}
                                />
                            </div>
                            <InputField
                                label="Location (Optional)"
                                value={newGroup.location}
                                onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })}
                                placeholder="e.g., Community Hall, Nairobi"
                            />

                            <h4 className="text-sm font-black text-safaricom-green uppercase tracking-wider mb-4 border-b pb-2 pt-4">Financial Policies</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Min Monthly Saving"
                                    type="number"
                                    value={newGroup.minMonthlySaving}
                                    onChange={(e) => setNewGroup({ ...newGroup, minMonthlySaving: e.target.value })}
                                />
                                <InputField
                                    label="Loan Multiplier"
                                    type="number"
                                    value={newGroup.loanMultiplier}
                                    onChange={(e) => setNewGroup({ ...newGroup, loanMultiplier: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Div Policy (75% = 0.75)"
                                    type="number"
                                    step="0.01"
                                    value={newGroup.dividendPolicy}
                                    onChange={(e) => setNewGroup({ ...newGroup, dividendPolicy: e.target.value })}
                                />
                                <InputField
                                    label="Financial Year"
                                    type="number"
                                    value={newGroup.financial_year}
                                    onChange={(e) => setNewGroup({ ...newGroup, financial_year: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Governance Info */}
                        <div className="space-y-4 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                            <h4 className="text-sm font-black text-safaricom-green uppercase tracking-wider mb-4 border-b pb-2">Group Officials (Governance)</h4>
                            <div className="space-y-4">
                                <div>
                                    <InputField
                                        label="Chairperson Name *"
                                        value={newGroup.chairperson}
                                        onChange={(e) => setNewGroup({ ...newGroup, chairperson: e.target.value })}
                                        placeholder="Full Name"
                                        required
                                    />
                                    <InputField
                                        label="Chair Phone *"
                                        value={newGroup.chairperson_phone}
                                        onChange={(e) => setNewGroup({ ...newGroup, chairperson_phone: e.target.value })}
                                        placeholder="07..."
                                        required
                                    />
                                </div>
                                <div>
                                    <InputField
                                        label="Secretary Name *"
                                        value={newGroup.secretary}
                                        onChange={(e) => setNewGroup({ ...newGroup, secretary: e.target.value })}
                                        placeholder="Full Name"
                                        required
                                    />
                                    <InputField
                                        label="Sec Phone *"
                                        value={newGroup.secretary_phone}
                                        onChange={(e) => setNewGroup({ ...newGroup, secretary_phone: e.target.value })}
                                        placeholder="07..."
                                        required
                                    />
                                </div>
                                <div>
                                    <InputField
                                        label="Treasurer Name *"
                                        value={newGroup.treasurer}
                                        onChange={(e) => setNewGroup({ ...newGroup, treasurer: e.target.value })}
                                        placeholder="Full Name"
                                        required
                                    />
                                    <InputField
                                        label="Treas Phone *"
                                        value={newGroup.treasurer_phone}
                                        onChange={(e) => setNewGroup({ ...newGroup, treasurer_phone: e.target.value })}
                                        placeholder="07..."
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* CREATE OFFICER MODAL */}
            {showOfficerModal && (
                <Modal
                    title="Add New Officer"
                    onClose={() => setShowOfficerModal(false)}
                    onSubmit={handleCreateOfficer}
                    isProcessing={loading}
                >
                    <div className="space-y-4">
                        <InputField
                            label="Full Name *"
                            value={newOfficer.name}
                            onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })}
                            placeholder="John Doe"
                            required
                        />
                        <InputField
                            label="Email *"
                            type="email"
                            value={newOfficer.email}
                            onChange={(e) => setNewOfficer({ ...newOfficer, email: e.target.value })}
                            placeholder="john@example.com"
                            required
                        />
                        <InputField
                            label="Phone Number *"
                            value={newOfficer.phone}
                            onChange={(e) => setNewOfficer({ ...newOfficer, phone: e.target.value })}
                            placeholder="0712345678"
                            required
                        />
                        <SelectField
                            label="Role *"
                            value={newOfficer.role}
                            onChange={(e) => setNewOfficer({ ...newOfficer, role: e.target.value })}
                            options={[
                                { value: 'Field Officer', label: 'Field Officer' },
                                { value: 'Admin', label: 'Administrator' },
                                { value: 'Director', label: 'Director' }
                            ]}
                        />

                        <div className="p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Initial System Password</label>
                                <button
                                    type="button"
                                    onClick={generateRandomPassword}
                                    className="text-[10px] font-black text-safaricom-green hover:underline"
                                >
                                    Generate
                                </button>
                            </div>
                            <input
                                type="text"
                                readOnly
                                value={newOfficer.password || ''}
                                className="w-full bg-white border-none rounded-xl text-center font-mono font-bold text-safaricom-green"
                                placeholder="Click Generate"
                            />
                            <p className="text-[10px] text-gray-400 mt-2 italic text-center">Copy this password before saving.</p>
                        </div>
                    </div>
                </Modal>
            )}

            {/* CREATE LOAN PRODUCT MODAL */}
            {showProductModal && (
                <Modal
                    title={newProduct.id ? "Edit Loan Product" : "Create Loan Product"}
                    onClose={() => setShowProductModal(false)}
                    onSubmit={handleCreateProduct}
                    isProcessing={loading}
                >
                    <div className="space-y-4">
                        <InputField
                            label="Product Name *"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            placeholder="e.g., Development Loan"
                            required
                        />
                        <InputField
                            label="Product Code * (e.g., STL)"
                            value={newProduct.code}
                            onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value.toUpperCase() })}
                            placeholder="STL"
                            required
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                label="Interest Rate (%) *"
                                type="number"
                                value={newProduct.interest_rate}
                                onChange={(e) => setNewProduct({ ...newProduct, interest_rate: e.target.value })}
                                placeholder="10"
                                required
                            />
                            <InputField
                                label="Duration (Months) *"
                                type="number"
                                value={newProduct.duration_months}
                                onChange={(e) => setNewProduct({ ...newProduct, duration_months: e.target.value })}
                                placeholder="12"
                                required
                            />
                        </div>
                        <InputField
                            label="Max Amount (Optional)"
                            type="number"
                            value={newProduct.max_amount}
                            onChange={(e) => setNewProduct({ ...newProduct, max_amount: e.target.value })}
                            placeholder="500000"
                        />
                        <InputField
                            label="Description"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                            placeholder="Development purposes..."
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};

// ========================================
// REUSABLE COMPONENTS
// ========================================

const StatCard = ({ title, value, icon, color, trend }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-red-50 text-red-600',
        purple: 'bg-purple-50 text-purple-600'
    };

    return (
        <div className="bg-white p-6 rounded-xl border-2 border-gray-100 relative overflow-hidden group">
            <div className={`p-3 rounded-lg ${colors[color]} w-fit mb-3 group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase">{title}</div>
            <div className="text-2xl font-black text-gray-800 mt-1">{value}</div>
            {trend && (
                <div className="mt-2 text-[10px] font-black text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                    <FaChartLine /> {trend}
                </div>
            )}
        </div>
    );
};

const ApprovalShortcut = ({ icon, label, desc, path, color }) => {
    const colors = {
        blue: 'text-blue-600 bg-blue-50',
        orange: 'text-orange-600 bg-orange-50',
        emerald: 'text-emerald-600 bg-emerald-50'
    };

    return (
        <a
            href={path}
            className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent hover:border-gray-100 hover:bg-gray-50 transition-all"
        >
            <div className={`p-3 rounded-xl ${colors[color]} group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div className="flex-1">
                <p className="font-black text-gray-800 text-sm group-hover:text-black transition-colors">{label}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{desc}</p>
            </div>
            <div className="text-gray-300 group-hover:text-gray-400 transition-colors">
                <FaGear className="animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </a>
    );
};

const LoanProductCard = ({ product, onEdit, onDelete }) => (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-safaricom-green/30 transition-all">
        <div className="flex justify-between items-start mb-3">
            <h4 className="font-black text-gray-800">{product.name}</h4>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">{product.code}</span>
        </div>
        <div className="space-y-2 text-sm">
            <p><span className="font-bold text-gray-600">Max Amount:</span> KES {product.max_amount?.toLocaleString() || 'Unlimited'}</p>
            <p><span className="font-bold text-gray-600">Rate:</span> {product.interest_rate}%</p>
            <p><span className="font-bold text-gray-600">Term:</span> {product.duration_months} month(s)</p>
        </div>
        <div className="flex gap-2 mt-auto pt-4">
            <button
                onClick={onEdit}
                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold text-xs flex items-center justify-center gap-1"
            >
                <FaPenToSquare /> Edit
            </button>
            <button
                onClick={onDelete}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold text-xs"
            >
                <FaTrash />
            </button>
        </div>
    </div>
);

const SettingsSection = ({ title, children }) => (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-6">
        <h4 className="font-black text-gray-700 mb-4 flex items-center gap-2">
            <FaGear className="text-safaricom-green" />
            {title}
        </h4>
        <div className="space-y-3">{children}</div>
    </div>
);

const SettingRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-600">{label}</span>
        <span className="text-sm text-gray-700">{value}</span>
    </div>
);

const AuditLogRow = ({ time, user, action, details }) => (
    <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-gray-600">{time}</td>
        <td className="px-4 py-3 font-bold text-gray-800">{user}</td>
        <td className="px-4 py-3">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">{action}</span>
        </td>
        <td className="px-4 py-3 text-gray-600">{details}</td>
    </tr>
);

const Modal = ({ title, onClose, onSubmit, children, maxWidth = 'max-w-md', isProcessing = false }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <div className={`bg-white rounded-[2.5rem] shadow-2xl ${maxWidth} w-full p-8 animate-in fade-in zoom-in duration-300 my-8 relative`}>
            {/* Close Button Icon */}
            <button
                onClick={onClose}
                className="absolute right-6 top-6 p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all active:scale-95"
                title="Close Modal"
            >
                <FaXmark size={24} />
            </button>

            <div className="mb-8">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">{title}</h3>
                <div className="w-12 h-1 bg-safaricom-green mt-2 rounded-full"></div>
            </div>

            <form onSubmit={onSubmit}>
                <div className="max-h-[65vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200">
                    {children}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-6 py-4 bg-safaricom-green text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isProcessing}
                    >
                        {isProcessing ? <FaSpinner className="animate-spin" /> : <FaFloppyDisk />}
                        {isProcessing ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    </div>
);

const InputField = ({ label, value, onChange, placeholder, type = 'text', required = false }) => (
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
        />
    </div>
);

const SelectField = ({ label, value, onChange, options, required = false }) => (
    <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>
        <select
            value={value}
            onChange={onChange}
            required={required}
            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
        >
            {Array.isArray(options) && typeof options[0] === 'string'
                ? options.map(opt => <option key={opt} value={opt}>{opt}</option>)
                : options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
            }
        </select>
    </div>
);

export default AdminPanel;
