const DashboardRepository = require('../../domain/repositories/DashboardRepository');
const { query } = require('../database/sqlServer');

const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

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
// danh muc dich vu (tuy chon). categoryId = 'PARTS' nghia la hang muc phu tung
// (khong gan category_id vi phu tung khong thuoc service_categories).
function buildScopeParams({ branchId, fromDate, toDate, status, categoryId }) {
  return {
    branchId,
    fromDate: fromDate || null,
    toDate: toDate || null,
    status: status || null,
    categoryId: categoryId || null,
  };
}

class DashboardRepositoryImpl extends DashboardRepository {
  async getOverview({ branchId, fromDate, toDate, status, categoryId } = {}) {
    const params = buildScopeParams({ branchId, fromDate, toDate, status, categoryId });

    const kpiResult = await query(
      `WITH filtered_orders AS (
         SELECT so.id, so.status, so.total
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
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

    // Category performance khong loc theo categoryId (de con so sanh giua cac
    // danh muc voi nhau) - chi loc theo khoang ngay + trang thai.
    const categoryResult = await query(
      `WITH date_status_orders AS (
         SELECT so.id, so.status
         FROM   service_orders so
         WHERE  so.branch_id = @branchId
           AND  (@fromDate IS NULL OR so.intake_date >= @fromDate)
           AND  (@toDate IS NULL OR so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE)))
           AND  (@status IS NULL OR so.status = @status)
       ),
       item_categories AS (
         SELECT
           dso.id AS order_id,
           dso.status AS order_status,
           CASE WHEN soi.lhsc = 'PT' THEN 'PARTS' ELSE CAST(ISNULL(s.category_id, -1) AS NVARCHAR(20)) END AS category_key,
           CASE WHEN soi.lhsc = 'PT' THEN N'Phụ tùng' ELSE ISNULL(sc.category_name, N'Khác') END AS category_name,
           soi.total AS item_total
         FROM   date_status_orders dso
         JOIN   service_order_items soi ON soi.service_order_id = dso.id
         LEFT JOIN services s ON s.id = soi.service_id
         LEFT JOIN service_categories sc ON sc.id = s.category_id
       ),
       category_revenue AS (
         SELECT category_key, category_name,
                SUM(CASE WHEN order_status = 'invoiced' THEN item_total ELSE 0 END) AS revenue
         FROM   item_categories
         GROUP BY category_key, category_name
       ),
       category_orders AS (
         SELECT DISTINCT category_key, category_name, order_id, order_status
         FROM   item_categories
       ),
       category_order_stats AS (
         SELECT category_key, category_name,
                COUNT(*) AS order_count,
                SUM(CASE WHEN order_status = 'invoiced' THEN 1 ELSE 0 END) AS invoiced_count,
                SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
         FROM   category_orders
         GROUP BY category_key, category_name
       )
       SELECT
         cos.category_key, cos.category_name, cos.order_count,
         cos.invoiced_count, cos.cancelled_count,
         ISNULL(cr.revenue, 0) AS revenue
       FROM category_order_stats cos
       LEFT JOIN category_revenue cr ON cr.category_key = cos.category_key
       ORDER BY revenue DESC`,
      { branchId: params.branchId, fromDate: params.fromDate, toDate: params.toDate, status: params.status }
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

    const categoryPerformance = categoryResult.recordset.map((row) => {
      const invoiced = Number(row.invoiced_count || 0);
      const cancelled = Number(row.cancelled_count || 0);
      const concluded = invoiced + cancelled;
      const revenue = Number(row.revenue || 0);
      return {
        categoryId: row.category_key,
        categoryName: row.category_name,
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
      categoryPerformance,
    };
  }

  async listCategories() {
    const result = await query(`SELECT id, category_name FROM service_categories ORDER BY category_name ASC`);
    return result.recordset.map((row) => ({ id: String(row.id), name: row.category_name }));
  }
}

module.exports = DashboardRepositoryImpl;
