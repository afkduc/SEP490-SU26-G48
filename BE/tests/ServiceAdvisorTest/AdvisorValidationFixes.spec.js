const { test } = require('@jest/globals');
const assert = require('node:assert/strict');
const ServiceRequestService = require('../../src/application/services/ServiceRequestService');
const MaintenanceReminderService = require('../../src/application/services/MaintenanceReminderService');
const CustomerService = require('../../src/application/services/CustomerService');

// 3 lo validate bat duoc o integration test dot 17/09 (issue #226, #191, #187).
// Moi test giu 2 chieu: gia tri sai bi chan 400, gia tri dung van di qua.

function srRepo() {
  return {
    findById: async () => ({ id: 10, nearestBranchId: 1, status: 'accepted', acceptedBy: 5, appointments: [] }),
    createAppointment: async () => {},
    updateAppointment: async () => {},
  };
}
const TUONG_LAI = '2099-01-01T09:00:00+07:00';

test('#226 ghi chu lich hen qua 500 ky tu bi chan, 500 ky tu thi qua', async () => {
  const service = new ServiceRequestService({ serviceRequestRepository: srRepo() });
  await assert.rejects(
    () => service.createAppointment(10, { appointmentAt: TUONG_LAI, notes: 'a'.repeat(501) }, { userId: 5, branchId: 1 }),
    (err) => err.statusCode === 400 && /500 ký tự/.test(err.message),
  );
  await assert.rejects(
    () => service.updateAppointment(10, 7, { appointmentAt: TUONG_LAI, notes: 'a'.repeat(501) }, { userId: 5, branchId: 1 }),
    (err) => err.statusCode === 400,
  );
  await service.createAppointment(10, { appointmentAt: TUONG_LAI, notes: 'a'.repeat(500) }, { userId: 5, branchId: 1 });
});

function reminderRepo() {
  const calls = [];
  return {
    calls,
    findById: async () => ({ id: 5, branchId: 1, isSent: true, isConfirmed: false }),
    markConfirmed: async (id, data) => { calls.push(data); return { id, branchId: 1, isConfirmed: true, ...data }; },
  };
}

test('#191 ngay xac nhan nhac bao duong o qua khu bi chan, hom nay va tuong lai thi qua', async () => {
  const repo = reminderRepo();
  const service = new MaintenanceReminderService({ maintenanceReminderRepository: repo });
  await assert.rejects(
    () => service.markConfirmed(5, { branchId: 1, confirmedDate: '2020-01-01' }),
    (err) => err.statusCode === 400 && /quá khứ/.test(err.message),
  );
  await assert.rejects(
    () => service.markConfirmed(5, { branchId: 1, confirmedDate: 'abc' }),
    (err) => err.statusCode === 400,
  );
  const homNay = new Date().toISOString().slice(0, 10);
  await service.markConfirmed(5, { branchId: 1, confirmedDate: homNay });
  await service.markConfirmed(5, { branchId: 1, confirmedDate: '2099-12-31' });
  await service.markConfirmed(5, { branchId: 1 }); // khong gui ngay -> mac dinh hom nay
  assert.equal(repo.calls.length, 3);
});

function customerRepo() {
  return {
    findByIdWithDetails: async () => ({ id: 1, fullName: 'Nguyễn Minh Tâm', phone: '0911222333' }),
    // dev them buoc chan doi sang SDT cua khach khac (xem CustomerService.update)
    findByPhone: async () => null,
    update: async (id, data) => ({ id, ...data }),
  };
}

test('#187 cap nhat khach hang: SDT va email phai dung dinh dang', async () => {
  const service = new CustomerService({ customerRepository: customerRepo() });
  await assert.rejects(
    () => service.update(1, { fullName: 'Nguyễn Minh Tâm', phone: 'abc' }),
    (err) => err.statusCode === 400 && /Số điện thoại/.test(err.message),
  );
  await assert.rejects(
    () => service.update(1, { fullName: 'Nguyễn Minh Tâm', phone: '0911222333', email: 'x' }),
    (err) => err.statusCode === 400 && /Email/.test(err.message),
  );
  const ok = await service.update(1, { fullName: 'Nguyễn Minh Tâm', phone: '0911222333', email: 'minhtam@gmail.com' });
  assert.equal(ok.phone, '0911222333');
  // email de trong van duoc (khach khong co email)
  await service.update(1, { fullName: 'Nguyễn Minh Tâm', phone: '0911 222 333', email: '' });
});
