import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Download, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

const OfficerScorecard = () => {
    const [officers, setOfficers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await api.getOfficerPerformance();
            setOfficers(data);
        } catch (error) {
            console.error("Failed to load officer stats", error);
            toast.error("Failed to load officer performance data.");
        } finally {
            setLoading(false);
        }
    };

    const exportPDF = async () => {
        try {
            const { default: jsPDF } = await import('jspdf');
            await import('jspdf-autotable');

            const doc = new jsPDF();

            // Header
            doc.setFillColor(41, 128, 185); // Professional Blue
            doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.text("UKOMBOZI - Officer Performance Scorecard", 14, 13);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            // Table
            const tableColumn = ["Officer Name", "Role", "Reports Filed", "Collections (in KES)", "Errors/Variance", "Efficiency Score"];
            const tableRows = [];

            officers.forEach(officer => {
                const officerData = [
                    officer.name,
                    officer.role,
                    officer.reports_filed,
                    officer.total_collected.toLocaleString(),
                    officer.variance_issues,
                    `${officer.efficiency_score}%`
                ];
                tableRows.push(officerData);
            });

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                headStyles: { fillColor: [52, 73, 94] },
                alternateRowStyles: { fillColor: [240, 240, 240] }
            });

            doc.save(`Officer_Scorecard_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("PDF Report downloaded successfully.");
        } catch (error) {
            console.error("PDF Export Error:", error);
            toast.error("Failed to load PDF generator. Please check connection.");
        }
    };

    const exportExcel = async () => {
        try {
            const XLSX = await import('xlsx');

            const worksheet = XLSX.utils.json_to_sheet(officers.map(o => ({
                "Officer ID": o.id,
                "Name": o.name,
                "Role": o.role,
                "Reports Filed": o.reports_filed,
                "Total Collected": o.total_collected,
                "Variance Issues": o.variance_issues,
                "Efficiency Score": o.efficiency_score,
                "Last Active": o.last_active
            })));

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Officer Performance");
            XLSX.writeFile(workbook, `Officer_Scorecard_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success("Excel Report downloaded successfully.");
        } catch (error) {
            console.error("Excel Export Error:", error);
            toast.error("Failed to load Excel generator. Please check connection.");
        }
    };

    if (loading) return <div className="p-4 text-center">Loading scorecard...</div>;

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="text-blue-600" />
                        Officer Performance Scorecard
                    </h2>
                    <p className="text-gray-500 text-sm">Performance metrics based on field report accuracy and collections.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                        <FileText size={18} /> Excel
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                        <Download size={18} /> PDF Report
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 uppercase text-sm font-semibold">
                            <th className="p-4 border-b">Officer</th>
                            <th className="p-4 border-b">Role</th>
                            <th className="p-4 border-b text-center">Reports Filed</th>
                            <th className="p-4 border-b text-right">Total Collections</th>
                            <th className="p-4 border-b text-center">Error Rate</th>
                            <th className="p-4 border-b text-center">Efficiency</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {officers.length > 0 ? (
                            officers.map((officer) => (
                                <tr key={officer.id} className="hover:bg-blue-50 transition duration-150">
                                    <td className="p-4 font-medium text-gray-800">{officer.name}</td>
                                    <td className="p-4 text-gray-500 text-sm">{officer.role}</td>
                                    <td className="p-4 text-center">
                                        <span className="bg-gray-100 text-gray-700 py-1 px-3 rounded-full text-xs font-bold">
                                            {officer.reports_filed}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono font-medium text-blue-700">
                                        KES {officer.total_collected.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        {officer.variance_issues > 0 ? (
                                            <span className="flex items-center justify-center gap-1 text-red-600 font-bold text-xs">
                                                <AlertTriangle size={14} /> {officer.variance_issues} Issues
                                            </span>
                                        ) : (
                                            <span className="text-green-500 text-xs font-bold">Perfect</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className={`h-2.5 rounded-full ${officer.efficiency_score >= 90 ? 'bg-green-500' :
                                                        officer.efficiency_score >= 70 ? 'bg-yellow-400' : 'bg-red-500'
                                                        }`}
                                                    style={{ width: `${officer.efficiency_score}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-bold w-8">{officer.efficiency_score}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-400">
                                    No data available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OfficerScorecard;
