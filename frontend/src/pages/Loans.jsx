import React, { useState } from 'react';
import { mockLoans } from '../data/mockData';
import { FaPlus, FaSearch, FaFilter, FaFileDownload } from 'react-icons/fa';
import LoanIssuanceModal from '../components/LoanIssuanceModal';
import { mockMembers } from '../data/mockData';

const Loans = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState(mockMembers[0]); // Default to first for group-level add

    const filteredLoans = mockLoans.filter(loan =>
        loan.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return 'bg-yellow-100 text-yellow-800';
            case 'Paid': return 'bg-green-100 text-green-800';
            case 'Overdue': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Loans Management</h2>
                    <p className="text-sm text-gray-500">Track and manage member loan applications and repayments.</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <FaFileDownload className="mr-2" /> Export
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center bg-safaricom-green text-white px-4 py-2 rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm"
                    >
                        <FaPlus className="mr-2" /> New Loan
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by member or loan ID..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="flex items-center justify-center px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    <FaFilter className="mr-2" /> Filter
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Loan ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Member Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Principal</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Interest</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Due Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLoans.map((loan) => (
                                <tr key={loan.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{loan.id}</td>
                                    <td className="px-6 py-4 text-gray-700">{loan.memberName}</td>
                                    <td className="px-6 py-4 text-gray-700">KES {loan.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-700">KES {loan.interest.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(loan.dueDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(loan.status)}`}>
                                            {loan.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-safaricom-dark font-bold text-xs hover:underline">View Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredLoans.length === 0 && (
                    <div className="p-10 text-center text-gray-500">
                        No loans found matching your criteria.
                    </div>
                )}
            </div>

            <LoanIssuanceModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                member={selectedMember}
                onSuccess={(newLoan) => {
                    console.log('New Loan Issued from Loans Page:', newLoan);
                }}
            />
        </div>
    );
};

export default Loans;
