import React, { useState, useEffect } from 'react';
import {
    FaUserShield, FaEnvelope, FaPhone, FaPenToSquare, FaPlus, FaCircleCheck,
    FaXmark, FaObjectGroup, FaTrash, FaMagnifyingGlass
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AllocationModal = ({ isOpen, onClose, officer, groups, onSave }) => {
    const [selectedGroups, setSelectedGroups] = useState([]);

    useEffect(() => {
        if (officer && officer.assignedGroups) {
            setSelectedGroups(officer.assignedGroups.map(g => parseInt(g.id)));
        } else {
            setSelectedGroups([]);
        }
    }, [officer, isOpen]);

    if (!isOpen || !officer) return null;

    const toggleGroup = (groupId) => {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="bg-gradient-to-r from-safaricom-green to-green-600 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black">Allocate Groups</h3>
                        <p className="text-xs opacity-80 font-bold uppercase tracking-wider">Officer: {officer.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <FaXmark size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-sm font-bold text-gray-500 mb-4">Select groups to assign to this officer:</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                        {groups.map(group => (
                            <div
                                key={group.id}
                                onClick={() => toggleGroup(group.id)}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedGroups.includes(group.id)
                                    ? 'border-safaricom-green bg-green-50 shadow-sm'
                                    : 'border-gray-50 hover:border-gray-100 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${selectedGroups.includes(group.id) ? 'bg-safaricom-green text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <FaObjectGroup />
                                    </div>
                                    <div className="text-sm font-black text-gray-800">{group.name}</div>
                                </div>
                                {selectedGroups.includes(group.id) && (
                                    <FaCircleCheck className="text-safaricom-green" />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 text-sm font-black text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(officer.id, selectedGroups)}
                            className="flex-1 py-3 bg-safaricom-green text-white rounded-2xl font-black text-sm shadow-lg shadow-green-100 hover:bg-green-600 active:scale-95 transition-all"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OfficerForm = ({ isOpen, onClose, onSave, editingOfficer }) => {
    const [formData, setFormData] = useState({
        name: '',
        role: 'Field Officer',
        phone: '',
        email: '',
        status: 'active',
        password: ''
    });

    const generateRandomPassword = () => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let retVal = "";
        for (let i = 0, n = charset.length; i < 8; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        setFormData(prev => ({ ...prev, password: retVal }));
    };

    useEffect(() => {
        if (editingOfficer) {
            setFormData({
                ...editingOfficer,
                name: editingOfficer.full_name || editingOfficer.name || '',
                password: ''
            });
        } else {
            setFormData({
                name: '',
                role: 'Field Officer',
                phone: '',
                email: '',
                status: 'active',
                password: ''
            });
        }
    }, [editingOfficer, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight">
                            {editingOfficer ? 'Edit Staff Profile' : 'Register New Staff'}
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <FaXmark size={20} className="text-gray-400" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest leading-none">Full Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-safaricom-green/20 font-medium"
                                    placeholder="Enter name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest leading-none">Role Category</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-safaricom-green/20 font-medium"
                                >
                                    <option value="Field Officer">Field Officer</option>
                                    <option value="Admin">Administrator</option>
                                    <option value="Director">Director</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest leading-none">Phone Number</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-safaricom-green/20 font-medium"
                                    placeholder="+254..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest leading-none">Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-safaricom-green/20 font-medium"
                                    placeholder="name@tbms.com"
                                />
                            </div>
                        </div>

                        {!editingOfficer && (
                            <div className="p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Initial System Password</label>
                                    <button
                                        onClick={generateRandomPassword}
                                        className="text-[10px] font-black text-safaricom-green hover:underline"
                                    >
                                        Generate
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    readOnly
                                    value={formData.password}
                                    className="w-full bg-white border-none rounded-xl text-center font-mono font-bold text-safaricom-green"
                                    placeholder="Automatically Generated"
                                />
                                <p className="text-[10px] text-gray-400 mt-2 italic text-center">Give this password to the officer after saving.</p>
                            </div>
                        )}

                        {editingOfficer && (
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest leading-none">Account Status</label>
                                <div className="flex gap-4">
                                    {['active', 'inactive'].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setFormData({ ...formData, status })}
                                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${formData.status === status
                                                ? 'bg-black text-white shadow-lg'
                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-sm font-black text-gray-400 hover:bg-gray-50 rounded-2xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(formData)}
                            className="flex-1 py-3 bg-black text-white rounded-2xl font-black text-sm shadow-xl shadow-gray-200 hover:bg-gray-900 active:scale-95 transition-all"
                        >
                            {editingOfficer ? 'Update Profile' : 'Activate Staff Account'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Officers = () => {
    const { isAuditor } = useAuth();
    const [officers, setOfficers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAllocationOpen, setIsAllocationOpen] = useState(false);
    const [selectedOfficer, setSelectedOfficer] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [officersData, groupsData] = await Promise.all([
                api.getOfficers(),
                api.getGroups()
            ]);
            setOfficers(officersData || []);
            setGroups(groupsData || []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load staff data");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOfficer = async (officerData) => {
        try {
            await api.saveOfficer(officerData);
            toast.success(officerData.id ? "Staff profile updated!" : "Staff member registered!");
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            console.error("Save Officer Error:", error);
            const msg = error.response?.data?.error || error.message || "Process failed";
            toast.error(msg);
        }
    };

    const handleAllocateGroups = async (officerId, groupIds) => {
        try {
            await api.allocateGroupsToOfficer(officerId, groupIds);
            toast.success("Groups allocated successfully!");
            setIsAllocationOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Allocation failed");
        }
    };

    const handleDeleteOfficer = async (id) => {
        if (!window.confirm("Are you sure you want to remove this staff member?")) return;
        try {
            await api.deleteOfficer(id);
            toast.success("Staff member removed");
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Deletion failed");
        }
    };

    const handleResetPassword = async (officer) => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let newPassword = "";
        for (let i = 0, n = charset.length; i < 8; ++i) {
            newPassword += charset.charAt(Math.floor(Math.random() * n));
        }

        if (!window.confirm(`Reset password for ${officer.name || officer.full_name}? A new one will be generated.`)) return;

        try {
            await api.resetOfficerPassword(officer.id, newPassword);
            alert(`PASSWORD RESET SUCCESSFUL!\n\nNew Password for ${officer.name || officer.full_name}:\n${newPassword}\n\nPlease share this securely with them.`);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Reset failed");
        }
    };

    const filteredOfficers = officers.filter(o => {
        const nameMatch = (o.full_name || o.name || "").toLowerCase().includes(searchTerm.toLowerCase());
        const roleMatch = (o.role || "").toLowerCase().includes(searchTerm.toLowerCase());
        return nameMatch || roleMatch;
    });

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="relative p-8 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-safaricom-green/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 tracking-tight">System Staff & Field Officers</h2>
                        <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest italic">
                            Manage access control and field operations
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or role..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-safaricom-green/20 text-sm font-bold"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (isAuditor) {
                                    toast.warning("🛡️ Auditor Mode: Staff registry is locked.");
                                    return;
                                }
                                setSelectedOfficer(null);
                                setIsFormOpen(true);
                            }}
                            className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${isAuditor ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-safaricom-green text-white shadow-green-100 hover:bg-green-600'}`}
                            title="Register New Staff"
                        >
                            <FaPlus />
                        </button>
                    </div>
                </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-gray-100 rounded-[2.5rem] animate-pulse"></div>
                    ))
                ) : filteredOfficers.length > 0 ? filteredOfficers.map((officer) => (
                    <div key={officer.id} className="group relative bg-white rounded-[2.5rem] p-6 shadow-xl shadow-gray-100/50 border border-transparent hover:border-gray-100 hover:shadow-2xl transition-all duration-500 overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl group-hover:bg-safaricom-green/5 transition-colors duration-500"></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-safaricom-green group-hover:scale-110 transition-transform duration-500 shadow-inner border border-gray-50">
                                            <FaUserShield size={32} />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ${officer.status === 'active' ? 'bg-safaricom-green' : 'bg-gray-300'}`}></div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-800 leading-tight">
                                            {officer.full_name || officer.name}
                                        </h3>
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none block mt-1">
                                            {officer.role}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!isAuditor && (
                                        <>
                                            <button
                                                onClick={() => handleResetPassword(officer)}
                                                className="p-2 hover:bg-gray-50 text-gray-400 hover:text-green-600 rounded-xl transition-all"
                                                title="Reset Password"
                                            >
                                                <FaPlus size={14} className="rotate-45" />
                                            </button>
                                            <button
                                                onClick={() => { setSelectedOfficer(officer); setIsFormOpen(true); }}
                                                className="p-2 hover:bg-gray-50 text-gray-400 hover:text-blue-500 rounded-xl transition-all"
                                            >
                                                <FaPenToSquare size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOfficer(officer.id)}
                                                className="p-2 hover:bg-gray-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"
                                            >
                                                <FaTrash size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-gray-400 shadow-sm">
                                        <FaPhone size={12} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-600">{officer.phone}</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-gray-400 shadow-sm">
                                        <FaEnvelope size={12} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-600 truncate">{officer.email}</span>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Active Portfolios</span>
                                    <button
                                        onClick={() => {
                                            if (isAuditor) {
                                                toast.warning("🛡️ Auditor Mode: Portfolio management is locked.");
                                                return;
                                            }
                                            setSelectedOfficer(officer);
                                            setIsAllocationOpen(true);
                                        }}
                                        className={`text-[10px] font-black uppercase tracking-widest hover:underline ${isAuditor ? 'text-gray-400 cursor-not-allowed' : 'text-safaricom-green cursor-pointer'}`}
                                    >
                                        + Manage Groups
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {officer.assignedGroups && officer.assignedGroups.length > 0 ? (
                                        officer.assignedGroups.map(g => (
                                            <span key={g.id} className="px-3 py-1 bg-green-50 text-safaricom-green text-[9px] font-black uppercase rounded-lg border border-green-100">
                                                {g.name}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] font-bold text-gray-300 italic">No portfolios assigned</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-20 text-center">
                        <FaUserShield size={64} className="mx-auto text-gray-100 mb-4" />
                        <h3 className="text-xl font-black text-gray-400">Registry Empty</h3>
                        <p className="text-sm text-gray-400 italic">No staff members found in the current registry.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AllocationModal
                isOpen={isAllocationOpen}
                onClose={() => setIsAllocationOpen(false)}
                officer={selectedOfficer}
                groups={groups}
                onSave={handleAllocateGroups}
            />

            <OfficerForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveOfficer}
                editingOfficer={selectedOfficer}
            />
        </div>
    );
};

export default Officers;
