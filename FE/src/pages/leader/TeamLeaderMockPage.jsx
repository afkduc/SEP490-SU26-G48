const MOCKUP_CONTENT = {
  team: {
    title: 'Đội nhóm',
    subtitle: 'Mockup quản lý đội nhóm để Tổ trưởng theo dõi quân số, chuyên môn và trạng thái sẵn sàng của từng kỹ thuật viên.',
    summary: [
      { label: 'Tổ đang hoạt động', value: '01 đội' },
      { label: 'KTV sẵn sàng', value: '06 người' },
      { label: 'Ca đang thực hiện', value: '03 xe' },
    ],
    sections: [
      {
        title: 'Danh sách kỹ thuật viên',
        items: [
          'Bảng danh sách hiển thị mã nhân viên, họ tên, chuyên môn chính và trạng thái làm việc.',
          'Bộ lọc theo kỹ năng giúp Tổ trưởng phân ca nhanh trước khi nhận việc mới.',
        ],
      },
      {
        title: 'Năng lực theo ca',
        items: [
          'Thẻ tổng hợp số lượng kỹ thuật viên đang rảnh, đang làm việc và nghỉ phép trong ngày.',
          'Khu vực ghi chú giúp Tổ trưởng lưu các lưu ý đặc biệt cho từng ca sửa chữa.',
        ],
      },
    ],
  },
  orders: {
    title: 'Lệnh sửa chữa',
    subtitle: 'Mockup màn hình tổng hợp lệnh sửa chữa được giao cho tổ để Tổ trưởng nắm tiến độ trước khi phân việc chi tiết.',
    summary: [
      { label: 'Lệnh mới nhận', value: '04 lệnh' },
      { label: 'Chờ phụ tùng', value: '02 lệnh' },
      { label: 'Ưu tiên hôm nay', value: '03 lệnh' },
    ],
    sections: [
      {
        title: 'Danh sách lệnh theo trạng thái',
        items: [
          'Bảng danh sách cho phép xem nhanh mã RO, khách hàng, biển số và mức độ ưu tiên.',
          'Thanh lọc theo trạng thái giúp chuyển nhanh giữa nhóm chờ nhận việc, đang làm và chờ bàn giao.',
        ],
      },
      {
        title: 'Chi tiết lệnh',
        items: [
          'Khung bên phải mô tả dịch vụ, ghi chú từ Cố vấn dịch vụ và phụ tùng cần chuẩn bị.',
          'Khu vực timeline dùng để theo dõi mốc nhận xe, bắt đầu sửa và dự kiến hoàn thành.',
        ],
      },
    ],
  },
  technicians: {
    title: 'Thợ máy',
    subtitle: 'Mockup theo dõi danh sách thợ máy trực thuộc để Tổ trưởng quản lý kỹ năng, hiệu suất và phân công phù hợp.',
    summary: [
      { label: 'Tổng kỹ thuật viên', value: '08 người' },
      { label: 'Đa kỹ năng', value: '03 người' },
      { label: 'Cần hỗ trợ đào tạo', value: '02 người' },
    ],
    sections: [
      {
        title: 'Hồ sơ năng lực',
        items: [
          'Mỗi thợ máy có thẻ thông tin riêng gồm chuyên môn, cấp bậc và số đầu việc đã hoàn thành.',
          'Chỉ báo màu thể hiện mức tải hiện tại để Tổ trưởng tránh phân việc quá tải.',
        ],
      },
      {
        title: 'Lịch sử phân công',
        items: [
          'Bảng lịch sử cho phép xem các lệnh đã tham gia, thời gian xử lý và đánh giá sau bàn giao.',
          'Bộ lọc ngày giúp rà soát hiệu suất cá nhân theo tuần hoặc theo tháng.',
        ],
      },
    ],
  },
};

function SummaryCard({ label, value }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--gray-200)',
      borderRadius: 12,
      padding: 16,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{value}</div>
    </div>
  );
}

function SectionCard({ title, items }) {
  return (
    <section style={{
      background: 'var(--white)',
      border: '1px solid var(--gray-200)',
      borderRadius: 12,
      padding: 18,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--gray-700)', lineHeight: 1.6 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export default function TeamLeaderMockPage({ view }) {
  const content = MOCKUP_CONTENT[view] || MOCKUP_CONTENT.team;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{content.title}</h1>
          <div className="breadcrumb">Tổ trưởng kỹ thuật / {content.title}</div>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, rgba(230,81,0,0.12), rgba(245,127,23,0.06))',
        border: '1px solid rgba(230,81,0,0.18)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className="tag" style={{ background: '#fff3e0', color: '#e65100', borderColor: '#ffcc80' }}>
            Mockup Team Leader
          </span>
        </div>
        <p style={{ margin: 0, color: 'var(--gray-700)', lineHeight: 1.6 }}>{content.subtitle}</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        {content.summary.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {content.sections.map((section) => (
          <SectionCard key={section.title} title={section.title} items={section.items} />
        ))}
      </div>
    </div>
  );
}
