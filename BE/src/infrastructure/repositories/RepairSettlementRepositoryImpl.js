const RepairSettlementRepository = require('../../domain/repositories/RepairSettlementRepository');
const RepairSettlement = require('../../domain/entities/RepairSettlement');
const { query, sql } = require('../database/sqlServer');
const { runInTransaction } = require('../../utils/sqlTransaction');
const { nowVN } = require('../../utils/dateVN');
const { buildDesiredTasks, computeDesiredTasks, loadPackageServiceNames, packageCodesNeeding, PACKAGE_SERVICES_SQL } = require('./repairOrderTaskBuilder');

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
         CASE WHEN vbrand.brand_name IS NOT NULL AND vbrand.brand_name <> N''
              THEN vbrand.brand_name + N' ' + v.vehicle_model_text
              ELSE v.vehicle_model_text END AS vehicle_model_text,
         v.frame_number       AS vehicle_frame_number,
         v.engine_number      AS vehicle_engine_number,
         v.current_km         AS vehicle_current_km,
         wr.purchase_date     AS vehicle_purchase_date,
         adv.user_name AS advisor_name,
         adv.phone     AS advisor_phone,
         tl.user_name  AS team_leader_name,
         inv.issued_at AS invoice_issued_at,
         ro.id         AS repair_order_id,
         vb.bay_number AS bay_number,
         -- Da co it nhat 1 dau muc duoc tick hoan thanh chua - dung de FE
         -- khoa nut "Huy" o man danh sach (xem RepairSettlementService
         -- .updateStatus, BE cung tu chan lai neu co goi thang API).
         CASE WHEN EXISTS (
           SELECT 1 FROM repair_order_tasks rot
           WHERE rot.repair_order_id = ro.id AND rot.is_done = 1
         ) THEN 1 ELSE 0 END AS has_completed_task,
         -- Da gan tho thuc hien chua - claim() chuyen status sang 'inprogress'
         -- ngay luc chon khoang (truoc ca khi gan tho, de khoa khong cho to
         -- truong khac nhan trung), nhung ben man CVDV chi nen hien "Đang sửa
         -- chữa" tu luc THUC SU co tho cam may - xem FE displayStatus().
         CASE WHEN EXISTS (
           SELECT 1 FROM repair_order_technicians rot2
           WHERE rot2.repair_order_id = ro.id
         ) THEN 1 ELSE 0 END AS has_technicians
  FROM   service_orders so
  JOIN   branches  b   ON b.id = so.branch_id
  JOIN   customers c   ON c.id = so.customer_id
  JOIN   vehicles  v   ON v.id = so.vehicle_id
  LEFT JOIN brands vbrand ON vbrand.id = v.brand_id
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
  OUTER APPLY (
      -- Lenh sua chua DANG HIEN HANH cua phieu nay (bo qua lenh da huy - xem
      -- RepairOrderRepositoryImpl.findByServiceOrderCode ly do tuong tu) -
      -- dung de CVDV huy truc tiep tu man Phieu quyet toan khi phieu dang
      -- "inprogress", khong can qua man "Lenh sua chua" (da bo).
      SELECT TOP 1 r.id, r.bay_id
      FROM   repair_orders r
      WHERE  r.service_order_id = so.id AND r.status <> 'cancelled'
      ORDER  BY r.id DESC
  ) ro
  LEFT JOIN vehicle_bays vb ON vb.id = ro.bay_id
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
      `SELECT rot.id, rot.task_name, rot.task_type, rot.quantity, rot.is_done, rot.is_cancelled, rot.is_added_later, rot.is_qty_increased, rot.prev_quantity, rot.note
       FROM   repair_order_tasks rot
       JOIN   repair_orders ro ON ro.id = rot.repair_order_id
       WHERE  ro.service_order_id = @id
       ORDER  BY rot.id`,
      { id }
    );

    // Tho thuc hien (co the nhieu tho) - dung DUNG lenh sua chua dang hien
    // hanh (header.repair_order_id, xem HEADER_SELECT OUTER APPLY) de khop
    // voi "To truong" hien cung tren man, tranh gop nham tho tu 1 lenh cu da huy.
    // same_team: tho nay co cung to voi to truong dang phu trach lenh sua
    // chua nay khong (khac to nghia la duoc dieu dong sang giup - xem FE
    // formatTechnicianLabel).
    const techniciansResult = header.repair_order_id
      ? await query(
          `SELECT u.id, u.user_name, u.phone,
                  CASE WHEN u.team_leader_id = @teamLeaderId THEN 1 ELSE 0 END AS same_team
           FROM   repair_order_technicians rot
           JOIN   users u ON u.id = rot.technician_id
           WHERE  rot.repair_order_id = @repairOrderId
           ORDER  BY u.user_name ASC`,
          { repairOrderId: header.repair_order_id, teamLeaderId: header.team_leader_id }
        )
      : { recordset: [] };

    return RepairSettlement.fromPersistence(header, itemsResult.recordset, tasksResult.recordset, techniciansResult.recordset);
  }

  // Tra cuu cong khai (khong dang nhap, xem publicRoutes.js) - khach nhap bien
  // so HOAC so khung (xe doi bien van tra duoc bang so khung). Chi tra ve
  // thong tin toi thieu (ma phieu/ngay/trang thai/chi nhanh) - KHONG tra ten
  // khach hang, SDT, gia tien... de tranh lo thong tin nguoi khac qua bien so.
  //
  // Day la tra cuu LICH SU BAO DUONG (khong phai tien do sua chua/lich su sua
  // chua noi chung) - chi tra ve phieu co it nhat 1 hang muc thuoc loai hinh
  // "Bao duong dinh ky" (repair_category = 'PM', xem REPAIR_CATEGORY_LABELS
  // trong DashboardRepositoryImpl.js). Phieu chi gom cac loai hinh sua chua
  // khac (dong son, sua dong co...) se khong hien ra o day.
  //
  // Khong co cot "goi bao duong" rieng (chon goi luc tao phieu chi expand ra
  // tung dong dich vu, khong luu lai ten goi goc) - nen "goi bao duong la
  // gi" duoc tra loi bang chinh ten cac hang muc PM da lam trong phieu do
  // (pm_items, gop bang STRING_AGG), thay vi co doan ten 1 goi trong catalog.
  async findPublicHistoryByVehicleIdentifier(identifier) {
    const result = await query(
      `SELECT so.order_code, so.status, so.intake_date, so.completed_date,
              b.branch_name, v.license_plate, v.vehicle_model_text, pm.items AS pm_items
       FROM   service_orders so
       JOIN   vehicles  v ON v.id = so.vehicle_id
       JOIN   branches  b ON b.id = so.branch_id
       CROSS APPLY (
         SELECT STRING_AGG(soi.item_description, ', ') AS items
         FROM   service_order_items soi
         WHERE  soi.service_order_id = so.id AND soi.repair_category = 'PM'
       ) pm
       WHERE  (v.license_plate = @identifier OR v.frame_number = @identifier)
         AND  so.status <> 'cancelled'
         AND  pm.items IS NOT NULL
       ORDER  BY so.intake_date DESC`,
      { identifier }
    );
    return result.recordset;
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
        .input('note', sql.NVarChar(1000), data.note || null)
        .input('currentKm', sql.Int, data.currentKm || null)
        .input('status', sql.VarChar(30), 'waiting_repair')
        .input('subtotal', sql.Decimal(18, 2), data.subtotal || 0)
        .input('discountAmount', sql.Decimal(18, 2), data.discountAmount || 0)
        .input('afterDiscount', sql.Decimal(18, 2), data.afterDiscount || 0)
        .input('vat', sql.Decimal(18, 2), data.vat || 0)
        .input('freeAmount', sql.Decimal(18, 2), data.freeAmount || 0)
        .input('total', sql.Decimal(18, 2), data.total || 0)
        .input('isWarranty', sql.Bit, isWarranty)
        .input('intakeDate', sql.DateTime, nowVN())
        .input('intakeChecklist', sql.NVarChar(sql.MAX), JSON.stringify(data.intakeChecklist || {}))
        .input('signatureData', sql.NVarChar(sql.MAX), data.signatureData)
        .input('signerName', sql.NVarChar(255), data.signerName || null)
        .input('signedAt', sql.DateTime, nowVN())
        .query(`
          INSERT INTO service_orders (
            order_code, branch_id, vehicle_id, customer_id, advisor_id,
            customer_request, note, current_km, status,
            subtotal, discount_amount, after_discount, vat, free_amount, total,
            is_warranty, intake_date, intake_checklist,
            signature_data, signature_signer_name, signature_signed_at
          )
          VALUES (
            '', @branchId, @vehicleId, @customerId, @advisorId,
            @customerRequest, @note, @currentKm, @status,
            @subtotal, @discountAmount, @afterDiscount, @vat, @freeAmount, @total,
            @isWarranty, @intakeDate, @intakeChecklist,
            @signatureData, @signerName, @signedAt
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
        .input('note', sql.NVarChar(1000), data.note || null)
        .input('currentKm', sql.Int, data.currentKm || null)
        .input('subtotal', sql.Decimal(18, 2), data.subtotal || 0)
        .input('discountAmount', sql.Decimal(18, 2), data.discountAmount || 0)
        .input('afterDiscount', sql.Decimal(18, 2), data.afterDiscount || 0)
        .input('vat', sql.Decimal(18, 2), data.vat || 0)
        .input('freeAmount', sql.Decimal(18, 2), data.freeAmount || 0)
        .input('total', sql.Decimal(18, 2), data.total || 0)
        .input('isWarranty', sql.Bit, isWarranty)
        .input('intakeChecklist', sql.NVarChar(sql.MAX), JSON.stringify(data.intakeChecklist || {}))
        .query(`
          UPDATE service_orders SET
            customer_request = @customerRequest,
            note = @note,
            current_km = @currentKm,
            subtotal = @subtotal,
            discount_amount = @discountAmount,
            after_discount = @afterDiscount,
            vat = @vat,
            free_amount = @freeAmount,
            total = @total,
            is_warranty = @isWarranty,
            intake_checklist = @intakeChecklist
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

  // Kiem tra doi HTTT/xoa hang muc trong payload MOI co lam "bien mat" 1 dau
  // muc DA duoc to truong/tho tick hoan thanh hay khong - goi TRUOC khi luu
  // that (RepairSettlementService.update), khong tin rieng validation phia
  // FE. Chi co y nghia khi phieu dang co lenh sua chua "inprogress" (da co
  // tasks) - tra ve false neu chua ai nhan hoac chua tick gi (khong co gi de mat).
  async wouldLoseCompletedTasks(serviceOrderId, newItems) {
    const roResult = await query(
      `SELECT id FROM repair_orders WHERE service_order_id = @serviceOrderId AND status = 'inprogress'`,
      { serviceOrderId }
    );
    const repairOrder = roResult.recordset[0];
    if (!repairOrder) return false;

    const doneResult = await query(
      `SELECT task_name, task_type, product_id FROM repair_order_tasks WHERE repair_order_id = @repairOrderId AND is_done = 1`,
      { repairOrderId: repairOrder.id }
    );
    if (doneResult.recordset.length === 0) return false;

    const items = newItems.map((it) => ({
      lhsc: it.lhsc,
      serviceId: it.serviceId,
      itemCode: it.code,
      description: it.description,
      productId: it.productId,
      quantity: it.qty,
      unitPrice: it.unitPrice,
      httt: it.httt,
    }));

    const packageServiceNamesByCode = await loadPackageServiceNames(
      (code) => query(PACKAGE_SERVICES_SQL, { code }).then((r) => r.recordset),
      packageCodesNeeding(items)
    );
    const desired = computeDesiredTasks(items, packageServiceNamesByCode);
    const keyOf = (taskType, taskName, productId) => `${taskType}|${taskName}|${productId || ''}`;
    // Hang muc huy (isCancelled) van giu nguyen key trong desired (khong bien
    // mat nua - xem repairOrderTaskBuilder.js) nen phai check RIENG: 1 dau
    // muc DA hoan thanh se "mat" ca khi key bien mat HOAN TOAN LAN khi key con
    // nhung bi lat sang trang thai huy - ca 2 truong hop deu phai chan.
    const desiredCancelledKeys = new Set(
      desired.filter((t) => t.isCancelled).map((t) => keyOf(t.taskType, t.taskName, t.productId))
    );
    const desiredKeys = new Set(desired.map((t) => keyOf(t.taskType, t.taskName, t.productId)));

    return doneResult.recordset.some((t) => {
      const key = keyOf(t.task_type, t.task_name, t.product_id);
      return !desiredKeys.has(key) || desiredCancelledKeys.has(key);
    });
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
      .query(`SELECT id, task_name, task_type, product_id, quantity, is_cancelled, note FROM repair_order_tasks WHERE repair_order_id = @repairOrderId`);
    const existing = existingResult.recordset;

    const keyOf = (taskType, taskName, productId) => `${taskType}|${taskName}|${productId || ''}`;
    const desiredByKey = new Map(desired.map((t) => [keyOf(t.taskType, t.taskName, t.productId), t]));
    const existingByKey = new Map(existing.map((t) => [keyOf(t.task_type, t.task_name, t.product_id), t]));

    const toDelete = existing.filter((t) => !desiredByKey.has(keyOf(t.task_type, t.task_name, t.product_id)));
    // Task moi xuat hien qua 1 lan SUA phieu (khong phai luc nhan viec lan
    // dau) - danh dau is_added_later=1 de FE hien "(Khach them)".
    const toInsert = desired.filter((t) => !existingByKey.has(keyOf(t.taskType, t.taskName, t.productId)));
    // Task cu con giu key nhung trang thai huy thay doi (vua bi huy, hoac
    // hiem hon la duoc "un-huy") - chi cap nhat co is_cancelled, giu nguyen
    // is_done/is_added_later da co.
    const toUpdateCancelled = existing.filter((t) => {
      const d = desiredByKey.get(keyOf(t.task_type, t.task_name, t.product_id));
      return d && Boolean(t.is_cancelled) !== Boolean(d.isCancelled);
    });
    // Task cu con giu key nhung so luong doi khac (vd khach dang thay 1 lop,
    // sau muon thay them 3 lop nua -> tong 4) - cap nhat quantity/unit_price
    // theo so luong moi, VA lat is_qty_increased tuong ung (1 neu TANG so voi
    // truoc do FE hien "(Khach them so luong, tong la: N)"; 0 neu giam/bang -
    // tu "quen" lan tang cu neu sau do CVDV dieu chinh giam lai, tranh nham
    // hien nhan sai khi so luong da tro ve muc binh thuong).
    const toUpdateQty = existing.filter((t) => {
      const d = desiredByKey.get(keyOf(t.task_type, t.task_name, t.product_id));
      return d && !d.isCancelled && Number(d.quantity || 0) !== Number(t.quantity || 0);
    });
    // Ghi chu doi rieng (khong lien quan so luong/huy) - CVDV sua lai luu y
    // cho tho tren 1 hang muc da co san.
    const toUpdateNote = existing.filter((t) => {
      const d = desiredByKey.get(keyOf(t.task_type, t.task_name, t.product_id));
      return d && (d.note || null) !== (t.note || null);
    });

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
        .input('isCancelled', sql.Bit, t.isCancelled ? 1 : 0)
        .input('note', sql.NVarChar(500), t.note || null)
        .query(`
          INSERT INTO repair_order_tasks (repair_order_id, task_name, task_type, product_id, quantity, unit_price, is_done, is_cancelled, is_added_later, note)
          VALUES (@repairOrderId, @taskName, @taskType, @productId, @quantity, @unitPrice, 0, @isCancelled, 1, @note)
        `);
    }

    for (const t of toUpdateCancelled) {
      const d = desiredByKey.get(keyOf(t.task_type, t.task_name, t.product_id));
      await tx
        .request()
        .input('id', sql.BigInt, t.id)
        .input('isCancelled', sql.Bit, d.isCancelled ? 1 : 0)
        .query(`UPDATE repair_order_tasks SET is_cancelled = @isCancelled WHERE id = @id`);
    }

    for (const t of toUpdateQty) {
      const d = desiredByKey.get(keyOf(t.task_type, t.task_name, t.product_id));
      const increased = Number(d.quantity || 0) > Number(t.quantity || 0);
      await tx
        .request()
        .input('id', sql.BigInt, t.id)
        .input('quantity', sql.Int, d.quantity || 0)
        .input('unitPrice', sql.Decimal(18, 2), d.unitPrice || 0)
        .input('isQtyIncreased', sql.Bit, increased ? 1 : 0)
        // prev_quantity = so luong TRUOC lan doi nay (t.quantity, chua bi ghi
        // de) - FE dung de tinh chenh lech khi GIAM ("Khách trả lại SL xN"),
        // xem TaskNameLabel. Moi lan doi tiep theo se ghi de tiep, luon phan
        // anh dung mac ngay truoc lan sua gan nhat (khong phai lich su day du).
        .input('prevQuantity', sql.Int, t.quantity ?? null)
        .query(`UPDATE repair_order_tasks SET quantity = @quantity, unit_price = @unitPrice, is_qty_increased = @isQtyIncreased, prev_quantity = @prevQuantity WHERE id = @id`);
    }

    for (const t of toUpdateNote) {
      const d = desiredByKey.get(keyOf(t.task_type, t.task_name, t.product_id));
      await tx
        .request()
        .input('id', sql.BigInt, t.id)
        .input('note', sql.NVarChar(500), d.note || null)
        .query(`UPDATE repair_order_tasks SET note = @note WHERE id = @id`);
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
          .query(`UPDATE service_orders SET status = @status, cancel_reason = @cancelReason, cancelled_at = GETDATE() WHERE id = @id`);

        // Khach huy giua chung, khi da co to truong nhan (lenh sua chua dang
        // "inprogress") - huy luon lenh do CHO DUT DIEM (khong revert ve
        // "waiting_repair" de nhan lai nhu truoc, vi khach da huy thi khong
        // con gi de lam nua) - xem RepairSettlementService.updateStatus emit
        // SSE bao rieng cho khoang dang hien lenh nay.
        await tx.request().input('id', sql.BigInt, id).input('cancelReason', sql.NVarChar(500), cancelReason || null)
          .query(`
            UPDATE repair_orders
            SET    status = 'cancelled', cancel_reason = @cancelReason
            WHERE  service_order_id = @id AND status = 'inprogress'
          `);
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

  // Man hinh bao ve tai cong (public, khong dang nhap) - xe da xuat hoa don
  // nhung chua duoc xac nhan ra cong (delivery_date con NULL). Chi lay du
  // thong tin de doi chieu xe/khach, khong lo so dien thoai/tong tien.
  async findGatePending(branchId) {
    const result = await query(
      `SELECT so.id, so.order_code,
              c.full_name AS customer_full_name,
              v.license_plate AS vehicle_license_plate, v.vehicle_model_text
       FROM   service_orders so
       JOIN   customers c ON c.id = so.customer_id
       JOIN   vehicles  v ON v.id = so.vehicle_id
       WHERE  so.branch_id = @branchId AND so.status = 'invoiced' AND so.delivery_date IS NULL
       ORDER  BY so.id DESC`,
      { branchId }
    );
    return result.recordset;
  }

  // Bao ve bam xac nhan xe da ra cong - set delivery_date, dieu kien du
  // status='invoiced' VA branch khop (chan sua phieu chi nhanh khac) VA
  // chua xac nhan lan nao (tranh bam 2 lan/2 man hinh cung luc).
  async confirmGateExit(id, branchId) {
    const result = await query(
      `UPDATE service_orders
       SET    delivery_date = CAST(GETDATE() AS DATE)
       WHERE  id = @id AND branch_id = @branchId AND status = 'invoiced' AND delivery_date IS NULL`,
      { id, branchId }
    );
    return result.rowsAffected[0] > 0;
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
        .input('note', sql.NVarChar(500), (item.note || '').trim() || null)
        .query(`
          INSERT INTO service_order_items (
            service_order_id, item_type, product_id, service_id, item_code, item_description,
            lhsc, httt, repair_category, unit, quantity, unit_price, discount_pct, is_free, total, note
          )
          VALUES (
            @serviceOrderId, @itemType, @productId, @serviceId, @itemCode, @itemDescription,
            @lhsc, @httt, @repairCategory, @unit, @quantity, @unitPrice, @discountPct, @isFree, @total, @note
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

  // ─── PayOS ───────────────────────────────────────────────────────
  async createPayosTransaction(serviceOrderId, { orderCode, paymentLinkId, qrCode, checkoutUrl, amount, expiredAt }) {
    await query(
      `INSERT INTO payos_transactions (service_order_id, order_code, payment_link_id, qr_code, checkout_url, amount, expired_at)
       VALUES (@serviceOrderId, @orderCode, @paymentLinkId, @qrCode, @checkoutUrl, @amount, @expiredAt)`,
      {
        serviceOrderId,
        orderCode,
        paymentLinkId: paymentLinkId || null,
        qrCode: qrCode || null,
        checkoutUrl: checkoutUrl || null,
        amount,
        expiredAt: expiredAt || null,
      }
    );
  }

  async findPayosTransactionByOrderCode(orderCode) {
    const result = await query(`SELECT * FROM payos_transactions WHERE order_code = @orderCode`, { orderCode });
    return result.recordset[0] || null;
  }

  async markPayosTransactionPaid(orderCode, { reference, paidAt }) {
    await query(
      `UPDATE payos_transactions SET status = 'paid', webhook_reference = @reference, paid_at = @paidAt WHERE order_code = @orderCode`,
      { orderCode, reference: reference || null, paidAt }
    );
  }
}

module.exports = RepairSettlementRepositoryImpl;
