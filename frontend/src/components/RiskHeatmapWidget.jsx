import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AlertTriangle, CheckCircle, AlertOctagon, TrendingUp, DollarSign } from 'lucide-react';

const RiskHeatmapWidget = () => {
    const [auditData, setAuditData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRiskData = async () => {
            try {
                // getRiskDashboard → GET /risk/dashboard → returns {scores, alerts, heatmap[], stats}
                // heatmap[] has the per-group shape: {id, name, riskScore, riskFactors, metrics}
                const data = await api.getRiskDashboard();
                const heatmap = data?.heatmap || [];
                setAuditData(heatmap);
            } catch (error) {
                console.error("Failed to load risk heatmap", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRiskData();
        // Poll every 60s
        const interval = setInterval(fetchRiskData, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="h-48 flex items-center justify-center text-gray-400">Loading Risk Analysis...</div>;

    const getRiskColor = (score) => {
        if (score >= 60) return 'bg-red-50 border-red-200 text-red-700';
        if (score >= 30) return 'bg-yellow-50 border-yellow-200 text-yellow-700';
        return 'bg-green-50 border-green-200 text-green-700';
    };

    const getRiskIcon = (score) => {
        if (score >= 60) return <AlertOctagon className="w-5 h-5 text-red-600" />;
        if (score >= 30) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Live Risk Heatmap
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {auditData.map((group) => (
                    <div key={group.id} className={`p-4 rounded-lg border flex flex-col justify-between transition-all hover:shadow-md ${getRiskColor(group.riskScore)}`}>
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-lg leading-tight">{group.name}</h4>
                                {getRiskIcon(group.riskScore)}
                            </div>

                            <div className="space-y-1 my-3">
                                {Array.isArray(group.riskFactors) && group.riskFactors.length > 0 ? (
                                    group.riskFactors.map((factor, idx) => (
                                        <div key={idx} className="text-xs font-semibold flex items-center gap-1">
                                            • {factor}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs opacity-75">No immediate risks detected.</div>
                                )}
                            </div>
                        </div>

                        <div className="mt-2 pt-3 border-t border-black/5 flex justify-between text-xs font-mono">
                            <div className="flex flex-col">
                                <span className="opacity-60 uppercase text-[10px]">Score</span>
                                <span className="font-bold text-base">{group.riskScore}/100</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="opacity-60 uppercase text-[10px]">Utilization</span>
                                <span className="font-bold text-base">{group.metrics?.utilization || 0}%</span>
                            </div>
                        </div>
                    </div>
                ))}

                {auditData.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-400 text-sm">
                        No active groups found to analyze.
                    </div>
                )}
            </div>

            <div className="mt-4 text-[10px] text-gray-400 flex gap-4 justify-end">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> High Risk (&gt;60)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Medium Risk (30-60)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Low Risk (&lt;30)</div>
            </div>
        </div>
    );
};

export default RiskHeatmapWidget;
