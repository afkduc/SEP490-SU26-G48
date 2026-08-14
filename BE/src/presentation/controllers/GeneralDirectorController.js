const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class GeneralDirectorController {
  constructor(generalDirectorService) {
    this.generalDirectorService = generalDirectorService;
    this.notificationService = new NotificationService();
    this.getRevenueReports = this.getRevenueReports.bind(this);
    this.getSettlementReports = this.getSettlementReports.bind(this);
    this.getSettlementReportById = this.getSettlementReportById.bind(this);
    this.getBranches = this.getBranches.bind(this);
    this.getEmployees = this.getEmployees.bind(this);
    this.getEmployeeById = this.getEmployeeById.bind(this);
    this.getTechnicians = this.getTechnicians.bind(this);
    this.getTechnicianById = this.getTechnicianById.bind(this);
    this.getBranchManagers = this.getBranchManagers.bind(this);
    this.getBranchManagerById = this.getBranchManagerById.bind(this);
    this.createBranchManager = this.createBranchManager.bind(this);
    this.updateBranchManager = this.updateBranchManager.bind(this);
    this.deactivateBranch = this.deactivateBranch.bind(this);
    this.reactivateBranch = this.reactivateBranch.bind(this);
  }

  async getRevenueReports(req, res, next) {
    try {
      const data = await this.generalDirectorService.getRevenueReports({
        branchId: req.query.branchId || 'all',
        monthsBack: req.query.monthsBack,
      });
      return success(res, data, 'Lấy báo cáo doanh thu thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSettlementReports(req, res, next) {
    try {
      const data = await this.generalDirectorService.listSettlementReports({
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
        branchId: req.query.branchId || 'all',
      });
      return success(res, data, 'Lấy danh sách phiếu quyết toán thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSettlementReportById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getSettlementReportById(req.params.id);
      return success(res, data, 'Lấy chi tiết phiếu quyết toán thành công');
    } catch (err) {
      next(err);
    }
  }

  async getBranches(req, res, next) {
    try {
      const data = await this.generalDirectorService.listBranches();
      return success(res, data, 'Lấy danh sách chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async getEmployees(req, res, next) {
    try {
      const data = await this.generalDirectorService.listEmployees({
        search: req.query.search || req.query.q || '',
        branchId: req.query.branchId || 'all',
        status: req.query.status || 'all',
        role: req.query.role || 'all',
      });
      return success(res, data, 'Lấy danh sách nhân sự thành công');
    } catch (err) {
      next(err);
    }
  }

  async getEmployeeById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getEmployeeById(req.params.id);
      return success(res, data, 'Lấy chi tiết nhân sự thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTechnicians(req, res, next) {
    try {
      const data = await this.generalDirectorService.listTechnicians({
        search: req.query.search || req.query.q || '',
        branchId: req.query.branchId || 'all',
        skillGroup: req.query.skillGroup || 'all',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách kỹ thuật viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTechnicianById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getTechnicianById(req.params.id);
      return success(res, data, 'Lấy chi tiết kỹ thuật viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async getBranchManagers(req, res, next) {
    try {
      const data = await this.generalDirectorService.listBranchManagers({
        search: req.query.search || req.query.q || '',
        branchId: req.query.branchId || 'all',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async getBranchManagerById(req, res, next) {
    try {
      const data = await this.generalDirectorService.getBranchManagerById(req.params.id);
      return success(res, data, 'Lấy chi tiết giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async createBranchManager(req, res, next) {
    try {
      const data = await this.generalDirectorService.createBranchManager(req.body || {});
      const managerCode = data?.managerId || data?.email || null;
      await auditCrud.create(req, {
        tableName: 'users',
        entityCode: managerCode,
        recordId: data?.id || null,
        entityName: 'Giám đốc chi nhánh',
        data: {
          fullName: data?.fullName,
          email: data?.email,
          phone: data?.phone,
          status: data?.status,
          branchId: data?.branch?.id || req.body?.branchId,
          managerId: managerCode,
        },
        description: `Thêm giám đốc chi nhánh ${data?.fullName || managerCode || ''}`.trim(),
      });
      if (data?.branch?.id) {
        await auditCrud.update(req, {
          tableName: 'branches',
          entityCode: data.branch.code || `ID-${data.branch.id}`,
          recordId: data.branch.id,
          entityName: 'Chi nhánh',
          newData: {
            managerId: data.id,
            managerName: data.fullName,
            managerCode,
          },
          description: `Gán giám đốc chi nhánh ${data.fullName || managerCode} cho ${data.branch.name || data.branch.code}`,
        });
      }
      await this.notificationService.notifyAdmins('BRANCH_MANAGER_CREATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Giám đốc',
        targetName: data?.fullName || data?.email || '',
        targetCode: managerCode || '',
        userId: data?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[GeneralDirectorController] notifyAdmins:', e.message));
      return success(res, data, 'Thêm giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async updateBranchManager(req, res, next) {
    try {
      const data = await this.generalDirectorService.updateBranchManager(req.params.id, req.body || {});
      const managerCode = data?.managerId || data?.email || `ID-${req.params.id}`;
      const status = req.body?.status || data?.status;
      const auditDescription = status === 'inactive'
        ? `Khóa tài khoản giám đốc chi nhánh ${data?.fullName || managerCode}`
        : `Cập nhật giám đốc chi nhánh ${data?.fullName || managerCode}`;
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: managerCode,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Giám đốc chi nhánh',
        newData: {
          fullName: data?.fullName,
          email: data?.email,
          phone: data?.phone,
          status: data?.status,
          branchId: data?.branch?.id,
          managerId: managerCode,
        },
        description: auditDescription,
      });
      if (data?.branch?.id) {
        await auditCrud.update(req, {
          tableName: 'branches',
          entityCode: data.branch.code || `ID-${data.branch.id}`,
          recordId: data.branch.id,
          entityName: 'Chi nhánh',
          newData: {
            managerId: data.id,
            managerName: data.fullName,
            managerStatus: data.status,
          },
          description: `Cập nhật giám đốc phụ trách chi nhánh ${data.branch.name || data.branch.code}`,
        });
      }
      await this.notificationService.notifyAdmins('BRANCH_MANAGER_UPDATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Giám đốc',
        targetName: data?.fullName || data?.email || `ID-${req.params.id}`,
        targetCode: managerCode || '',
        userId: data?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[GeneralDirectorController] notifyAdmins:', e.message));
      return success(res, data, 'Cập nhật giám đốc chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async deactivateBranch(req, res, next) {
    try {
      const data = await this.generalDirectorService.deactivateBranch(req.params.id);
      await auditCrud.update(req, {
        tableName: 'branches',
        entityCode: data?.branchCode || data?.branch_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Chi nhánh',
        newData: { isActive: false },
        description: `Vô hiệu hóa chi nhánh ${data?.branchCode || data?.branchName || req.params.id}`,
      });
      return success(res, data, 'Ngưng hoạt động chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async reactivateBranch(req, res, next) {
    try {
      const data = await this.generalDirectorService.reactivateBranch(req.params.id);
      await auditCrud.update(req, {
        tableName: 'branches',
        entityCode: data?.branchCode || data?.branch_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Chi nhánh',
        newData: { isActive: true },
        description: `Kích hoạt lại chi nhánh ${data?.branchCode || data?.branchName || req.params.id}`,
      });
      return success(res, data, 'Kích hoạt lại chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = GeneralDirectorController;