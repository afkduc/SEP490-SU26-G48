const express = require('express');
const { makeServiceRequestService } = require('../../application/services');
const ServiceRequestController = require('../controllers/ServiceRequestController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function makeServiceRequestController() {
  return new ServiceRequestController({ serviceRequestService: makeServiceRequestService() });
}

function buildServiceRequestRouter() {
  const router = express.Router();
  const controller = makeServiceRequestController();

  router.use(authenticate, trackActivity);
  router.get('/', controller.getAll);
  router.get('/unread-count', controller.getUnreadCount);
  router.get('/:id', controller.getById);
  router.patch('/:id/accept', controller.accept);
  router.post('/:id/appointments', controller.createAppointment);
  router.put('/:id/appointments/:appointmentId', controller.updateAppointment);
  router.patch('/:id/appointments/:appointmentId/cancel', controller.cancelAppointment);

  return router;
}

module.exports = buildServiceRequestRouter;
