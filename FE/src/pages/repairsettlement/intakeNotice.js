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

export default INTAKE_NOTICE_LINES;
