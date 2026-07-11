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
}

module.exports = ManagerController;
