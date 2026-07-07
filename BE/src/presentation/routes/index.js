const express = require('express');
const { success } = require('../../utils/response');
const buildUserRouter = require('./userRoutes');
const buildAuthRouter = require('./authRoutes');
const buildAdminRouter = require('./adminRoutes');
const buildProductRouter = require('./productRoutes');

const router = express.Router();

router.get('/', (req, res) => {
  return success(res, null, 'Welcome to AutoGara API');
});

router.use('/auth', buildAuthRouter());
router.use('/users', buildUserRouter());
router.use('/admin', buildAdminRouter());
router.use('/products', buildProductRouter());

module.exports = router;
