import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
    FaUserTie,
    FaSearch,
    FaUsers,
    FaShieldAlt,
    FaPhoneAlt,
    FaFilePdf,
    FaFileExcel,
    FaSync,
    FaEye,
    FaChevronDown,
    FaUserFriends,
    FaExclamationCircle,
    FaTrophy,
    FaEnvelope
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Role metadata ────────────────────────────────────────────────────────────
const ROLE_META = {
    Chairperson: {
        label: 'Chairperson',
        abbr: 'CH',
        icon: FaTrophy,
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        avatar: 'bg-amber-100 text-amber-800',
        accent: 'border-l-amber-400',
        dot: 'bg-amber-400'
    },
    Secretary: {
        label: 'Secretary',
        abbr: 'SE',
        icon: FaUserTie,
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        avatar: 'bg-blue-100 text-blue-800',
        accent: 'border-l-blue-400',
        dot: 'bg-blue-400'
    },
    Treasurer: {
        label: 'Treasurer',
        abbr: 'TR',
        icon: FaShieldAlt,
        badge: 'bg-green-50 text-green-700 border-green-200',
        avatar: 'bg-green-100 text-green-800',
        accent: 'border-l-green-400',
        dot: 'bg-green-400'
    },
    Admin: {
        label: 'System Admin',
        abbr: 'AD',
        icon: FaShieldAlt,
        badge: 'bg-red-50 text-red-700 border-red-200',
        avatar: 'bg-red-100 text-red-800',
        accent: 'border-l-red-400',
        dot: 'bg-red-400'
    },
    Director: {
        label: 'Director',
        abbr: 'DR',
        icon: FaUserTie,
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        avatar: 'bg-purple-100 text-purple-800',
        accent: 'border-l-purple-400',
        dot: 'bg-purple-400'
    },
    Field_Officer: {
        label: 'Field Officer',
        abbr: 'FO',
        icon: FaUserTie,
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        avatar: 'bg-indigo-100 text-indigo-800',
        accent: 'border-l-indigo-400',
        dot: 'bg-indigo-400'
    }
};

const getRoleMeta = (role) => {
    const key = Object.keys(ROLE_META).find(k => k.toLowerCase() === (role || '').toLowerCase());
    return ROLE_META[key] || {
        label: role || 'Member',
        abbr: (role || 'M').charAt(0).toUpperCase(),
        icon: FaUserFriends,
        badge: 'bg-gray-50 text-gray-600 border-gray-200',
        avatar: 'bg-gray-100 text-gray-700',
        accent: 'border-l-gray-300',
        dot: 'bg-gray-400'
    };
};

// ─── Component ────────────────────────────────────────────────────────────────
const OfficialsDirectory = () => {
    const navigate = useNavigate();

    const [officials, setOfficials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRole, setActiveRole] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');
    const [expandedCard, setExpandedCard] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const [officialsData, officersData] = await Promise.all([
                api.getOfficials(),
                api.getOfficers()
            ]);

            const normalizedOfficials = (Array.isArray(officialsData) ? officialsData : []).map(o => ({
                ...o,
                category: 'Group'
            }));

            const normalizedStaff = (Array.isArray(officersData) ? officersData : []).map(o => ({
                ...o,
                member_name: o.name,
                member_phone: o.phone,
                role: o.role === 'Admin' ? 'Admin' : (o.role === 'Director' ? 'Director' : 'Field_Officer'),
                group_name: 'SYSTEM STAFF',
                category: 'Staff',
                isStaff: true
            }));

            setOfficials([...normalizedStaff, ...normalizedOfficials]);
        } catch (err) {
            console.error('OfficialsDirectory error:', err);
            setFetchError(err.message || 'Failed to load official records.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived lists ─────────────────────────────────────────────────────────
    const uniqueGroups = useMemo(() => {
        const groups = [...new Set(officials.map(o => o.group_name).filter(Boolean))];
        return groups.sort();
    }, [officials]);

    const filteredOfficials = useMemo(() => {
        return officials.filter(o => {
            const search = searchTerm.toLowerCase();
            const matchesSearch = !search || (
                (o.member_name || '').toLowerCase().includes(search) ||
                (o.group_name || '').toLowerCase().includes(search) ||
                (o.role || '').toLowerCase().includes(search) ||
                (o.member_phone || '').includes(search)
            );
            const matchesRole = activeRole === 'All' ||
                (o.role || '').toLowerCase() === activeRole.toLowerCase();
            const matchesGroup = groupFilter === 'All' ||
                o.group_name === groupFilter;

            return matchesSearch && matchesRole && matchesGroup;
        });
    }, [officials, searchTerm, activeRole, groupFilter]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const roles = Object.keys(ROLE_META);
        return {
            total: officials.length,
            byRole: roles.reduce((acc, r) => {
                acc[r] = officials.filter(o => (o.role || '').toLowerCase() === r.toLowerCase()).length;
                return acc;
            }, {}),
            groups: uniqueGroups.length
        };
    }, [officials, uniqueGroups]);

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExportExcel = () => {
        toast.info('Exporting Officials Directory to Excel...');
        // Build CSV as fallback (Excel functionality in api.js can be extended)
        const rows = [
            ['Name', 'Phone', 'Role', 'Group', 'Term Start', 'Term End', 'Status'],
            ...filteredOfficials.map(o => [
                o.member_name || '',
                o.member_phone || '',
                o.role || '',
                o.group_name || '',
                o.term_start || '',
                o.term_end || '',
                o.status || 'Active'
            ])
        ];
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ukombozini_officials_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Officials directory exported!');
    };

    const handleExportPDF = () => {
        toast.info('Opening print view for PDF export...');
        window.print();
    };

    const handleViewProfile = (official) => {
        if (!official.member_id) {
            toast.warn(`${official.member_name}'s profile link is not available.`);
            return;
        }
        navigate(`/members/${official.member_id}/ledger`);
    };

    const handleSendSMS = (official) => {
        if (!official.member_phone) {
            toast.warn('No phone number found for this official.');
            return;
        }
        toast.info(`Opening message composer for ${official.member_name}...`);
        navigate('/communication', { state: { prefillPhone: official.member_phone, prefillName: official.member_name } });
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 border-4 border-safaricom-green/20 border-t-safaricom-green rounded-full animate-spin" />
                <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Officials Directory...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                    <FaExclamationCircle className="text-red-400" size={32} />
                </div>
                <div className="text-center">
                    <p className="font-black text-red-700 text-lg">Failed to Load Officials</p>
                    <p className="text-red-400 text-sm mt-1">{fetchError}</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-6 py-2.5 bg-safaricom-green text-white rounded-xl font-black hover:bg-safaricom-dark transition-colors"
                >
                    <FaSync size={13} /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">

            {/* ── HEADER ───────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <div className="p-2 bg-safaricom-green/10 rounded-xl">
                            <FaUserTie className="text-safaricom-green" size={22} />
                        </div>
                        Group Officials Directory
                    </h2>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold ml-14">
                        Chairpersons · Secretaries · Treasurers · Cross-Group Leadership
                    </p>
                </div>

                <div className="flex gap-2 flex-wrap print:hidden">
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm"
                    >
                        <FaSync size={13} /> Refresh
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-xl hover:bg-green-800 transition-colors shadow-sm font-bold text-sm"
                    >
                        <FaFileExcel size={13} /> Export CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-safaricom-green text-white rounded-xl hover:bg-safaricom-dark transition-colors shadow-sm font-bold text-sm"
                    >
                        <FaFilePdf size={13} /> Print PDF
                    </button>
                </div>
            </div>

            {/* ── STATS BANNER ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                    className={`bg-white border-2 rounded-2xl p-4 cursor-pointer transition-all ${activeRole === 'All' ? 'border-safaricom-green shadow-md shadow-green-100' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => setActiveRole('All')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-safaricom-green/10 rounded-xl">
                            <FaUsers className="text-safaricom-green" size={18} />
                        </div>
                        <div>
                            <p className="text-xs font-black text-gray-500 uppercase tracking-wider">All Officials</p>
                            <p className="text-2xl font-black text-gray-800">{stats.total}</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">{stats.groups} groups covered</p>
                </div>

                {Object.entries(ROLE_META).map(([role, meta]) => {
                    const Icon = meta.icon;
                    const count = stats.byRole[role] || 0;
                    return (
                        <div
                            key={role}
                            className={`bg-white border-2 rounded-2xl p-4 cursor-pointer transition-all ${activeRole === role ? 'border-safaricom-green shadow-md shadow-green-100' : 'border-gray-100 hover:border-gray-200'}`}
                            onClick={() => setActiveRole(activeRole === role ? 'All' : role)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 ${meta.badge.replace('text-', 'text-').replace('bg-', 'bg-').replace('border-', '')} rounded-xl`}>
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">{role}s</p>
                                    <p className="text-2xl font-black text-gray-800">{count}</p>
                                </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${meta.dot}`}
                                    style={{ width: stats.total ? `${(count / stats.total) * 100}%` : '0%' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── FILTERS ──────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="relative md:col-span-2">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                        <input
                            type="text"
                            placeholder="Search by name, phone, role or group..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/30 text-sm"
                        />
                    </div>

                    {/* Group filter */}
                    <div className="relative">
                        <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={11} />
                        <select
                            value={groupFilter}
                            onChange={e => setGroupFilter(e.target.value)}
                            className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/30 text-sm font-bold pr-8"
                        >
                            <option value="All">All Groups</option>
                            {uniqueGroups.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Role quick filters */}
                <div className="flex flex-wrap gap-2 mt-3">
                    {['All', 'Chairperson', 'Secretary', 'Treasurer'].map(role => {
                        const meta = ROLE_META[role];
                        return (
                            <button
                                key={role}
                                onClick={() => setActiveRole(role)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${activeRole === role
                                    ? 'bg-safaricom-green text-white border-safaricom-green shadow-sm'
                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-safaricom-green/50'
                                    }`}
                            >
                                {role === 'All' ? `All (${officials.length})` : `${role}s (${stats.byRole[role] || 0})`}
                            </button>
                        );
                    })}

                    {(searchTerm || activeRole !== 'All' || groupFilter !== 'All') && (
                        <button
                            onClick={() => { setSearchTerm(''); setActiveRole('All'); setGroupFilter('All'); }}
                            className="ml-auto px-3 py-1.5 text-xs font-black text-red-500 hover:text-red-700 uppercase tracking-wider"
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-bold">
                        Showing <span className="text-safaricom-green font-black">{filteredOfficials.length}</span> of <span className="font-black">{officials.length}</span> officials
                    </p>
                </div>
            </div>

            {/* ── OFFICIALS GRID ───────────────────────────────────────────── */}
            {filteredOfficials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                        <FaUserFriends className="text-gray-200" size={32} />
                    </div>
                    <p className="text-gray-500 font-black text-lg">No Officials Found</p>
                    <p className="text-gray-400 text-sm mt-1">
                        {searchTerm || activeRole !== 'All' || groupFilter !== 'All'
                            ? 'Try adjusting your search or filters'
                            : 'The officials directory is empty. Assign group officials from the Group Management section.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOfficials.map((official, idx) => {
                        const meta = getRoleMeta(official.role);
                        const Icon = meta.icon;
                        const isExpanded = expandedCard === (official.id || idx);

                        return (
                            <div
                                key={official.id || idx}
                                className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden border-l-4 ${meta.accent} hover:shadow-md transition-all`}
                            >
                                {/* Card Top */}
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className={`relative w-14 h-14 rounded-2xl ${meta.avatar} flex items-center justify-center text-xl font-black flex-shrink-0 border-2 ${meta.badge.split(' ')[2] || 'border-gray-200'}`}>
                                            {(official.member_name || '?').charAt(0)}
                                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${meta.dot}`} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-gray-900 text-base leading-tight truncate">
                                                {official.member_name || 'Unknown'}
                                            </h4>
                                            <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${meta.badge}`}>
                                                <Icon size={9} />
                                                {meta.label}
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1.5 font-semibold truncate flex items-center gap-1.5">
                                                <FaUsers size={10} className="text-gray-400" />
                                                {official.group_name || 'Unknown Group'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Contact row */}
                                    <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <FaPhoneAlt className="text-gray-400 flex-shrink-0" size={12} />
                                        <span className="text-sm font-black text-gray-700 font-mono">
                                            {official.member_phone || 'N/A'}
                                        </span>
                                    </div>

                                    {/* Term info – expandable */}
                                    {(official.term_start || official.term_end) && (
                                        <button
                                            onClick={() => setExpandedCard(isExpanded ? null : (official.id || idx))}
                                            className="mt-2 w-full text-left text-[10px] text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest flex items-center gap-1"
                                        >
                                            <FaChevronDown className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={9} />
                                            Term Details
                                        </button>
                                    )}

                                    {isExpanded && (
                                        <div className="mt-2 p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                                            {official.term_start && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 font-bold uppercase text-[10px]">Term Start</span>
                                                    <span className="font-black text-gray-700">
                                                        {new Date(official.term_start).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            )}
                                            {official.term_end && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 font-bold uppercase text-[10px]">Term End</span>
                                                    <span className="font-black text-gray-700">
                                                        {new Date(official.term_end).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-gray-400 font-bold uppercase text-[10px]">Status</span>
                                                <span className={`font-black text-[10px] px-2 py-0.5 rounded-full uppercase ${official.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {official.status || 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Card Actions */}
                                <div className="border-t border-gray-100 px-5 py-3 flex gap-2 print:hidden">
                                    <button
                                        onClick={() => handleViewProfile(official)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black text-safaricom-green hover:bg-green-50 rounded-xl transition-colors border border-green-100 hover:border-green-200"
                                        title="View Member Ledger"
                                    >
                                        <FaEye size={12} />
                                        View Ledger
                                    </button>
                                    <button
                                        onClick={() => handleSendSMS(official)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-100 hover:border-blue-200"
                                        title="Open Message Composer"
                                    >
                                        <FaEnvelope size={12} />
                                        Message
                                    </button>
                                    <a
                                        href={`tel:${official.member_phone}`}
                                        className="px-3 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100 hover:border-gray-200"
                                        title={`Call ${official.member_name}`}
                                    >
                                        <FaPhoneAlt size={12} />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── PRINT TABLE ──────────────────────────────────────────────── */}
            <div className="hidden print:block mt-6">
                <h3 className="text-xl font-black text-gray-800 mb-4">UKOMBOZINI TABLE BANKING — OFFICIALS DIRECTORY</h3>
                <p className="text-sm text-gray-500 mb-6">As of {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b-2 border-gray-800">
                            <th className="text-left py-2 px-3 font-black">Name</th>
                            <th className="text-left py-2 px-3 font-black">Phone</th>
                            <th className="text-left py-2 px-3 font-black">Role</th>
                            <th className="text-left py-2 px-3 font-black">Group</th>
                            <th className="text-left py-2 px-3 font-black">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOfficials.map((o, i) => (
                            <tr key={i} className="border-b border-gray-200">
                                <td className="py-2 px-3 font-semibold">{o.member_name}</td>
                                <td className="py-2 px-3 font-mono">{o.member_phone || 'N/A'}</td>
                                <td className="py-2 px-3">{o.role}</td>
                                <td className="py-2 px-3">{o.group_name}</td>
                                <td className="py-2 px-3 capitalize">{o.status || 'Active'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OfficialsDirectory;
