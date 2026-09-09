const crypto = require('crypto');
const { error } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const { sqlErrorMessage, CHUNG } = require('../utils/sqlErrorMessage');

// Loi KHONG phai ApiError (tuc la loi ngoai du tinh: SQL Server, bug code,
// thu vien...) thi TUYET DOI khong tra err.message ra client.
//
// Truoc day tra thang, nen nguoi dung gap nguyen van chuoi cua SQL Server:
//   The INSERT statement conflicted with the CHECK constraint
//   "roi_repair_category_chk" ... table "dbo.repair_order_items", column
//   'repair_category'.
// Vua khong ai hieu de xu ly, vua lo ten bang/cot/rang buoc ra ngoai.
//
// Doi lai: nguoi dung nhan cau tieng Viet + 1 MA LOI ngan; chi tiet that ghi
// day du o log may chu kem dung ma do, de bao loi la tra ra duoc ngay dong
// log tuong ung, khong phai mo mam theo gio.
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError && err.statusCode < 500) {
    console.warn(`[${err.statusCode}] ${req.method} ${req.originalUrl} - ${err.message}`);
    return error(res, err.message, err.statusCode, null, {
      code: err.code || null,
      details: err.details || null,
    });
  }

  // ApiError 5xx: thong diep do chinh minh viet ra nen van an toan de tra ve.
  if (err instanceof ApiError) {
    console.error(`[${err.statusCode}] ${req.method} ${req.originalUrl}`, err);
    return error(res, err.message, err.statusCode, null, {
      code: err.code || null,
      details: err.details || null,
    });
  }

  const maLoi = crypto.randomBytes(4).toString('hex').toUpperCase();
  console.error(`[500] [${maLoi}] ${req.method} ${req.originalUrl}`
    + (req.user?.userId ? ` - user ${req.user.userId}` : ''), err);

  // Ghep ma loi vao CHINH cau thong bao: cac man hinh chi hien err.message
  // chu khong doc truong `code`, de rieng ra thi nguoi dung khong bao gio
  // thay - ma khong co ma thi tra log van phai mo mam theo gio.
  const thongBao = `${sqlErrorMessage(err) || CHUNG} (Mã lỗi: ${maLoi})`;
  return error(res, thongBao, 500, null, { code: maLoi });
}

module.exports = errorHandler;
