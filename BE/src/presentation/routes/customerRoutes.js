const express = require('express');
const multer = require('multer');
const { makeCustomerService } = require('../../application/services');
const CustomerController = require('../controllers/CustomerController');
const { authenticate, authorize } = require('../../middlewares/auth');
const ApiError = require('../../utils/ApiError');

const EXCEL_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXCEL_MIMETYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, 'Chỉ chấp nhận file Excel (.xlsx)'));
    }
    cb(null, true);
  },
});

function makeCustomerController() {
  return new CustomerController({ customerService: makeCustomerService() });
}

function buildCustomerRouter() {
  const router = express.Router();
  const controller = makeCustomerController();

  router.use(authenticate);
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.post('/import', authorize('manager'), upload.single('file'), controller.importExcel);

  return router;
}

module.exports = buildCustomerRouter;
