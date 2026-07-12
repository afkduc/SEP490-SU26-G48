const RepairSettlementRepository = require('../../domain/repositories/RepairSettlementRepository');
const RepairSettlement = require('../../domain/entities/RepairSettlement');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');

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
         tl.user_name  AS team_leader_name
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
`;

function genCode(prefix, id) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(3, '0')}`;
}

function itemTypeFor(lhsc) {
  return lhsc === 'PT' ? 'product' : 'service';
}

class RepairSettlementRepositoryImpl extends RepairSettlementRepository {
  async findAll({ branchId, status, search, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let sqlText = `${HEADER_SELECT} WHERE so.branch_id = @branchId`;
    const params = { branchId };

    if (status) {
      params.status = status;
      sqlText += ` AND so.status = @status`;
    }
    if (search) {
      params.search = `%${search}%`;
      sqlText += ` AND (so.order_code LIKE @search OR c.full_name LIKE @search OR v.license_plate LIKE @search)`;
    }

    sqlText += ` ORDER BY so.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    params.offset = offset;
    params.limit = limit;

    const result = await query(sqlText, params);
    return result.recordset.map((row) => RepairSettlement.fromPersistence(row, []));
  }

  async count({ branchId, status, search } = {}) {
    let sqlText = `
      SELECT COUNT(*) AS total
      FROM   service_orders so
      JOIN   customers c ON c.id = so.customer_id
      JOIN   vehicles  v ON v.id = so.vehicle_id
      WHERE  so.branch_id = @branchId
    `;
    const params = { branchId };

    if (status) {
      params.status = status;
      sqlText += ` AND so.status = @status`;
    }
    if (search) {
      params.search = `%${search}%`;
      sqlText += ` AND (so.order_code LIKE @search OR c.full_name LIKE @search OR v.license_plate LIKE @search)`;
    }

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
    return RepairSettlement.fromPersistence(header, itemsResult.recordset);
  }

  async create(data, { branchId, advisorId }) {
    const newId = await runInTransaction(async (tx) => {
      const isWarranty = await this._checkWarranty(data.vehicleId);

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
            @nextMaintenanceKm, @nextMaintenanceDate, @isWarranty, GETDATE()
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
            next_maintenance_date = @nextMaintenanceDate
          WHERE id = @id
        `);

      await tx.request().input('id', sql.BigInt, id).query(`DELETE FROM service_order_items WHERE service_order_id = @id`);
      await this._insertItems(tx, id, data.items);

      if (data.vehicleId) {
        await this._bumpVehicleKm(tx, data.vehicleId, data.currentKm);
      }
    });

    return this.findById(id);
  }

  async updateStatus(id, status, { issuedBy } = {}) {
    await runInTransaction(async (tx) => {
      if (status === 'waiting_payment') {
        await tx.request().input('id', sql.BigInt, id).input('status', sql.VarChar(30), status)
          .query(`UPDATE service_orders SET status = @status, completed_date = GETDATE() WHERE id = @id`);
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
        .input('unit', sql.NVarChar(20), item.unit || null)
        .input('quantity', sql.Int, item.qty || 0)
        .input('unitPrice', sql.Decimal(18, 2), item.unitPrice || 0)
        .input('discountPct', sql.Decimal(5, 2), item.discount || 0)
        .input('isFree', sql.Bit, Boolean(item.isFree))
        .input('total', sql.Decimal(18, 2), item.total || 0)
        .query(`
          INSERT INTO service_order_items (
            service_order_id, item_type, product_id, service_id, item_code, item_description,
            lhsc, httt, unit, quantity, unit_price, discount_pct, is_free, total
          )
          VALUES (
            @serviceOrderId, @itemType, @productId, @serviceId, @itemCode, @itemDescription,
            @lhsc, @httt, @unit, @quantity, @unitPrice, @discountPct, @isFree, @total
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

  async _checkWarranty(vehicleId) {
    const result = await query(
      `SELECT is_under_warranty FROM v_warranty_status WHERE vehicle_id = @vehicleId`,
      { vehicleId }
    );
    return Boolean(result.recordset[0]?.is_under_warranty);
  }
}

module.exports = RepairSettlementRepositoryImpl;
