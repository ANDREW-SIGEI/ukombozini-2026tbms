import React, { useState, useEffect } from 'react';
import {
    FaPlus, FaSearch, FaFilter, FaFileDownload,
    FaMoneyBillWave, FaExclamationTriangle, FaCheckCircle, FaSpinner
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

const Loans = () => {
    const navigate = useNavigate();
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    const [stats, setStats] = useState({
        totalPrincipal: 0,
        countActive: 0,
        countDefaulted: 0
    });

    useEffect(() => {
        fetchLoans();
    }, []);

    const fetchLoans = async () => {
        setLoading(true);
        try {
            const data = await api.getLoans();
            if (data) {
                setLoans(data);
                calculateStats(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch loans.");
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        const active = data.filter(l => l.status === 'Active');
        const defaulted = data.filter(l => l.status === 'Defaulted');
        const principal = active.reduce((sum, l) => sum + (l.principal || 0), 0);

        setStats({
            totalPrincipal: principal,
            countActive: active.length,
            countDefaulted: defaulted.length
        });
    };

    const filteredLoans = loans.filter(loan => {
        const matchesSearch =
            loan.members?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.id.toString().includes(searchTerm);

        const matchesFilter = filterStatus === 'ALL' || loan.status === filterStatus;

        return matchesSearch && matchesFilter;
    });

    const getStatusStyle = (status) => {
        const styles = {
            'Active': 'bg-green-100 text-green-800 border-green-200',
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'Defaulted': 'bg-red-100 text-red-800 border-red-200',
            'Closed': 'bg-gray-100 text-gray-600 border-gray-200'
        };
        return styles[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaMoneyBillWave className="text-safaricom-green" /> Loans Management
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        Overview of Portfolio & Risk
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 transition-colors">
                        <FaFileDownload /> Export List
                    </button>
                    <button
                        onClick={() => navigate('/loan-approvals')}
                        className="flex items-center gap-2 bg-safaricom-green text-white px-5 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                    >
                        <FaPlus /> New Application
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-green-50 text-green-600 rounded-xl">
                        <FaMoneyBillWave size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase">Total Principal</div>
                        <div className="text-2xl font-black text-gray-800">KES {stats.totalPrincipal.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
                        <FaCheckCircle size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase">Active Loans</div>
                        <div className="text-2xl font-black text-gray-800">{stats.countActive}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl">
                        <FaExclamationTriangle size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase">Defaulted</div>
                        <div className="text-2xl font-black text-red-600">{stats.countDefaulted}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by member name or ID..."
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold text-gray-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Status:</span>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-600 focus:outline-none focus:border-safaricom-green/50"
                    >
                        <option value="ALL">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Defaulted">Defaulted</option>
                        <option value="Closed">Closed</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Loan Info</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Principal</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Repayable</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-bold">
                                        <FaSpinner className="animate-spin inline mr-2" /> Loading Portfolio...
                                    </td>
                                </tr>
                            ) : filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 font-bold">
                                        No loans found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredLoans.map((loan) => (
                                    <tr key={loan.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{loan.members?.name || 'Unknown Member'}</div>
                                            <div className="text-xs font-mono text-gray-500">#{loan.id.substr(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-700">
                                            KES {loan.principal?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-safaricom-green">
                                            KES {loan.total_repayable?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-600">
                                            {loan.duration_months} Months
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(loan.status)}`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="text-gray-400 hover:text-blue-600 font-bold text-xs group-hover:visible transition-colors">
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Loans;
