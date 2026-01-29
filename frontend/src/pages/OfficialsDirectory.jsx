import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import {
    FaUserShield, FaPhone, FaMagnifyingGlass, FaPlus,
    FaFileExport, FaFilePdf, FaFileExcel, FaRightToBracket
} from 'react-icons/fa6';
import PdfService from '../services/pdfService';
import ExcelService from '../services/excelService';

const OfficialsDirectory = () => {
    const [officials, setOfficials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await api.getOfficials();
            setOfficials(data || []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load directory");
        } finally {
            setLoading(false);
        }
    };

    const getRoleCount = (role) => officials.filter(o => o.role === role && o.status === 'active').length || 0;

    const filteredOfficials = officials.filter(o => {
        const matchesRole = selectedRole ? o.role === selectedRole : true;
        const nameMatch = (o.member_name || "").toLowerCase().includes(searchTerm.toLowerCase());
        const groupMatch = (o.group_name || "").toLowerCase().includes(searchTerm.toLowerCase());
        const phoneMatch = (o.member_phone || "").includes(searchTerm);
        return matchesRole && (nameMatch || groupMatch || phoneMatch);
    });

    const handleExportPDF = () => {
        const title = selectedRole ? `${selectedRole}s Directory` : 'All Officials Directory';
        PdfService.generateContactList(title, filteredOfficials.map(o => ({
            name: o.member_name,
            phone: o.member_phone,
            groupName: o.group_name,
            role: o.role
        })));
        toast.success("PDF Generated");
    };

    const handleExportExcel = () => {
        const title = selectedRole ? `${selectedRole}s` : 'All_Officials';
        const columns = [
            { header: 'Official Name', key: 'member_name' },
            { header: 'Role', key: 'role' },
            { header: 'Group', key: 'group_name' },
            { header: 'Phone', key: 'member_phone' },
            { header: 'Term Start', key: 'term_start' },
            { header: 'Status', key: 'status' }
        ];
        ExcelService.exportToExcel(filteredOfficials, columns, `${title} Directory`, `${title}_Directory`, { Role: selectedRole || 'All' });
        toast.success("Excel Exported");
    };

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            {/* 1. Header & Quick Stats */}
            <div className="relative p-8 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-safaricom-green/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                            <FaUserShield className="text-safaricom-green" /> OFFICIALS DIRECTORY
                        </h2>
                        <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest italic">
                            Consolidated Institutional Governance & Leadership
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, group, or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-safaricom-green/20 text-sm font-bold"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Role Filter Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <button
                    onClick={() => setSelectedRole(null)}
                    className={`p-6 rounded-[2rem] border-2 text-left transition-all hover:scale-105 active:scale-95 shadow-xl ${!selectedRole
                        ? 'bg-gray-900 text-white border-gray-900 shadow-gray-200'
                        : 'bg-white text-gray-800 border-white shadow-gray-100 hover:border-gray-100'
                        }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-2xl ${!selectedRole ? 'bg-white/20' : 'bg-gray-100'}`}>
                            <FaUserShield className="text-2xl" />
                        </div>
                        <span className={`text-3xl font-black ${!selectedRole ? 'text-white' : 'text-gray-200'}`}>
                            {officials.length}
                        </span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight">All Roles</h3>
                    <p className={`text-xs font-bold mt-1 ${!selectedRole ? 'text-gray-400' : 'text-gray-400'}`}>Full Registry</p>
                </button>

                {['Chairman', 'Secretary', 'Treasurer'].map(role => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role === selectedRole ? null : role)}
                        className={`p-6 rounded-[2rem] border-2 text-left transition-all hover:scale-105 active:scale-95 shadow-xl ${selectedRole === role
                            ? 'bg-safaricom-green text-white border-safaricom-green shadow-green-200'
                            : 'bg-white text-gray-800 border-white shadow-gray-100 hover:border-gray-100'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-2xl ${selectedRole === role ? 'bg-white/20' : 'bg-gray-100'}`}>
                                <FaUserShield className="text-2xl" />
                            </div>
                            <span className={`text-3xl font-black ${selectedRole === role ? 'text-white' : 'text-gray-200'}`}>
                                {getRoleCount(role)}
                            </span>
                        </div>
                        <h3 className="text-lg font-black tracking-tight">{role === 'Chairman' ? 'Chairpersons' : role + 's'}</h3>
                        <p className={`text-xs font-bold mt-1 ${selectedRole === role ? 'text-green-100' : 'text-gray-400'}`}>
                            {role} View
                        </p>
                    </button>
                ))}
            </div>

            {/* 3. Main Directory Table */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800">
                            {selectedRole ? `${selectedRole === 'Chairman' ? 'Chairpersons' : selectedRole + 's'} Registry` : 'All Governance Officials'}
                        </h3>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">
                            Showing {filteredOfficials.length} of {officials.length} records
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-5 py-2.5 bg-green-50 text-safaricom-green rounded-2xl font-black text-xs hover:bg-green-100 transition-all border border-green-100 flex items-center gap-2"
                        >
                            <FaFileExcel /> EXCEL
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-black text-xs hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex items-center gap-2"
                        >
                            <FaFilePdf /> PDF PRINT
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="py-20 text-center animate-pulse">
                            <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4"></div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Loading Directory...</p>
                        </div>
                    ) : filteredOfficials.length > 0 ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b-2 border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                    <th className="pb-4 pl-4">Official Detail</th>
                                    <th className="pb-4">Role</th>
                                    <th className="pb-4">Group Association</th>
                                    <th className="pb-4">Term Validity</th>
                                    <th className="pb-4">Status</th>
                                    <th className="pb-4 text-right pr-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredOfficials.map(o => (
                                    <tr key={o.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="py-6 pl-4">
                                            <div className="font-black text-gray-800">{o.member_name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold">{o.member_phone}</div>
                                        </td>
                                        <td className="py-6">
                                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${o.role === 'Chairman' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                o.role === 'Secretary' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                    'bg-orange-50 text-orange-600 border-orange-100'
                                                }`}>
                                                {o.role === 'Chairman' ? 'Chairperson' : o.role}
                                            </span>
                                        </td>
                                        <td className="py-6">
                                            <div className="font-bold text-gray-700">{o.group_name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">ID: GR-{o.group_id}</div>
                                        </td>
                                        <td className="py-6">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                                                {new Date(o.term_start).toLocaleDateString()} — {o.term_end ? new Date(o.term_end).toLocaleDateString() : 'PRESENT'}
                                            </div>
                                            <div className="text-[9px] text-gray-400 mt-0.5">Formal Statutory Term</div>
                                        </td>
                                        <td className="py-6">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${o.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="py-6 pr-4 text-right">
                                            <div className="flex justify-end gap-2 outline-none">
                                                <a href={`tel:${o.member_phone}`} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:bg-safaricom-green hover:text-white hover:border-safaricom-green transition-all shadow-sm active:scale-90">
                                                    <FaPhone size={14} />
                                                </a>
                                                <button
                                                    onClick={() => toast.info(`Viewing ${o.member_name} Profile...`)}
                                                    className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all shadow-sm active:scale-90"
                                                >
                                                    <FaRightToBracket size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-20 text-center flex flex-col items-center gap-4">
                            <FaUserShield className="text-gray-100 text-6xl" />
                            <span className="text-sm font-black text-gray-400 uppercase tracking-widest italic leading-relaxed">
                                No officials found matching your current filters.<br />
                                <button onClick={() => { setSelectedRole(null); setSearchTerm(''); }} className="text-safaricom-green hover:underline mt-2">Clear all filters</button>
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfficialsDirectory;
