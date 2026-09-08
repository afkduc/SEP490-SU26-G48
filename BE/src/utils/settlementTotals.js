// Tinh tien cua 1 phieu quyet toan tu danh sach hang muc.
//
// Tach rieng khoi RepairSettlementService de TANG REPOSITORY dung lai duoc
// (vd them phu tung khi khach dong y thay 1 dau muc "Khong dat" - phai tinh
// lai tong ngay trong cung transaction voi luc chen hang muc). Neu de trong
// service thi repository require nguoc lai service -> phu thuoc vong.
//
// Mot cong thuc DUY NHAT cho moi duong ghi tien - truoc day chi co service
// tinh, them 1 duong ghi khac la de lech tien voi hoa don/PayOS.

// Mien thu khach: 'BHH'/'BH' bao hanh, 'NB' noi bo, 'HUY' khach huy giua
// chung. Cac hang muc nay VAN nam tren phieu (de biet da lam gi) nhung khong
// cong vao tien khach phai tra.
const EXEMPT_HTTT_VALUES = new Set(['BHH', 'BH', 'NB', 'HUY']);

const VAT_RATE = 0.08;

function calcTotalsFromItems(items) {
  let subtotal = 0;
  let discountAmount = 0;
  let freeAmount = 0;
  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const base = qty * unitPrice;
    if (item.isFree) {
      freeAmount += base;
      continue;
    }
    if (EXEMPT_HTTT_VALUES.has(item.httt)) continue;
    const discountPct = Number(item.discount) || 0;
    subtotal += base * (1 - discountPct / 100);
    discountAmount += base * (discountPct / 100);
  }
  subtotal = Math.round(subtotal);
  discountAmount = Math.round(discountAmount);
  freeAmount = Math.round(freeAmount);
  const vat = Math.round(subtotal * VAT_RATE);
  return { subtotal, discountAmount, afterDiscount: subtotal, vat, freeAmount, total: subtotal + vat };
}

module.exports = { calcTotalsFromItems, EXEMPT_HTTT_VALUES, VAT_RATE };
