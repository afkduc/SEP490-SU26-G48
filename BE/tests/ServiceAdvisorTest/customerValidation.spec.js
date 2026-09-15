const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const { getCustomerFieldErrors } = require('../../src/application/services/customerValidation');
const CustomerService = require('../../src/application/services/CustomerService');

const good = () => ({
  fullName: 'Nguyễn Văn A', phone: '0912111333', cccd: '012345678901',
  dateOfBirth: '1990-05-20', email: 'a@gmail.com', address: '45 Kim Mã, Hà Nội',
});

test('customer validation accepts a normal record', () => {
  assert.deepEqual(getCustomerFieldErrors(good()), []);
});

test('customer validation rejects the junk record that slipped in before (ten "â", CCCD "12", sinh 1852, email rac)', () => {
  const errors = getCustomerFieldErrors({
    fullName: 'â', phone: '0912111333', cccd: '12', dateOfBirth: '1852-06-09', email: 'te. st',
  });
  assert.ok(errors.some((e) => /ít nhất 2 ký tự/.test(e)), 'ten 1 ky tu phai bi chan');
  assert.ok(errors.some((e) => /CCCD/.test(e)), 'CCCD 2 so phai bi chan');
  assert.ok(errors.some((e) => /120 tuổi/.test(e)), 'sinh nam 1852 phai bi chan');
  assert.ok(errors.some((e) => /Email không hợp lệ/.test(e)), 'email rac phai bi chan');
});

test('customer validation: each rule individually', () => {
  const only = (patch) => getCustomerFieldErrors({ ...good(), ...patch });
  assert.match(only({ fullName: '' })[0], /không được để trống/);
  assert.match(only({ fullName: 'Nguyen 123' })[0], /chỉ gồm chữ cái/);
  assert.match(only({ phone: '12345' })[0], /Số điện thoại không hợp lệ/);
  assert.match(only({ cccd: '123456789' })[0] || '', /^$/, 'CMND 9 so hop le');
  assert.match(only({ dateOfBirth: '2999-01-01' })[0], /tương lai/);
  assert.match(only({ dateOfBirth: 'abc' })[0], /không đúng định dạng/);
  assert.match(only({ email: 'a@mail.v' })[0], /Email không hợp lệ/);
  assert.match(only({ address: 'x'.repeat(256) })[0], /Địa chỉ tối đa 255/);
  assert.match(only({ taxCode: '123' })[0], /Mã số thuế/);
  assert.deepEqual(only({ taxCode: '0123456789-001' }), []);
  assert.match(only({ contactPhone: '999' })[0], /SĐT người liên hệ/);
  // Truong tuy chon de trong thi khong loi
  assert.deepEqual(only({ cccd: '', email: null, address: undefined, dateOfBirth: '' }), []);
});

test('CustomerService.update rejects bad fields with 400 and blocks phone already used by another customer', async () => {
  const repo = {
    findByIdWithDetails: async (id) => ({ id, fullName: 'Cu' }),
    findByPhone: async (phone) => (phone === '0912111333' ? { id: 99, fullName: 'Đặng Văn Long', customerCode: 'KH-2026-0008' } : null),
    update: async (id, data) => ({ id, ...data }),
  };
  const service = new CustomerService({ customerRepository: repo });

  await assert.rejects(
    () => service.update(5, { fullName: 'â', phone: '0912111333' }),
    (err) => err.statusCode === 400 && /ít nhất 2 ký tự/.test(err.message),
  );
  await assert.rejects(
    () => service.update(5, { ...good(), phone: '0912111333' }),
    (err) => err.statusCode === 409 && /đã thuộc khách hàng "Đặng Văn Long"/.test(err.message),
  );
  // Cung SDT nhung la chinh khach do thi cho qua
  const updated = await service.update(99, { ...good(), phone: '0912111333' });
  assert.equal(updated.phone, '0912111333');
  // Ten duoc chuan hoa khoang trang
  const norm = await service.update(5, { ...good(), phone: '0999888777', fullName: '  Trần   Văn  B ' });
  assert.equal(norm.fullName, 'Trần Văn B');
});

const { getVehicleFieldErrors } = require('../../src/application/services/customerValidation');

test('vehicle validation: plate format, model required, VIN/engine, year, km', () => {
  const ok = { licensePlate: '30a-123.45', modelId: 2, frameNumber: 'rn2k25326nm100130', engineNumber: 'PY31308930', manufactureYear: 2022, color: 'Trắng', currentKm: 15200 };
  assert.deepEqual(getVehicleFieldErrors(ok), []);
  assert.deepEqual(getVehicleFieldErrors({ licensePlate: '30A-02465', modelId: 1 }), [], 'bien 5 so, cac truong khac trong');
  const only = (patch) => getVehicleFieldErrors({ ...ok, ...patch });
  assert.match(only({ licensePlate: '' })[0], /không được để trống/);
  assert.match(only({ licensePlate: 'ABC' })[0], /không đúng định dạng/);
  assert.match(only({ modelId: null })[0], /chọn dòng xe/);
  assert.match(only({ frameNumber: 'AB 12' })[0], /Số khung chỉ gồm chữ và số/);
  assert.match(only({ manufactureYear: 1950 })[0], /Năm sản xuất/);
  assert.match(only({ manufactureYear: new Date().getFullYear() + 5 })[0], /Năm sản xuất/);
  assert.match(only({ currentKm: -1 })[0], /không âm/);
  assert.match(only({ currentKm: 5000000 })[0], /vượt quá/);
  assert.match(only({ currentKm: 1.5 })[0], /số nguyên/);
});

test('CustomerService.addVehicle normalizes fields and rejects bad input / unknown customer', async () => {
  const calls = [];
  const repo = {
    findByIdWithDetails: async (id) => (String(id) === '7' ? { id: 7 } : null),
    addVehicle: async (customerId, data) => { calls.push([customerId, data]); return { id: 99, licensePlate: data.licensePlate }; },
  };
  const service = new CustomerService({ customerRepository: repo });

  await assert.rejects(() => service.addVehicle(7, { licensePlate: 'xx', modelId: 1 }), (e) => e.statusCode === 400);
  await assert.rejects(() => service.addVehicle(8, { licensePlate: '30A-123.45', modelId: 1 }), (e) => e.statusCode === 404);

  const v = await service.addVehicle('7', { licensePlate: ' 30a-123.45 ', modelId: '2', frameNumber: 'abc123', manufactureYear: '', currentKm: '' });
  assert.equal(v.id, 99);
  assert.deepEqual(calls[0], [7, {
    licensePlate: '30A-123.45', modelId: 2, frameNumber: 'ABC123', engineNumber: null,
    manufactureYear: null, color: null, currentKm: 0,
  }]);
});
