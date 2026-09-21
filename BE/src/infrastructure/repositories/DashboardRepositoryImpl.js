const DashboardRepository = require('../../domain/repositories/DashboardRepository');
const { query } = require('../database/sqlServer');

const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

// Loai hinh sua chua THAT (repair_order_items.repair_category) - khac voi
// danh muc dich vu (service_categories) va khac ca LHSC (loai hang muc: cong/
// vat tu). Dung 5 loai cua dich vu le (ER/CB/EE/BP/CS - xem ManagerService
// SERVICE_REPAIR_CATEGORY_VALUES) + PM dai dien cho GOI bao duong. Dong chua
// gan loai hinh (phu tung goi them le, khong di kem dich vu) KHONG tinh vao
// bieu do - no la vat tu, khong phai 1 loai hinh sua chua.
// Phai khop voi REPAIR_CATEGORY_ORDER/LABELS trong FE DashboardCharts.jsx.
const REPAIR_CATEGORY_ORDER = ['ER', 'CB', 'EE', 'BP', 'CS', 'PM'];
const REPAIR_CATEGORY_LABELS = {
  ER: 'Sửa chữa động cơ',
  CB: 'Sửa chữa gầm',
  EE: 'Sửa chữa điện - điện tử',
  BP: 'Đồng sơn',
  CS: 'Chăm sóc xe',
  PM: 'Bảo dưỡng định kỳ (gói)',
};
const REPAIR_CATEGORY_SQL_LIST = REPAIR_CATEGORY_ORDER.map((c) => `'${c}'`).join(',');

// Doanh thu theo loai hinh = tong cac DONG hang muc (soi.total, truoc VAT/giam
// gia) nhan he so total/subtotal cua phieu -> VAT va giam gia/mien phi cua phieu
// duoc phan bo theo ty le vao tung dong, nen cong cac loai hinh = dung "Tong
// doanh thu" (repair_orders.total, da gom VAT) tren KPI/bieu do. Khong co he so
// nay thi bang loai hinh luon thieu dung phan VAT (8%) so voi so tren cung.
// subtotal = 0 (phieu chua co hang muc) -> he so 1 de khong chia cho 0.
const ORDER_LINE_FACTOR_SQL = 'CASE WHEN ISNULL(so.subtotal, 0) = 0 THEN 1.0 ELSE CAST(so.total AS FLOAT) / so.subtotal END';

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
         FROM   repair_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
           AND  (
             @categoryId IS NULL
             OR (@categoryId = 'PARTS' AND EXISTS (
                   SELECT 1 FROM repair_order_items soi
                   WHERE soi.repair_order_id = so.id AND soi.lhsc = 'PT'
                 ))
             OR (@categoryId <> 'PARTS' AND EXISTS (
                   SELECT 1 FROM repair_order_items soi
                   JOIN services s ON s.id = soi.service_id
                   WHERE soi.repair_order_id = so.id AND s.category_id = TRY_CAST(@categoryId AS BIGINT)
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
         FROM   repair_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
           AND  (
             @categoryId IS NULL
             OR (@categoryId = 'PARTS' AND EXISTS (
                   SELECT 1 FROM repair_order_items soi
                   WHERE soi.repair_order_id = so.id AND soi.lhsc = 'PT'
                 ))
             OR (@categoryId <> 'PARTS' AND EXISTS (
                   SELECT 1 FROM repair_order_items soi
                   JOIN services s ON s.id = soi.service_id
                   WHERE soi.repair_order_id = so.id AND s.category_id = TRY_CAST(@categoryId AS BIGINT)
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
         FROM   repair_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
           AND  (
             @categoryId IS NULL
             OR (@categoryId = 'PARTS' AND EXISTS (
                   SELECT 1 FROM repair_order_items soi
                   WHERE soi.repair_order_id = so.id AND soi.lhsc = 'PT'
                 ))
             OR (@categoryId <> 'PARTS' AND EXISTS (
                   SELECT 1 FROM repair_order_items soi
                   JOIN services s ON s.id = soi.service_id
                   WHERE soi.repair_order_id = so.id AND s.category_id = TRY_CAST(@categoryId AS BIGINT)
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
         SELECT so.id, so.status, so.intake_date, ${ORDER_LINE_FACTOR_SQL} AS line_factor
         FROM   repair_orders so
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
           DATEFROMPARTS(YEAR(dso.intake_date), MONTH(dso.intake_date), 1) AS month_start,
           soi.repair_category,
           soi.total * dso.line_factor AS item_total
         FROM   date_status_orders dso
         JOIN   repair_order_items soi ON soi.repair_order_id = dso.id
         WHERE  soi.repair_category IN (${REPAIR_CATEGORY_SQL_LIST})
       ),
       month_category_orders AS (
         SELECT DISTINCT month_start, repair_category, order_id
         FROM   item_repair
       ),
       month_category_counts AS (
         SELECT month_start, repair_category, COUNT(*) AS order_count
         FROM   month_category_orders
         GROUP BY month_start, repair_category
       ),
       -- Doanh thu theo thang x loai hinh (chi phieu da xuat hoa don) - de bang
       -- "Hieu suat theo loai hinh" loc duoc theo tung thang ngay tren FE.
       month_category_revenue AS (
         SELECT month_start, repair_category,
                SUM(CASE WHEN order_status = 'invoiced' THEN item_total ELSE 0 END) AS revenue
         FROM   item_repair
         GROUP BY month_start, repair_category
       )
       SELECT c.month_start, c.repair_category, c.order_count, ISNULL(r.revenue, 0) AS revenue
       FROM   month_category_counts c
       LEFT JOIN month_category_revenue r
         ON r.month_start = c.month_start AND r.repair_category = c.repair_category
       ORDER BY c.month_start ASC`,
      { branchId: params.branchId, advisorId: params.advisorId, fromDate: params.fromDate, toDate: params.toDate, status: params.status }
    );

    // Hieu suat tong theo loai hinh sua chua (khong loc theo categoryId, cung
    // ly do nhu tren) - dung cho bang "Hieu suat theo loai hinh sua chua".
    const repairCategoryOverallResult = await query(
      `WITH date_status_orders AS (
         SELECT so.id, so.status, ${ORDER_LINE_FACTOR_SQL} AS line_factor
         FROM   repair_orders so
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
           soi.repair_category,
           soi.total * dso.line_factor AS item_total
         FROM   date_status_orders dso
         JOIN   repair_order_items soi ON soi.repair_order_id = dso.id
         WHERE  soi.repair_category IN (${REPAIR_CATEGORY_SQL_LIST})
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
    const emptyMonthBucket = (month, label) => ({
      month,
      label,
      total: 0,
      byCategory: Object.fromEntries(REPAIR_CATEGORY_ORDER.map((c) => [c, 0])),
      // doanh thu (phieu da xuat hoa don) theo loai hinh trong thang - bang
      // "Hieu suat theo loai hinh" loc theo thang dung cai nay
      byCategoryRevenue: Object.fromEntries(REPAIR_CATEGORY_ORDER.map((c) => [c, 0])),
    });
    const repairMonthMap = new Map();
    for (const m of monthlyTrend) {
      repairMonthMap.set(m.month, emptyMonthBucket(m.month, m.label));
    }
    for (const row of repairCategoryTrendResult.recordset) {
      const key = monthKey(row.month_start);
      if (!repairMonthMap.has(key)) {
        repairMonthMap.set(key, emptyMonthBucket(key, monthLabel(row.month_start)));
      }
      const bucket = repairMonthMap.get(key);
      const cat = row.repair_category;
      if (!REPAIR_CATEGORY_ORDER.includes(cat)) continue; // SQL da loc, phong ho
      const count = Number(row.order_count || 0);
      bucket.byCategory[cat] += count;
      bucket.byCategoryRevenue[cat] += Math.round(Number(row.revenue || 0));
      bucket.total += count;
    }
    const repairCategoryMonthly = Array.from(repairMonthMap.values()).sort((a, b) => (a.month > b.month ? 1 : -1));

    const repairCategoryPerformance = repairCategoryOverallResult.recordset.filter((row) => (
      REPAIR_CATEGORY_ORDER.includes(row.repair_category)
    )).map((row) => {
      const invoiced = Number(row.invoiced_count || 0);
      const cancelled = Number(row.cancelled_count || 0);
      const concluded = invoiced + cancelled;
      const revenue = Math.round(Number(row.revenue || 0));
      const cat = row.repair_category;
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

  // Bam vao 1 loai hinh o bang "Hieu suat theo loai hinh" -> dich vu nao da
  // dung + so phieu / so luong / doanh thu. Cung pham vi loc (chi nhanh, co
  // van, khoang ngay, trang thai) voi getOverview de so phieu khop bang.
  //
  // Dong trong repair_order_items:
  //   dich vu le      item_type='service', service_id co   -> gom theo service_id
  //   goi bao duong   item_type='service', service_id NULL, item_code 'PKG-...'
  //                   (dong header cua goi; cac hang muc con cua goi cung mang
  //                   PM nhung la checklist, khong liet ke)   -> gom theo item_code
  // Voi PM chi lay dong header goi; loai khac chi lay dich vu le.
  async listRepairCategoryServices({ branchId, advisorId, fromDate, toDate, status, repairCategory } = {}) {
    const params = { ...buildScopeParams({ branchId, advisorId, fromDate, toDate, status }), repairCategory };
    const isPackage = repairCategory === 'PM';
    const result = await query(
      `WITH scoped_orders AS (
         SELECT so.id, so.status
         FROM   repair_orders so
         WHERE  so.branch_id = @branchId
           AND  (@advisorId IS NULL OR so.advisor_id = @advisorId)
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
       ),
       items AS (
         SELECT
           ${isPackage ? 'soi.item_code' : 'CAST(soi.service_id AS NVARCHAR(20))'} AS item_key,
           soi.item_code, soi.item_description, so.id AS order_id, so.status AS order_status,
           soi.quantity, soi.total
         FROM   scoped_orders so
         JOIN   repair_order_items soi ON soi.repair_order_id = so.id
         WHERE  soi.repair_category = @repairCategory
           AND  soi.item_type = 'service'
           AND  ${isPackage ? 'soi.service_id IS NULL AND soi.product_id IS NULL' : 'soi.service_id IS NOT NULL'}
       )
       SELECT
         item_key,
         MAX(item_code) AS item_code,
         MAX(item_description) AS item_name,
         COUNT(DISTINCT order_id) AS order_count,
         SUM(quantity) AS quantity,
         SUM(CASE WHEN order_status = 'invoiced' THEN total ELSE 0 END) AS revenue
       FROM   items
       GROUP BY item_key
       ORDER BY order_count DESC, quantity DESC, item_code ASC`,
      params
    );
    return result.recordset.map((row) => ({
      key: String(row.item_key),
      code: row.item_code,
      name: row.item_name,
      kind: isPackage ? 'package' : 'service',
      orders: Number(row.order_count || 0),
      quantity: Number(row.quantity || 0),
      revenue: Number(row.revenue || 0),
    }));
  }
}

module.exports = DashboardRepositoryImpl;
