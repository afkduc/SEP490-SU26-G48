const sql = require('mssql');
const { getPool } = require('./sqlServer');

// Phieu quyet toan phai co IT NHAT 2 nguoi ky (yeu cau nghiep vu): khach hang
// va co van dich vu. Truoc day chi co 1 chu ky duy nhat cua khach, ky 1 lan
// luc lap phieu (cot signature_data/signature_signer_name/signature_signed_at,
// GIU NGUYEN, khong doi ten de khong pha cac duong doc hien co va tai lieu).
//
// Chia lam 2 MOC ky, vi phieu khong di cung 1 co van tu dau den cuoi - co van
// A lap phieu hom tiep nhan xe, hom khach quay lai nhan xe co the la co van B
// chot phieu:
//
//   Moc 1 (lap phieu)   : khach duyet bao gia  -> signature_* (da co)
//                         co van lap phieu ky  -> advisor_signature_*
//   Moc 2 (giao xe)     : co van CHOT phieu ky -> closing_*
//                         khach xac nhan nhan xe -> customer_final_*
//
// Bao nhieu lan ban giao cung khong vo: ai chot thi nguoi do ky o moc 2, chu
// ky cua nguoi lap o moc 1 van nguyen.
//
// closing_advisor_id con de tra loi "phieu nay CO VAN NAO done": duong thanh
// toan PayOS chay qua webhook (khong co user dang nhap) nen truoc day
// invoices.issued_by bi gan = nguoi LAP phieu, sai voi thuc te khi co ban
// giao. Xem RepairSettlementService.handlePayosWebhook.
//
// Khong tach bang rieng ma them cot: so chu ky co dinh (4), va them bang moi
// thi phai sua lai ERD + Data Dictionary trong tai lieu da gan xong.
//
// Toan bo cot deu NULL duoc - phieu cu (da xuat hoa don / da huy) giu nguyen,
// chi tiet se hien "Chua ky", dung voi thuc te luc do chua co tinh nang nay.

const COT = [
  ['advisor_signature_data', 'NVARCHAR(MAX)'],
  ['advisor_signed_at', 'DATETIME'],
  ['closing_advisor_id', 'BIGINT'],
  ['closing_signature_data', 'NVARCHAR(MAX)'],
  ['closing_signed_at', 'DATETIME'],
  ['customer_final_signature_data', 'NVARCHAR(MAX)'],
  // Nguoi den nhan xe co the khac nguoi mang xe den (vo/chong, lai xe cong
  // ty...) nen phai luu ten rieng, khong dung lai signature_signer_name.
  ['customer_final_signer_name', 'NVARCHAR(255)'],
  ['customer_final_signed_at', 'DATETIME'],
];

const STEPS = [
  ...COT.map(([ten, kieu]) => ([
    `Them cot repair_orders.${ten}`,
    `
      IF COL_LENGTH('dbo.repair_orders','${ten}') IS NULL
        ALTER TABLE dbo.repair_orders ADD ${ten} ${kieu} NULL;
    `,
  ])),
  ['Them khoa ngoai closing_advisor_id -> users', `
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
                   WHERE name = 'FK_repair_orders_closing_advisor')
      ALTER TABLE dbo.repair_orders
        ADD CONSTRAINT FK_repair_orders_closing_advisor
        FOREIGN KEY (closing_advisor_id) REFERENCES dbo.users(id);
  `],
];

async function alreadyDone(pool) {
  const r = await pool.request().query(
    `SELECT CASE WHEN COL_LENGTH('dbo.repair_orders','closing_advisor_id') IS NOT NULL
                  AND COL_LENGTH('dbo.repair_orders','customer_final_signed_at') IS NOT NULL
                 THEN 1 ELSE 0 END AS done`
  );
  return r.recordset[0].done === 1;
}

async function ensureSettlementSignatures() {
  const pool = await getPool();
  if (await alreadyDone(pool)) return { skipped: true, steps: 0 };

  const tx = new sql.Transaction(pool);
  await tx.begin();
  const done = [];
  try {
    await tx.request().batch('SET XACT_ABORT ON;');
    for (const [label, statement] of STEPS) {
      await tx.request().batch(statement);
      done.push(label);
    }
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction da tu abort */ }
    err.message = `[chu ky phieu quyet toan] hong o buoc "${done.length + 1}. ${STEPS[done.length]?.[0] || '?'}" `
      + `(da chay xong ${done.length}/${STEPS.length}, TAT CA da rollback): ${err.message}`;
    throw err;
  }
  return { skipped: false, steps: done.length };
}

module.exports = { ensureSettlementSignatures, STEPS, COT };
