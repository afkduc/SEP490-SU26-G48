const UserService = require('./UserService');
const ProductService = require('./ProductService');
const RepairSettlementService = require('./RepairSettlementService');
const RepairOrderService = require('./RepairOrderService');
const InventoryService = require('./InventoryService');
const ImportRequestService = require('./ImportRequestService');
const ExportRequestService = require('./ExportRequestService');
const CustomerService = require('./CustomerService');
const DashboardService = require('./DashboardService');
const MaintenanceReminderService = require('./MaintenanceReminderService');
const {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeRepairOrderRepository,
  makeInventoryRepository,
  makeImportRequestRepository,
  makeExportRequestRepository,
  makeCustomerRepository,
  makeDashboardRepository,
  makeMaintenanceReminderRepository,
} = require('../../infrastructure/repositories');

function makeUserService() {
  return new UserService({ userRepository: makeUserRepository() });
}

function makeProductService() {
  return new ProductService({ productRepository: makeProductRepository() });
}

function makeRepairSettlementService() {
  return new RepairSettlementService({ repairSettlementRepository: makeRepairSettlementRepository() });
}

function makeRepairOrderService() {
  return new RepairOrderService({ repairOrderRepository: makeRepairOrderRepository() });
}

function makeInventoryService() {
  return new InventoryService({ inventoryRepository: makeInventoryRepository() });
}

function makeImportRequestService() {
  return new ImportRequestService({
    importRequestRepository: makeImportRequestRepository(),
  });
}
function makeExportRequestService() {
  return new ExportRequestService({
    exportRequestRepository: makeExportRequestRepository(),
  });
}
function makeCustomerService() {
  return new CustomerService({ customerRepository: makeCustomerRepository() });
}

function makeDashboardService() {
  return new DashboardService({ dashboardRepository: makeDashboardRepository() });
}

function makeMaintenanceReminderService() {
  return new MaintenanceReminderService({ maintenanceReminderRepository: makeMaintenanceReminderRepository() });
}

module.exports = {
  UserService,
  ProductService,
  RepairSettlementService,
  RepairOrderService,
  InventoryService,
  ImportRequestService,
  ExportRequestService,
  CustomerService,
  DashboardService,
  MaintenanceReminderService,
  makeUserService,
  makeProductService,
  makeRepairSettlementService,
  makeRepairOrderService,
  makeInventoryService,
  makeImportRequestService,
  makeExportRequestService,
  makeCustomerService,
  makeDashboardService,
  makeMaintenanceReminderService,
};
