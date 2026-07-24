const { success } = require('../../utils/response');

class ServiceRequestController {
  constructor({ serviceRequestService }) {
    this.serviceRequestService = serviceRequestService;
  }

  // Public - khong auth.
  getPublicBranches = async (req, res, next) => {
    try {
      const branches = await this.serviceRequestService.getPublicBranches();
      return success(res, branches, 'Branches retrieved');
    } catch (err) {
      next(err);
    }
  };

  getPublicVehicleBrands = async (req, res, next) => {
    try {
      const brands = await this.serviceRequestService.getPublicVehicleBrands();
      return success(res, brands, 'Vehicle brands retrieved');
    } catch (err) {
      next(err);
    }
  };

  createPublic = async (req, res, next) => {
    try {
      const result = await this.serviceRequestService.createPublic(req.body);
      return success(res, result, 'Service request created', 201);
    } catch (err) {
      next(err);
    }
  };

  // Authenticated - CVDV.
  getAll = async (req, res, next) => {
    try {
      const items = await this.serviceRequestService.listByBranch(req.user.branchId, {
        status: req.query.status,
      });
      return success(res, items, 'Service requests retrieved');
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (req, res, next) => {
    try {
      const count = await this.serviceRequestService.getUnreadCount(req.user.branchId);
      return success(res, { count }, 'Unread count retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const item = await this.serviceRequestService.getById(req.params.id, req.user.branchId);
      return success(res, item, 'Service request retrieved');
    } catch (err) {
      next(err);
    }
  };

  accept = async (req, res, next) => {
    try {
      const item = await this.serviceRequestService.accept(req.params.id, {
        userId: req.user.userId,
        userName: req.user.name,
        branchId: req.user.branchId,
      });
      return success(res, item, 'Service request accepted');
    } catch (err) {
      next(err);
    }
  };

  createAppointment = async (req, res, next) => {
    try {
      const item = await this.serviceRequestService.createAppointment(req.params.id, req.body, {
        userId: req.user.userId,
        branchId: req.user.branchId,
      });
      return success(res, item, 'Appointment created', 201);
    } catch (err) {
      next(err);
    }
  };

  updateAppointment = async (req, res, next) => {
    try {
      const item = await this.serviceRequestService.updateAppointment(
        req.params.id,
        req.params.appointmentId,
        req.body,
        { userId: req.user.userId, branchId: req.user.branchId }
      );
      return success(res, item, 'Appointment updated');
    } catch (err) {
      next(err);
    }
  };

  cancelAppointment = async (req, res, next) => {
    try {
      const item = await this.serviceRequestService.cancelAppointment(
        req.params.id,
        req.params.appointmentId,
        req.body.reason,
        { userId: req.user.userId, branchId: req.user.branchId }
      );
      return success(res, item, 'Appointment cancelled');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ServiceRequestController;
