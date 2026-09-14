// Xu ly danh sach hang muc cua phieu quyet toan.
//
// Tach ra file rieng vi CA BA cho deu can: form tao/sua phieu, ban in, va
// modal "Lịch sử xe". De trong RepairSettlementPage roi import nguoc lai se
// thanh vong (trang do import chinh modal Lich su xe).

// Suy luan lai nhom "dich vu/goi da chon + phu tung/dich vu con tu dong chen
// kem theo" tu du lieu da luu (BE khong luu quan he cha-con, groupId chi ton
// tai o FE). Dau nhom la 1 dich vu le that (co serviceId, don gia > 0) hoac 1
// dong goi combo (khong co serviceId). Cac dong ngay sau no la PT hoac DV gia
// 0 (dich vu con cua goi) deu la "con" cua dau nhom gan nhat, cho den khi gap
// dau nhom tiep theo - dung de khi Xoa/chon lai dau nhom thi don dep dung cac
// dong con di kem, khong de sot lai orphan.
export function assignGroupIds(items, nextGroupId) {
  let currentGroupId = null;
  return items.map((it) => {
    const isHead = it.lhsc === 'DV' && (!it.serviceId || (it.unitPrice || 0) > 0);
    if (isHead) {
      currentGroupId = nextGroupId();
      return { ...it, groupId: currentGroupId, isGroupParent: true };
    }
    const isChild = currentGroupId && (it.lhsc === 'PT' || (it.lhsc === 'DV' && (it.unitPrice || 0) === 0));
    if (isChild) {
      return { ...it, groupId: currentGroupId };
    }
    currentGroupId = null;
    return it;
  });
}

// Danh sach hang muc dung cho BAN IN, MODAL XEM TRUOC va MODAL LICH SU XE -
// phai la MOT ham, khong the moi cho tu dung mot kieu: modal ten la "xem
// truoc" thi phai ra dung cai se in ra giay.
//
// Goi bao duong bung ra 30+ dau muc con, liet ke het thi phieu dai 3-4 trang
// trong khi khach chi tra 1 gia goi - chi can dong ten goi. Chi tiet ben
// trong da nam o "Phieu kiem tra BDDK" rieng.
//
// Goi bi TACH (khach huy 1 muc trong goi -> moi dich vu ve gia le cua no, xem
// handleCancelItem) thi khong con dong dau goi nua, luc do liet ke tung dich
// vu la dung: khach dang tra tien theo tung cai chu khong theo gia goi.
//
// STT danh lai SAU khi bo dong - giu so goc thi phieu nhay coc 1, 2, 3, 38, 39.
export function dongHangMucDeIn(items) {
  let demNhom = 0;
  return assignGroupIds(items || [], () => { demNhom += 1; return demNhom; })
    .filter((it) => !(it.groupId && !it.isGroupParent && it.lhsc === 'DV'))
    .map((item, i) => ({ item, i }));
}

// Tach thanh 2 nhom nhu bang o form tao phieu: "Công việc cần thực hiện" va
// "Phụ tùng, vật tư" - de lien mot mach thi khong biet dau la cong tho, dau
// la vat tu.
export function tachCongViecVaPhuTung(items) {
  const dong = dongHangMucDeIn(items);
  return {
    congViec: dong.filter(({ item }) => item.lhsc !== 'PT'),
    phuTung: dong.filter(({ item }) => item.lhsc === 'PT'),
  };
}
