const { success } = require('../../utils/response');

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
      return success(res, data, 'Thêm nhân viên thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateEmployee(req, res, next) {
    try {
      const data = await this.managerService.updateEmployee(req.user.branchId, req.params.id, req.body);
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
      return success(res, data, 'Thêm dịch vụ thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateService(req, res, next) {
    try {
      const data = await this.managerService.updateService(req.user.branchId, req.params.id, req.body);
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
      return success(res, data, 'Thêm gói dịch vụ thành công', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateServicePackage(req, res, next) {
    try {
      const data = await this.managerService.updateServicePackage(req.user.branchId, req.params.id, req.body);
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
}

module.exports = ManagerController;
