// Ban rut gon cua "Tien do cong viec" - dung cho phieu DA XONG VIEC (invoiced,
// khong con gi de thao tac them): liet ke het 30 dau muc kem tick xanh chi
// huu ich luc dang theo doi tien do, phieu da xong thi thong tin do la nhieu -
// chi can biet dau muc nao KHONG DAT ma khach da tu choi sua. Dung chung giua
// RepairSettlementPage (Truy cap phieu, khi da xuat hoa don) va
// CustomerHistoryPage (man Lich su khach hang) de 2 noi hien GIONG HET nhau.
//
// Tach file rieng (khong dat trong RepairSettlementPage.jsx) de
// CustomerHistoryPage.jsx khong phai keo theo ca file quyet toan (130KB+) chi
// de dung 1 component nho.
export default function DeclinedTasksSummary({ tasks }) {
  const declinedTasks = (tasks || []).filter((t) => t.taskType === 'service' && t.ngDecision === 'declined');
  if (declinedTasks.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="form-section-title">Hạng mục không đạt, khách từ chối sửa</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {declinedTasks.map((t) => (
          <div key={t.id} style={{ padding: '8px 10px', background: '#FDECEA', borderRadius: 6, fontSize: 13, color: '#B91C1C' }}>
            <b>{t.taskName}</b>
            {t.checkNote && ` — ${t.checkNote}`}
            {t.ngNote && <div style={{ fontWeight: 600, marginTop: 2 }}>Khách từ chối thay — {t.ngNote}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
