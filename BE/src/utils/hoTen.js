// Quy uoc ten nguoi dung trong he thong (dung chung ca BE va FE):
//
//   users.last_name  = HO            vd "Tran"
//   users.first_name = TEN DEM + TEN vd "Quoc Bao"
//   users.user_name  = ho ten day du vd "Tran Quoc Bao"
//
// Nguoi Viet doc HO truoc, nen moi cho hien thi deu phai ghep last_name +
// first_name. Truoc day vai duong ghi du lieu nhet CA ho ten vao first_name va
// de last_name = '' (xem ManagerRepositoryImpl.createTechnician cu), nen ten
// to truong hien thanh "Tran Quoc Bao Tran" - ho bi lap lai.

/** Tach "Tran Quoc Bao" -> { ho: 'Tran', ten: 'Quoc Bao' }. */
function tachHoTen(hoTenDayDu) {
  const chuan = String(hoTenDayDu || '').replace(/\s+/g, ' ').trim();
  if (!chuan) return { ho: '', ten: '' };
  const cach = chuan.indexOf(' ');
  // Ten chi co 1 tu (tai khoan ky thuat nhu "admin") thi coi nhu khong co ho.
  if (cach === -1) return { ho: '', ten: chuan };
  return { ho: chuan.slice(0, cach), ten: chuan.slice(cach + 1) };
}

/** Ghep lai theo dung thu tu nguoi Viet doc: HO truoc, TEN sau. */
function ghepHoTen(ho, ten) {
  return [ho, ten]
    .map((phan) => String(phan || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

module.exports = { tachHoTen, ghepHoTen };
