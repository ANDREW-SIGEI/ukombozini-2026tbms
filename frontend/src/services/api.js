import axios from 'axios';
import { toast } from 'react-toastify';
import offlineManager from './OfflineManager';


/**
 * UKOMBOZINI Table Banking System - API Service
 * Decoupled from Supabase, now using Local Node.js / SQLite backend.
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';


export const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 30000, // Increased to 30s to handle heavy sync backlogs // Consolidated redundant method lux
    headers: {
        'Content-Type': 'application/json'
    }
});

// Helper to normalize group data
const normalizeGroup = (group) => {
    if (!group) return null;
    const name = group.group_name || group.name;
    const meetingDay = group.meeting_day || group.meetingDay;
    const freq = group.meeting_frequency || group.meetingFrequency;
    const regDate = group.registration_date || group.registrationDate;
    return {
        ...group,
        name: name,
        group_name: name,
        groupName: name,
        meetingDay: meetingDay,
        meeting_day: meetingDay,
        meetingFrequency: freq,
        meeting_frequency: freq,
        registrationDate: regDate,
        registration_date: regDate
    };
};

// Helper to normalize member data
const normalizeMember = (member) => {
    if (!member) return null;
    const name = member.name || member.full_name || member.fullName;
    const phone = member.phone || member.phone_number || member.phoneNumber;
    return {
        ...member,
        name: name,
        full_name: name,
        fullName: name,
        phone: phone,
        phoneNumber: phone,
        phone_number: phone,
        group_name: member.group_name || member.groupName,
        joined_at: member.joined_at || member.created_at,
        group_role: member.group_role || member.role || 'Member'
    };
};

// Helper to normalize meeting data
const normalizeMeeting = (meeting) => {
    if (!meeting) return null;
    const gId = meeting.group_id || meeting.groupId;
    const oId = meeting.officer_id || meeting.officerId;
    const gName = meeting.group_name || meeting.groupName;
    const oName = meeting.officer_name || meeting.officerName;
    return {
        ...meeting,
        group_id: gId,
        groupId: gId,
        officer_id: oId,
        officerId: oId,
        group_name: gName,
        groupName: gName,
        officer_name: oName,
        officerName: oName
    };
};

const CACHE_KEYS = {
    MEMBERS: 'ukombozini_members_cache',
    GROUPS: 'ukombozini_groups_cache',
    LOAN_PRODUCTS: 'ukombozini_loan_products_cache'
};

// Add Token Interceptor
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('ukombozini_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Debugging timeout [PHASE-DEBUG]
    console.log(`[API-DEBUG] Req: ${config.method?.toUpperCase()} ${config.url} | Timeout: ${config.timeout}ms`);
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Add Response Interceptor for Automatic Caching
axiosInstance.interceptors.response.use(async (response) => {
    const url = response.config.url;

    try {
        // Cache Members
        if (url.includes('/members') && response.config.method === 'get' && Array.isArray(response.data)) {
            await offlineManager.cacheMembers(response.data);
        }
        // Cache Groups
        else if (url.includes('/groups') && response.config.method === 'get' && Array.isArray(response.data)) {
            await offlineManager.cacheGroups(response.data);
        }
        // Cache Loan Products
        else if (url.includes('/loan-products') && response.config.method === 'get' && Array.isArray(response.data)) {
            await offlineManager.cacheLoanProducts(response.data);
        }
    } catch (e) {
        console.warn('Caching failed:', e);
    }

    return response;
}, (error) => {
    return Promise.reject(error);
});

const handleApiError = (error) => {
    console.error('🔴 API Error [DEBUG-AXIOS-TIMEOUT-30000]:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url
    });

    const url = error.config?.url || 'unknown';
    const msg = `${error.response?.data?.error || error.message || 'Error'} | URL: ${url} [DEBUG-REF-30S]`;

    // [FIX-SYNC-SPAM] Do not toast for "Missing mandatory fields" (handled by OfflineManager)
    if (msg.includes('Missing mandatory fields')) {
        console.warn('⚠️ Suppressed Toast:', msg);
    } else {
        toast.error(msg);
    }
    throw error;
};

export const api = {
    // ========================================
    // HELPERS
    // ========================================
    calculateServiceFee(amount) {
        if (!amount || amount < 10000) return 0;
        if (amount > 300000) return 3000;
        return Math.round(amount * 0.01);
    },

    async downloadFile(endpoint, filename, params = {}) {
        try {
            const response = await axiosInstance.get(endpoint, {
                params,
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // CORE MEMBER & GROUP API
    // ========================================



    // Basic Member/Group methods are defined in the overrides section at the end


    // ========================================
    // PHASE 2: AUDIT & GOVERNANCE
    // ========================================

    async getAttendance(sessionId) {
        try {
            const response = await axiosInstance.get(`governance/sessions/${sessionId}/attendance`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async recordAttendance(sessionId, memberId, status) {
        try {
            const response = await axiosInstance.post(`governance/sessions/${sessionId}/attendance`, { memberId, status });
            return response.data;
        } catch (error) {
            // Check for Network Error
            if (!error.response && error.request) {
                console.warn('⚡ Network Error. Saving attendance offline...');
                const offlineId = await offlineManager.saveOfflineTransaction({
                    type: 'attendance',
                    data: { sessionId, memberId, status }
                });
                return { success: true, offline: true, offlineId };
            }
            handleApiError(error);
        }
    },

    async getLoansDueSummary(groupId) {
        try {
            const response = await axiosInstance.get(`governance/loans/due-summary/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async resendSMSReceipt(data) {
        try {
            const response = await axiosInstance.post('communication/resend-receipt', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getAuditSnapshot(date, groupId = null) {
        try {
            const response = await axiosInstance.get('audit/snapshot', { params: { date, groupId } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getAuditTrail(memberId, date) {
        try {
            const response = await axiosInstance.get(`audit/trail/${memberId}`, { params: { date } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // Consolidated redundant method lux
    // ========================================
    // UNIFIED TRANSACTION POSTING API
    // Routes to appropriate engine based on type
    // ========================================


    // Unified Transaction methods are defined at the end

    // ========================================
    // CONTRIBUTION ENGINE API
    // ========================================

    async validateContribution(data) {
        try {
            const response = await axiosInstance.post('contributions/validate', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async getContributionHistory(memberId) {
        try {
            const response = await axiosInstance.get(`contributions/history/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // WITHDRAWAL ENGINE API
    // ========================================

    async validateWithdrawal(data) {
        try {
            const response = await axiosInstance.post('withdrawals/validate', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async getWithdrawalHistory(memberId) {
        try {
            const response = await axiosInstance.get(`withdrawals/history/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // LOAN DISBURSEMENT ENGINE API
    // ========================================

    async checkLoanEligibility(data) {
        try {
            const response = await axiosInstance.post('loans/check-eligibility', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async getLoanArrearsById(loanId) {
        try {
            const response = await axiosInstance.get(`loans/${loanId}/arrears`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanPayments(loanId) {
        try {
            const response = await axiosInstance.get(`loans/${loanId}/payments`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // MEMBER STATEMENT API
    // ========================================

    async getMemberStatement(memberId, startDate = null, endDate = null) {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await axiosInstance.get(`statements/member/${memberId}`, { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    downloadMemberStatementPDF(memberId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozini_token');
        let url = `${API_URL}/statements/member/${memberId}/pdf`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        // Create a temporary link to download
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '');

        // Add auth header via fetch for PDF download
        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('PDF Download error:', err));
    },

    downloadMemberStatementExcel(memberId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozini_token');
        let url = `${API_URL}/statements/member/${memberId}/excel`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('Excel Download error:', err));
    },

    // ========================================
    // GROUP STATEMENT API
    // ========================================

    async getGroupStatement(groupId, startDate = null, endDate = null) {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await axiosInstance.get(`statements/group/${groupId}`, { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    downloadGroupStatementPDF(groupId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozini_token');
        let url = `${API_URL}/statements/group/${groupId}/pdf`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('PDF Download error:', err));
    },

    downloadGroupStatementExcel(groupId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozini_token');
        let url = `${API_URL}/statements/group/${groupId}/excel`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('Excel Download error:', err));
    },

    // ========================================
    // DIVIDEND REPORT API
    // ========================================

    downloadDividendReportPDF(runId) {
        const token = localStorage.getItem('ukombozini_token');
        const url = `${API_URL}/dividend-runs/${runId}/pdf`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('PDF Download error:', err));
    },

    // ========================================
    // RECONCILIATION API
    // ========================================

    async createReconciliation(sessionId, actualCash, notes = null) {
        try {
            const response = await axiosInstance.post('reconciliation/session', {
                sessionId,
                actualCash,
                notes
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getSessionReconciliation(sessionId) {
        try {
            const response = await axiosInstance.get(`reconciliation/session/${sessionId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getDiscrepancies(status = null, groupId = null) {
        try {
            const params = {};
            if (status) params.status = status;
            if (groupId) params.groupId = groupId;
            const response = await axiosInstance.get('reconciliation/discrepancies', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async resolveDiscrepancy(recId, resolutionNotes) {
        try {
            const response = await axiosInstance.post(`reconciliation/${recId}/resolve`, {
                resolutionNotes
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getReconciliationDashboard() {
        try {
            const response = await axiosInstance.get('reconciliation/dashboard');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // ARREARS TRACKING API
    // ========================================

    async getArrearsSummary(groupId = null) {
        try {
            const params = {};
            if (groupId) params.groupId = groupId;
            const response = await axiosInstance.get('arrears/summary', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getArrearsMembers(status = null, groupId = null, sortBy = null) {
        try {
            const params = {};
            if (status) params.status = status;
            if (groupId) params.groupId = groupId;
            if (sortBy) params.sortBy = sortBy;
            const response = await axiosInstance.get('arrears/members', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async sendArrearsReminders(memberIds, customMessage = null) {
        try {
            const response = await axiosInstance.post('arrears/notify', {
                memberIds,
                customMessage
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getArrearsHistory(memberId) {
        try {
            const response = await axiosInstance.get(`arrears/history/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DIRECTOR DASHBOARD API
    // ========================================

    async getDirectorDashboard() {
        try {
            const response = await axiosInstance.get('dashboard/director');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getPortfolioAnalytics() {
        try {
            const response = await axiosInstance.get('dashboard/portfolio');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupRankings() {
        try {
            const response = await axiosInstance.get('dashboard/groups');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getActivityFeed(limit = 20) {
        try {
            const response = await axiosInstance.get('dashboard/activity', { params: { limit } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async toggleFreeze(targetType, targetId, action, reason) {
        try {
            // Backend expects: { scope, targetId, reason }
            // Routes: POST /governance/freeze   (action === 'FREEZE')
            //         POST /governance/unfreeze  (action === 'UNFREEZE')
            const endpoint = action === 'FREEZE' ? '/governance/freeze' : '/governance/unfreeze';
            const response = await axiosInstance.post(endpoint, {
                scope: targetType,  // backend reads 'scope', not 'targetType'
                targetId: targetId,
                reason: reason
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGovernanceStatus() {
        try {
            const response = await axiosInstance.get('governance/status');
            return response.data;
        } catch (error) {
            console.error('getGovernanceStatus error:', error);
            // Default safe state
            return { system_lockdown: false };
        }
    },



    // getGroupExposure — canonical defined below, uses handleApiError consistently

    async getGroupScore(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/score/${groupId}`);
            return response.data;
        } catch (error) {
            console.error('getGroupScore error:', error);
            throw error;
        }
    },

    async getGroupMatrixStatus(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/matrix-status/${groupId}`);
            return response.data;
        } catch (error) {
            console.error('getGroupMatrixStatus error:', error);
            throw error;
        }
    },



    async getRiskOverview() {
        try {
            const response = await axiosInstance.get('risk/overview');
            // Returns { parAmount, highRiskGroups, asOfDate }
            return response.data || { parAmount: 0, highRiskGroups: 0, asOfDate: null };
        } catch (error) {
            console.error('getRiskOverview error:', error);
            return { parAmount: 0, highRiskGroups: 0, asOfDate: null };
        }
    },

    async getRiskDashboard() {
        try {
            const response = await axiosInstance.get('risk/dashboard');
            const data = response.data || { scores: [], alerts: [], heatmap: [] };
            if (data.heatmap) {
                data.heatmap = data.heatmap.map(normalizeGroup);
            }
            return data;
        } catch (error) {
            console.error('getRiskDashboard error:', error);
            return { scores: [], alerts: [], heatmap: [] };
        }
    },
    async recalculateRiskScores() {
        try {
            const response = await axiosInstance.post('risk/recalculate-all');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    async requestReversal(transactionId, reason) {
        try {
            const response = await axiosInstance.post('reversals/request', { transaction_id: transactionId, reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    async approveReversal(requestId) {
        try {
            const response = await axiosInstance.post('reversals/approve', { request_id: requestId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    async getReversalRequests() {
        try {
            const response = await axiosInstance.get('reversals/requests');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getFreezeLogs() {
        try {
            const response = await axiosInstance.get('governance/freeze-logs');
            return response.data;
        } catch (error) {
            console.error('getFreezeLogs error:', error);
            return [];
        }
    },

    async getRiskScore(scope, id) {
        try {
            const response = await axiosInstance.get(`risk/${scope.toLowerCase()}/${id}`);
            return response.data;
        } catch (error) {
            console.error(`getRiskScore for ${scope} error:`, error);
            return null;
        }
    },

    async getSystemSettings() {
        try {
            const response = await axiosInstance.get('admin/system-settings');
            return response.data;
        } catch (error) {
            console.error('getSystemSettings error:', error);
            return [];
        }
    },

    async getDashboardStats() {
        try {
            const response = await axiosInstance.get('dashboard/stats');
            return response.data;
        } catch (error) {
            console.error('getDashboardStats error:', error);
            return null;
        }
    },

    // PDF Financial Report Downloads
    async downloadBalanceSheetPDF(date) {
        const params = date ? `?date=${date}` : '';
        const response = await axiosInstance.get(`reports/financial/balance-sheet/pdf${params}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `balance_sheet_${date || 'today'}.pdf`;
        document.body.appendChild(a); a.click();
        a.remove(); window.URL.revokeObjectURL(url);
    },

    async downloadIncomeStatementPDF(startDate, endDate) {
        const year = new Date().getFullYear();
        const s = startDate || `${year}-01-01`;
        const e = endDate || new Date().toISOString().split('T')[0];
        const response = await axiosInstance.get(`reports/financial/income-statement/pdf?startDate=${s}&endDate=${e}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `income_statement_${s}_to_${e}.pdf`;
        document.body.appendChild(a); a.click();
        a.remove(); window.URL.revokeObjectURL(url);
    },

    async downloadCashFlowPDF(date) {
        const params = date ? `?date=${date}` : '';
        const response = await axiosInstance.get(`reports/financial/cash-flow/pdf${params}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash_flow_${date || 'today'}.pdf`;
        document.body.appendChild(a); a.click();
        a.remove(); window.URL.revokeObjectURL(url);
    },

    // Consolidated redundant method lux

    // ========================================
    // CASH CONTROL & RECONCILIATION (Bank-Grade)
    // ========================================
    // openCashSession/getCashSessionContext/verifyAndLockCashSession/unlockSession
    // ─ canonical versions defined below (~line 2587) with richer meetingId param and
    //   correct /cash-sessions/:id/unlock endpoint.



    async getMonthlyReports(filters = {}) {
        try {
            const response = await axiosInstance.get('monthly-reports', { params: filters });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getMonthlyReportDetails(id) {
        try {
            const response = await axiosInstance.get(`monthly-reports/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadMonthlyReportPDF(id) {
        return this.downloadFile(`/monthly-reports/${id}/pdf`, `monthly_report_${id}.pdf`);
    },

    async downloadMonthlyReportExcel(id) {
        return this.downloadFile(`/monthly-reports/${id}/excel`, `monthly_report_${id}.xlsx`);
    },

    async getLoanTracking(month) {
        try {
            const response = await axiosInstance.get('reports/loan-tracking', { params: { month } });
            return response.data || [];
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },


    async downloadComplianceReportPDF(month, groupId) {
        return this.downloadFile('/reports/contribution-compliance-pdf', `compliance_report_${month}_${groupId}.pdf`, { month, groupId });
    },

    // ========================================
    // MEETING SUMMARY (New)
    // ========================================

    async getMeetingSummary(sessionId) {
        try {
            const response = await axiosInstance.get(`sessions/${sessionId}/summary`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // ALLOCATION MATRIX API (TABLE BANKING)
    // ========================================

    // ========================================
    // AUTHENTICATION
    // ========================================

    async login(email, password) {
        try {
            const response = await axiosInstance.post('auth/login', { email, password });
            if (response.data.token) {
                localStorage.setItem('ukombozini_token', response.data.token);
            }
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getMe() {
        try {
            const response = await axiosInstance.get('auth/me');
            return response.data;
        } catch (error) {
            // No toast for quiet check
            if (error.response?.status !== 401) {
                console.error('getMe error:', error);
            }
            return null;
        }
    },

    logout() {
        localStorage.removeItem('ukombozini_token');
    },

    // ========================================
    // REPORTS (PDF)
    // ========================================



    async downloadMemberStatement(memberId, startDate, endDate) {
        try {
            const response = await axiosInstance.get(`reports/member/${memberId}`, {
                params: { startDate, endDate },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statement_${memberId}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadMemberExcel(memberId, startDate, endDate) {
        try {
            const response = await axiosInstance.get(`reports/member/${memberId}/excel`, {
                params: { startDate, endDate },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statement_${memberId}_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadDividendReport(runId) {
        try {
            const response = await axiosInstance.get(`dividend-runs/${runId}/pdf`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `dividend_report_${runId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadContributionComplianceReport(month, groupId) {
        try {
            const response = await axiosInstance.get(`reports/compliance`, {
                params: { month, groupId },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `compliance_report_${month}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },


    async downloadLoanStatementPDF(loanId) {
        try {
            const response = await axiosInstance.get(`reports/receipt/loan-statement/${loanId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `loan_statement_${loanId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadReceiptPDF(transactionId) {
        try {
            const response = await axiosInstance.get(`reports/receipt/${transactionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `receipt_${transactionId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },
    // ========================================

    /**
     * Get all members with their financial summary
     */

    /**
     * Get all transactions for a member (used by MemberLedger)
     * Calls GET /api/members/:id/transactions
     */


    /**
     * Get all group officials (Chairpersons, Secretaries, Treasurers)
     * Used by OfficialsDirectory.jsx — calls GET /api/officials
     */

    /**
     * Create a new member
     */
    async createMember(memberData) {
        try {
            const response = await axiosInstance.post('members', memberData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Update member profile
     */
    async updateMember(id, memberData) {
        try {
            const response = await axiosInstance.put(`members/${id}`, memberData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async deleteMember(id) {
        try {
            const response = await axiosInstance.delete(`members/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // CONTRIBUTION MANAGEMENT
    // ========================================

    /**
     * Post a new contribution (institutional standard)
     */
    /**
     * Post a new loan repayment (Supabase Integrated)
     */
    async postRepayment(repaymentData) {
        try {
            const payload = {
                ...repaymentData,
                sessionId: repaymentData.meetingId || repaymentData.sessionId
            };
            const response = await axiosInstance.post('sessions/repayment', payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    /**
     * Get contribution compliance data for a period (Institutional)
     */
    /**
     * Get contribution compliance data for a period (Institutional)
     */
    async getContributionCompliance(month, groupId = 'all') {
        try {
            const response = await axiosInstance.get(`reports/contribution-compliance?month=${month}&groupId=${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },

    // ========================================
    // LOAN MANAGEMENT
    // ========================================

    /**
     * Issue a new loan (Supabase Integrated)
     */

    // getLoans moved to later section (Unified API) - Line 1983

    async getLoanSchedule(loanId) {
        try {
            const response = await axiosInstance.get(`loans/${loanId}/schedule`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async markLoanDefaulted(loanId) {
        try {
            const response = await axiosInstance.patch(`loans/${loanId}/default`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async markLoanClosed(loanId) {
        try {
            const response = await axiosInstance.patch(`loans/${loanId}/close`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanArrears() {
        try {
            const response = await axiosInstance.get('loans/arrears-summary');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Get loan repayment tracking data
     */
    /**
     * Get loan repayment tracking data (Institutional Standard)
     */



    /**
     * Approve or reject a loan
     */
    async approveLoan(loanId, approvalData) {
        try {
            const response = await axiosInstance.put(`loans/${loanId}`, { status: approvalData.status });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // MEETING MANAGEMENT
    // ========================================

    /**
     * Get active meeting for a group (Supabase Integrated)
     */
    async getActiveMeeting(groupId) {
        try {
            const response = await axiosInstance.get(`groups/${groupId}/active-session`);
            return response.data;
        } catch (error) {
            console.error('getActiveMeeting error:', error);
            return null;
        }
    },

    /**
     * Get all meeting sessions (for dashboard)
     */
    // getMeetingSessions — canonical defined below (line ~1800) with normalizeMeeting

    /**
     * Create a new meeting session
     */
    async createMeeting(meetingData) {
        try {
            const response = await axiosInstance.post('sessions', meetingData);
            return response.data;
        } catch (error) {
            // Check for Network Error
            if (!error.response && error.request) {
                console.warn('⚡ Network Error detected. Saving meeting session offline...');
                const offlineId = await offlineManager.saveOfflineTransaction({
                    type: 'meeting_session',
                    data: meetingData
                });
                return { success: true, offline: true, offlineId, ...meetingData };
            }
            handleApiError(error);
        }
    },

    async updateMeeting(meetingId, meetingData) {
        try {
            const response = await axiosInstance.patch(`sessions/${meetingId}`, meetingData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Close a meeting session
     */
    async closeMeeting(meetingId, closureData) {
        try {
            const response = await axiosInstance.patch(`sessions/${meetingId}/close`, closureData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postMeeting(meetingId, postData) {
        try {
            const response = await axiosInstance.post(`sessions/${meetingId}/post`, postData);
            return response.data;
        } catch (error) {
            // Check for Network Error
            if (!error.response && error.request) {
                console.warn('⚡ Network Error detected. Saving post-session payload offline...');
                const offlineId = await offlineManager.saveOfflineTransaction({
                    type: 'post_meeting',
                    meetingId: meetingId,
                    data: postData
                });
                return { success: true, offline: true, offlineId };
            }
            handleApiError(error);
        }
    },

    // ========================================
    // TRANSACTION MANAGEMENT
    // ========================================

    /**
     * Reverse a transaction (Full Institutional Audit Trail)
     */
    async reverseTransaction(transactionId, reason, approverId) {
        try {
            const response = await axiosInstance.post(`transactions/${transactionId}/reverse`, { reason, approverId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    // Transaction methods are at the end

    // ========================================
    // GROUP MANAGEMENT
    // ========================================


    // Group methods are at the end

    async deleteGroup(id) {
        try {
            const response = await axiosInstance.delete(`groups/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async createGroup(groupData) {
        try {
            const response = await axiosInstance.post('groups', groupData);
            // Invalidate cache
            localStorage.removeItem(CACHE_KEYS.GROUPS);
            return normalizeGroup(response.data);
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateGroup(id, groupData) {
        try {
            const response = await axiosInstance.put(`groups/${id}`, groupData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupTransactions(groupId) {
        try {
            const response = await axiosInstance.get(`groups/${groupId}/transactions`);
            return response.data;
        } catch (error) {
            console.error('getGroupTransactions error:', error);
            return [];
        }
    },

    // ========================================
    // ADMIN & SYSTEM MANAGEMENT
    // ========================================

    async getAdminSettings() {
        try {
            const response = await axiosInstance.get('admin/settings');
            return response.data;
        } catch (error) {
            console.error('getAdminSettings error:', error);
            return [];
        }
    },

    async saveAdminSetting(setting) {
        try {
            const response = await axiosInstance.post('admin/settings', setting);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanProducts() {
        try {
            const response = await axiosInstance.get('loan-products');
            return response.data;
        } catch (error) {
            console.error('getLoanProducts error:', error);
            return [];
        }
    },

    async saveLoanProduct(product) {
        try {
            const response = await axiosInstance.post('loan-products', product);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async deleteLoanProduct(id) {
        try {
            const response = await axiosInstance.delete(`loan-products/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DIVIDEND ENGINE
    // ========================================
    // NOTE: canonical previewDividends / postDividends are defined below
    // under "DIVIDEND ENGINE (Supabase Native)" — they use /dividend-runs/* endpoints.

    async generateDividendReport(groupId, year) {
        try {
            const response = await axiosInstance.get('dividends/report', { params: { groupId, year } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async downloadBackup() {
        alert("Please use the Supabase Dashboard to download database backups.");
    },

    async downloadTableExport(table) {
        toast.info("Exporting CSV via local API...");
        try {
            const response = await axiosInstance.get(`admin/export?table=${table}`);
            const data = response.data;

            if (!data || data.length === 0) {
                toast.info('No data to export');
                return;
            }

            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row => headers.map(fieldName => {
                    const val = row[fieldName];
                    return JSON.stringify(val === null ? '' : val);
                }).join(','))
            ];
            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${table}_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // OFFICER MANAGEMENT (Supabase Integrated)
    // ========================================
    async getOfficers() {
        try {
            const response = await axiosInstance.get('officers');
            return response.data;
        } catch (error) {
            console.error('getOfficers error:', error);
            return [];
        }
    },

    async getProfile(userId) {
        try {
            const response = await axiosInstance.get(`profile${userId ? `?id=${userId}` : ''}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateProfile(updates) {
        try {
            const response = await axiosInstance.put('profile', updates);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async saveOfficer(officer) {
        try {
            const response = await axiosInstance.post('officers', officer);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async deleteOfficer(id) {
        try {
            const response = await axiosInstance.delete(`officers/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateOfficerStatus(id, status) {
        try {
            const response = await axiosInstance.put(`officers/${id}`, { status });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async resetOfficerPassword(id, newPassword) {
        try {
            const response = await axiosInstance.post(`officers/${id}/reset-password`, { newPassword });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async allocateGroupsToOfficer(officerId, groupIds) {
        try {
            const response = await axiosInstance.post(`officers/${officerId}/groups`, { groupIds });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    async updateMemberSavings(memberId, amount) {
        // No-op: handled by triggers on transactions table
        console.log('updateMemberSavings: Handled by DB triggers');
    },

    async getMemberFinancialSummary(memberId) {
        try {
            const response = await axiosInstance.get(`members/${memberId}/summary`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DAILY REPORTS
    // ========================================
    // Note: 'daily_cash_reports' table not defined in new schema, 
    // replacing with aggregate queries on meeting_sessions/transactions

    async getDailyReports(filters = {}) {
        // Return meeting summaries as daily reports
        try {
            const response = await axiosInstance.get('daily-reports', { params: filters });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async submitDailyReport(reportData) {
        try {
            const response = await axiosInstance.post('daily-reports', reportData);
            return response.data;
        } catch (error) {
            handleApiError(error);
            throw error;
        }
    },

    async approveDailyReport(reportId) {
        try {
            const response = await axiosInstance.patch(`daily-reports/${reportId}/approve`);
            return response.data;
        } catch (error) {
            handleApiError(error);
            throw error;
        }
    },

    async getDailyReportContext(groupId, date) {
        try {
            const response = await axiosInstance.get(`daily-reports/context/${groupId}/${date}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DIVIDEND ENGINE (Supabase Native)
    // ========================================

    async previewDividends(params) {
        const { year, groupId, expenses = 0 } = params;
        try {
            const response = await axiosInstance.post('dividend-runs/calculate', { year, groupId, expenses });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getDividendRuns(groupId = null) {
        try {
            const response = await axiosInstance.get('dividend-runs', { params: { groupId } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async createDividendRun(runData) {
        try {
            const response = await axiosInstance.post('dividend-runs', runData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async approveDividendRun(runId) {
        try {
            const response = await axiosInstance.post(`dividend-runs/${runId}/approve`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getDividendAllocations(runId) {
        try {
            const response = await axiosInstance.get(`dividend-runs/${runId}/allocations`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // LOAN REPAYMENT TRACKING
    // ========================================

    async getLoanRepaymentTracking(month) {
        try {
            const response = await axiosInstance.get(`reports/loan-tracking?month=${month}`);
            return response.data;
        } catch (error) {
            console.error('getLoanRepaymentTracking error:', error);
            // Return empty list on error to prevent UI crash
            return [];
        }
    },

    async downloadLoanRepaymentReport(month, group, type) {
        try {
            const response = await axiosInstance.get(`reports/loan-repayment-pdf?month=${month}&groupId=${group}&type=${type}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Loan_Repayment_Report_${month}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async postDividends({ runData, officerId }) {
        try {
            // 1. Create Run as DRAFT — map interest breakdown to correct DB columns
            const breakdown = runData.interestBreakdown || {};
            const saveRes = await axiosInstance.post('dividend-runs', {
                financial_year: runData.year,
                group_id: runData.groupId,
                run_number: `DIV-${runData.year}-${Date.now()}`,
                // Correct breakdown: loan interest → stl_interest, fines → penalties
                banking_interest: 0,                              // bank statement interest (not tracked yet)
                stl_interest: breakdown.loanInterest || 0,  // short-term loan interest
                ltl_interest: 0,                              // long-term (separate when tracked)
                penalties: breakdown.finesAndPenalties || 0,
                operating_expenses: runData.expenses || 0,
                allocable_profit: runData.ap,
                profit_share_percentage: runData.ratio * 100,
                dividend_rate: runData.dividendRate,
                total_payout: runData.profitToShare,
                allocations: runData.allocations.map(a => ({
                    memberId: a.memberId,
                    averageShares: a.averageShares,
                    grossDividend: a.grossDividend,
                    netDividend: a.netDividend     // already WHT-deducted by dividendRules.js
                }))
            });

            if (!saveRes.data.success) throw new Error('Failed to save dividend run');
            const runId = saveRes.data.id;

            // 2. Approve Run
            await axiosInstance.post(`dividend-runs/${runId}/approve`);

            // 3. Post (Distribute via MTE v2)
            return await this.postDividendRun(runId, officerId);
        } catch (error) {
            handleApiError(error);
        }
    },

    async postDividendRun(runId, officerId) {
        try {
            const response = await axiosInstance.post(`dividend-runs/${runId}/post`, { officerId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // LOAN WORKFLOW (Supabase)
    // ========================================

    async submitLoanApplication(applicationData) {
        try {
            const response = await axiosInstance.post('loan-applications', applicationData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanApplications(status = 'ALL') {
        try {
            const response = await axiosInstance.get('loan-applications', {
                params: { status }
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateApplicationStatus(id, status, comments, officerId, role) {
        try {
            const response = await axiosInstance.patch(`loan-applications/${id}/status`, {
                status,
                comments,
                officerId,
                role
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadMeetingMinutes(sessionId) {
        try {
            const response = await axiosInstance.get(`reports/meeting/${sessionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Meeting_Minutes_${sessionId}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // LOAN PRODUCTS - HELPERS
    // ========================================

    // Consolidated redundant method lux
    async downloadLoanAdvisoryPDF(advisoryData) {
        try {
            const response = await axiosInstance.post('reports/loan-advisory/pdf', advisoryData, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Loan_Advisory_${advisoryData.memberName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanProductByAmount(amount) {
        return null;
    },

    async findClosestLoanProduct(desiredAmount) {
        return null;
    }
    ,

    // ==========================================
    // FINANCIAL REPORTS (Standardized)
    // ==========================================
    async getBalanceSheet(date) {
        try {
            const response = await axiosInstance.get('reports/financial/balance-sheet', { params: { date } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getIncomeStatement(startDate, endDate) {
        try {
            const response = await axiosInstance.get('reports/financial/income-statement', { params: { startDate, endDate } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getTreasuryStatus() {
        try {
            const response = await axiosInstance.get('treasury/status');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getInstitutionalStats() {
        try {
            const response = await axiosInstance.get('admin/institutional-stats');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getMeetingSessions() {
        // Get all meeting sessions (for dashboard)
        try {
            const response = await axiosInstance.get('sessions');
            const sessions = Array.isArray(response.data) ? response.data : [];
            return sessions.map(normalizeMeeting);
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },




    // ==========================================
    // PARTNERSHIP MODEL (Commitments/Top-Ups)
    // ==========================================

    async getPartnershipExposure(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/exposure/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async applyPartnerOffset(data) {
        try {
            const response = await axiosInstance.post('partnership/apply-offset', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadPartnershipStatement(groupId) {
        try {
            const response = await axiosInstance.get(`reports/partnership/${groupId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Partnership_Statement_${groupId}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async getRelationshipScore(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/score/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // PROJECT SAVINGS MODULE
    // ========================================

    async registerProject(memberId, projectType, groupId) {
        try {
            const response = await axiosInstance.post('projects/register', {
                memberId: memberId,
                projectType: projectType,
                groupId: groupId
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async getProjectGroupStats(groupId) {
        try {
            const response = await axiosInstance.get(`projects/group-stats/${groupId}`);
            const data = response.data;

            // Normalize pools for frontend consumption
            const eduPool = data.pools?.find(p => p.project_type === 'EDUCATION')?.pool_total || 0;
            const agriPool = data.pools?.find(p => p.project_type === 'AGRICULTURE')?.pool_total || 0;

            return {
                ...data,
                education_pool: eduPool,
                agriculture_pool: agriPool
            };
        } catch (error) {
            console.error('getProjectGroupStats error:', error);
            return {
                pools: [],
                total_project_pool: 0,
                total_table_savings: 0,
                total_active_loans: 0,
                payout_obligation: 0,
                available_cash: 0,
                liquidity_alert: 'SAFE',
                participation_rate: 0,
                loan_utilization: 0,
                education_pool: 0,
                agriculture_pool: 0
            };
        }
    },

    async postProjectPayout(registrationId) {
        try {
            const response = await axiosInstance.post('projects/payout', { registration_id: registrationId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },



    async getProjectGroupMatrix(groupId) {
        try {
            const response = await axiosInstance.get(`projects/group-matrix/${groupId}`);
            return response.data;
        } catch (error) {
            console.error('getProjectGroupMatrix error:', error);
            return [];
        }
    },

    // ========================================
    // GOVERNANCE & MESSAGING (New)
    // ========================================



    async getOfficerPerformance() {
        try {
            const response = await axiosInstance.get('reports/officer-performance');
            return response.data;
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },

    async getOfficials() {
        try {
            const response = await axiosInstance.get('governance/officials');
            return response.data;
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },



    // ========================================
    // PROJECT MANAGEMENT
    // ========================================

    async getProjectMemberStatus(memberId) {
        try {
            const response = await axiosInstance.get(`projects/member/${memberId}/status`);
            return response.data;
        } catch (error) {
            console.error('getProjectMemberStatus error:', error);
            return [];
        }
    },


    async postProjectSaving(registrationId, amount, date, groupId) {
        try {
            const payload = { amount, date, groupId };
            const response = await axiosInstance.post(`projects/savings/${registrationId}`, payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DEFINITIVE OVERRIDES (Resolves Duplicate Chaos)
    // ========================================

    async getMember(id) {
        const response = await axiosInstance.get(`members/${id}`);
        return normalizeMember(response.data);
    },

    async getGroup(id) {
        const response = await axiosInstance.get(`groups/${id}`);
        return normalizeGroup(response.data);
    },

    async getGroupById(id) {
        return this.getGroup(id);
    },

    // ========================================
    // SYSTEM HEALTH CHECK
    // ========================================

    async getSystemHealth() {
        try {
            const response = await axiosInstance.get('health');
            return response.data;
        } catch (error) {
            console.error('Health Check Failed:', error.message);
            return { status: 'DOWN', error: error.message };
        }
    },



    async getGroups() {
        const response = await axiosInstance.get('groups');
        const groups = Array.isArray(response.data) ? response.data : [];
        return groups.map(normalizeGroup);
    },


    async getMembers(groupId = null) {
        const params = groupId ? { groupId } : {};
        const response = await axiosInstance.get('members', { params });
        const members = Array.isArray(response.data) ? response.data : [];
        return members.map(normalizeMember);
    },

    async getMembersByGroup(groupId) {
        return this.getMembers(groupId);
    },

    async getProjectMemberDayLimit(memberId) {
        try {
            const response = await axiosInstance.get(`members/${memberId}/day-limit`);
            return response.data;
        } catch (error) {
            console.error('getProjectMemberDayLimit error:', error);
            return { remaining_limit: 0, daily_savings: 0 };
        }
    },

    async getMemberRelationships(memberId) {
        try {
            const response = await axiosInstance.get(`members/${memberId}/relationships`);
            return response.data;
        } catch (error) {
            console.error('getMemberRelationships error:', error);
            return { next_of_kin: null, guarantors: [], liability_network: [] };
        }
    },

    // Get all transactions for a specific session (for Meeting Cockpit)
    async getSessionTransactions(sessionId) {
        try {
            const response = await axiosInstance.get(`transactions?sessionId=${sessionId}`);
            return response.data || [];
        } catch (error) {
            console.error('getSessionTransactions error:', error);
            return [];
        }
    },

    async getLoans(memberId = null) {
        const params = memberId ? { memberId } : {};
        const response = await axiosInstance.get('loans', { params });
        // Map backend fields to frontend expectations
        return (response.data || []).map(loan => ({
            ...loan,
            date_issued: loan.issued_date || loan.created_at,
            principal_amount: parseFloat(loan.principal_amount || 0),
            interest_rate: parseFloat(loan.interest_rate || 0),
            status: loan.status ? loan.status.charAt(0).toUpperCase() + loan.status.slice(1).toLowerCase() : 'Active'
        }));
    },

    async getLatestCashSession(groupId) {
        const response = await axiosInstance.get(`sessions/latest`, { params: { groupId } });
        return response.data;
    },

    async postContribution(data) {
        // Ensure sessionId is preserved and amount is mapped if needed for legacy compatibility
        const payload = {
            ...data,
            amount: data.amount || (parseFloat(data.savings || 0) + parseFloat(data.welfare || 0) + parseFloat(data.project || 0) + parseFloat(data.penalty || 0))
        };

        try {
            const response = await axiosInstance.post('contributions/post', payload);
            return response.data;
        } catch (error) {
            // Check for Network Error
            if (!error.response && error.request) {
                console.warn('⚡ Network Error. Saving contribution offline...');
                const offlineId = await offlineManager.saveOfflineTransaction({
                    type: 'contribution',
                    data: payload
                });
                return { success: true, offline: true, offlineId };
            }
            handleApiError(error);
        }
    },

    async postWithdrawal(data) {
        // Redirect to unified transactions hub
        const payload = {
            ...data,
            transaction_type: 'WITHDRAWAL',
            amount: data.amount
        };
        return this.postTransaction(payload);
    },

    async processLoanRepayment(data) {
        // Redirect to unified transactions hub
        const payload = {
            ...data,
            transaction_type: 'LOAN_REPAYMENT'
        };
        return this.postTransaction(payload);
    },

    async postLoanApplication(data) {
        const response = await axiosInstance.post('loan-applications', data);
        return response.data;
    },

    async updateLoanApplicationStatus(applicationId, status, comments = '') {
        const response = await axiosInstance.patch(`loan-applications/${applicationId}/status`, { status, comments });
        return response.data;
    },

    async previewTransaction(data) {
        try {
            const response = await axiosInstance.post('transactions/preview', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postTransaction(data) {
        try {
            // Unified MTE Payload
            const detectedType = data.type || data.transaction_type || data.finalType || 'SAVINGS';
            const payload = {
                memberId: data.memberId,
                sessionId: data.sessionId || data.meetingId,
                transaction_type: detectedType,
                amount: parseFloat(data.amount),
                description: data.description || '',
                officerId: data.officerId,
                breakdown: data.breakdown,
                loanId: data.loanId,
                loanType: data.loanType
            };

            const response = await axiosInstance.post('transactions', payload);
            return response.data;
        } catch (error) {
            // Check for Network Error
            if (!error.response && error.request) {
                console.warn('⚡ Network Error detected. Saving transaction offline...');
                const detectedType = data.type || data.transaction_type || data.finalType || 'SAVINGS';
                const offlineId = await offlineManager.saveOfflineTransaction({
                    type: detectedType,
                    data: {
                        memberId: data.memberId,
                        sessionId: data.sessionId || data.meetingId,
                        transaction_type: detectedType,
                        amount: parseFloat(data.amount),
                        description: data.description || '',
                        officerId: data.officerId,
                        breakdown: data.breakdown,
                        loanId: data.loanId, // [PHASE-31] Fixed missing loanId in offline
                        loanType: data.loanType  // [PHASE-31] Fixed missing loanType in offline
                    }
                });
                return { success: true, offline: true, offlineId };
            }
            handleApiError(error);
        }
    },

    async issueLoan(loanData) {
        // Wrapper for specialized LOAN_ISSUANCE transaction lux
        return this.postTransaction({
            ...loanData,
            transaction_type: 'LOAN_ISSUANCE'
        });
    },

    async getTransactions(memberId = null, filters = {}, limit = null) {
        const params = { ...filters };
        if (memberId) params.memberId = memberId;
        if (limit) params.limit = limit;
        const response = await axiosInstance.get('transactions', { params, timeout: 15000 });
        // Map backend fields to frontend expectations for Member Profile
        return (response.data || []).map(t => {
            // Normalize transaction type for UI filters and colors
            let type = t.transaction_type || t.type || 'Savings';
            const typeUp = type.toUpperCase().replace(/\s/g, '_');

            if (typeUp === 'SAVINGS') type = 'Savings';
            else if (typeUp === 'WITHDRAWAL') type = 'Withdrawal';
            else if (typeUp === 'LOAN_REPAYMENT' || typeUp === 'LOANREPAYMENT' || typeUp === 'REPAYMENT') type = 'LoanRepayment';
            else if (typeUp === 'LOAN_ISSUANCE' || typeUp === 'LOAN_ISSUED') type = 'Loan Disbursement';
            else if (typeUp === 'FINE' || typeUp === 'PENALTY') type = 'Fine';
            else if (typeUp === 'WELFARE') type = 'Welfare';
            else if (typeUp === 'PROJECT' || typeUp === 'EDUCATION' || typeUp === 'AGRICULTURE') type = 'Project';
            else if (typeUp === 'INTEREST' || typeUp === 'LOAN_INTEREST') type = 'Interest';
            else type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace('_', ' ');

            // Calculate NET amount impact for the member ledger
            // Credits (In): savings_amount, stl_repayment, ltl_repayment, loan_interest, fines, welfare, project
            // Debits (Out): withdrawals, loans_issued
            const credits =
                parseFloat(t.savings_amount || 0) +
                parseFloat(t.stl_repayment || 0) +
                parseFloat(t.ltl_repayment || 0) +
                parseFloat(t.loan_interest || 0) +
                parseFloat(t.fines || 0) +
                parseFloat(t.welfare || 0) +
                parseFloat(t.project || 0) +
                (typeUp === 'SAVINGS' && !t.savings_amount ? parseFloat(t.amount || 0) : 0); // Fallback

            const debits =
                parseFloat(t.withdrawals || 0) +
                parseFloat(t.loans_issued || 0) +
                (typeUp === 'WITHDRAWAL' && !t.withdrawals ? parseFloat(t.amount || 0) : 0); // Fallback

            return {
                ...t,
                date: t.sessionDate || t.created_at,
                type: type,
                amount: credits - debits
            };
        });
    },

    async getMemberRisk(memberId) {
        try {
            const response = await axiosInstance.get(`risk/member/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // MESSAGING HUB & SMS API
    // ========================================
    async getNotificationLogs(limit = 100) {
        try {
            const response = await axiosInstance.get('communication/logs', { params: { limit } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getSMSBalance() {
        try {
            const response = await axiosInstance.get('communication/balance');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async sendBulkNotification(data) {
        try {
            // data items: { target, targetIds, message, method }
            const response = await axiosInstance.post('communication/bulk', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getPartnershipStats() {
        try {
            const response = await axiosInstance.get('partnership/stats');
            return response.data;
        } catch (error) {
            handleApiError(error);
            return {
                totalInjected: 0,
                activeCommitments: 0,
                pendingRepayments: 0,
                productFinanceVolume: 0
            };
        }
    },

    async getMatrixStatus(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/matrix-status/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupRiskScore(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/score/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async addCompanyTopUp(data) {
        try {
            const response = await axiosInstance.post('partnership/top-up', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async addCommitmentDeposit(data) {
        try {
            const response = await axiosInstance.post('partnership/commitment-deposit', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async issueProduct(data) {
        try {
            const response = await axiosInstance.post('partnership/issue-product', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async requestTopUp(data) {
        try {
            const response = await axiosInstance.post('partnership/request-topup', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async approveTopUp(requestId) {
        try {
            const response = await axiosInstance.post(`partnership/approve-topup/${requestId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async rejectTopUp(requestId, reason) {
        try {
            const response = await axiosInstance.post(`partnership/reject-topup/${requestId}`, { reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getPendingTopUpRequests() {
        try {
            const response = await axiosInstance.get('partnership/pending-requests');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupCommitments(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/commitments/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupProducts(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/products/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupExposure(groupId) {
        try {
            const response = await axiosInstance.get(`partnership/exposure/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // applyPartnerOffset — canonical at line ~1838 (axiosInstance version)
    // downloadPartnershipStatement — canonical at line ~1847 (axiosInstance blob download)


    /**
     * Update current officer password
     */
    async updateMyPassword(password) {
        try {
            const response = await axiosInstance.put('me/password', { password });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Withdraw from Education/Agriculture Projects
     */
    async withdrawProjectSavings(data) {
        try {
            const response = await axiosInstance.post('projects/withdraw', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }


    },

    // approveReversal / requestReversal — canonical at lines ~736/728
    // getAuditLogs — GET /governance/audit-logs → audit_logs table
    async getAuditLogs(limit = 50) {
        try {
            const response = await axiosInstance.get('governance/audit-logs', { params: { limit } });
            return response.data || [];
        } catch (error) {
            console.error('getAuditLogs error:', error);
            return [];
        }
    },

    async getSMSLogs(params = {}) {
        try {
            const response = await axiosInstance.get('sms/logs', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },



    // downloadMemberStatementPDF / downloadMemberStatementExcel:
    // canonical async/axiosInstance versions are defined above (lines ~341 and ~367)

    // ALLOCATION SERVICE (PHASE 12)
    async getAllocationPreview(sessionId) {
        try {
            const response = await axiosInstance.get(`allocation/preview/${sessionId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async commitAllocation(sessionId) {
        try {
            const response = await axiosInstance.post(`allocation/commit/${sessionId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // getAllocationHistory (canonical) is defined below — calls /allocation/history

    async getAllocationRules(groupId) {
        try {
            const response = await axiosInstance.get(`allocation/rules/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateAllocationRules(groupId, rules) {
        try {
            const response = await axiosInstance.post(`allocation/rules`, { groupId, rules });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getAllocationHistory(limit = 50) {
        try {
            const response = await axiosInstance.get(`allocation/history`, { params: { limit } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // SUPERVISOR APPROVAL WORKFLOW
    async requestSupervisorApproval(sessionId, reason) {
        try {
            const response = await axiosInstance.post('governance/approvals/request', { sessionId, reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getPendingApprovals() {
        try {
            const response = await axiosInstance.get('governance/approvals/pending');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async reviewSupervisorApproval(requestId, status, comments) {
        try {
            const response = await axiosInstance.post('governance/approvals/review', { requestId, status, comments });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // CASH CONTROL MODULE (Institutional Guard)
    async openCashSession(groupId, date, meetingId = null) {
        try {
            const response = await axiosInstance.post('cash-sessions/open', { groupId, date, meetingId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getCashSessionContext(sessionId) {
        try {
            const response = await axiosInstance.get(`cash-sessions/${sessionId}/context`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async verifyAndLockCashSession(sessionId, data) {
        try {
            const response = await axiosInstance.patch(`cash-sessions/${sessionId}/verify`, data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async unlockSession(sessionId, reason) {
        try {
            const response = await axiosInstance.post(`cash-sessions/${sessionId}/unlock`, { reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // toggleFreeze — canonical defined at line ~618 with (targetType, targetId, action, reason) signature
    // matching GovernanceHub.jsx calling convention

    // CASH RECONCILIATION
    async getDailyCashFlow(date) {
        try {
            const response = await axiosInstance.get('reports/financial/daily-cash-flow', { params: { date } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    async getReconciliations() {
        try {
            const response = await axiosInstance.get('reconciliations');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async submitReconciliation(data) {
        try {
            const response = await axiosInstance.post('reconciliations', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },







    async updateAdminSettings(settings) {
        try {
            const response = await axiosInstance.post('admin/settings', settings);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getBoardReport() {
        try {
            const response = await axiosInstance.get('admin/board-report');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    }

};

export default api;

