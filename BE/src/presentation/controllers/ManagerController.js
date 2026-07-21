const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class ManagerController {
  constructor(managerService) {
    this.managerService = managerService;
    this.notificationService = new NotificationService();
    this.getBranch = this.getBranch.bind(this);
    this.getRoles = this.getRoles.bind(this);
    this.getEmployees = this.getEmployees.bind(this);
    this.getEmployeeById = this.getEmployeeById.bind(this);
    this.createEmployee = this.createEmployee.bind(this);
    this.updateEmployee = this.updateEmployee.bind(this);
    this.getServiceCategories = this.getServiceCategories.bind(this);
    this.getProducts = this.getProducts.bind(this);
    this.getServices = this.getServices.bind(this);
    this.getServiceById = this.getServiceById.bind(this);
    this.createService = this.createService.bind(this);
    this.updateService = this.updateService.bind(this);
    this.getServicePackages = this.getServicePackages.bind(this);
    this.getServicePackageById = this.getServicePackageById.bind(this);
    this.createServicePackage = this.createServicePackage.bind(this);
    this.updateServicePackage = this.updateServicePackage.bind(this);
    this.getSettlementReports = this.getSettlementReports.bind(this);
    this.getSettlementReportById = this.getSettlementReportById.bind(this);
    this.getSpecialties = this.getSpecialties.bind(this);
    this.getTeamLeaderOptions = this.getTeamLeaderOptions.bind(this);
    this.getTechnicians = this.getTechnicians.bind(this);
    this.getTechnicianById = this.getTechnicianById.bind(this);
    this.createTechnician = this.createTechnician.bind(this);
    this.updateTechnician = this.updateTechnician.bind(this);
    this.getTeamLeaders = this.getTeamLeaders.bind(this);
    this.getTeamLeaderById = this.getTeamLeaderById.bind(this);
    this.createTeamLeader = this.createTeamLeader.bind(this);
    this.updateTeamLeader = this.updateTeamLeader.bind(this);
  }

  async getBranch(req, res, next) {
    try {
      const data = await this.managerService.getBranch(req.user.branchId);
      return success(res, data, 'Lấy thông tin chi nhánh thành công');
    } catch (err) {
      next(err);
    }
  }

  async getRoles(req, res, next) {
    try {
      const data = await this.managerService.listRoles();
      return success(res, data, 'Lấy danh sách vai trò thành công');
    } catch (err) {
      next(err);
    }
  }

  async getEmployees(req, res, next) {
    try {
      const data = await this.managerService.listEmployees(req.user.branchId, {
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
        role: req.query.role || 'all',
      });
      return success(res, data, 'Lấy danh sách nhân viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async getEmployeeById(req, res, next) {
    try {
      const data = await this.managerService.getEmployeeById(req.user.branchId, req.params.id);
      return success(res, data, 'Lấy chi tiết nhân viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async createEmployee(req, res, next) {
    try {
      const data = await this.managerService.createEmployee(req.user.branchId, req.body);
      await auditCrud.create(req, {
        tableName: 'users',
        entityCode: data?.employee_code || data?.user_code || null,
        recordId: data?.id || null,
        entityName: 'Nhân viên',
        data: req.body,
      });
      return success(res, data, 'Thêm nhân viên thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateEmployee(req, res, next) {
    try {
      const data = await this.managerService.updateEmployee(req.user.branchId, req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: data?.employee_code || data?.user_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Nhân viên',
        newData: req.body,
      });
      return success(res, data, 'Cập nhật nhân viên thành công');
    } catch (err) {
      next(err);
    }
  }

  async getServiceCategories(req, res, next) {
    try {
      const data = await this.managerService.listServiceCategories();
      return success(res, data, 'Lấy danh sách danh mục dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async getProducts(req, res, next) {
    try {
      const data = await this.managerService.listProducts(req.user.branchId);
      return success(res, data, 'Lấy danh sách phụ tùng thành công');
    } catch (err) {
      next(err);
    }
  }

  async getServices(req, res, next) {
    try {
      const data = await this.managerService.listServices(req.user.branchId, {
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
        categoryId: req.query.categoryId || 'all',
      });
      return success(res, data, 'Lấy danh sách dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async getServiceById(req, res, next) {
    try {
      const data = await this.managerService.getServiceById(req.user.branchId, req.params.id);
      return success(res, data, 'Lấy chi tiết dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async createService(req, res, next) {
    try {
      const data = await this.managerService.createService(req.user.branchId, req.body);
      await auditCrud.create(req, {
        tableName: 'services',
        entityCode: data?.service_code || data?.code || null,
        recordId: data?.id || null,
        entityName: 'Dịch vụ',
        data: req.body,
      });
      return success(res, data, 'Thêm dịch vụ thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateService(req, res, next) {
    try {
      const data = await this.managerService.updateService(req.user.branchId, req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'services',
        entityCode: data?.service_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Dịch vụ',
        newData: req.body,
      });
      return success(res, data, 'Cập nhật dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async getServicePackages(req, res, next) {
    try {
      const data = await this.managerService.listServicePackages(req.user.branchId, {
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách gói dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async getServicePackageById(req, res, next) {
    try {
      const data = await this.managerService.getServicePackageById(req.user.branchId, req.params.id);
      return success(res, data, 'Lấy chi tiết gói dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async createServicePackage(req, res, next) {
    try {
      const data = await this.managerService.createServicePackage(req.user.branchId, req.body);
      await auditCrud.create(req, {
        tableName: 'service_packages',
        entityCode: data?.package_code || data?.code || null,
        recordId: data?.id || null,
        entityName: 'Gói dịch vụ',
        data: req.body,
      });
      return success(res, data, 'Thêm gói dịch vụ thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateServicePackage(req, res, next) {
    try {
      const data = await this.managerService.updateServicePackage(req.user.branchId, req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'service_packages',
        entityCode: data?.package_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Gói dịch vụ',
        newData: req.body,
      });
      return success(res, data, 'Cập nhật gói dịch vụ thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSettlementReports(req, res, next) {
    try {
      const data = await this.managerService.listSettlementReports(req.user.branchId, {
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách phiếu quyết toán thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSettlementReportById(req, res, next) {
    try {
      const data = await this.managerService.getSettlementReportById(req.user.branchId, req.params.id);
      return success(res, data, 'Lấy chi tiết phiếu quyết toán thành công');
    } catch (err) {
      next(err);
    }
  }

  async getSpecialties(req, res, next) {
    try {
      const data = await this.managerService.listSpecialties();
      return success(res, data, 'Lấy danh sách chuyên môn thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTeamLeaderOptions(req, res, next) {
    try {
      const data = await this.managerService.listTeamLeaderOptions(req.user.branchId);
      return success(res, data, 'Lấy danh sách tổ trưởng thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTechnicians(req, res, next) {
    try {
      const data = await this.managerService.listTechnicians(req.user.branchId, {
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
        teamLeaderId: req.query.teamLeaderId || 'all',
      });
      return success(res, data, 'Lấy danh sách thợ máy thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTechnicianById(req, res, next) {
    try {
      const data = await this.managerService.getTechnicianById(req.user.branchId, req.params.id);
      return success(res, data, 'Lấy chi tiết thợ máy thành công');
    } catch (err) {
      next(err);
    }
  }

  async createTechnician(req, res, next) {
    try {
      const data = await this.managerService.createTechnician(req.user.branchId, req.body);
      await auditCrud.create(req, {
        tableName: 'users',
        entityCode: data?.employee_code || data?.user_code || null,
        recordId: data?.id || null,
        entityName: 'Thợ máy',
        data: req.body,
      });
      return success(res, data, 'Thêm thợ máy thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateTechnician(req, res, next) {
    try {
      const data = await this.managerService.updateTechnician(req.user.branchId, req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: data?.employee_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Thợ máy',
        newData: req.body,
      });
      return success(res, data, 'Cập nhật thợ máy thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTeamLeaders(req, res, next) {
    try {
      const data = await this.managerService.listTeamLeaders(req.user.branchId, {
        search: req.query.search || req.query.q || '',
        status: req.query.status || 'all',
      });
      return success(res, data, 'Lấy danh sách tổ trưởng thành công');
    } catch (err) {
      next(err);
    }
  }

  async getTeamLeaderById(req, res, next) {
    try {
      const data = await this.managerService.getTeamLeaderById(req.user.branchId, req.params.id);
      return success(res, data, 'Lấy chi tiết tổ trưởng thành công');
    } catch (err) {
      next(err);
    }
  }

  async createTeamLeader(req, res, next) {
    try {
      const data = await this.managerService.createTeamLeader(req.user.branchId, req.body);
      await auditCrud.create(req, {
        tableName: 'users',
        entityCode: data?.employee_code || data?.user_code || null,
        recordId: data?.id || null,
        entityName: 'Tổ trưởng',
        data: req.body,
      });
      return success(res, data, 'Thêm tổ trưởng thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateTeamLeader(req, res, next) {
    try {
      const data = await this.managerService.updateTeamLeader(req.user.branchId, req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: data?.employee_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Tổ trưởng',
        newData: req.body,
      });
      return success(res, data, 'Cập nhật tổ trưởng thành công');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ManagerController;
