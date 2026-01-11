import React from 'react';
import { mockOfficers } from '../data/mockData';
import { FaUserShield, FaEnvelope, FaPhone, FaEdit } from 'react-icons/fa';

const Officers = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Table Officers</h2>
                    <p className="text-sm text-gray-500">Manage group officers, their roles, and assigned groups.</p>
                </div>
                <button className="bg-safaricom-green text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-safaricom-dark">
                    Assign New Officer
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockOfficers.map((officer) => (
                    <div key={officer.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-start">
                            <div className="flex items-center">
                                <div className="w-12 h-12 rounded-full bg-safaricom-green/10 flex items-center justify-center text-safaricom-green mr-3">
                                    <FaUserShield size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">{officer.name}</h3>
                                    <p className="text-xs text-safaricom-dark font-bold uppercase tracking-wider">{officer.role}</p>
                                </div>
                            </div>
                            <button className="text-gray-400 hover:text-safaricom-dark">
                                <FaEdit />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center text-sm text-gray-600">
                                <span className="font-bold text-gray-400 mr-2">GROUP:</span>
                                <span className="font-medium">{officer.group}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <FaPhone className="mr-2 text-gray-400" />
                                <span>{officer.phone}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <FaEnvelope className="mr-2 text-gray-400" />
                                <span>{officer.name.toLowerCase().replace(' ', '.')}@tbms.com</span>
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-gray-50 flex justify-end">
                            <button className="text-[10px] font-bold text-safaricom-dark hover:underline">VIEW PERMISSIONS</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Officers;
