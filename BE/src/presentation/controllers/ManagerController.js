const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');

class ManagerController {
  constructor(managerService) {
    this.managerService = managerService;
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
    this.setEmployeeTeamMembers = this.setEmployeeTeamMembers.bind(this);
    this.setEmployeeBays = this.setEmployeeBays.bind(this);
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
        entityCode: data?.employeeId || data?.email || null,
        recordId: data?.id || null,
        entityName: 'Nhân viên chi nhánh',
        data: req.body,
        description: `Thêm nhân viên ${data?.fullName || data?.employeeId || ''}`.trim(),
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
        entityCode: data?.employeeId || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Nhân viên chi nhánh',
        newData: req.body,
        description: `Cập nhật nhân viên ${data?.fullName || data?.employeeId || req.params.id}`,
      });
      return success(res, data, 'Cập nhật nhân viên thành công');
    } catch (err) {
      next(err);
    }
  }

  // To truong (isTeamLeaderRole) - dong bo danh sach tho may minh quan ly
  // (users.team_leader_id), goi tu khoi "Thanh vien doi" tren man Chinh sua
  // nhan vien - xem EmployeeFormPage.jsx.
  async setEmployeeTeamMembers(req, res, next) {
    try {
      const data = await this.managerService.setTeamMembers(req.user.branchId, req.params.id, req.body.memberIds || []);
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: `NV-ID-${req.params.id}`,
        recordId: Number(req.params.id) || null,
        entityName: 'Thành viên đội',
        newData: { memberIds: req.body.memberIds || [] },
        description: `Cập nhật thành viên đội của tổ trưởng #${req.params.id}`,
      });
      return success(res, data, 'Cập nhật thành viên đội thành công');
    } catch (err) {
      next(err);
    }
  }

  // To truong - dong bo danh sach so khoang xe minh phu trach (bang moi
  // vehicle_bays) - goi tu khoi "Khoang xe phu trach".
  async setEmployeeBays(req, res, next) {
    try {
      const data = await this.managerService.setBayNumbers(req.user.branchId, req.params.id, req.body.bayNumbers || []);
      await auditCrud.update(req, {
        tableName: 'vehicle_bays',
        entityCode: `NV-ID-${req.params.id}`,
        recordId: Number(req.params.id) || null,
        entityName: 'Khoang xe phụ trách',
        newData: { bayNumbers: req.body.bayNumbers || [] },
        description: `Cập nhật khoang xe phụ trách của tổ trưởng #${req.params.id}`,
      });
      return success(res, data, 'Cập nhật khoang xe phụ trách thành công');
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
        entityCode: data?.code || null,
        recordId: data?.id || null,
        entityName: 'Dịch vụ',
        data: req.body,
        description: `Thêm dịch vụ ${data?.code || data?.name || ''}`.trim(),
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
        entityCode: data?.code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Dịch vụ',
        newData: req.body,
        description: `Cập nhật dịch vụ ${data?.code || req.params.id}`,
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
        entityCode: data?.code || null,
        recordId: data?.id || null,
        entityName: 'Gói dịch vụ',
        data: req.body,
        description: `Thêm gói dịch vụ ${data?.code || data?.name || ''}`.trim(),
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
        entityCode: data?.code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Gói dịch vụ',
        newData: req.body,
        description: `Cập nhật gói dịch vụ ${data?.code || req.params.id}`,
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
        entityCode: data?.employeeId || data?.email || null,
        recordId: data?.id || null,
        entityName: 'Thợ máy',
        data: req.body,
        description: `Thêm thợ máy ${data?.fullName || data?.employeeId || ''}`.trim(),
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
        entityCode: data?.employeeId || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Thợ máy',
        newData: req.body,
        description: `Cập nhật thợ máy ${data?.fullName || data?.employeeId || req.params.id}`,
      });
      return success(res, data, 'Cập nhật thợ máy thành công');
    } catch (err) {
      next(err);
    }
  }

}

module.exports = ManagerController;
