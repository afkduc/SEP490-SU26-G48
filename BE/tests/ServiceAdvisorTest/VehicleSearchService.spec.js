const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const VehicleSearchService = require('../../src/application/services/VehicleSearchService');

const row = (overrides = {}) => ({
  customer_id: 1, full_name: 'Trần Văn X', phone: '0912345678', address: null,
  tax_code: null, cccd: null, email: null, contact_name: null, contact_phone: null,
  vehicle_id: 7, license_plate: '30A-12345', vehicle_model_text: 'Mazda CX-5', frame_number: null,
  engine_number: null, current_km: 0, model_id: 2, purchase_date: null,
  warranty_end_date: null, warranty_km_limit: null,
  ...overrides,
});

const makeService = (rows) => new VehicleSearchService({
  findAllCustomerVehicleRows: async () => rows,
});

test('VehicleSearchService: go bien so THIEU dau "-" van tim ra xe da luu CO dau "-"', async () => {
  const service = makeService([row()]);
  const found = await service.search('30a12345');
  assert.equal(found.length, 1, 'go "30a12345" phai khop voi bien so da luu "30A-12345"');
  assert.equal(found[0].licensePlate, '30A-12345');
});

test('VehicleSearchService: go bien so CO dau "-" van tim ra nhu binh thuong', async () => {
  const service = makeService([row()]);
  const found = await service.search('30a-123');
  assert.equal(found.length, 1);
});

test('VehicleSearchService: khong khop bien so khac', async () => {
  const service = makeService([row()]);
  const found = await service.search('51k99999');
  assert.equal(found.length, 0);
});
