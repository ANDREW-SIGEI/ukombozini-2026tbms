import React, { useState } from 'react';
import { mockContributions, mockGroups } from '../data/mockData';
import { FaPlus, FaSearch, FaPiggyBank, FaUsers, FaExclamationCircle } from 'react-icons/fa';
import ContributionModal from '../components/ContributionModal';

const Contributions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [contributions, setContributions] = useState(mockContributions);

    const selectedGroup = mockGroups.find(g => g.id === parseInt(selectedGroupId));

    const filtered = contributions.filter(c => {
        const matchesSearch = c.memberName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = selectedGroupId ? c.groupId === parseInt(selectedGroupId) : true;
        return matchesSearch && matchesGroup;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Member Contributions</h2>
                    <p className="text-sm text-gray-500">Track savings and special contributions from members.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <select
                        className="px-4 py-2 border border-gray-100 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold text-gray-700"
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                        <option value="">Select Group Context...</option>
                        {mockGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowModal(true)}
                        disabled={!selectedGroupId}
                        className={`flex items-center px-6 py-2 rounded-xl font-extrabold transition-all shadow-lg ${selectedGroupId
                            ? 'bg-safaricom-green text-white hover:bg-safaricom-dark shadow-green-900/20'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <FaPlus className="mr-2" /> Record Contribution
                    </button>
                </div>
            </div>

            {!selectedGroupId && (
                <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-3xl flex items-center gap-4 text-yellow-800 animate-pulse">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                        <FaExclamationCircle size={24} />
                    </div>
                    <div>
                        <p className="font-black text-sm uppercase tracking-wider">Group Selection Required</p>
                        <p className="text-sm opacity-80">Please select a group above to view history and record new contributions.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 rounded-lg bg-blue-100 text-blue-600 mr-4">
                        <FaPiggyBank size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Total Month Savings</p>
                        <p className="text-xl font-bold text-gray-800">KES 1.2M</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative mb-4">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by member name..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-500">{new Date(item.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.memberName}</td>
                                    <td className="px-6 py-4 text-safaricom-dark font-bold">KES {item.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-600 truncate">{item.type}</td>
                                    <td className="px-6 py-4 text-xs font-bold text-gray-400">
                                        <button className="hover:text-safaricom-dark">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <ContributionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                selectedGroupId={parseInt(selectedGroupId)}
                selectedGroupName={selectedGroup?.name}
                onSuccess={(newEntry) => {
                    setContributions([newEntry, ...contributions]);
                    console.log('Ripple Effect: Updating DCR and Ledgers with:', newEntry);
                }}
            />
        </div>
    );
};

export default Contributions;
