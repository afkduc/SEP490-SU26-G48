const express = require('express');
const CatalogSearchController = require('../controllers/CatalogSearchController');
const CatalogSearchService = require('../../application/services/CatalogSearchService');
const CatalogSearchRepositoryImpl = require('../../infrastructure/repositories/CatalogSearchRepositoryImpl');
const { authenticate } = require('../../middlewares/auth');

function buildCatalogRouter() {
  const router = express.Router();

  const repo = new CatalogSearchRepositoryImpl();
  const service = new CatalogSearchService(repo);
  const controller = new CatalogSearchController(service);

  router.get('/search', authenticate, controller.search);

  return router;
}

module.exports = buildCatalogRouter;
