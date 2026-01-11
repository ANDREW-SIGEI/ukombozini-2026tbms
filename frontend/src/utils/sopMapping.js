/**
 * SOPs Mapped to System Rules
 * Phase 5: SOPs Mapped Directly to System Rules
 * 
 * Maps company Standard Operating Procedures to role-based permissions
 */

import { ROLES, PERMISSIONS } from './permissions';

/**
 * Field Officer SOP - System-Enforced
 */
export const FIELD_OFFICER_SOP = {
    role: ROLES.FIELD_OFFICER,
    allowedActions: [
        PERMISSIONS.POST_CONTRIBUTION,
        PERMISSIONS.SUBMIT_CASH_REPORT,
    ],
    blockedActions: [
        PERMISSIONS.APPROVE_LOAN,
        PERMISSIONS.REVERSE_TRANSACTION,
        PERMISSIONS.EDIT_SYSTEM_RULES,
        PERMISSIONS.UNLOCK_CASH_REPORT,
        PERMISSIONS.VIEW_AUDIT_LOGS,
        PERMISSIONS.CREATE_USER,
    ],
    description: 'Field Officer can ONLY add members, post contributions, and submit daily cash reports. Cannot approve loans, reverse entries, or edit rules.',
};

/**
 * Supervisor SOP - System-Enforced
 */
export const SUPERVISOR_SOP = {
    role: ROLES.SUPERVISOR,
    allowedActions: [
        PERMISSIONS.APPROVE_LOAN,
        PERMISSIONS.APPROVE_CASH_REPORT,
        PERMISSIONS.SUBMIT_CASH_REPORT,
        PERMISSIONS.EXPORT_DATA,
        PERMISSIONS.VIEW_AUDIT_LOGS,
    ],
    blockedActions: [
        PERMISSIONS.EDIT_SYSTEM_RULES,
        PERMISSIONS.REVERSE_TRANSACTION,
        PERMISSIONS.UNLOCK_CASH_REPORT,
        PERMISSIONS.CREATE_USER,
        PERMISSIONS.BACKUP_RESTORE,
    ],
    description: 'Supervisor can approve loans, review reports, and export data. Cannot change system rules or unlock reports.',
};

/**
 * Admin SOP - System-Enforced
 */
export const ADMIN_SOP = {
    role: ROLES.ADMIN,
    allowedActions: [
        PERMISSIONS.CREATE_USER,
        PERMISSIONS.EDIT_USER,
        PERMISSIONS.DELETE_USER,
        PERMISSIONS.APPROVE_LOAN,
        PERMISSIONS.REVERSE_TRANSACTION,
        PERMISSIONS.EDIT_SYSTEM_RULES,
        PERMISSIONS.UNLOCK_CASH_REPORT,
        PERMISSIONS.VIEW_AUDIT_LOGS,
        PERMISSIONS.EXPORT_DATA,
    ],
    blockedActions: [
        PERMISSIONS.BACKUP_RESTORE,
    ],
    description: 'Admin can edit system rules, manage users, unlock reports, and view audit logs. Cannot perform backup/restore (Director only).',
};

/**
 * Director SOP - System-Enforced
 */
export const DIRECTOR_SOP = {
    role: ROLES.DIRECTOR,
    allowedActions: Object.values(PERMISSIONS), // All permissions
    blockedActions: [],
    description: 'Director has final authority - can perform all actions including backup/restore, view audits, and lock/unlock system-wide.',
};

/**
 * Get SOP for a specific role
 * @param {string} role - User role
 * @returns {Object} SOP object
 */
export const getSOPForRole = (role) => {
    switch (role) {
        case ROLES.DIRECTOR:
            return DIRECTOR_SOP;
        case ROLES.ADMIN:
            return ADMIN_SOP;
        case ROLES.SUPERVISOR:
            return SUPERVISOR_SOP;
        case ROLES.FIELD_OFFICER:
            return FIELD_OFFICER_SOP;
        default:
            return FIELD_OFFICER_SOP; // Default to most restrictive
    }
};

/**
 * Check if action is allowed for role based on SOP
 * @param {string} role - User role
 * @param {string} permission - Permission key
 * @returns {boolean}
 */
export const isActionAllowedBySOP = (role, permission) => {
    const sop = getSOPForRole(role);
    return sop.allowedActions.includes(permission);
};

/**
 * Check if action is blocked for role based on SOP
 * @param {string} role - User role
 * @param {string} permission - Permission key
 * @returns {boolean}
 */
export const isActionBlockedBySOP = (role, permission) => {
    const sop = getSOPForRole(role);
    return sop.blockedActions.includes(permission);
};

/**
 * Get all allowed actions for a role
 * @param {string} role - User role
 * @returns {Array} Array of permission keys
 */
export const getAllowedActions = (role) => {
    const sop = getSOPForRole(role);
    return sop.allowedActions;
};

/**
 * Get all blocked actions for a role
 * @param {string} role - User role
 * @returns {Array} Array of permission keys
 */
export const getBlockedActions = (role) => {
    const sop = getSOPForRole(role);
    return sop.blockedActions;
};

/**
 * Validate action against SOP
 * @param {Object} user - User object
 * @param {string} permission - Permission key
 * @returns {Object} { allowed: boolean, reason: string|null }
 */
export const validateSOP = (user, permission) => {
    if (!user || !user.role) {
        return {
            allowed: false,
            reason: 'User role not defined',
        };
    }

    if (isActionBlockedBySOP(user.role, permission)) {
        const sop = getSOPForRole(user.role);
        return {
            allowed: false,
            reason: `${sop.description} This action is blocked for ${user.role} role.`,
        };
    }

    if (!isActionAllowedBySOP(user.role, permission)) {
        const sop = getSOPForRole(user.role);
        return {
            allowed: false,
            reason: `${sop.description} This action is not permitted for ${user.role} role.`,
        };
    }

    return {
        allowed: true,
        reason: null,
    };
};

/**
 * Get SOP summary for display
 * @param {string} role - User role
 * @returns {Object} Summary object
 */
export const getSOPSummary = (role) => {
    const sop = getSOPForRole(role);
    return {
        role: sop.role,
        description: sop.description,
        allowedCount: sop.allowedActions.length,
        blockedCount: sop.blockedActions.length,
        allowedActions: sop.allowedActions,
        blockedActions: sop.blockedActions,
    };
};

