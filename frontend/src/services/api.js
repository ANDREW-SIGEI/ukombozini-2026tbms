import { supabase, handleSupabaseError } from './supabase';

/**
 * UKOMBOZI Table Banking System - API Service
 * Integrated with Supabase Backend
 * 
 * This service provides database operations for all UKOMBOZI modules
 * with institutional-grade error handling and audit trail support.
 */

export const api = {
    // ========================================
    // MEMBER MANAGEMENT
    // ========================================

    /**
     * Get all members with their financial summary
     */
    async getMembers() {
        try {
            const { data, error } = await supabase
                .from('members')
                .select(`
                    *,
                    groups:group_id (name)
                `)
                .order('name');

            if (error) throw error;

            // Transform data to match frontend expectations
            return data.map(member => ({
                id: member.id,
                name: member.name,
                groupId: member.group_id,
                groupName: member.groups?.name || 'Unknown',
                phone: member.phone,
                status: member.status,
                savings: member.current_savings || 0,
                activeLoans: member.active_loan_balance || 0,
                arrears: member.arrears || 0,
                balance: member.current_savings || 0, // Legacy field
                lastActivity: member.updated_at,
                lastActivityType: 'Unknown'
            }));
        } catch (error) {
            handleSupabaseError(error);
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
            const { data, error } = await supabase
                .from('members')
                .insert([{
                    name: memberData.name,
                    group_id: memberData.groupId,
                    phone: memberData.phone,
                    status: memberData.status || 'Active',
                    current_savings: 0,
                    active_loan_balance: 0,
                    arrears: 0
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
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
            const { data, error } = await supabase
                .from('transactions')
                .insert([{
                    member_id: contributionData.memberId,
                    transaction_type: 'Contribution',
                    contribution_type: contributionData.type,
                    amount: contributionData.amount,
                    payment_method: contributionData.paymentMethod,
                    meeting_reference: contributionData.meetingReference,
                    officer_id: contributionData.officerId || 1,
                    affects_savings: contributionData.affectsSavings,
                    affects_loan_eligibility: contributionData.affectsLoanEligibility,
                    affects_cash: contributionData.affectsCash,
                    description: `${contributionData.type} contribution`,
                    status: 'Completed'
                }])
                .select()
                .single();

            if (error) throw error;

            // Update member savings if applicable
            if (contributionData.affectsSavings) {
                await this.updateMemberSavings(contributionData.memberId, contributionData.amount);
            }

            return data;
        } catch (error) {
            handleSupabaseError(error);
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
            const { data, error } = await supabase
                .from('loans')
                .insert([{
                    member_id: loanData.memberId,
                    loan_type: loanData.loanType,
                    principal: loanData.amount,
                    interest_rate: loanData.interestRate,
                    duration_months: loanData.duration,
                    monthly_repayment: loanData.monthlyRepayment,
                    total_repayable: loanData.totalRepayable,
                    purpose: loanData.purpose,
                    guarantor1: loanData.guarantor1,
                    guarantor2: loanData.guarantor2,
                    meeting_reference: loanData.meetingReference,
                    officer_id: loanData.officerId || 1,
                    approval_status: loanData.approvalStatus || 'Pending',
                    status: 'Active',
                    disbursement_date: new Date().toISOString().split('T')[0]
                }])
                .select()
                .single();

            if (error) throw error;

            // Update member active loan balance
            const { error: updateError } = await supabase
                .from('members')
                .update({
                    active_loan_balance: supabase.raw(`active_loan_balance + ${loanData.amount}`)
                })
                .eq('id', loanData.memberId);

            if (updateError) throw updateError;

            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Get loans for a member or all loans
     */
    async getLoans(memberId = null) {
        try {
            let query = supabase
                .from('loans')
                .select(`
                    *,
                    members:member_id (id, name, phone)
                `)
                .order('created_at', { ascending: false });

            if (memberId) {
                query = query.eq('member_id', memberId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
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
                    members:member_id (id, name, phone)
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
    /**
     * Approve or reject a loan (Legacy/Quick Mode)
     */
    async approveLoan(loanId, approvalData) {
        try {
            const { data, error } = await supabase
                .from('loans')
                .update({
                    approval_status: approvalData.status,
                    approved_by: approvalData.approvedBy,
                    approval_date: new Date().toISOString(),
                    approval_notes: approvalData.notes
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
    // LOAN APPLICATION WORKFLOW (OFFICIAL)
    // ========================================

    /**
     * Get Loan Applications with rich data
     */
    async getLoanApplications(filters = {}) {
        try {
            let query = supabase
                .from('loan_applications')
                .select(`
                    *,
                    member:members (id, name, phone, group_id, groups:group_id(name)),
                    guarantors:loan_guarantors (
                        guarantor_member_id,
                        guaranteed_amount,
                        status,
                        member:members(name, phone)
                    )
                `)
                .order('created_at', { ascending: false });

            if (filters.status && filters.status !== 'ALL') {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Submit a new Loan Application
     */
    async submitLoanApplication(appData) {
        try {
            // Generate Application Number (Simple format: APP-YYYYMM-XXXX)
            // Real implementation might use a DB sequence or function
            const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
            const randomSuffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
            const appNumber = `APP-${dateStr}-${randomSuffix}`;

            const { data, error } = await supabase
                .from('loan_applications')
                .insert([{
                    application_number: appNumber,
                    member_id: appData.memberId,
                    group_id: appData.groupId,
                    loan_type: appData.loanType,
                    amount_requested: appData.amount,
                    duration_months: appData.duration,
                    purpose: appData.purpose,
                    applicant_savings_snapshot: appData.savingsSnapshot || 0,
                    status: 'PENDING',
                    officer_id: appData.officerId
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
     * Add Guarantor to Application
     */
    async addGuarantor(guarantorData) {
        try {
            const { data, error } = await supabase
                .from('loan_guarantors')
                .insert([{
                    loan_application_id: guarantorData.applicationId,
                    guarantor_member_id: guarantorData.memberId,
                    guaranteed_amount: guarantorData.amount
                }])
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Update Application Status (Approval Flow)
     */
    async updateApplicationStatus(id, status, notes, reviewerId, role) {
        try {
            const updatePayload = { status };
            const timestamp = new Date().toISOString();

            if (status.includes('REJECTED')) {
                updatePayload.rejection_reason = notes;
            }

            if (role === 'Officer') {
                updatePayload.officer_notes = notes;
                updatePayload.officer_submitted_at = timestamp;
            } else if (role === 'Admin') {
                updatePayload.admin_id = reviewerId;
                updatePayload.admin_notes = notes;
                updatePayload.admin_reviewed_at = timestamp;
            }

            const { data, error } = await supabase
                .from('loan_applications')
                .update(updatePayload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Check Loan Eligibility (RPC)
     */
    async checkLoanEligibility(memberId) {
        try {
            const { data, error } = await supabase
                .rpc('calculate_loan_eligibility', { p_member_id: memberId });

            if (error) throw error;
            return data;
        } catch (error) {
            // Fallback for dev if RPC missing
            console.warn("RPC calculate_loan_eligibility failed, using mock fallback");
            return {
                max_eligible: 100000,
                multiplier: 3,
                total_savings: 0,
                outstanding_loans: 0
            };
        }
    },

    // ========================================
    // MEETING MANAGEMENT
    // ========================================

    /**
     * Get active meeting for a group
     */
    async getActiveMeeting(groupId) {
        try {
            const { data, error } = await supabase
                .from('meeting_sessions')
                .select('*')
                .eq('group_id', groupId)
                .eq('status', 'OPEN')
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
            return data || null;
        } catch (error) {
            handleSupabaseError(error);
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
                    members:member_id (id, name)
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

    /**
     * Get all groups
     */
    async getGroups() {
        try {
            const { data, error } = await supabase
                .from('groups')
                .select(`
                    *,
                    members:members(count)
                `)
                .order('name');

            if (error) throw error;
            return data;
        } catch (error) {
            handleSupabaseError(error);
        }
    },

    /**
     * Create a new group
     */
    async createGroup(groupData) {
        try {
            const { data, error } = await supabase
                .from('groups')
                .insert([{
                    name: groupData.name,
                    description: groupData.description,
                    status: groupData.status || 'Active'
                }])
                .select()
                .single();

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
                    name,
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

    /**
     * Generate Dividend Report
     * Calls the database RPC to calculate TRF and member balances
     */
    async generateDividendReport(groupId, year) {
        try {
            const { data, error } = await supabase
                .rpc('generate_dividend_report', {
                    p_group_id: groupId,
                    p_year: year
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Simulation Mock: RPC not deployed yet, returning fallback mock data.");
            // Handle error (likely RPC missing in dev) by returning null or throwing
            // For now, we allow the frontend to fallback to mock if this fails
            throw error;
        }
    }
};

export default api;
