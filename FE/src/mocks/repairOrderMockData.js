export const MOCK_BRANCH = 'AutoGara Hà Nội';

// Mức độ ưu tiên xử lý lệnh sửa chữa.
export const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Bình thường' },
  { value: 'urgent', label: 'Ưu tiên' },
  { value: 'emergency', label: 'Khẩn cấp' },
];

// Kỹ thuật viên và mức độ tay nghề: thợ chính, thợ phụ, thực tập.
export const SKILL_LEVEL_LABELS = {
  main: { label: 'Thợ chính', badge: 'badge-approved' },
  assistant: { label: 'Thợ phụ', badge: 'badge-pending' },
  intern: { label: 'Thực tập', badge: 'badge-inactive' },
};

export const mockTechnicians = [
  { id: 1, fullName: 'Trần Văn Hùng', specialty: 'Động cơ - Hộp số', skillLevel: 'main' },
  { id: 2, fullName: 'Lê Minh Khoa', specialty: 'Điện - Điện tử', skillLevel: 'main' },
  { id: 3, fullName: 'Nguyễn Thành Long', specialty: 'Gầm - Phanh', skillLevel: 'assistant' },
  { id: 4, fullName: 'Phạm Đức Duy', specialty: 'Điều hòa - Làm lạnh', skillLevel: 'assistant' },
  { id: 5, fullName: 'Bùi Văn Sơn', specialty: 'Đa năng', skillLevel: 'intern' },
];

const VAT_RATE = 0.1;

function buildQuote({ id, code, customer, vehicle, items }) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = Math.round(subtotal * VAT_RATE);
  return { id, code, customer, vehicle, items, subtotal, vatAmount, total: subtotal + vatAmount };
}

// Phiếu báo giá đã được khách hàng đồng ý, chờ tạo lệnh sửa chữa và phân công kỹ thuật viên.
export const mockQuotes = [
  buildQuote({
    id: 1,
    code: 'BG-2024-001',
    customer: { fullName: 'Lê Văn Cường' },
    vehicle: { licensePlate: '51A-23456', vehicleModel: 'Hyundai Tucson 2023', currentKm: 15200 },
    items: [
      { description: 'Thay dầu máy 5W-30 (4 lít)', type: 'supply', unit: 'Lít', quantity: 4, unitPrice: 150000 },
      { description: 'Lọc dầu', type: 'supply', unit: 'Cái', quantity: 1, unitPrice: 120000 },
      { description: 'Lọc gió động cơ', type: 'supply', unit: 'Cái', quantity: 1, unitPrice: 210000 },
      { description: 'Công thay dầu và lọc', type: 'labor', unit: 'Lần', quantity: 1, unitPrice: 150000 },
      { description: 'Kiểm tra hệ thống điện tổng quát', type: 'labor', unit: 'Lần', quantity: 1, unitPrice: 300000 },
    ],
  }),
  buildQuote({
    id: 2,
    code: 'BG-2024-002',
    customer: { fullName: 'Nguyễn Minh Tâm' },
    vehicle: { licensePlate: '30A-123.45', vehicleModel: 'Mazda CX-5 2.0 Premium 2023', currentKm: 22400 },
    items: [
      { description: 'Má phanh trước', type: 'supply', unit: 'Bộ', quantity: 1, unitPrice: 850000 },
      { description: 'Dầu phanh DOT4', type: 'supply', unit: 'Chai', quantity: 1, unitPrice: 95000 },
      { description: 'Công thay má phanh và xả dầu phanh', type: 'labor', unit: 'Lần', quantity: 1, unitPrice: 220000 },
    ],
  }),
];

export const REPAIR_ORDER_TYPE_LABELS = {
  supply: 'Vật tư',
  labor: 'Công',
};

// Lệnh sửa chữa đã được tạo trước đó (đã hoặc chưa phân công kỹ thuật viên).
export const mockRepairOrders = [
  {
    id: 1,
    code: 'LSC-2024-001',
    quoteId: 1,
    customer: { fullName: 'Lê Văn Cường' },
    vehicle: { licensePlate: '51A-23456', vehicleModel: 'Hyundai Tucson 2023' },
    priority: 'normal',
    note: '',
    technicians: [
      { id: 1, fullName: 'Trần Văn Hùng', specialty: 'Động cơ - Hộp số' },
      { id: 2, fullName: 'Lê Minh Khoa', specialty: 'Điện - Điện tử' },
    ],
    createdAt: '09/07/2026',
  },
];
