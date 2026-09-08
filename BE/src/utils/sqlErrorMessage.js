// Doi loi tho cua SQL Server thanh cau tieng Viet nguoi dung doc duoc.
//
// Truoc day errorHandler tra thang err.message ra client, nen nguoi dung gap
// nguyen van:
//
//   The INSERT statement conflicted with the CHECK constraint
//   "roi_repair_category_chk". The conflict occurred in database "AutoGaraDB",
//   table "dbo.repair_order_items", column 'repair_category'.
//
// Vua khong ai hieu, vua lo ten bang / ten cot / ten rang buoc ra ngoai - do
// la thong tin giup nguoi co y do do duoc cau truc CSDL ma khong can vao DB.
//
// Nguyen tac: nguoi dung nhan cau chung chung nhung DUNG huong xu ly; chi
// tiet that van ghi day du o log may chu (xem errorHandler).

// mssql boc loi nhieu tang: so hieu co the nam o err.number, hoac chui trong
// err.originalError.info.number (loi tu tedious).
function soHieuLoi(err) {
  return err?.number
    ?? err?.originalError?.info?.number
    ?? err?.originalError?.number
    ?? null;
}

// Ma loi cua SQL Server: https://learn.microsoft.com/sql/relational-databases/errors-events/
const THEO_SO_HIEU = {
  547: 'Dữ liệu vừa nhập không hợp lệ hoặc đang được bản ghi khác sử dụng, không lưu được. '
    + 'Vui lòng kiểm tra lại các ô đã chọn.',
  2627: 'Dữ liệu này đã tồn tại trong hệ thống, không thể thêm trùng.',
  2601: 'Dữ liệu này đã tồn tại trong hệ thống, không thể thêm trùng.',
  515: 'Còn thông tin bắt buộc chưa được điền, vui lòng kiểm tra lại biểu mẫu.',
  8152: 'Nội dung vừa nhập quá dài so với giới hạn cho phép.',
  2628: 'Nội dung vừa nhập quá dài so với giới hạn cho phép.',
  245: 'Giá trị vừa nhập không đúng định dạng (ví dụ chữ ở ô chỉ nhận số).',
  8114: 'Giá trị vừa nhập không đúng định dạng (ví dụ chữ ở ô chỉ nhận số).',
  1205: 'Hệ thống đang xử lý nhiều việc cùng lúc nên thao tác bị hủy. Vui lòng thử lại.',
};

// Loi ket noi/thao tac cua driver (khong co so hieu SQL Server).
const THEO_MA_DRIVER = {
  ETIMEOUT: 'Máy chủ dữ liệu phản hồi quá chậm. Vui lòng thử lại sau ít phút.',
  ETIMEOUT_CONNECTION: 'Không kết nối được máy chủ dữ liệu. Vui lòng thử lại sau ít phút.',
  ECONNCLOSED: 'Mất kết nối tới máy chủ dữ liệu. Vui lòng thử lại.',
  ECONNRESET: 'Mất kết nối tới máy chủ dữ liệu. Vui lòng thử lại.',
  ELOGIN: 'Không đăng nhập được vào máy chủ dữ liệu. Vui lòng báo quản trị hệ thống.',
  ESOCKET: 'Mất kết nối tới máy chủ dữ liệu. Vui lòng thử lại.',
};

const CHUNG = 'Hệ thống gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại; '
  + 'nếu vẫn lỗi, báo quản trị hệ thống kèm mã lỗi.';

// Loi CO PHAI tu tang du lieu khong - de errorHandler biet co nen giau
// err.message di hay khong.
function laLoiSql(err) {
  if (!err) return false;
  if (soHieuLoi(err) != null) return true;
  if (err.code && THEO_MA_DRIVER[err.code]) return true;
  return err.name === 'RequestError' || err.name === 'ConnectionError' || err.name === 'TransactionError';
}

// Tra ve cau tieng Viet cho 1 loi CSDL, hoac null neu khong phai loi CSDL.
function sqlErrorMessage(err) {
  if (!laLoiSql(err)) return null;
  const so = soHieuLoi(err);
  if (so != null && THEO_SO_HIEU[so]) return THEO_SO_HIEU[so];
  if (err.code && THEO_MA_DRIVER[err.code]) return THEO_MA_DRIVER[err.code];
  return CHUNG;
}

module.exports = { sqlErrorMessage, laLoiSql, soHieuLoi, CHUNG };
