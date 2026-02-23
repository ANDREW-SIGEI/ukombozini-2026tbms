const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const reportService = require('../services/reportService');
const { logAudit } = require('../utils/logger');

/**
 * 📄 Statutory Statement Engine
 */

// GET /api/statements/member/:id/pdf - Official Member Statement
router.get('/member/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const pdfBuffer = await reportService.generateMemberStatement(id, startDate, endDate);

        res.setHeader('Content-disposition', `attachment; filename=Member_Statement_${id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        res.send(pdfBuffer);

        logAudit(`Member Statement Downloaded: ${id}`, 'report', { id, startDate, endDate }, req.user.id, req.user.name, req);
    } catch (error) {
        console.error('Member Statement Error:', error);
        res.status(500).json({ error: 'Failed to generate member statement' });
    }
});

// GET /api/statements/member/:id/excel - Official Member Excel Export
router.get('/member/:id/excel', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const excelBuffer = await reportService.generateMemberExcel(id, startDate, endDate);

        res.setHeader('Content-disposition', `attachment; filename=Member_Statement_${id}.xlsx`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        logAudit(`Member Excel Statement Downloaded: ${id}`, 'report', { id, startDate, endDate }, req.user.id, req.user.name, req);
    } catch (error) {
        console.error('Member Excel Error:', error);
        res.status(500).json({ error: 'Failed to generate excel statement' });
    }
});

// GET /api/statements/group/:id/pdf - Official Group Ledger Statement
router.get('/group/:id/pdf', authenticateToken, async (req, res) => {
    try {
        // Note: reportService might need a generateGroupStatement method 
        // For now, if missing, we use a placeholder or implement it
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        // Check if reportService has generateGroupStatement
        if (typeof reportService.generateGroupStatement !== 'function') {
            return res.status(501).json({ error: 'Group statement generation not yet implemented in reportService' });
        }

        const pdfBuffer = await reportService.generateGroupStatement(id, startDate, endDate);

        res.setHeader('Content-disposition', `attachment; filename=Group_Statement_${id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        res.send(pdfBuffer);

        logAudit(`Group Statement Downloaded: ${id}`, 'report', { id, startDate, endDate }, req.user.id, req.user.name, req);
    } catch (error) {
        console.error('Group Statement Error:', error);
        res.status(500).json({ error: 'Failed to generate group statement' });
    }
});

module.exports = router;
