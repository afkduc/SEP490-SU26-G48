const DashboardService = require('../../src/application/services/DashboardService');

function createService() {
  const dashboardRepository = {
    getOverview: jest.fn().mockResolvedValue({ kpis: { totalOrders: 0, totalRevenue: 0 } }),
    listCategories: jest.fn().mockResolvedValue([{ id: 1, name: 'Bảo dưỡng' }]),
    listRepairCategoryServices: jest.fn().mockResolvedValue([{ key: '173', code: 'SV-HN-001', orders: 2, quantity: 2 }]),
  };
  return { service: new DashboardService({ dashboardRepository }), dashboardRepository };
}

describe('DashboardService.listRepairCategoryServices - dich vu da dung theo loai hinh', () => {
  test('truyen dung pham vi loc xuong repository', async () => {
    const { service, dashboardRepository } = createService();
    const out = await service.listRepairCategoryServices({
      branchId: 1, advisorId: undefined, fromDate: '2026-09-01', toDate: '2026-09-30', status: 'invoiced', repairCategory: 'PM',
    });
    expect(out).toHaveLength(1);
    expect(dashboardRepository.listRepairCategoryServices).toHaveBeenCalledWith({
      branchId: 1, advisorId: undefined, fromDate: '2026-09-01', toDate: '2026-09-30', status: 'invoiced', repairCategory: 'PM',
    });
  });

  test('loai hinh khong hop le (OTHER / rong) -> 400', async () => {
    const { service } = createService();
    for (const repairCategory of ['OTHER', '', undefined]) {
      await expect(service.listRepairCategoryServices({ branchId: 1, repairCategory }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Loại hình sửa chữa không hợp lệ' });
    }
  });

  test('trang thai sai -> 400; thieu branchId -> 400', async () => {
    const { service } = createService();
    await expect(service.listRepairCategoryServices({ branchId: 1, repairCategory: 'CB', status: 'xyz' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'Trạng thái không hợp lệ' });
    await expect(service.listRepairCategoryServices({ repairCategory: 'CB' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
