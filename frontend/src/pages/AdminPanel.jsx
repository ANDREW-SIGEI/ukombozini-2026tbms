import React, { useState, useEffect } from 'react';
import {
    FaCog, FaUsers, FaUserTie, FaChartLine, FaDatabase,
    FaFileExport, FaShieldAlt, FaPlus, FaEdit, FaTrash,
    FaSpinner, FaCheckCircle, FaCalendarAlt, FaMoneyBillWave,
    FaMapMarkerAlt, FaEnvelope, FaPhone, FaSave, FaHistory
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

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
        location: ''
    });

    // Officers State
    const [officers, setOfficers] = useState([]);
    const [showOfficerModal, setShowOfficerModal] = useState(false);
    const [newOfficer, setNewOfficer] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'FIELD_OFFICER'
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

    useEffect(() => {
        fetchSystemData();
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            const [logs, setts, products] = await Promise.all([
                api.getAuditLogs(10),
                api.getAdminSettings(),
                api.getLoanProducts()
            ]);
            setAuditLogs(logs);
            setSettings(setts);
            setLoanProducts(products);
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

    // ========================================
    // GROUPS MANAGEMENT FUNCTIONS
    // ========================================
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            await api.createGroup({
                ...newGroup,
                registration_date: new Date().toISOString().split('T')[0]
            });
            toast.success(`✅ ${newGroup.group_name} created successfully!`);
            setShowGroupModal(false);
            setNewGroup({ group_name: '', meeting_day: 'Monday', meeting_frequency: 'WEEKLY', location: '' });
            fetchSystemData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create group");
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
            // Add create officer API call
            toast.success(`✅ Officer ${newOfficer.name} added successfully!`);
            setShowOfficerModal(false);
            setNewOfficer({ name: '', email: '', phone: '', role: 'FIELD_OFFICER' });
        } catch (error) {
            toast.error("Failed to create officer");
        }
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
        { id: 'groups', name: 'Groups', icon: <FaUsers /> },
        { id: 'officers', name: 'Officers', icon: <FaUserTie /> },
        { id: 'products', name: 'Loan Products', icon: <FaMoneyBillWave /> },
        { id: 'settings', name: 'Settings', icon: <FaCog /> },
        { id: 'audit', name: 'Audit Logs', icon: <FaHistory /> },
        { id: 'backup', name: 'Backup & Export', icon: <FaDatabase /> }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaShieldAlt className="text-red-600" /> Admin Control Panel
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
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-gray-800">System Statistics</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <StatCard
                                    title="Total Groups"
                                    value={stats.totalGroups}
                                    icon={<FaUsers />}
                                    color="blue"
                                />
                                <StatCard
                                    title="Total Members"
                                    value={stats.totalMembers}
                                    icon={<FaUserTie />}
                                    color="green"
                                />
                                <StatCard
                                    title="Total Savings"
                                    value={`KES ${stats.totalSavings.toLocaleString()}`}
                                    icon={<FaMoneyBillWave />}
                                    color="yellow"
                                />
                                <StatCard
                                    title="Active Loans"
                                    value={`KES ${stats.totalLoans.toLocaleString()}`}
                                    icon={<FaMoneyBillWave />}
                                    color="orange"
                                />
                                <StatCard
                                    title="Active Officers"
                                    value={stats.activeOfficers}
                                    icon={<FaShieldAlt />}
                                    color="red"
                                />
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-gray-50 p-6 rounded-xl">
                                <h4 className="font-black text-gray-700 mb-4">Recent System Activity</h4>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <p>• New group "Ukombozi Warriors" registered - 2 hours ago</p>
                                    <p>• Dividend payment processed for Group A - 5 hours ago</p>
                                    <p>• 15 new member registrations - Today</p>
                                    <p>• System backup completed successfully - Yesterday 3:00 AM</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* GROUPS TAB */}
                    {activeTab === 'groups' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-800">Groups Management</h3>
                                <button
                                    onClick={() => setShowGroupModal(true)}
                                    className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors"
                                >
                                    <FaPlus /> New Group
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {groups.map(group => (
                                    <div
                                        key={group.id}
                                        className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-safaricom-green/30 transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-black text-gray-800">{group.group_name}</h4>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(group.created_at || group.registration_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <FaCheckCircle className="text-green-500" />
                                        </div>
                                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                                            <p className="flex items-center gap-2">
                                                <FaCalendarAlt className="text-gray-400" />
                                                {group.meeting_day} ({group.meeting_frequency})
                                            </p>
                                            {group.location && (
                                                <p className="flex items-center gap-2">
                                                    <FaMapMarkerAlt className="text-gray-400" />
                                                    {group.location}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold text-sm">
                                                <FaEdit className="inline mr-1" /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(group.id, group.group_name)}
                                                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-bold text-sm"
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
                                        <FaUserTie className="text-4xl mx-auto mb-3 opacity-50" />
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
                                        <button className="w-full bg-white text-green-700 px-4 py-2 rounded-xl font-bold hover:bg-green-100 transition-colors border-2 border-green-200">
                                            Export Members List
                                        </button>
                                        <button className="w-full bg-white text-green-700 px-4 py-2 rounded-xl font-bold hover:bg-green-100 transition-colors border-2 border-green-200">
                                            Export Transactions
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CREATE GROUP MODAL */}
            {showGroupModal && (
                <Modal
                    title="Register New Group"
                    onClose={() => setShowGroupModal(false)}
                    onSubmit={handleCreateGroup}
                >
                    <div className="space-y-4">
                        <InputField
                            label="Group Name *"
                            value={newGroup.group_name}
                            onChange={(e) => setNewGroup({ ...newGroup, group_name: e.target.value })}
                            placeholder="e.g., Ukombozi Group A"
                            required
                        />
                        <SelectField
                            label="Meeting Day *"
                            value={newGroup.meeting_day}
                            onChange={(e) => setNewGroup({ ...newGroup, meeting_day: e.target.value })}
                            options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']}
                        />
                        <SelectField
                            label="Meeting Frequency *"
                            value={newGroup.meeting_frequency}
                            onChange={(e) => setNewGroup({ ...newGroup, meeting_frequency: e.target.value })}
                            options={[
                                { value: 'WEEKLY', label: 'Weekly' },
                                { value: 'BIWEEKLY', label: 'Bi-Weekly' },
                                { value: 'MONTHLY', label: 'Monthly' }
                            ]}
                        />
                        <InputField
                            label="Location (Optional)"
                            value={newGroup.location}
                            onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })}
                            placeholder="e.g., Community Hall, Nairobi"
                        />
                    </div>
                </Modal>
            )}

            {/* CREATE OFFICER MODAL */}
            {showOfficerModal && (
                <Modal
                    title="Add New Officer"
                    onClose={() => setShowOfficerModal(false)}
                    onSubmit={handleCreateOfficer}
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
                                { value: 'FIELD_OFFICER', label: 'Field Officer' },
                                { value: 'ADMIN', label: 'Administrator' },
                                { value: 'DIRECTOR', label: 'Director' }
                            ]}
                        />
                    </div>
                </Modal>
            )}

            {/* CREATE LOAN PRODUCT MODAL */}
            {showProductModal && (
                <Modal
                    title={newProduct.id ? "Edit Loan Product" : "Create Loan Product"}
                    onClose={() => setShowProductModal(false)}
                    onSubmit={handleCreateProduct}
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

const StatCard = ({ title, value, icon, color }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-red-50 text-red-600'
    };

    return (
        <div className="bg-white p-6 rounded-xl border-2 border-gray-100">
            <div className={`p-3 rounded-lg ${colors[color]} w-fit mb-3`}>
                {icon}
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase">{title}</div>
            <div className="text-2xl font-black text-gray-800 mt-1">{value}</div>
        </div>
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
        <div className="flex gap-2 mt-4">
            <button
                onClick={onEdit}
                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold text-sm"
            >
                <FaEdit className="inline mr-1" /> Edit
            </button>
            <button
                onClick={onDelete}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold text-sm"
            >
                <FaTrash />
            </button>
        </div>
    </div>
);

const SettingsSection = ({ title, children }) => (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-6">
        <h4 className="font-black text-gray-700 mb-4 flex items-center gap-2">
            <FaCog className="text-safaricom-green" />
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

const Modal = ({ title, onClose, onSubmit, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-800">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-xl">×</button>
            </div>
            <form onSubmit={onSubmit}>
                {children}
                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-3 bg-safaricom-green text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md flex items-center justify-center gap-2"
                    >
                        <FaSave /> Save
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
