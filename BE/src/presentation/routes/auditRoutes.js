const express = require('express');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { requireScreen } = require('../../middlewares/permission');
const { trackActivity } = require('../../middlewares');
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

  router.use(authenticate, requireAdmin, requireScreen('audit_logs'), trackActivity);

  /**
   * GET /api/audit
   * Filter params:
   * - keyword: tim kiem tren user_name, description, entity_name, entity_code, table_name, request_url
   * - userName: ten nguoi dung
   * - phone: so dien thoai
   * - action: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
   * - tableName: ten bang du lieu
   * - entityName: ten doi tuong
   * - entityCode: ma doi tuong
   * - ipAddress: dia chi IP
   * - requestMethod: GET, POST, PUT, DELETE
   * - responseStatus: 2xx, 4xx, 5xx, hoac ma cu the
   * - branchId: chi nhanh
   * - startDate, endDate: khoang ngay
   * - page, pageSize: phan trang
   */
  router.get('/', async (req, res, next) => {
    try {
      const data = await auditService.getAuditLogs({
        keyword: req.query.keyword,
        userName: req.query.userName,
        phone: req.query.phone,
        action: req.query.action,
        tableName: req.query.tableName,
        entityName: req.query.entityName,
        entityCode: req.query.entityCode,
        ipAddress: req.query.ipAddress,
        requestMethod: req.query.requestMethod,
        responseStatus: req.query.responseStatus,
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

  /**
   * GET /api/audit/export
   * Xuat audit logs ra Excel theo filter hien tai
   */
  router.get('/export', async (req, res, next) => {
    try {
      const { items } = await auditService.exportAuditLogs({
        keyword: req.query.keyword,
        userName: req.query.userName,
        phone: req.query.phone,
        action: req.query.action,
        tableName: req.query.tableName,
        entityName: req.query.entityName,
        entityCode: req.query.entityCode,
        ipAddress: req.query.ipAddress,
        requestMethod: req.query.requestMethod,
        responseStatus: req.query.responseStatus,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        branchId: req.query.branchId,
      });
      const buffer = await exportAuditLogsToExcel(items, {
        keyword: req.query.keyword,
        userName: req.query.userName,
        phone: req.query.phone,
        action: req.query.action,
        tableName: req.query.tableName,
        entityName: req.query.entityName,
        entityCode: req.query.entityCode,
        ipAddress: req.query.ipAddress,
        requestMethod: req.query.requestMethod,
        responseStatus: req.query.responseStatus,
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

  // IMPORTANT: Dinh tuyen /login-sessions VA /entity-definitions TRUOC /:id
  // vi Express match theo thu tu, neu dat /:id truoc thi login-sessions se bi bat boi /:id
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

  /**
   * GET /api/audit/:id
   * Lay chi tiet mot audit log
   * PHAI DAT CUOI CUNG vi no la wildcard route
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const log = await auditService.getAuditLogById(req.params.id);
      return success(res, log, 'Lay chi tiet audit log thanh cong');
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = buildAuditRouter;
