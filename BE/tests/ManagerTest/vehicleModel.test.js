const test = require('node:test');
const assert = require('node:assert/strict');
const { validateVehicleModel } = require('../../src/presentation/controllers/VehicleModelController');

const SEG = ['Sedan/Hatchback', 'SUV/Crossover', 'Pickup Truck'];
const good = () => ({ modelLine: 'CX-30', generationCode: 'DM', trimName: 'Luxury', segment: 'SUV/Crossover', displayName: 'Mazda CX-30 2.0 Luxury' });

test('vehicle model validation accepts a normal catalog row and normalizes it', () => {
  const { errors, data } = validateVehicleModel({ ...good(), modelLine: '  CX-30 ' }, SEG);
  assert.deepEqual(errors, []);
  assert.equal(data.modelLine, 'CX-30');
  // year_from/year_to khong con nhan tu form
  assert.deepEqual(Object.keys(data).sort(), ['displayName', 'generationCode', 'modelLine', 'segment', 'trimName']);
});

test('vehicle model validation rejects each bad field', () => {
  const only = (patch) => validateVehicleModel({ ...good(), ...patch }, SEG).errors;
  assert.match(only({ modelLine: '' })[0], /Dòng xe/);
  assert.match(only({ generationCode: '' })[0], /Mã đời xe/);
  assert.match(only({ trimName: '' })[0], /Phiên bản/);
  assert.match(only({ segment: 'Xe bus' })[0], /Phân khúc phải là/);
  assert.match(only({ displayName: '' })[0], /Tên hiển thị/);
  assert.match(only({ displayName: 'x'.repeat(301) })[0], /tối đa 300/);
});
