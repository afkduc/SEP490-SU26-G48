// SQL Server 'datetime' khong luu mui gio, va driver mssql (tedious, useUTC
// mac dinh true) doc/ghi cot nay theo TRUC UTC cua JS Date - bat ke may chu
// Node hay SQL Server dang chay o mui gio he thong nao. Neu dung GETDATE() o
// SQL Server (phu thuoc dong ho he dieu hanh cua may chu DB) hoac dung
// `new Date().getHours()` o Node (phu thuoc mui gio he dieu hanh cua may chu
// BE), gio hien thi co the bi lech neu 1 trong 2 may khong dat mui gio VN.
//
// Cach lam an toan, khong phu thuoc cau hinh ha tang: tu tinh gio VIET NAM
// THAT (Asia/Ho_Chi_Minh) tai tang ung dung bang Intl API (luon dung, khong
// phu thuoc TZ cua process), roi dung Date.UTC(...) de tao 1 Date co truc UTC
// dung bang cac con so gio VN do - ghi thang gia tri nay vao cot datetime.
// Khi doc lai, dung .getUTCXxx() (KHONG dung .getXxx() local) se ra dung lai
// cac con so da ghi, bat ke may chu nao dang chay o dau.
function nowVN() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date()).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour; // hour12:false co the tra ve "24" cho 0h

  return new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(hour), Number(parts.minute), Number(parts.second)
  ));
}

module.exports = { nowVN };
