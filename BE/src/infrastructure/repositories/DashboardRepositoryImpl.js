const DashboardRepository = require('../../domain/repositories/DashboardRepository');
const { query } = require('../database/sqlServer');

const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

// Loai hinh sua chua THAT (service_order_items.repair_category) - khac voi
// danh muc dich vu (service_categories) va khac ca LHSC (loai hang muc: cong/
// vat tu). Gia tri + nhan phai khop voi REPAIR_CATEGORY_OPTIONS trong
// RepairSettlementPage.jsx. 'OTHER' la bucket cho dong chua duoc gan loai hinh.
const REPAIR_CATEGORY_ORDER = ['ER', 'CB', 'EE', 'BP', 'PM', 'OTHER'];
const REPAIR_CATEGORY_LABELS = {
  ER: 'Sửa chữa động cơ',
  CB: 'Sửa chữa gầm',
  EE: 'Sửa chữa điện - điện tử',
  BP: 'Đồng sơn',
  PM: 'Bảo dưỡng định kỳ',
  OTHER: 'Khác',
};

function monthLabel(monthStart) {
  if (!monthStart) return '';
  const d = new Date(monthStart);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${mm}/${d.getFullYear()}`;
}

function monthKey(monthStart) {
  if (!monthStart) return null;
  const d = new Date(monthStart);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Dieu kien loc dung chung: chi nhanh (bat buoc) + khoang ngay + trang thai +
// danh muc dich vu (tuy chon) + advisorId (tuy chon - Co van dich vu chi xem
// duoc thong ke cua chinh minh, cac vai tro khac xem toan chi nhanh nen
// advisorId = null). categoryId = 'PARTS' nghia la hang muc phu tung (khong
// gan category_id vi phu tung khong thuoc service_categories).
function buildScopeParams({ branchId, advisorId, fromDate, toDate, status, categoryId }) {
  return {
    branchId,
    advisorId: advisorId || null,
    fromDate: fromDate || null,
    toDate: toDate || null,
    status: status || null,
    categoryId: categoryId || null,
  };
}

class DashboardRepositoryImpl extends DashboardRepository {
  async getOverview({ branchId, advisorId, fromDate, toDate, status, categoryId } = {}) {
    const params = buildScopeParams({ branchId, advisorId, fromDate, toDate, status, categoryId });

    const kpiResult = await query(
      `WITH filtered_orders AS (
         SELECT so.id, so.status, so.total
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
           AND  (
             @categoryId IS NULL
             OR (@categoryId = 'PARTS' AND EXISTS (
                   SELECT 1 FROM service_order_items soi
                   WHERE soi.service_order_id = so.id AND soi.lhsc = 'PT'
                 ))
             OR (@categoryId <> 'PARTS' AND EXISTS (
                   SELECT 1 FROM service_order_items soi
                   JOIN services s ON s.id = soi.service_id
                   WHERE soi.service_order_id = so.id AND s.category_id = TRY_CAST(@categoryId AS BIGINT)
                 ))
           )
       )
       SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'invoiced' THEN total ELSE 0 END) AS total_revenue,
         SUM(CASE WHEN status = 'invoiced' THEN 1 ELSE 0 END) AS invoiced_count,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
       FROM filtered_orders`,
      params
    );

    const trendResult = await query(
      `WITH filtered_orders AS (
         SELECT so.id, so.status, so.total, so.intake_date
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
           AND  (
             @categoryId IS NULL
             OR (@categoryId = 'PARTS' AND EXISTS (
                   SELECT 1 FROM service_order_items soi
                   WHERE soi.service_order_id = so.id AND soi.lhsc = 'PT'
                 ))
             OR (@categoryId <> 'PARTS' AND EXISTS (
                   SELECT 1 FROM service_order_items soi
                   JOIN services s ON s.id = soi.service_id
                   WHERE soi.service_order_id = so.id AND s.category_id = TRY_CAST(@categoryId AS BIGINT)
                 ))
           )
       )
       SELECT
         DATEFROMPARTS(YEAR(intake_date), MONTH(intake_date), 1) AS month_start,
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'invoiced' THEN total ELSE 0 END) AS total_revenue,
         status
       FROM filtered_orders
       GROUP BY DATEFROMPARTS(YEAR(intake_date), MONTH(intake_date), 1), status
       ORDER BY month_start ASC`,
      params
    );

    const statusResult = await query(
      `WITH filtered_orders AS (
         SELECT so.id, so.status
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
           AND  (
             @categoryId IS NULL
             OR (@categoryId = 'PARTS' AND EXISTS (
                   SELECT 1 FROM service_order_items soi
                   WHERE soi.service_order_id = so.id AND soi.lhsc = 'PT'
                 ))
             OR (@categoryId <> 'PARTS' AND EXISTS (
                   SELECT 1 FROM service_order_items soi
                   JOIN services s ON s.id = soi.service_id
                   WHERE soi.service_order_id = so.id AND s.category_id = TRY_CAST(@categoryId AS BIGINT)
                 ))
           )
       )
       SELECT status, COUNT(*) AS cnt
       FROM filtered_orders
       GROUP BY status`,
      params
    );

    // Loai hinh sua chua theo thang - de xem loai nao duoc dung nhieu nhat qua
    // tung thang. Khong loc theo categoryId (danh muc dich vu la 1 khai niem
    // khac, khong lien quan).
    const repairCategoryTrendResult = await query(
      `WITH date_status_orders AS (
         SELECT so.id, so.status, so.intake_date
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
       ),
       item_repair AS (
         SELECT
           dso.id AS order_id,
           DATEFROMPARTS(YEAR(dso.intake_date), MONTH(dso.intake_date), 1) AS month_start,
           CASE WHEN soi.repair_category IS NULL OR soi.repair_category = '' THEN 'OTHER' ELSE soi.repair_category END AS repair_category
         FROM   date_status_orders dso
         JOIN   service_order_items soi ON soi.service_order_id = dso.id
       ),
       month_category_orders AS (
         SELECT DISTINCT month_start, repair_category, order_id
         FROM   item_repair
       )
       SELECT month_start, repair_category, COUNT(*) AS order_count
       FROM   month_category_orders
       GROUP BY month_start, repair_category
       ORDER BY month_start ASC`,
      { branchId: params.branchId, advisorId: params.advisorId, fromDate: params.fromDate, toDate: params.toDate, status: params.status }
    );

    // Hieu suat tong theo loai hinh sua chua (khong loc theo categoryId, cung
    // ly do nhu tren) - dung cho bang "Hieu suat theo loai hinh sua chua".
    const repairCategoryOverallResult = await query(
      `WITH date_status_orders AS (
         SELECT so.id, so.status
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
       ),
       item_repair AS (
         SELECT
           dso.id AS order_id,
           dso.status AS order_status,
           CASE WHEN soi.repair_category IS NULL OR soi.repair_category = '' THEN 'OTHER' ELSE soi.repair_category END AS repair_category,
           soi.total AS item_total
         FROM   date_status_orders dso
         JOIN   service_order_items soi ON soi.service_order_id = dso.id
       ),
       category_revenue AS (
         SELECT repair_category,
                SUM(CASE WHEN order_status = 'invoiced' THEN item_total ELSE 0 END) AS revenue
         FROM   item_repair
         GROUP BY repair_category
       ),
       category_orders AS (
         SELECT DISTINCT repair_category, order_id, order_status
         FROM   item_repair
       ),
       category_order_stats AS (
         SELECT repair_category,
                COUNT(*) AS order_count,
                SUM(CASE WHEN order_status = 'invoiced' THEN 1 ELSE 0 END) AS invoiced_count,
                SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
         FROM   category_orders
         GROUP BY repair_category
       )
       SELECT
         cos.repair_category, cos.order_count,
         cos.invoiced_count, cos.cancelled_count,
         ISNULL(cr.revenue, 0) AS revenue
       FROM category_order_stats cos
       LEFT JOIN category_revenue cr ON cr.repair_category = cos.repair_category
       ORDER BY cos.order_count DESC`,
      { branchId: params.branchId, advisorId: params.advisorId, fromDate: params.fromDate, toDate: params.toDate, status: params.status }
    );

    const kpiRow = kpiResult.recordset[0] || {};
    const totalOrders = Number(kpiRow.total_orders || 0);
    const totalRevenue = Number(kpiRow.total_revenue || 0);
    const invoicedCount = Number(kpiRow.invoiced_count || 0);
    const cancelledCount = Number(kpiRow.cancelled_count || 0);
    const concludedCount = invoicedCount + cancelledCount;

    // Gom du lieu theo thang tu trendResult (moi dong la 1 thang + 1 status)
    const monthMap = new Map();
    for (const row of trendResult.recordset) {
      const key = monthKey(row.month_start);
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month: key,
          label: monthLabel(row.month_start),
          totalOrders: 0,
          totalRevenue: 0,
          byStatus: Object.fromEntries(STATUS_VALUES.map((s) => [s, 0])),
        });
      }
      const bucket = monthMap.get(key);
      bucket.totalOrders += Number(row.total_orders || 0);
      bucket.totalRevenue += Number(row.total_revenue || 0);
      if (STATUS_VALUES.includes(row.status)) {
        bucket.byStatus[row.status] += Number(row.total_orders || 0);
      }
    }
    const monthlyTrend = Array.from(monthMap.values()).sort((a, b) => (a.month > b.month ? 1 : -1));

    const statusBreakdown = STATUS_VALUES.map((s) => {
      const row = statusResult.recordset.find((r) => r.status === s);
      const count = row ? Number(row.cnt) : 0;
      return {
        status: s,
        count,
        percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 1000) / 10 : 0,
      };
    });

    // Gom du lieu loai hinh sua chua theo thang (moi dong la 1 thang + 1 loai
    // hinh). Dam bao co du cac thang da xuat hien o monthlyTrend (ke ca thang
    // khong co dong nao gan loai hinh) de 2 bieu do dung chung 1 truc thang.
    const repairMonthMap = new Map();
    for (const m of monthlyTrend) {
      repairMonthMap.set(m.month, {
        month: m.month,
        label: m.label,
        total: 0,
        byCategory: Object.fromEntries(REPAIR_CATEGORY_ORDER.map((c) => [c, 0])),
      });
    }
    for (const row of repairCategoryTrendResult.recordset) {
      const key = monthKey(row.month_start);
      if (!repairMonthMap.has(key)) {
        repairMonthMap.set(key, {
          month: key,
          label: monthLabel(row.month_start),
          total: 0,
          byCategory: Object.fromEntries(REPAIR_CATEGORY_ORDER.map((c) => [c, 0])),
        });
      }
      const bucket = repairMonthMap.get(key);
      const cat = REPAIR_CATEGORY_ORDER.includes(row.repair_category) ? row.repair_category : 'OTHER';
      const count = Number(row.order_count || 0);
      bucket.byCategory[cat] += count;
      bucket.total += count;
    }
    const repairCategoryMonthly = Array.from(repairMonthMap.values()).sort((a, b) => (a.month > b.month ? 1 : -1));

    const repairCategoryPerformance = repairCategoryOverallResult.recordset.map((row) => {
      const invoiced = Number(row.invoiced_count || 0);
      const cancelled = Number(row.cancelled_count || 0);
      const concluded = invoiced + cancelled;
      const revenue = Number(row.revenue || 0);
      const cat = REPAIR_CATEGORY_ORDER.includes(row.repair_category) ? row.repair_category : 'OTHER';
      return {
        repairCategory: cat,
        repairCategoryName: REPAIR_CATEGORY_LABELS[cat] || cat,
        orders: Number(row.order_count || 0),
        revenue,
        avgOrderValue: invoiced > 0 ? Math.round(revenue / invoiced) : 0,
        successRate: concluded > 0 ? Math.round((invoiced / concluded) * 1000) / 10 : null,
      };
    });

    return {
      kpis: {
        totalOrders,
        totalRevenue,
        avgOrderValue: invoicedCount > 0 ? Math.round(totalRevenue / invoicedCount) : 0,
        successRate: concludedCount > 0 ? Math.round((invoicedCount / concludedCount) * 1000) / 10 : null,
      },
      monthlyTrend,
      statusBreakdown,
      repairCategoryMonthly,
      repairCategoryPerformance,
    };
  }

  async listCategories() {
    const result = await query(`SELECT id, category_name FROM service_categories ORDER BY category_name ASC`);
    return result.recordset.map((row) => ({ id: String(row.id), name: row.category_name }));
  }
}

module.exports = DashboardRepositoryImpl;
