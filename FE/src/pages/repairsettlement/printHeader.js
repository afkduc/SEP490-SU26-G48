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
// giải được. Dùng absolute theo origin hiện tại cho chắc - dùng chung cho MOI
// anh tinh trong FE/public (logo, so do xe...), khong chi rieng logo.
export function urlAsset(duongDan) {
  const goc = typeof window !== 'undefined' ? window.location.origin : '';
  return `${goc}${BASE_PATH}${duongDan}`;
}

export function urlLogo() {
  return urlAsset('/AutoGaraLogo-Photoroom.png');
}

// Mo 1 cua so moi va in noi dung HTML da dung san - dung chung cho MOI mau in
// (quyet toan, danh sach cong viec, phieu tiep nhan...) va MOI man hinh goi
// in (trang quyet toan, lich su khach hang, man to truong).
//
// 2 loi that da gap khi tu viet doan nay o moi cho:
//
// 1. `w.onload = () => w.print()` gan SAU khi document.close(): neu trang
//    khong co anh nao (phieu in luc chua co ma QR) thi no da load xong TRUOC
//    luc gan, su kien load khong bao gio ban nua -> bam In khong ra hop thoai
//    nao, nguoi dung tuong nut hong. Phai xet readyState truoc.
//
// 2. window.open tra ve null khi bi trinh duyet chan popup - goi thang
//    w.document.write se nem "Cannot read properties of null" giua chung,
//    khong ai biet chuyen gi. Tra ve ly do de cho goi bao cho tu te.
//
// 3. Doi readyState==='complete'/su kien 'load' cua WINDOW tuong la du, nhung
//    voi trang dung document.write()+close() thi Chrome co the bao 'complete'
//    NGAY LAP TUC (parse xong la xong), truoc ca khi kip gui request cho
//    <img src="https://..."> con ma QR (qua api.qrserver.com, anh chu ky la
//    data: URI nen luon tuc thi, khong dinh loi nay) - ket qua la ban in ra
//    thieu han ma QR (o QR trong rong) du code van "cho load" nhu binh
//    thuong. Phai doi RIENG tung <img> load/error xong that su, khong dua
//    vao readyState nua.
//
// Tra ve '' neu in duoc, hoac cau thong bao loi.
export function moCuaSoIn(html) {
  const w = window.open('', '_blank');
  if (!w) {
    return 'Trình duyệt đã chặn cửa sổ in. Hãy cho phép pop-up cho trang này rồi bấm In lại.';
  }
  w.document.write(html);
  w.document.close();

  let daIn = false;
  const inRa = () => {
    if (daIn) return;
    daIn = true;
    try {
      w.focus();
      w.print();
    } catch {
      /* nguoi dung dong cua so truoc khi kip in - khong co gi de lam */
    }
  };

  // Doi TAT CA <img> trong trang (chu ky + ma QR) tai xong (load hoac error)
  // roi moi in. Gioi han 2s de khong treo cua so in mai neu mang cham/mang
  // hong - luc do in thieu ma QR con hon khong in duoc gi.
  const choAnhRoiIn = () => {
    const imgs = Array.from(w.document.images || []);
    const chuaXong = imgs.filter((img) => !img.complete);
    if (chuaXong.length === 0) {
      inRa();
      return;
    }
    let conLai = chuaXong.length;
    const motAnhXong = () => {
      conLai -= 1;
      if (conLai <= 0) inRa();
    };
    chuaXong.forEach((img) => {
      img.addEventListener('load', motAnhXong, { once: true });
      img.addEventListener('error', motAnhXong, { once: true });
    });
    setTimeout(inRa, 2000);
  };

  if (w.document.readyState === 'complete') choAnhRoiIn();
  else w.addEventListener('load', choAnhRoiIn, { once: true });
  return '';
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
