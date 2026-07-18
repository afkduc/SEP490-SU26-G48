const UserService = require('./UserService');
const ProductService = require('./ProductService');
const RepairSettlementService = require('./RepairSettlementService');
const RepairOrderService = require('./RepairOrderService');
const InventoryService = require('./InventoryService');
const ImportRequestService = require('./ImportRequestService');
const CustomerService = require('./CustomerService');
const DashboardService = require('./DashboardService');
const MaintenanceReminderService = require('./MaintenanceReminderService');
const PermissionService = require('./PermissionService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeRepairOrderRepository,
  makeInventoryRepository,
  makeImportRequestRepository,
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
function makeCustomerService() {
  return new CustomerService({ customerRepository: makeCustomerRepository() });
}

function makeDashboardService() {
  return new DashboardService({ dashboardRepository: makeDashboardRepository() });
}

function makeMaintenanceReminderService() {
  return new MaintenanceReminderService({ maintenanceReminderRepository: makeMaintenanceReminderRepository() });
}

function makePermissionService() {
  return new PermissionService({ roleRepository: new RoleRepositoryImpl() });
}

module.exports = {
  UserService,
  ProductService,
  RepairSettlementService,
  RepairOrderService,
  InventoryService,
  ImportRequestService,
  CustomerService,
  DashboardService,
  MaintenanceReminderService,
  PermissionService,
  makeUserService,
  makeProductService,
  makeRepairSettlementService,
  makeRepairOrderService,
  makeInventoryService,
  makeImportRequestService,
  makeCustomerService,
  makeDashboardService,
  makeMaintenanceReminderService,
  makePermissionService,
};
