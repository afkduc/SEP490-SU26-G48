const express = require('express');
const http = require('http');
const cors = require('cors');
require('./config/env');

const config = require('./config');
const routes = require('./presentation/routes');
const { logger, errorHandler } = require('./middlewares');
const { getPool } = require('./infrastructure/database/sqlServer');
const { makeMaintenanceReminderRepository } = require('./infrastructure/repositories');

const MAINTENANCE_REMINDER_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 gio/lan

// Tu dong sinh 3 moc nhac nho bao duong (1 tuan/1 thang/2 thang tinh tu ngay
// tao phieu) cho tung phieu quyet toan - chay 1 lan luc khoi dong roi lap lai
// dinh ky, khong lam gian doan server neu loi (chi log).
async function syncMaintenanceReminders() {
  try {
    await makeMaintenanceReminderRepository().syncFromServiceOrders();
  } catch (err) {
    console.error('[maintenanceReminders] sync failed:', err.message);
  }
}

const app = express();

// CORS config - phai la origin string khi credentials=true
// CORS_ORIGIN: danh sach origin duoc phep, phan cach boi dau phay - cho phep
// them origin thuc te khi deploy (IP/domain server) ma khong phai sua code,
// mac dinh giu nguyen 2 origin dev cu neu khong set.
const allowedOrigins = (process.env.CORS_ORIGIN || [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Vite tự nhảy port khi 3000 bận (vd npm run dev → 3001)
  'http://localhost:3001',
  'http://127.0.0.1:3001',
].join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};
app.use(cors(corsOptions));
// Default 100kb qua nho - anh chu ky dien tu (base64 PNG, xem SignaturePad.jsx)
// thuong lon hon muc nay.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(logger);

app.use(config.apiPrefix, routes);

app.use(errorHandler);

async function start() {
  try {
    await getPool();

    // Start background jobs
    try {
      require('./jobs/securityAlertJob').start();
      require('./jobs/auditRetentionJob').start();
      require('./jobs/loginSessionCleanupJob').start();
    } catch (jobErr) {
      console.warn('[BE] Failed to start background jobs:', jobErr.message);
    }

    // Dam bao cot thiet bi tren login_sessions (da gop bo user_devices)
    try {
      await require('./infrastructure/repositories/DeviceRepository').ensureSessionDeviceSchema();
      console.log('[BE] login_sessions device columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureSessionDeviceSchema:', schemaErr.message);
    }

    // PHAI chay TRUOC cac buoc ensure* khac vi no doi ten bang
    // (service_orders -> repair_orders, service_order_items ->
    // repair_order_items) - cac buoc sau deu tham chieu ten MOI.
    //
    // Va KHAC cac buoc ensure* o duoi: doi ten bang/cot chu khong chi them
    // cot, nen KHONG duoc nuot loi. Neu no hong (da rollback) thi schema van
    // la ban cu trong khi code da la ban moi - chay tiep chi tao ra loi 500
    // kho hieu o khap noi. Dung han cho de con biet duong sua.
    try {
      const { ensureRepairOrderMerge } = require('./infrastructure/database/ensureRepairOrderMerge');
      const result = await ensureRepairOrderMerge();
      console.log(result.skipped
        ? '[BE] repair_orders merge: da gop tu truoc, bo qua'
        : `[BE] repair_orders merge: DA GOP XONG (${result.steps} buoc)`);
    } catch (mergeErr) {
      console.error('[BE] KHONG THE KHOI DONG - gop bang repair_orders that bai:');
      console.error(mergeErr.message);
      process.exit(1);
    }

    // Dat lai ten rang buoc/index cho khop ten bang moi - THUAN THAM MY, hong
    // cung khong sao nen chi canh bao (khac buoc gop bang o tren).
    try {
      const { ensureRepairOrderConstraintNames } = require('./infrastructure/database/ensureRepairOrderConstraintNames');
      const r = await ensureRepairOrderConstraintNames();
      if (r.renamed > 0) console.log(`[BE] doi ten ${r.renamed} rang buoc/index cho khop bang repair_orders`);
    } catch (nameErr) {
      console.warn('[BE] ensureRepairOrderConstraintNames:', nameErr.message);
    }

    // Bo bang `brands` (chi con Mazda) - doi cot nen KHONG duoc nuot loi:
    // hong ma van chay tiep thi code moi (da bo brand_id) gap schema cu se
    // loi kho hieu. Dung han cho de con biet duong sua.
    try {
      const { ensureDropBrands } = require('./infrastructure/database/ensureDropBrands');
      const r = await ensureDropBrands();
      console.log(r.skipped
        ? '[BE] brands: da bo tu truoc, bo qua'
        : `[BE] brands: DA BO XONG (${r.steps} buoc)`);
    } catch (brandErr) {
      console.error('[BE] KHONG THE KHOI DONG - bo bang brands that bai:');
      console.error(brandErr.message);
      process.exit(1);
    }

    // Bo 5 cot chet cua vehicle_models - doi cot nen KHONG duoc nuot loi,
    // giong ensureDropBrands: code moi da bo cac cot nay khoi cau SELECT.
    try {
      const { ensureTrimVehicleModelColumns } = require('./infrastructure/database/ensureTrimVehicleModelColumns');
      const r = await ensureTrimVehicleModelColumns();
      console.log(r.skipped
        ? '[BE] vehicle_models: cot chet da bo tu truoc, bo qua'
        : `[BE] vehicle_models: DA BO 5 COT CHET (${r.steps} buoc)`);
    } catch (trimErr) {
      console.error('[BE] KHONG THE KHOI DONG - bo cot chet vehicle_models that bai:');
      console.error(trimErr.message);
      process.exit(1);
    }

    try {
      await require('./infrastructure/database/ensureAuditLogsUnicode').ensureAuditLogsUnicodeColumns();
      console.log('[BE] audit_logs unicode columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureAuditLogsUnicodeColumns:', schemaErr.message);
    }

    try {
      await require('./infrastructure/database/ensureInventoryRequestUnicode').ensureInventoryRequestUnicode();
      console.log('[BE] inventory request unit columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureInventoryRequestUnicode:', schemaErr.message);
    }

    try {
      await require('./infrastructure/database/ensureRepairOrderTasksColumns').ensureRepairOrderTasksColumns();
      console.log('[BE] repair_order_tasks/repair_order_items note+prev_quantity columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureRepairOrderTasksColumns:', schemaErr.message);
    }

    try {
      await require('./infrastructure/database/ensureInvoicePaymentMethod').ensureInvoicePaymentMethod();
      console.log('[BE] invoices.payment_method column ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureInvoicePaymentMethod:', schemaErr.message);
    }

    // Metadata goi bao duong dinh ky (doi xe cua goi, nhom + yeu cau thuc hien
    // I/R/M/V theo bieu mau "Phieu kiem tra BDDK"). KHONG duoc nuot loi: code
    // moi SELECT thang cac cot nay o catalog va o checklist to truong/khoang -
    // thieu cot la 500 o khap noi thay vi mat 1 tinh nang.
    try {
      const { ensureMaintenancePackageMeta } = require('./infrastructure/database/ensureMaintenancePackageMeta');
      const r = await ensureMaintenancePackageMeta();
      console.log(r.skipped
        ? '[BE] metadata goi bao duong: da co tu truoc, bo qua'
        : `[BE] metadata goi bao duong: DA THEM XONG (${r.steps} buoc)`);
    } catch (metaErr) {
      console.error('[BE] KHONG THE KHOI DONG - them metadata goi bao duong that bai:');
      console.error(metaErr.message);
      process.exit(1);
    }

    // Cot repair_orders.bay_completed_at. Ban dau dung cho luong 2 buoc
    // (khoang bao xong -> to truong xac nhan); nay khoang khong con nut ket
    // thuc nua nen cot KHONG con duoc doc/ghi o dau. Giu buoc ensure lai de
    // dung schema giua cac may van khop nhau; muon bo han thi phai co
    // migration DROP COLUMN rieng.
    try {
      const { ensureBayCompletionConfirm } = require('./infrastructure/database/ensureBayCompletionConfirm');
      const r = await ensureBayCompletionConfirm();
      console.log(r.skipped
        ? '[BE] moc xac nhan hoan thanh: da co tu truoc, bo qua'
        : `[BE] moc xac nhan hoan thanh: DA THEM XONG (${r.steps} buoc)`);
    } catch (confirmErr) {
      console.error('[BE] KHONG THE KHOI DONG - them moc xac nhan hoan thanh that bai:');
      console.error(confirmErr.message);
      process.exit(1);
    }

    // Xoa phieu quyet toan thi hang muc / tien do / tho / lich nhac tu xoa
    // theo. Chi canh bao neu hong: day la tien ich don dep, thieu no thi xoa
    // phieu phai xoa tay chu khong lam sai chuc nang nao dang chay.
    try {
      const { ensureRepairOrderCascade } = require('./infrastructure/database/ensureRepairOrderCascade');
      const r = await ensureRepairOrderCascade();
      console.log(r.skipped
        ? '[BE] cascade xoa phieu: da co tu truoc, bo qua'
        : `[BE] cascade xoa phieu: DA DAT XONG (${r.steps} khoa ngoai)`);
    } catch (cascadeErr) {
      console.warn('[BE] ensureRepairOrderCascade:', cascadeErr.message);
    }

    // Cot chi dinh to truong cho phieu quyet toan. KHONG duoc nuot loi: cau
    // danh sach SELECT thang cot nay, thieu cot la 500 o ca man co van lan
    // man to truong.
    try {
      const { ensureAssignedTeamLeader } = require('./infrastructure/database/ensureAssignedTeamLeader');
      const r = await ensureAssignedTeamLeader();
      console.log(r.skipped
        ? '[BE] chi dinh to truong: da co tu truoc, bo qua'
        : `[BE] chi dinh to truong: DA THEM XONG (${r.steps} buoc)`);
    } catch (atlErr) {
      console.error('[BE] KHONG THE KHOI DONG - them cot chi dinh to truong that bai:');
      console.error(atlErr.message);
      process.exit(1);
    }

    // Cot to truong TU CHOI nhan viec (kem ly do) - di lien voi cot chi dinh
    // o tren. KHONG duoc nuot loi: bang "Việc chờ nhận" loc theo cot nay, thieu
    // cot la to truong nao cung thay phieu cua nguoi khac.
    try {
      const { ensureAssignmentDecline } = require('./infrastructure/database/ensureAssignmentDecline');
      const r = await ensureAssignmentDecline();
      console.log(r.skipped
        ? '[BE] tu choi nhan viec: da co tu truoc, bo qua'
        : `[BE] tu choi nhan viec: DA THEM XONG (${r.steps} buoc)`);
    } catch (declineErr) {
      console.error('[BE] KHONG THE KHOI DONG - them cot tu choi nhan viec that bai:');
      console.error(declineErr.message);
      process.exit(1);
    }

    // Loai hinh sua chua 'CS' (Cham soc xe) - FE/BE da cho phep nhung rang
    // buoc CHECK cua repair_order_items thi chua, nen luu phieu co dich vu
    // cham soc xe la chet o INSERT. KHONG duoc nuot loi: bo qua thi CVDV van
    // gap dung loi do.
    try {
      const { ensureRepairCategoryCS } = require('./infrastructure/database/ensureRepairCategoryCS');
      const r = await ensureRepairCategoryCS();
      console.log(r.skipped
        ? '[BE] loai hinh sua chua CS: da mo tu truoc, bo qua'
        : `[BE] loai hinh sua chua CS: DA MO XONG (${r.steps} buoc)`);
    } catch (csErr) {
      console.error('[BE] KHONG THE KHOI DONG - mo rang buoc loai hinh sua chua that bai:');
      console.error(csErr.message);
      process.exit(1);
    }

    // Gan doi xe cho dich vu le + phu tung (services/products.model_id) de
    // form quyet toan chi goi y do dung cho chinh chiec xe dang lam. KHONG
    // duoc nuot loi: thieu cot thi cau SELECT cua catalog gay 500 o form tao
    // phieu - hong han chuc nang chinh cua CVDV.
    try {
      const { ensureCatalogModel } = require('./infrastructure/database/ensureCatalogModel');
      const r = await ensureCatalogModel();
      console.log(r.skipped
        ? '[BE] doi xe cho catalog: da co tu truoc, bo qua'
        : `[BE] doi xe cho catalog: DA GAN XONG (${r.steps} buoc)`);
    } catch (catErr) {
      console.error('[BE] KHONG THE KHOI DONG - gan doi xe cho catalog that bai:');
      console.error(catErr.message);
      process.exit(1);
    }

    // Xu ly dau muc "Khong dat": cot ng_decision/ng_note/ng_decided_*.
    // KHONG duoc nuot loi - thieu cot thi to truong bam Hoan thanh duoc ca khi
    // con dau muc chua hoi khach, dung lo hong ma tinh nang nay sinh ra de va.
    try {
      const { ensureNgDecision } = require('./infrastructure/database/ensureNgDecision');
      const r = await ensureNgDecision();
      console.log(r.skipped
        ? '[BE] xu ly dau muc khong dat: da co tu truoc, bo qua'
        : `[BE] xu ly dau muc khong dat: DA THEM XONG (${r.steps} buoc)`);
    } catch (ngErr) {
      console.error('[BE] KHONG THE KHOI DONG - them cot xu ly dau muc khong dat that bai:');
      console.error(ngErr.message);
      process.exit(1);
    }

    // Cot export_requests.received_by (tho nhan phu tung khi xuat kho, thay
    // cho o "Ghi chu" tu do). KHONG duoc nuot loi: thieu cot thi tao phieu
    // xuat kho gui receivedBy len se chet ngay o INSERT.
    try {
      const { ensureExportRequestReceivedBy } = require('./infrastructure/database/ensureExportRequestReceivedBy');
      const r = await ensureExportRequestReceivedBy();
      console.log(r.skipped
        ? '[BE] tho nhan hang phieu xuat: da co tu truoc, bo qua'
        : `[BE] tho nhan hang phieu xuat: DA THEM XONG (${r.steps} buoc)`);
    } catch (recvErr) {
      console.error('[BE] KHONG THE KHOI DONG - them cot tho nhan hang phieu xuat that bai:');
      console.error(recvErr.message);
      process.exit(1);
    }

    // Cot export_requests.received_signature_data/received_signed_at (tho
    // nhan phu tung tu ky xac nhan, giong khach hang ky phieu quyet toan).
    // KHONG duoc nuot loi: thieu cot thi tao phieu xuat gui chu ky len se
    // chet ngay o INSERT.
    try {
      const { ensureExportRequestReceivedSignature } = require('./infrastructure/database/ensureExportRequestReceivedSignature');
      const r = await ensureExportRequestReceivedSignature();
      console.log(r.skipped
        ? '[BE] chu ky nguoi lay phieu xuat: da co tu truoc, bo qua'
        : `[BE] chu ky nguoi lay phieu xuat: DA THEM XONG (${r.steps} buoc)`);
    } catch (sigErr) {
      console.error('[BE] KHONG THE KHOI DONG - them cot chu ky nguoi lay phieu xuat that bai:');
      console.error(sigErr.message);
      process.exit(1);
    }

    // 8 cot chu ky phieu quyet toan (co van lap phieu ky, co van chot phieu
    // ky, khach ky nhan xe). KHONG duoc nuot loi: cau SELECT danh sach/chi
    // tiet doc thang cac cot nay, thieu cot la 500 o toan bo man co van.
    try {
      const { ensureSettlementSignatures } = require('./infrastructure/database/ensureSettlementSignatures');
      const r = await ensureSettlementSignatures();
      console.log(r.skipped
        ? '[BE] chu ky phieu quyet toan: da co tu truoc, bo qua'
        : `[BE] chu ky phieu quyet toan: DA THEM XONG (${r.steps} buoc)`);
    } catch (sigQtErr) {
      console.error('[BE] KHONG THE KHOI DONG - them cot chu ky phieu quyet toan that bai:');
      console.error(sigQtErr.message);
      process.exit(1);
    }

    // CVDV yeu cau tren tung dong hang muc (repair_order_items.requested_by) -
    // thay cho cach doan nguoc tu Nhat ky hoat dong theo thoi gian (sai khi 1
    // lan xuat kho gom hang muc cua nhieu lan sua khac nhau). Khong nuot loi:
    // RepairSettlementRepositoryImpl._insertItems ghi thang cot nay.
    try {
      const { ensureRepairOrderItemRequestedBy } = require('./infrastructure/database/ensureRepairOrderItemRequestedBy');
      const r = await ensureRepairOrderItemRequestedBy();
      console.log(r.skipped
        ? '[BE] CVDV yeu cau tren hang muc phieu: da co tu truoc, bo qua'
        : `[BE] CVDV yeu cau tren hang muc phieu: DA THEM XONG (${r.steps} buoc)`);
    } catch (roiRbErr) {
      console.error('[BE] KHONG THE KHOI DONG - them CVDV yeu cau tren hang muc phieu that bai:');
      console.error(roiRbErr.message);
      process.exit(1);
    }

    // Snapshot CVDV yeu cau vao tung dong giao dich kho luc xuat/tra (inventory_transactions
    // .requested_by) - repair_order_items bi xoa/chen lai moi lan sua phieu
    // nen phai chup lai tai thoi diem xuat, doc live se sai neu phieu bi sua
    // tiep sau do. Khong nuot loi: ExportRequestRepositoryImpl.confirmPickup
    // ghi thang cot nay.
    try {
      const { ensureInventoryTransactionRequestedBy } = require('./infrastructure/database/ensureInventoryTransactionRequestedBy');
      const r = await ensureInventoryTransactionRequestedBy();
      console.log(r.skipped
        ? '[BE] snapshot CVDV yeu cau tren giao dich kho: da co tu truoc, bo qua'
        : `[BE] snapshot CVDV yeu cau tren giao dich kho: DA THEM XONG (${r.steps} buoc)`);
    } catch (itRbErr) {
      console.error('[BE] KHONG THE KHOI DONG - them snapshot CVDV yeu cau tren giao dich kho that bai:');
      console.error(itRbErr.message);
      process.exit(1);
    }

    // Bang export_request_pickups + cot inventory_transactions.pickup_id -
    // cho phep xuat kho nhieu lan / tra hang tren cung 1 phieu xuat. KHONG
    // duoc nuot loi: thieu bang thi man xuat kho hong hoan toan.
    try {
      const { ensureExportPickups } = require('./infrastructure/database/ensureExportPickups');
      const r = await ensureExportPickups();
      console.log(r.skipped
        ? '[BE] lich su lay hang phieu xuat: da co tu truoc, bo qua'
        : `[BE] lich su lay hang phieu xuat: DA THEM XONG (${r.steps} buoc)`);
    } catch (pickupErr) {
      console.error('[BE] KHONG THE KHOI DONG - them lich su lay hang phieu xuat that bai:');
      console.error(pickupErr.message);
      process.exit(1);
    }

    // Gio chinh xac cua tung giao dich kho (inventory_transactions.created_at)
    // - PHAI chay SAU ensureExportPickups vi backfill doc export_request_pickups.
    // KHONG duoc nuot loi: bieu do lich su ton kho SELECT thang cot nay.
    try {
      const { ensureInventoryTransactionCreatedAt } = require('./infrastructure/database/ensureInventoryTransactionCreatedAt');
      const r = await ensureInventoryTransactionCreatedAt();
      console.log(r.skipped
        ? '[BE] gio giao dich kho: da co tu truoc, bo qua'
        : `[BE] gio giao dich kho: DA THEM XONG (${r.steps} buoc)`);
    } catch (itErr) {
      console.error('[BE] KHONG THE KHOI DONG - them gio giao dich kho that bai:');
      console.error(itErr.message);
      process.exit(1);
    }

    // Chu ky NV kho tren header phieu xuat (ky 1 lan/phieu). Khong nuot loi:
    // confirmPickup va man phieu xuat SELECT/UPDATE thang cac cot nay.
    try {
      const { ensureExportIssuerSignature } = require('./infrastructure/database/ensureExportIssuerSignature');
      const r = await ensureExportIssuerSignature();
      console.log(r.skipped
        ? '[BE] chu ky NV kho phieu xuat: da co tu truoc, bo qua'
        : `[BE] chu ky NV kho phieu xuat: DA THEM XONG (${r.steps} buoc)`);
    } catch (isErr) {
      console.error('[BE] KHONG THE KHOI DONG - them chu ky NV kho phieu xuat that bai:');
      console.error(isErr.message);
      process.exit(1);
    }

    // Ma phieu xuat RIENG (ERB-...), khong con dung lai ma cua Lenh sua chua
    // nua - cot "Ma phieu" tren danh sach truoc day hien y het cot "Phieu sua
    // chua" ben canh. Backfill lai ma cho phieu cu theo dung thu tu tao.
    // Khong nuot loi: sai thi trung ma / ma sai dinh dang.
    try {
      const { ensureExportRequestOwnCode } = require('./infrastructure/database/ensureExportRequestOwnCode');
      const r = await ensureExportRequestOwnCode();
      console.log(r.skipped
        ? '[BE] ma phieu xuat rieng: khong con phieu nao dung ma cu, bo qua'
        : `[BE] ma phieu xuat rieng: DA DOI ${r.updated} phieu`);
    } catch (ercErr) {
      console.error('[BE] KHONG THE KHOI DONG - doi ma phieu xuat rieng that bai:');
      console.error(ercErr.message);
      process.exit(1);
    }

    // Chu ky NV kho THEO TUNG LAN xuat/tra (export_request_pickups.issuer_signature_data)
    // - thay cho chu ky 1-lan-cho-ca-phieu o header (moi lan co the la NV kho
    // khac nhau). Khong nuot loi: confirmPickup ghi thang cot nay moi lan.
    try {
      const { ensureExportPickupIssuerSignature } = require('./infrastructure/database/ensureExportPickupIssuerSignature');
      const r = await ensureExportPickupIssuerSignature();
      console.log(r.skipped
        ? '[BE] chu ky NV kho theo tung lan xuat: da co tu truoc, bo qua'
        : `[BE] chu ky NV kho theo tung lan xuat: DA THEM XONG (${r.steps} buoc)`);
    } catch (pkIsErr) {
      console.error('[BE] KHONG THE KHOI DONG - them chu ky NV kho theo tung lan xuat that bai:');
      console.error(pkIsErr.message);
      process.exit(1);
    }

    // Backfill chu ky NV kho vao dong pickup DAU TIEN cua du lieu CU (tao
    // truoc khi co cot o tren) - khong thi "Lich su luu phieu" cua nhung
    // phieu xuat tu truoc deploy nay se thieu han chu ky NV kho o lan dau.
    // PHAI chay SAU ensureExportPickupIssuerSignature (can cot vua tao).
    // Khong nuot loi: sai thi lich su hien sai nguoi ky.
    try {
      const { ensureExportPickupIssuerSignatureBackfill } = require('./infrastructure/database/ensureExportPickupIssuerSignatureBackfill');
      const r = await ensureExportPickupIssuerSignatureBackfill();
      console.log(r.skipped
        ? '[BE] backfill chu ky NV kho lan xuat dau: khong con gi de chep, bo qua'
        : `[BE] backfill chu ky NV kho lan xuat dau: DA CHEP ${r.updated} phieu`);
    } catch (pkBfErr) {
      console.error('[BE] KHONG THE KHOI DONG - backfill chu ky NV kho lan xuat dau that bai:');
      console.error(pkBfErr.message);
      process.exit(1);
    }

    // Ma khach hang (customers.customer_code) bat buoc - khong khach nao duoc
    // de trong. Doi rang buoc cot nen KHONG duoc nuot loi.
    try {
      const { ensureCustomerCodeNotNull } = require('./infrastructure/database/ensureCustomerCodeNotNull');
      const r = await ensureCustomerCodeNotNull();
      console.log(r.skipped
        ? '[BE] ma khach hang bat buoc: da siet tu truoc, bo qua'
        : `[BE] ma khach hang bat buoc: DA SIET XONG (${r.steps} buoc)`);
    } catch (ccErr) {
      console.error('[BE] KHONG THE KHOI DONG - siet ma khach hang that bai:');
      console.error(ccErr.message);
      process.exit(1);
    }

    // vehicle_models.year_from -> NULL (chi la ghi chu, khong logic nao dung;
    // form them dong xe khong bat nhap nua). Doi rang buoc cot nen KHONG
    // duoc nuot loi.
    try {
      const { ensureVehicleModelYearOptional } = require('./infrastructure/database/ensureVehicleModelYearOptional');
      const r = await ensureVehicleModelYearOptional();
      console.log(r.skipped
        ? '[BE] nam san xuat dong xe: da noi tu truoc, bo qua'
        : `[BE] nam san xuat dong xe: DA NOI XONG (${r.steps} buoc)`);
    } catch (vmErr) {
      console.error('[BE] KHONG THE KHOI DONG - noi cot nam san xuat dong xe that bai:');
      console.error(vmErr.message);
      process.exit(1);
    }

    // Khoa ngoai cho 9 bang truoc gio chi noi bang id trong code (login_sessions,
    // notifications, payos_transactions, export_request_pickups, vehicle_bays...).
    // PHAI chay CUOI CUNG: can cac cot/bang do ensureExportPickups va
    // ensureExportIssuerSignature tao ra. Khong nuot loi: don dong mo coi + them
    // FK trong 1 transaction, hong la DB o trang thai cu.
    try {
      const { ensureMissingForeignKeys } = require('./infrastructure/database/ensureMissingForeignKeys');
      const r = await ensureMissingForeignKeys();
      console.log(r.skipped
        ? '[BE] khoa ngoai con thieu: da co tu truoc, bo qua'
        : `[BE] khoa ngoai con thieu: DA THEM XONG (${r.steps} buoc, don ${r.cleaned.reduce((s, c) => s + c.n, 0)} dong mo coi)`);
    } catch (fkErr) {
      console.error('[BE] KHONG THE KHOI DONG - them khoa ngoai con thieu that bai:');
      console.error(fkErr.message);
      process.exit(1);
    }

    const server = http.createServer({ maxHeaderSize: 32768 }, app);
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });

    // Keep timeouts reasonable for dev/prod
    server.headersTimeout = 60000;
    server.requestTimeout = 60000;

    syncMaintenanceReminders();
    setInterval(syncMaintenanceReminders, MAINTENANCE_REMINDER_SYNC_INTERVAL_MS);

  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();



