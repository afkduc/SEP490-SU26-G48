const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');

function serviceRequestCode(itemOrId) {
  const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
  return id != null ? `YCDV-${id}` : null;
}

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

  getPublicServicePackages = async (req, res, next) => {
    try {
      const packages = await this.serviceRequestService.getPublicServicePackages();
      return success(res, packages, 'Service packages retrieved');
    } catch (err) {
      next(err);
    }
  };

  getPublicServicePackageByCode = async (req, res, next) => {
    try {
      const pkg = await this.serviceRequestService.getPublicServicePackageByCode(req.params.code);
      return success(res, pkg, 'Service package retrieved');
    } catch (err) {
      next(err);
    }
  };

  createPublic = async (req, res, next) => {
    try {
      const result = await this.serviceRequestService.createPublic(req.body);
      await auditCrud.create(req, {
        tableName: 'service_requests',
        entityCode: serviceRequestCode(result),
        recordId: result?.id || null,
        entityName: 'Yêu cầu dịch vụ',
        data: req.body,
        description: `Khách tạo yêu cầu dịch vụ ${serviceRequestCode(result) || ''}`.trim(),
      });
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
      await auditCrud.update(req, {
        tableName: 'service_requests',
        entityCode: serviceRequestCode(item) || serviceRequestCode(req.params.id),
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Yêu cầu dịch vụ',
        newData: { status: item?.status || 'accepted' },
        description: `Cố vấn tiếp nhận yêu cầu dịch vụ của ${item?.fullName || 'khách'} - ${item?.phone || 'không có SĐT'}`,
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
      const appointmentAt = req.body?.appointmentAt || item?.appointment?.appointmentAt || null;
      await auditCrud.update(req, {
        tableName: 'service_requests',
        entityCode: serviceRequestCode(item) || serviceRequestCode(req.params.id),
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Yêu cầu dịch vụ',
        newData: { appointmentAt, appointmentId: item?.appointment?.id || null },
        description: `Cố vấn tạo lịch hẹn${appointmentAt ? ` lúc ${appointmentAt}` : ''} cho yêu cầu của ${item?.fullName || 'khách'} (${serviceRequestCode(item) || req.params.id})`,
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
      const appointmentAt = req.body?.appointmentAt || item?.appointment?.appointmentAt || null;
      await auditCrud.update(req, {
        tableName: 'service_requests',
        entityCode: serviceRequestCode(item) || serviceRequestCode(req.params.id),
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Yêu cầu dịch vụ',
        newData: { ...req.body, appointmentId: Number(req.params.appointmentId) || item?.appointment?.id || null },
        description: `Cố vấn cập nhật lịch hẹn${appointmentAt ? ` sang ${appointmentAt}` : ''} của yêu cầu ${serviceRequestCode(item) || req.params.id}`,
      });
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
      await auditCrud.update(req, {
        tableName: 'service_requests',
        entityCode: serviceRequestCode(item) || serviceRequestCode(req.params.id),
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Yêu cầu dịch vụ',
        newData: { cancelled: true, reason: req.body.reason, appointmentId: Number(req.params.appointmentId) || null },
        description: `Cố vấn hủy lịch hẹn của yêu cầu ${serviceRequestCode(item) || req.params.id}${req.body.reason ? ` — lý do: ${req.body.reason}` : ''}`,
      });
      return success(res, item, 'Appointment cancelled');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ServiceRequestController;
