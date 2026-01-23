import { supabase, handleSupabaseError } from './supabase';

/**
 * UKOMBOZI Table Banking System - API Service
 * Integrated with Supabase Backend
 * 
 * This service provides database operations for all UKOMBOZI modules
 * with institutional-grade error handling and audit trail support.
 */

// LOCAL API CONFIGURATION (Hybrid Approach)
const API_URL = 'http://localhost:5000/api';

export const api = {
    // ========================================
    // MEMBER MANAGEMENT
    // ========================================

    /**
     * Get all members with their financial summary
     */
    async getMembers() {
        try {
            const res = await fetch(`${API_URL}/members`);
            if (!res.ok) throw new Error('Failed to fetch members');
            const data = await res.json();

            // Transform data to ensure UI-ready fields
            return data.map(member => ({
                ...member,
                savings: member.current_savings || 0,
                arrears: member.arrears || 0,
                groupName: member.group_name || 'Generic Group'
            }));
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    /**
     * Get a single member by ID
     */
    async getMember(id) {
        try {
            const { data, error } = await supabase
                .from('members')
                .select(`
                    *,
                    groups:group_id (name)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                id: data.id,
                name: data.name,
                groupId: data.group_id,
                groupName: data.groups?.name || 'Unknown',
                phone: data.phone,
                status: data.status,
                savings: data.current_savings || 0,
                activeLoans: data.active_loan_balance || 0,
                arrears: data.arrears || 0,
                balance: data.current_savings || 0
            };
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Create a new member
     */
    async createMember(memberData) {
        try {
            const res = await fetch(`${API_URL}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberData)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create member');
            }
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    /**
     * Update member profile
     */
    async updateMember(id, memberData) {
        try {
            const res = await fetch(`${API_URL}/members/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberData)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update member');
            }
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // ========================================
    // CONTRIBUTION MANAGEMENT
    // ========================================

    /**
     * Post a new contribution (institutional standard)
     */
    async postContribution(contributionData) {
        try {
            const res = await fetch(`${API_URL}/contributions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: contributionData.memberId,
                    amount: contributionData.amount,
                    type: contributionData.type,
                    paymentMethod: contributionData.paymentMethod,
                    meetingReference: contributionData.meetingReference,
                    officerId: contributionData.officerId
                })
            });

            if (!res.ok) throw new Error('Failed to post contribution');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    /**
     * Post a new loan repayment (Local API)
     */
    async postRepayment(repaymentData) {
        try {
            const res = await fetch(`${API_URL}/sessions/repayment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(repaymentData)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to post repayment');
            }
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    /**
     * Post a withdrawal (Local API)
     */
    async postWithdrawal(withdrawalData) {
        try {
            const res = await fetch(`${API_URL}/withdrawals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withdrawalData)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to post withdrawal');
            }
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    /**
     * Get contribution compliance data for a period
     */
    async getContributionCompliance(month) {
        try {
            const startDate = `${month}-01`;
            const endDate = `${month}-31`;

            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    members:member_id (id, name, phone)
                `)
                .eq('transaction_type', 'Contribution')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // LOAN MANAGEMENT
    // ========================================

    /**
     * Issue a new loan (institutional standard)
     */
    async issueLoan(loanData) {
        try {
            const res = await fetch(`${API_URL}/loans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...loanData, sessionId: loanData.sessionId || null })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to issue loan');
            }
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // LOANS (Switched to Local)
    async getLoans(memberId = null) {
        try {
            let url = `${API_URL}/loans`;
            if (memberId) url += `?memberId=${memberId}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch loans');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    /**
     * Get loan repayment tracking data
     */
    async getLoanRepaymentTracking(month) {
        try {
            const { data, error } = await supabase
                .from('loans')
                .select(`
                    *,
                    members:member_id (id, full_name, phone)
                `)
                .eq('status', 'Active');

            if (error) throw error;

            // Calculate repayment status for each loan
            return data.map(loan => ({
                ...loan,
                memberName: loan.members?.name,
                // Add repayment calculations here based on payment history
            }));
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Approve or reject a loan
     */
    async approveLoan(loanId, approvalData) {
        try {
            const { data, error } = await supabase
                .from('loans')
                .update({
                    status: approvalData.status === 'Approved' ? 'active' : 'rejected'
                    // Add other workflow fields if needed
                })
                .eq('id', loanId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // MEETING MANAGEMENT
    // ========================================

    /**
     * Get active meeting for a group (Local Hybrid)
     */
    async getActiveMeeting(groupId) {
        try {
            const res = await fetch(`${API_URL}/groups/${groupId}/active-session`);
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    /**
     * Create a new meeting session
     */
    async createMeeting(meetingData) {
        try {
            const { data, error } = await supabase
                .from('meeting_sessions')
                .insert([{
                    group_id: meetingData.groupId,
                    session_number: meetingData.sessionNumber,
                    meeting_date: meetingData.date,
                    status: 'OPEN',
                    officer_id: meetingData.officerId || 1
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Close a meeting session
     */
    async closeMeeting(meetingId, closureData) {
        try {
            const { data, error } = await supabase
                .from('meeting_sessions')
                .update({
                    status: 'CLOSED',
                    closed_at: new Date().toISOString(),
                    total_contributions: closureData.totalContributions,
                    total_loan_disbursements: closureData.totalLoanDisbursements,
                    total_repayments: closureData.totalRepayments
                })
                .eq('id', meetingId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // TRANSACTION MANAGEMENT
    // ========================================

    /**
     * Get transactions for a member
     */
    async getTransactions(memberId = null, filters = {}) {
        try {
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    members:member_id (id, full_name)
                `)
                .order('created_at', { ascending: false });

            if (memberId) {
                query = query.eq('member_id', memberId);
            }

            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }

            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate);
            }

            if (filters.type) {
                query = query.eq('transaction_type', filters.type);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // GROUP MANAGEMENT
    // ========================================

    // GROUPS (Switched to Local)
    async getGroups() {
        try {
            const res = await fetch(`${API_URL}/groups`);
            if (!res.ok) throw new Error('Failed to fetch groups');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async deleteGroup(id) {
        try {
            const res = await fetch(`${API_URL}/groups/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete group');
            }
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    /**
     * Create a new group (Supabase)
     */
    /*
    async createGroup(groupData) {
        try {
            const { data, error } = await supabase
                .from('groups')
                .insert([{
                    group_name: groupData.group_name,
                    meeting_day: groupData.meeting_day,
                    meeting_frequency: groupData.meeting_frequency,
                    location: groupData.location || null,
                    registration_date: groupData.registration_date || new Date().toISOString().split('T')[0],
                    status: groupData.status || 'ACTIVE'
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
            throw error; // Re-throw so the caller can handle it
        }
    },
    */

    // ========================================
    // ADMIN & SYSTEM MANAGEMENT
    // ========================================

    async getAuditLogs(limit = 50, offset = 0) {
        try {
            const res = await fetch(`${API_URL}/admin/audit-logs?limit=${limit}&offset=${offset}`);
            if (!res.ok) throw new Error('Failed to fetch audit logs');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async getAdminSettings() {
        try {
            const res = await fetch(`${API_URL}/admin/settings`);
            if (!res.ok) throw new Error('Failed to fetch settings');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async saveAdminSetting(setting) {
        try {
            const res = await fetch(`${API_URL}/admin/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setting)
            });
            if (!res.ok) throw new Error('Failed to save setting');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async getLoanProducts() {
        try {
            const res = await fetch(`${API_URL}/admin/loan-products`);
            if (!res.ok) throw new Error('Failed to fetch loan products');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async saveLoanProduct(product) {
        try {
            const res = await fetch(`${API_URL}/admin/loan-products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            if (!res.ok) throw new Error('Failed to save loan product');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async deleteLoanProduct(id) {
        try {
            const res = await fetch(`${API_URL}/admin/loan-products/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete loan product');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async downloadBackup() {
        try {
            window.location.href = `${API_URL}/admin/backup`;
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // ========================================
    // OFFICER MANAGEMENT
    // ========================================

    async getOfficers() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'field_officer')
                .order('full_name');

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    async assignGroup(officerId, groupId) {
        try {
            const { data, error } = await supabase
                .from('officer_groups')
                .insert([{
                    officer_id: officerId,
                    group_id: groupId,
                    assigned_at: new Date().toISOString()
                    // assigned_by is optional or handled by default/trigger if auth context is missing
                }])
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    /**
     * Update member savings balance
     */
    async updateMemberSavings(memberId, amount) {
        try {
            const { error } = await supabase.rpc('update_member_savings', {
                p_member_id: memberId,
                p_amount: amount
            });

            if (error) throw error;
        } catch (error) {
            // If RPC doesn't exist, fallback to manual update
            const { data: member } = await supabase
                .from('members')
                .select('current_savings')
                .eq('id', memberId)
                .single();

            const newBalance = (member?.current_savings || 0) + amount;

            const { error: updateError } = await supabase
                .from('members')
                .update({ current_savings: newBalance })
                .eq('id', memberId);

            if (updateError) handleSupabaseError(updateError);
        }
    },

    /**
     * Get member financial summary
     */
    async getMemberFinancialSummary(memberId) {
        try {
            const { data, error } = await supabase
                .from('members')
                .select(`
                    id,
                    full_name,
                    current_savings,
                    active_loan_balance,
                    arrears
                `)
                .eq('id', memberId)
                .single();

            if (error) throw error;

            return {
                savings: data.current_savings || 0,
                activeLoans: data.active_loan_balance || 0,
                arrears: data.arrears || 0,
                maxLoan: (data.current_savings || 0) * 3
            };
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // DAILY REPORTS
    // ========================================

    /**
     * Get daily reports
     */
    async getDailyReports(filters = {}) {
        try {
            let query = supabase
                .from('daily_cash_reports')
                .select('*')
                .order('report_date', { ascending: false });

            if (filters.startDate) {
                query = query.gte('report_date', filters.startDate);
            }

            if (filters.endDate) {
                query = query.lte('report_date', filters.endDate);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Create a daily report
     */
    async createDailyReport(reportData) {
        try {
            const { data, error } = await supabase
                .from('daily_cash_reports')
                .insert([reportData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Approve a daily report
     */
    async approveDailyReport(reportId, approvalData) {
        try {
            const { data, error } = await supabase
                .from('daily_cash_reports')
                .update({
                    status: 'Approved',
                    approved_by: approvalData.approvedBy,
                    approved_at: new Date().toISOString(),
                    approval_notes: approvalData.notes
                })
                .eq('id', reportId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // DIVIDEND ENGINE (LOCAL HYBRID)
    // ========================================

    /**
     * Generate Dividend Report
     */
    async generateDividendReport(groupId, year) {
        try {
            const res = await fetch(`${API_URL}/dividends/report?groupId=${groupId}&year=${year}`);
            if (!res.ok) throw new Error('Failed to generate report');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    /**
     * Post Dividend Run
     */
    async postDividends(payload) {
        try {
            const res = await fetch(`${API_URL}/dividends/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to post dividends');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // ========================================
    // ========================================
    // DIVIDEND ENGINE (LOCAL ENGINE)
    // ========================================

    async getDividendRuns() {
        try {
            const res = await fetch(`${API_URL}/dividends/runs`);
            if (!res.ok) throw new Error('Failed to fetch runs');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async createDividendRun(runData) {
        try {
            const res = await fetch(`${API_URL}/dividends/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(runData)
            });
            if (!res.ok) throw new Error('Failed to create run');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async calculateDividend(runId) {
        try {
            const res = await fetch(`${API_URL}/dividends/${runId}/calculate`, { method: 'POST' });
            if (!res.ok) throw new Error('Calculation failed');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async getDividendAllocations(runId) {
        try {
            const res = await fetch(`${API_URL}/dividends/${runId}/allocations`);
            if (!res.ok) throw new Error('Failed to fetch allocations');
            return await res.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async approveDividendRun(runId) {
        try {
            const res = await fetch(`${API_URL}/dividends/${runId}/approve`, { method: 'POST' });
            if (!res.ok) throw new Error('Approval failed');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async postDividendRun(runId) {
        try {
            const res = await fetch(`${API_URL}/dividends/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ runId })
            });
            if (!res.ok) throw new Error('Posting failed');
            return await res.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    async getFinancialYearSummary(year) {
        // Mock implementation for local engine
        return {
            total_income: 150000,
            breakdown: { fines: 5000, banking: 20000 }
        };
    },

    // ========================================
    // LOAN WORKFLOW
    // ========================================

    async submitLoanApplication(applicationData) {
        try {
            const { data, error } = await supabase
                .from('loan_applications')
                .insert([{
                    application_number: `APP-${Date.now()}`,
                    member_id: applicationData.memberId,
                    group_id: applicationData.groupId,
                    loan_type: applicationData.loanType,
                    amount_requested: applicationData.amount,
                    duration_months: applicationData.duration,
                    purpose: applicationData.purpose,
                    monthly_installment: applicationData.monthly_installment,
                    principal_portion: applicationData.principal_portion,
                    interest_portion: applicationData.interest_portion,
                    shares_contribution: applicationData.shares_contribution,
                    status: 'PENDING',
                    officer_submitted_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    async getLoanApplications() {
        try {
            const { data, error } = await supabase
                .from('loan_applications')
                .select(`
                    *,
                    members:member_id (id, full_name, phone),
                    groups:group_id (group_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map for frontend
            return data.map(app => ({
                id: app.id,
                applicationNumber: app.application_number,
                memberId: app.member_id,
                memberName: app.members?.full_name || 'Unknown',
                groupId: app.group_id,
                groupName: app.groups?.group_name || 'Unknown',
                loanType: app.loan_type,
                amount: app.amount_requested,
                duration: app.duration_months,
                monthly_installment: app.monthly_installment,
                principal_portion: app.principal_portion,
                interest_portion: app.interest_portion,
                shares_contribution: app.shares_contribution,
                status: app.status,
                date: app.created_at
            }));
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    // ========================================
    // LOAN PRODUCTS (Standardized Matrix) - SUPABASE VERSION (DISABLED)
    // ========================================

    /**
     * Get all active loan products (Supabase)
     */
    /*
    async getLoanProducts() {
        try {
            const { data, error } = await supabase
                .from('loan_products')
                .select('*')
                .eq('is_active', true)
                .order('loan_amount');

            if (error) throw error;

            // Calculate total repayable for each
            return data.map(product => ({
                ...product,
                total_repayable: product.monthly_installment * product.repayment_period_months
            }));
        } catch (error) {
            handleSupabaseError(error);
            return [];
        }
    },
    */

    /**
     * Get loan product by exact amount
     */
    async getLoanProductByAmount(amount) {
        try {
            const { data, error } = await supabase
                .rpc('get_loan_product', { p_amount: amount });

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.warn('RPC get_loan_product failed, using direct query');
            // Fallback to direct query
            const { data, error: queryError } = await supabase
                .from('loan_products')
                .select('*')
                .eq('loan_amount', amount)
                .eq('is_active', true)
                .single();

            if (queryError) {
                handleSupabaseError(queryError);
                return null;
            }
            return data;
        }
    },

    /**
     * Find closest loan product to desired amount (for advisory)
     */
    async findClosestLoanProduct(desiredAmount) {
        try {
            const { data, error } = await supabase
                .rpc('find_closest_loan_product', { p_desired_amount: desiredAmount });

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.warn('RPC find_closest_loan_product failed, using JS calculation');
            // Fallback: fetch all and find closest in JS
            const products = await this.getLoanProducts();
            if (!products || products.length === 0) return null;

            return products.reduce((closest, product) => {
                const currentDiff = Math.abs(product.loan_amount - desiredAmount);
                const closestDiff = Math.abs(closest.loan_amount - desiredAmount);
                return currentDiff < closestDiff ? product : closest;
            });
        }
    },

    // ========================================
    // DIVIDEND ENGINE (Institutional)
    // ========================================

    /**
     * Get all dividend runs
     */
    async getDividendRuns(financialYear = null) {
        try {
            let query = supabase
                .from('dividend_runs')
                .select('*')
                .order('created_at', { ascending: false });

            if (financialYear) {
                query = query.eq('financial_year', financialYear);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
            return [];
        }
    },

    /**
     * Create new dividend run
     */
    async createDividendRun(runData) {
        try {
            const { data, error } = await supabase
                .from('dividend_runs')
                .insert([{
                    run_number: `DIV-${runData.financialYear}-${String(Date.now()).slice(-6)}`,
                    financial_year: runData.financialYear,
                    group_id: runData.groupId || null,
                    banking_interest: runData.bankingInterest || 0,
                    stl_interest: runData.stlInterest || 0,
                    ltl_interest: runData.ltlInterest || 0,
                    penalties: runData.penalties || 0,
                    other_income: runData.otherIncome || 0,
                    operating_expenses: runData.operatingExpenses || 0,
                    mandatory_reserves: runData.mandatoryReserves || 0,
                    risk_buffer: runData.riskBuffer || 0,
                    reinvested_capital: runData.reinvestedCapital || 0,
                    profit_share_percentage: runData.profitSharePercentage || 75,
                    status: 'DRAFT'
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Update dividend run (Draft only)
     */
    async updateDividendRun(runId, updates) {
        try {
            const { data, error } = await supabase
                .from('dividend_runs')
                .update(updates)
                .eq('id', runId)
                .eq('status', 'DRAFT') // Only update if still in draft
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Calculate dividend run (Triggers backend function)
     */
    async calculateDividend(runId) {
        try {
            const { data, error } = await supabase
                .rpc('calculate_dividend_run', { p_run_id: runId });

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Get member allocations for a run
     */
    async getDividendAllocations(runId) {
        try {
            const { data, error } = await supabase
                .from('dividend_allocations')
                .select(`
                    *,
                    members:member_id (id, full_name, phone)
                `)
                .eq('dividend_run_id', runId)
                .order('gross_dividend', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
            return [];
        }
    },

    /**
     * Approve dividend run (Director only)
     */
    async approveDividendRun(runId) {
        try {
            const { data, error } = await supabase
                .from('dividend_runs')
                .update({
                    status: 'APPROVED',
                    approved_at: new Date().toISOString()
                })
                .eq('id', runId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Post dividend (Transfer to member accounts)
     */
    async postDividendRun(runId) {
        try {
            const { data, error } = await supabase
                .from('dividend_runs')
                .update({
                    status: 'POSTED',
                    posted_at: new Date().toISOString()
                })
                .eq('id', runId)
                .eq('status', 'APPROVED')
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    }
};

export default api;
