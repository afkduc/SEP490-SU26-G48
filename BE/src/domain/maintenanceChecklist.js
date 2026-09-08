// Quy uoc "YEU CAU THUC HIEN" cua bieu mau Mazda "Phu luc 3 - Phieu kiem tra
// bao duong dinh ky" (chu giai o cuoi ca 2 sheet MAD va Pick-up):
//
//   I: Kiem tra, dieu chinh hoac thay the neu can thiet
//   R: Thay the
//   M: Thao, ve sinh va do kiem
//   V: Kiem tra bang mat (khong thao lap)
//
// Ma chu chi de LUU; moi cho hien thi cho nguoi dung deu ghi ra chu tieng
// Viet day du (FE/Landing giu ban sao cua bang nay).
const ACTION_LABELS = {
  I: 'Kiểm tra, điều chỉnh hoặc thay thế nếu cần thiết',
  R: 'Thay thế',
  M: 'Tháo, vệ sinh và đo kiểm',
  V: 'Kiểm tra bằng mắt (không tháo lắp)',
};

// Bieu mau co cot KET QUA (OK/NG) - chi co y nghia voi dau muc KIEM TRA.
// Dau muc "Thay the" (R) thi khong danh gia dat/khong dat, chi tick da thay
// xong; dau muc khong thuoc goi bao duong nao (actionCode = null) cung vay.
const CHECK_RESULT_ACTIONS = new Set(['I', 'M', 'V']);

function needsCheckResult(actionCode) {
  return CHECK_RESULT_ACTIONS.has(String(actionCode || '').toUpperCase());
}

const CHECK_RESULTS = ['OK', 'NG'];

module.exports = { ACTION_LABELS, CHECK_RESULT_ACTIONS, CHECK_RESULTS, needsCheckResult };
