const express = require('express');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { success } = require('../../utils/response');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const { exportAuditLogsToExcel } = require('../../utils/excelExporter');

/**
 * Audit routes - chi danh cho user co role admin
 *
 * GET  /api/audit                       -- audit logs (filter + phan trang)
 * GET  /api/audit/export                -- xuat audit logs ra file Excel (.xlsx)
 * GET  /api/audit/users/:userId/logs    -- audit logs theo user
 * GET  /api/audit/login-sessions        -- lich su dang nhap (filter + phan trang)
 * GET  /api/audit/entity-definitions    -- danh sach entity definitions
 */
function buildAuditRouter() {
  const router = express.Router();
  const repository = AuditRepository;
  const auditService = new AuditService(repository);

  router.use(authenticate, requireAdmin);

  router.get('/', async (req, res, next) => {
    try {
      const data = await auditService.getAuditLogs({
        userName: req.query.userName,
        phone: req.query.phone,
        action: req.query.action,
        entityName: req.query.entityName,
        entityCode: req.query.entityCode,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        branchId: req.query.branchId,
        page: req.query.page,
        pageSize: req.query.pageSize,
      });
      return success(res, data, 'Lay danh sach audit log thanh cong');
    } catch (err) {
      return next(err);
    }
  });

  router.get('/export', async (req, res, next) => {
    try {
      const { items } = await auditService.exportAuditLogs({
        userName: req.query.userName,
        phone: req.query.phone,
        action: req.query.action,
        entityName: req.query.entityName,
        entityCode: req.query.entityCode,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        branchId: req.query.branchId,
      });
      const buffer = await exportAuditLogsToExcel(items, {
        userName: req.query.userName,
        phone: req.query.phone,
        action: req.query.action,
        entityName: req.query.entityName,
        entityCode: req.query.entityCode,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        branchId: req.query.branchId,
      });

      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const filename = `audit_logs_${yyyy}${mm}${dd}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      return next(err);
    }
  });

  router.get('/users/:userId/logs', async (req, res, next) => {
    try {
      const data = await auditService.getAuditLogsByUser(
        req.params.userId,
        req.query.limit
      );
      return success(res, data, 'Lay audit log theo user thanh cong');
    } catch (err) {
      return next(err);
    }
  });

  router.get('/login-sessions', async (req, res, next) => {
    try {
      const data = await auditService.getLoginSessions({
        userName: req.query.userName,
        phone: req.query.phone,
        actionType: req.query.actionType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        branchId: req.query.branchId,
        page: req.query.page,
        pageSize: req.query.pageSize,
      });
      return success(res, data, 'Lay danh sach login session thanh cong');
    } catch (err) {
      return next(err);
    }
  });

  router.get('/entity-definitions', async (req, res, next) => {
    try {
      const data = await auditService.getEntityDefinitions();
      return success(res, data, 'Lay danh sach entity definition thanh cong');
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = buildAuditRouter;