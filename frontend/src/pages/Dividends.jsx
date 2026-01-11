import React from 'react';
import { mockDividends } from '../data/mockData';
import { FaCalculator, FaCheckCircle, FaClock } from 'react-icons/fa';

const Dividends = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Dividends Management</h2>
                    <p className="text-sm text-gray-500">Calculate and distribute member dividends based on savings and group performance.</p>
                </div>
                <button className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-sm">
                    <FaCalculator className="mr-2" /> Calculate Dividends
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Total Dividends Distributed</h3>
                    <p className="text-3xl font-bold text-gray-800">KES 1.55M</p>
                    <p className="text-xs text-green-600 font-bold mt-1">▲ 8.4% from previous year</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-yellow-400">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Payouts</h3>
                    <p className="text-3xl font-bold text-gray-800">42 Members</p>
                    <p className="text-xs text-yellow-600 font-bold mt-1">Value: KES 420,500</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Payout History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Member Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Payout Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {mockDividends.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.memberName}</td>
                                    <td className="px-6 py-4 text-purple-600 font-bold">KES {item.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(item.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            {item.status === 'Paid' ? (
                                                <><FaCheckCircle className="text-green-500 mr-2" /> <span className="text-xs font-bold text-green-700">PAID</span></>
                                            ) : (
                                                <><FaClock className="text-yellow-500 mr-2" /> <span className="text-xs font-bold text-yellow-700">PENDING</span></>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-xs font-bold text-gray-400 hover:text-gray-600">Download Slip</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dividends;
