const RepairSettlementRepository = require('../../domain/repositories/RepairSettlementRepository');
const RepairSettlement = require('../../domain/entities/RepairSettlement');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');
const { nowVN } = require('../../utils/dateVN');
const { buildDesiredTasks } = require('./repairOrderTaskBuilder');

// Cot join dung chung cho findAll/findById - lay du thong tin khach hang,
// xe (kem ngay mua tu warranty_records), co van dich vu va to truong.
const HEADER_SELECT = `
  SELECT so.*,
         b.branch_name,
         c.full_name  AS customer_full_name,
         c.phone      AS customer_phone,
         c.address    AS customer_address,
         c.tax_code   AS customer_tax_code,
         c.cccd       AS customer_cccd,
         c.email      AS customer_email,
         c.contact_name  AS customer_contact_name,
         c.contact_phone AS customer_contact_phone,
         v.license_plate      AS vehicle_license_plate,
         v.vehicle_model_text,
         v.frame_number       AS vehicle_frame_number,
         v.engine_number      AS vehicle_engine_number,
         v.current_km         AS vehicle_current_km,
         wr.purchase_date     AS vehicle_purchase_date,
         adv.user_name AS advisor_name,
         adv.phone     AS advisor_phone,
         tl.user_name  AS team_leader_name,
         inv.issued_at AS invoice_issued_at
  FROM   service_orders so
  JOIN   branches  b   ON b.id = so.branch_id
  JOIN   customers c   ON c.id = so.customer_id
  JOIN   vehicles  v   ON v.id = so.vehicle_id
  JOIN   users     adv ON adv.id = so.advisor_id
  LEFT JOIN users  tl  ON tl.id = so.team_leader_id
  OUTER APPLY (
      SELECT TOP 1 w.purchase_date
      FROM   warranty_records w
      WHERE  w.vehicle_id = so.vehicle_id
      ORDER  BY w.purchase_date DESC
  ) wr
  OUTER APPLY (
      SELECT TOP 1 i.issued_at
      FROM   invoices i
      WHERE  i.service_order_id = so.id
      ORDER  BY i.issued_at DESC
  ) inv
`;

function genCode(prefix, id) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(3, '0')}`;
}

function itemTypeFor(lhsc) {
  return lhsc === 'PT' ? 'product' : 'service';
}

// Dung chung cho findAll/count - tra ve mang cac dieu kien WHERE + gan params.
// customerId va vehicleId co the ket hop CUNG LUC (vd: man "Lich su dich vu"
// cua 1 khach hang loc theo 1 xe cu the cua ho) - khac voi truoc day chi cho
// dung 1 trong 2. Neu khong truyen ca 2 (man danh sach cua co van dich vu) thi
// bat buoc loc theo branchId nhu cu, kem advisorId neu nguoi goi la
// service_advisor (chi xem phieu cua chinh minh) - KHONG ap dung cho man lich
// su khach hang/xe (customerId/vehicleId) vi do la du lieu dung chung, 1 xe co
// the da qua tay nhieu co van khac nhau.
function buildConditions({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId }) {
  const params = {};
  const conditions = [];

  if (customerId) {
    params.customerId = customerId;
    conditions.push('so.customer_id = @customerId');
  }
  if (vehicleId) {
    params.vehicleId = vehicleId;
    conditions.push('so.vehicle_id = @vehicleId');
  }
  if (!customerId && !vehicleId) {
    params.branchId = branchId;
    conditions.push('so.branch_id = @branchId');
    if (advisorId) {
      params.advisorId = advisorId;
      conditions.push('so.advisor_id = @advisorId');
    }
  }

  if (status) {
    params.status = status;
    conditions.push('so.status = @status');
  }
  if (search) {
    params.search = `%${search}%`;
    conditions.push('(so.order_code LIKE @search OR c.full_name LIKE @search OR v.license_plate LIKE @search)');
  }
  if (fromDate) {
    params.fromDate = fromDate;
    conditions.push('so.intake_date >= @fromDate');
  }
  if (toDate) {
    params.toDate = toDate;
    conditions.push('so.intake_date < DATEADD(day, 1, CAST(@toDate AS DATE))');
  }

  return { params, conditions };
}

class RepairSettlementRepositoryImpl extends RepairSettlementRepository {
  async findAll({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { params, conditions } = buildConditions({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId });

    const sqlText = `${HEADER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY so.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    params.offset = offset;
    params.limit = limit;

    const result = await query(sqlText, params);
    return result.recordset.map((row) => RepairSettlement.fromPersistence(row, []));
  }

  async count({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId } = {}) {
    const { params, conditions } = buildConditions({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId });

    const sqlText = `
      SELECT COUNT(*) AS total
      FROM   service_orders so
      JOIN   customers c ON c.id = so.customer_id
      JOIN   vehicles  v ON v.id = so.vehicle_id
      WHERE  ${conditions.join(' AND ')}
    `;

    const result = await query(sqlText, params);
    return result.recordset[0].total;
  }

  async findById(id) {
    const headerResult = await query(`${HEADER_SELECT} WHERE so.id = @id`, { id });
    const header = headerResult.recordset[0];
    if (!header) return null;

    const itemsResult = await query(
      `SELECT * FROM service_order_items WHERE service_order_id = @id ORDER BY id`,
      { id }
    );

    // Chi co khi phieu da duoc gan to truong (co repair_order) - de co van xem
    // duoc tien do tung dau viec To truong da tich, khong can qua man rieng.
    const tasksResult = await query(
      `SELECT rot.id, rot.task_name, rot.task_type, rot.is_done
       FROM   repair_order_tasks rot
       JOIN   repair_orders ro ON ro.id = rot.repair_order_id
       WHERE  ro.service_order_id = @id
       ORDER  BY rot.id`,
      { id }
    );

    return RepairSettlement.fromPersistence(header, itemsResult.recordset, tasksResult.recordset);
  }

  // 1 khach hang + 1 xe chi duoc co TOI DA 1 phieu quyet toan dang xu ly
  // (waiting_repair/inprogress/waiting_payment) tai 1 thoi diem - phai huy
  // hoac xuat hoa don (invoiced) xong moi duoc tao phieu moi cho cap nay.
  async findActiveByCustomerVehicle(customerId, vehicleId, excludeId) {
    const result = await query(
      `SELECT TOP 1 id, order_code, status
       FROM   service_orders
       WHERE  customer_id = @customerId
         AND  vehicle_id = @vehicleId
         AND  status IN ('waiting_repair', 'inprogress', 'waiting_payment')
         AND  (@excludeId IS NULL OR id <> @excludeId)
       ORDER  BY id DESC`,
      { customerId, vehicleId, excludeId: excludeId || null }
    );
    const row = result.recordset[0];
    return row ? { id: row.id, code: row.order_code, status: row.status } : null;
  }

  async create(data, { branchId, advisorId }) {
    const newId = await runInTransaction(async (tx) => {
      const isWarranty = await this._checkWarranty(data.vehicleId, data.currentKm);

      const headerResult = await tx
        .request()
        .input('branchId', sql.BigInt, branchId)
        .input('vehicleId', sql.BigInt, data.vehicleId)
        .input('customerId', sql.BigInt, data.customerId)
        .input('advisorId', sql.BigInt, advisorId)
        .input('customerRequest', sql.NVarChar(1000), data.customerRequest || null)
        .input('currentKm', sql.Int, data.currentKm || null)
        .input('status', sql.VarChar(30), 'waiting_repair')
        .input('subtotal', sql.Decimal(18, 2), data.subtotal || 0)
        .input('discountAmount', sql.Decimal(18, 2), data.discountAmount || 0)
        .input('afterDiscount', sql.Decimal(18, 2), data.afterDiscount || 0)
        .input('vat', sql.Decimal(18, 2), data.vat || 0)
        .input('freeAmount', sql.Decimal(18, 2), data.freeAmount || 0)
        .input('total', sql.Decimal(18, 2), data.total || 0)
        .input('nextMaintenanceKm', sql.Int, data.nextMaintenanceKm || null)
        .input('nextMaintenanceDate', sql.Date, data.nextMaintenanceDate || null)
        .input('isWarranty', sql.Bit, isWarranty)
        .input('intakeDate', sql.DateTime, nowVN())
        .query(`
          INSERT INTO service_orders (
            order_code, branch_id, vehicle_id, customer_id, advisor_id,
            customer_request, current_km, status,
            subtotal, discount_amount, after_discount, vat, free_amount, total,
            next_maintenance_km, next_maintenance_date, is_warranty, intake_date
          )
          VALUES (
            '', @branchId, @vehicleId, @customerId, @advisorId,
            @customerRequest, @currentKm, @status,
            @subtotal, @discountAmount, @afterDiscount, @vat, @freeAmount, @total,
            @nextMaintenanceKm, @nextMaintenanceDate, @isWarranty, @intakeDate
          );
          SELECT SCOPE_IDENTITY() AS id;
        `);

      const id = headerResult.recordset[0].id;
      await tx.request().input('id', sql.BigInt, id).input('code', sql.VarChar(30), genCode('RO', id))
        .query(`UPDATE service_orders SET order_code = @code WHERE id = @id`);

      await this._insertItems(tx, id, data.items);
      await this._bumpVehicleKm(tx, data.vehicleId, data.currentKm);

      return id;
    });

    return this.findById(newId);
  }

  async update(id, data) {
    await runInTransaction(async (tx) => {
      const isWarranty = await this._checkWarranty(data.vehicleId, data.currentKm);

      await tx
        .request()
        .input('id', sql.BigInt, id)
        .input('customerRequest', sql.NVarChar(1000), data.customerRequest || null)
        .input('currentKm', sql.Int, data.currentKm || null)
        .input('subtotal', sql.Decimal(18, 2), data.subtotal || 0)
        .input('discountAmount', sql.Decimal(18, 2), data.discountAmount || 0)
        .input('afterDiscount', sql.Decimal(18, 2), data.afterDiscount || 0)
        .input('vat', sql.Decimal(18, 2), data.vat || 0)
        .input('freeAmount', sql.Decimal(18, 2), data.freeAmount || 0)
        .input('total', sql.Decimal(18, 2), data.total || 0)
        .input('nextMaintenanceKm', sql.Int, data.nextMaintenanceKm || null)
        .input('nextMaintenanceDate', sql.Date, data.nextMaintenanceDate || null)
        .input('isWarranty', sql.Bit, isWarranty)
        .query(`
          UPDATE service_orders SET
            customer_request = @customerRequest,
            current_km = @currentKm,
            subtotal = @subtotal,
            discount_amount = @discountAmount,
            after_discount = @afterDiscount,
            vat = @vat,
            free_amount = @freeAmount,
            total = @total,
            next_maintenance_km = @nextMaintenanceKm,
            next_maintenance_date = @nextMaintenanceDate,
            is_warranty = @isWarranty
          WHERE id = @id
        `);

      await tx.request().input('id', sql.BigInt, id).query(`DELETE FROM service_order_items WHERE service_order_id = @id`);
      await this._insertItems(tx, id, data.items);
      await this._syncRepairOrderTasks(tx, id);

      if (data.vehicleId) {
        await this._bumpVehicleKm(tx, data.vehicleId, data.currentKm);
      }
    });

    return this.findById(id);
  }

  // Co van sua phieu quyet toan (them/bot hang muc) sau khi da gan to truong
  // -> dong bo lai checklist ben To truong (repair_order_tasks) cho khop, thay
  // vi de nguyen danh sach cu tu luc gan viec. Chi dong bo khi lenh sua chua
  // con "inprogress" (chua hoan thanh/huy) - task nao van con trong danh sach
  // moi thi GIU NGUYEN is_done (khong reset ve chua tich).
  async _syncRepairOrderTasks(tx, serviceOrderId) {
    const roResult = await tx
      .request()
      .input('serviceOrderId', sql.BigInt, serviceOrderId)
      .query(`SELECT id FROM repair_orders WHERE service_order_id = @serviceOrderId AND status = 'inprogress'`);
    const repairOrder = roResult.recordset[0];
    if (!repairOrder) return;

    const desired = await buildDesiredTasks(tx, serviceOrderId);

    const existingResult = await tx
      .request()
      .input('repairOrderId', sql.BigInt, repairOrder.id)
      .query(`SELECT id, task_name, task_type, product_id FROM repair_order_tasks WHERE repair_order_id = @repairOrderId`);
    const existing = existingResult.recordset;

    const keyOf = (taskType, taskName, productId) => `${taskType}|${taskName}|${productId || ''}`;
    const existingKeys = new Set(existing.map((t) => keyOf(t.task_type, t.task_name, t.product_id)));
    const desiredKeys = new Set(desired.map((t) => keyOf(t.taskType, t.taskName, t.productId)));

    const toDelete = existing.filter((t) => !desiredKeys.has(keyOf(t.task_type, t.task_name, t.product_id)));
    const toInsert = desired.filter((t) => !existingKeys.has(keyOf(t.taskType, t.taskName, t.productId)));

    for (const t of toDelete) {
      await tx.request().input('id', sql.BigInt, t.id).query(`DELETE FROM repair_order_tasks WHERE id = @id`);
    }

    for (const t of toInsert) {
      await tx
        .request()
        .input('repairOrderId', sql.BigInt, repairOrder.id)
        .input('taskName', sql.NVarChar(300), t.taskName)
        .input('taskType', sql.VarChar(10), t.taskType)
        .input('productId', sql.BigInt, t.productId || null)
        .input('quantity', sql.Int, t.quantity || 0)
        .input('unitPrice', sql.Decimal(18, 2), t.unitPrice || 0)
        .query(`
          INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, unit_price, is_done)
          VALUES (@repairOrderId, @taskName, @taskType, @productId, @quantity, @unitPrice, 0)
        `);
    }
  }

  async updateStatus(id, status, { issuedBy, cancelReason } = {}) {
    await runInTransaction(async (tx) => {
      if (status === 'waiting_payment') {
        await tx.request().input('id', sql.BigInt, id).input('status', sql.VarChar(30), status)
          .query(`UPDATE service_orders SET status = @status, completed_date = GETDATE() WHERE id = @id`);
        return;
      }

      if (status === 'cancelled') {
        await tx.request().input('id', sql.BigInt, id).input('status', sql.VarChar(30), status)
          .input('cancelReason', sql.NVarChar(500), cancelReason || null)
          .query(`UPDATE service_orders SET status = @status, cancel_reason = @cancelReason WHERE id = @id`);
        return;
      }

      if (status === 'invoiced') {
        await tx.request().input('id', sql.BigInt, id).input('status', sql.VarChar(30), status)
          .query(`UPDATE service_orders SET status = @status WHERE id = @id`);

        const orderResult = await tx.request().input('id', sql.BigInt, id)
          .query(`SELECT branch_id, customer_id, total FROM service_orders WHERE id = @id`);
        const order = orderResult.recordset[0];

        const invResult = await tx
          .request()
          .input('serviceOrderId', sql.BigInt, id)
          .input('branchId', sql.BigInt, order.branch_id)
          .input('customerId', sql.BigInt, order.customer_id)
          .input('amount', sql.Decimal(18, 2), order.total)
          .input('issuedBy', sql.BigInt, issuedBy)
          .query(`
            INSERT INTO invoices (invoice_code, service_order_id, branch_id, customer_id, amount, paid, status, issued_at, issued_by)
            VALUES ('', @serviceOrderId, @branchId, @customerId, @amount, @amount, 'issued', GETDATE(), @issuedBy);
            SELECT SCOPE_IDENTITY() AS id;
          `);
        const invId = invResult.recordset[0].id;
        await tx.request().input('id', sql.BigInt, invId).input('code', sql.VarChar(30), genCode('HD', invId))
          .query(`UPDATE invoices SET invoice_code = @code WHERE id = @id`);
        return;
      }

      await tx.request().input('id', sql.BigInt, id).input('status', sql.VarChar(30), status)
        .query(`UPDATE service_orders SET status = @status WHERE id = @id`);
    });

    return this.findById(id);
  }

  async _insertItems(tx, serviceOrderId, items) {
    for (const item of items) {
      await tx
        .request()
        .input('serviceOrderId', sql.BigInt, serviceOrderId)
        .input('itemType', sql.VarChar(10), itemTypeFor(item.lhsc))
        .input('productId', sql.BigInt, item.productId || null)
        .input('serviceId', sql.BigInt, item.serviceId || null)
        .input('itemCode', sql.VarChar(30), item.code || null)
        .input('itemDescription', sql.NVarChar(300), item.description)
        .input('lhsc', sql.VarChar(10), item.lhsc)
        .input('httt', sql.VarChar(10), item.httt)
        .input('repairCategory', sql.VarChar(10), item.repairCategory || null)
        .input('unit', sql.NVarChar(20), item.unit || null)
        .input('quantity', sql.Int, item.qty || 0)
        .input('unitPrice', sql.Decimal(18, 2), item.unitPrice || 0)
        .input('discountPct', sql.Decimal(5, 2), item.discount || 0)
        .input('isFree', sql.Bit, Boolean(item.isFree))
        .input('total', sql.Decimal(18, 2), item.total || 0)
        .query(`
          INSERT INTO service_order_items (
            service_order_id, item_type, product_id, service_id, item_code, item_description,
            lhsc, httt, repair_category, unit, quantity, unit_price, discount_pct, is_free, total
          )
          VALUES (
            @serviceOrderId, @itemType, @productId, @serviceId, @itemCode, @itemDescription,
            @lhsc, @httt, @repairCategory, @unit, @quantity, @unitPrice, @discountPct, @isFree, @total
          )
        `);
    }
  }

  async _bumpVehicleKm(tx, vehicleId, currentKm) {
    if (!currentKm) return;
    await tx
      .request()
      .input('vehicleId', sql.BigInt, vehicleId)
      .input('currentKm', sql.Int, currentKm)
      .query(`UPDATE vehicles SET current_km = @currentKm WHERE id = @vehicleId AND current_km < @currentKm`);
  }

  // Con bao hanh khi CA HAI dieu kien thoa: con trong thoi han (warranty_end_date)
  // VA con trong han km (warranty_km) - dung km cua CHINH lan vao xuong nay
  // (data.currentKm), khong dung vehicles.current_km (co the la so km cua lan
  // truoc, chua duoc cap nhat luc check).
  async _checkWarranty(vehicleId, currentKm) {
    const result = await query(
      `SELECT TOP 1 warranty_end_date, warranty_km
       FROM   warranty_records
       WHERE  vehicle_id = @vehicleId
       ORDER  BY purchase_date DESC`,
      { vehicleId }
    );
    const wr = result.recordset[0];
    if (!wr) return false;

    const withinPeriod = new Date() <= new Date(wr.warranty_end_date);
    const withinKm = currentKm == null ? true : Number(currentKm) <= wr.warranty_km;
    return withinPeriod && withinKm;
  }
}

module.exports = RepairSettlementRepositoryImpl;
