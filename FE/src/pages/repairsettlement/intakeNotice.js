// Dong nhac cuoi phieu tiep nhan / ban giao xe.
//
// Dat rieng 1 cho vi cung mot noi dung phai xuat hien o 3 duong: form tao
// phieu (IntakeChecklistSection), man chi xem (IntakeChecklistView - dung cho
// ca trang Chinh sua lan modal Xem chi tiet) va ban in. Sua cau chu o day la
// ca 3 cho doi theo, khong the lech nhau - day la cam ket khach da ky nen 3
// noi ma khac chu thi la van de that su, khong phai chi xau.
export const INTAKE_NOTICE_LINES = [
  'Quý Khách vui lòng mang theo toàn bộ tư trang, tiền bạc, vật dụng có giá trị ra khỏi xe. '
    + 'Không tự ý lái xe trong xưởng và nhận lại xe tại khu vực giao xe.',
  'Quý Khách đồng ý cho phép Đại lý sử dụng chiếc xe này trên đường thử trong trường hợp cần thiết '
    + 'để phục vụ cho mục đích kiểm tra, sửa chữa.',
];

// Style cua khoi cam ket - dung chung luon (truoc day copy o 2 file, sua 1
// ben la lech ngay).
//
// Co chu theo be ngang man hinh bang clamp(): iPad doc (768px) ra ~15px,
// iPad ngang / laptop (>=1024px) ra 17px, khong to vo han tren man rong.
// Day la doan khach PHAI doc truoc khi ky nen khong duoc de chu nho nhu ghi
// chu phu - CVDV thuong dua iPad cho khach doc tai cho.
export const INTAKE_NOTICE_STYLE = {
  marginTop: 16,
  padding: '14px 18px',
  borderRadius: 8,
  background: 'var(--gray-50)',
  border: '1px solid var(--gray-200)',
  borderLeft: '4px solid var(--primary, #4F46E5)',
  fontSize: 'clamp(15px, 1.1vw + 6px, 17px)',
  lineHeight: 1.75,
  color: '#1F2937',
};

// Khoang cach giua 2 dong cam ket - tach dong cho de doc, khong dinh lien.
export const INTAKE_NOTICE_LINE_STYLE = { marginBottom: 6 };

export default INTAKE_NOTICE_LINES;
