// Khối tiêu đề (logo + tên công ty + tên phiếu) dùng chung cho MỌI bản in.
//
// Trước đây mỗi mẫu in tự viết phần đầu: phiếu quyết toán có mỗi dòng chữ
// "CÔNG TY TNHH AUTOGARA – CHI NHÁNH ...", danh sách công việc và phiếu tiếp
// nhận thì không có gì - tờ giấy đưa cho khách không nhận ra là của AutoGara.
import { BASE_PATH } from '../../config';
import { MOCK_BRANCH } from './mockData';

const TEN_CONG_TY = 'CÔNG TY TNHH AUTOGARA';

// Cửa sổ in được mở bằng window.open('', '_blank') rồi document.write - tài
// liệu đó không có <base>, nên đường dẫn tương đối ("/crm/...") có thể không
// giải được. Dùng absolute theo origin hiện tại cho chắc.
export function urlLogo() {
  const goc = typeof window !== 'undefined' ? window.location.origin : '';
  return `${goc}${BASE_PATH}/AutoGaraLogo-Photoroom.png`;
}

// CSS cho khối tiêu đề - nhúng vào <style> của từng mẫu in.
// Bố cục: logo ghim bên trái, phần chữ vẫn CĂN GIỮA như mẫu phiếu cũ (ô trống
// bên phải rộng bằng logo để chữ giữa thật, không bị lệch).
// print-color-adjust: trình duyệt mặc định bỏ nền/màu khi in, không có nó thì
// vạch kẻ dưới tiêu đề biến mất trên giấy.
export const PRINT_HEADER_CSS = `
  .ag-head { display:flex; align-items:center; gap:10px;
             border-bottom:2px solid #111; padding-bottom:6px; margin-bottom:8px; }
  .ag-head__logo, .ag-head__chen { width:78px; flex-shrink:0; }
  .ag-head__logo { height:50px; object-fit:contain; object-position:left center; }
  .ag-head__giua { flex:1; text-align:center; line-height:1.4; }
  .ag-head__cty { font-weight:700; font-size:12px; }
  .ag-head__ten { font-weight:700; font-size:16px; letter-spacing:0.5px; margin-top:2px; }
  .ag-head__phu { font-size:10.5px; color:#333; margin-top:1px; }
  @media print {
    .ag-head { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
`;

/**
 * @param {string} tieuDe   tên phiếu, vd "QUYẾT TOÁN SỬA CHỮA"
 * @param {Object} tuyChon
 * @param {string} tuyChon.chiNhanh  tên chi nhánh (order.branch)
 * @param {string} tuyChon.phuDe     dòng nhỏ dưới tên phiếu (vd "Số RO: ...")
 */
export function khoiTieuDeIn(tieuDe, { chiNhanh, phuDe = '' } = {}) {
  const ten = (chiNhanh || MOCK_BRANCH).toUpperCase();
  return `
<div class="ag-head">
  <img class="ag-head__logo" src="${urlLogo()}" alt="AutoGara" />
  <div class="ag-head__giua">
    <div class="ag-head__cty">${TEN_CONG_TY} – CHI NHÁNH ${ten}</div>
    <div class="ag-head__ten">${tieuDe}</div>
    ${phuDe ? `<div class="ag-head__phu">${phuDe}</div>` : ''}
  </div>
  <div class="ag-head__chen"></div>
</div>`;
}
