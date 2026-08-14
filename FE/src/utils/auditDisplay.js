/**
 * Hiển thị nhật ký hoạt động bằng tiếng Việt dễ hiểu (không cần biết code).
 */
import { getPermissionScreenLabel, getScreenLabel } from './screenLabels';
import { formatDateSafeWithOffset, formatDateOnly, secondsSince, getClockOffsetMs } from './dateUtils';
import { formatPhoneDisplay } from './validation';

export const AUDIT_ACTION_LABELS = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Vô hiệu hóa',
  DISABLE: 'Ngừng hoạt động',
  REACTIVATE: 'Kích hoạt lại',
  READ: 'Xem dữ liệu',
  LOGIN: 'Đăng nhập',
  FAILED_LOGIN: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  FORCE_LOGOUT: 'Buộc đăng xuất',
  FORCE_LOGO: 'Buộc đăng xuất', // DB cột action ngắn → lưu FORCE_LOGO
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  ASSIGN_ROLE: 'Gán vai trò',
  REMOVE_ROLE: 'Thu hồi vai trò',
  EXPORT: 'Xuất dữ liệu',
  IMPORT: 'Nhập dữ liệu',
  GRANT_SCREEN: 'Cấp quyền màn hình',
  REVOKE_SCREEN: 'Thu hồi quyền màn hình',
  BULK_TOGGLE: 'Cập nhật hàng loạt ma trận',
  SAVE_SCREEN_MATRIX: 'Lưu ma trận quyền màn hình',
  SAVE_USER_SCREEN_PERMISSIONS: 'Lưu quyền riêng người dùng',
  CLEAR_USER_SCREEN_PERMISSIONS: 'Xóa quyền riêng người dùng',
  APPROVE_PERMISSION_REQUEST: 'Duyệt yêu cầu cấp quyền',
  REJECT_PERMISSION_REQUEST: 'Từ chối yêu cầu cấp quyền',
  APPROVE_LOGIN_CHALLENGE: 'Đồng ý đăng nhập thiết bị khác',
  REJECT_LOGIN_CHALLENGE: 'Từ chối đăng nhập thiết bị khác',
  PERMISSION_MATRIX_BULK: 'Cập nhật ma trận phân quyền',
};

const ROLE_LABELS = {
  admin: 'Quản trị viên',
  general_director: 'Giám đốc',
  director: 'Giám đốc',
  branch_manager: 'Quản lý chi nhánh',
  manager: 'Quản lý chi nhánh',
  service_advisor: 'Cố vấn dịch vụ',
  advisor: 'Cố vấn dịch vụ',
  team_leader: 'Tổ trưởng',
  leader: 'Tổ trưởng',
  technician: 'Kỹ thuật viên',
  warehouse_staff: 'Nhân viên kho',
  inventory: 'Nhân viên kho',
};

export const AUDIT_FIELD_LABELS = {
  // Người dùng / phân quyền
  status: 'Trạng thái',
  branchId: 'Mã chi nhánh',
  branch_id: 'Mã chi nhánh',
  branchName: 'Chi nhánh',
  branch_name: 'Chi nhánh',
  branchCode: 'Mã chi nhánh',
  roleId: 'Mã vai trò',
  role_id: 'Mã vai trò',
  roleName: 'Vai trò',
  role_name: 'Vai trò',
  role: 'Vai trò',
  phone: 'Số điện thoại',
  phoneNumber: 'Số điện thoại',
  phone_number: 'Số điện thoại',
  firstName: 'Họ',
  first_name: 'Họ',
  lastName: 'Tên',
  last_name: 'Tên',
  fullName: 'Họ và tên',
  full_name: 'Họ và tên',
  email: 'Email',
  userName: 'Tên đăng nhập',
  user_name: 'Tên đăng nhập',
  specialtyId: 'Chuyên môn',
  specialty_id: 'Chuyên môn',
  specialtyName: 'Tên chuyên môn',
  specialtyCode: 'Mã chuyên môn',
  name: 'Tên',
  permissionKey: 'Quyền (mã hệ thống)',
  screenKey: 'Màn hình',
  screenLabel: 'Tên màn hình',
  granted: 'Trạng thái quyền',
  itemCount: 'Số mục thay đổi',
  activeItems: 'Số mục đang có quyền',
  l1Granted: 'Số quyền truy cập mới được cấp',
  l1Revoked: 'Số quyền truy cập bị thu hồi',
  count: 'Số lượng',
  quantity: 'Số lượng',
  entityCode: 'Mã đối tượng',
  entityName: 'Tên đối tượng',
  recordId: 'Mã bản ghi',
  targetUserId: 'Người nhận (ID)',
  targetUserName: 'Người nhận',
  targetEmail: 'Email người nhận',
  targetName: 'Đối tượng',
  newTokenVersion: 'Phiên bản phiên đăng nhập',
  reason: 'Lý do',
  rejectReason: 'Lý do từ chối',
  pendingId: 'Mã yêu cầu đăng nhập',
  browser: 'Trình duyệt',
  os: 'Hệ điều hành',
  ip: 'Địa chỉ IP',
  device: 'Thiết bị',
  deviceId: 'Mã thiết bị',
  userId: 'Mã người dùng',
  user_id: 'Mã người dùng',
  actorId: 'Người thực hiện (ID)',
  isActive: 'Đang hoạt động',
  is_active: 'Đang hoạt động',
  password: 'Mật khẩu',
  newPassword: 'Mật khẩu mới',
  notes: 'Ghi chú',
  description: 'Mô tả',
  code: 'Mã',
  id: 'Mã hệ thống',

  // Lệnh sửa chữa / yêu cầu dịch vụ / khoang
  serviceOrderId: 'Mã phiếu tiếp nhận',
  service_order_id: 'Mã phiếu tiếp nhận',
  serviceRequestId: 'Mã yêu cầu dịch vụ',
  service_request_id: 'Mã yêu cầu dịch vụ',
  repairOrderId: 'Mã lệnh sửa chữa',
  repair_order_id: 'Mã lệnh sửa chữa',
  repairOrderCode: 'Mã lệnh sửa chữa',
  bayId: 'Mã khoang',
  bay_id: 'Mã khoang',
  bayNumber: 'Số khoang',
  bay_number: 'Số khoang',
  bayNumbers: 'Danh sách số khoang',
  technicianIds: 'Danh sách thợ (ID)',
  technicianNames: 'Thợ thực hiện',
  technicians: 'Danh sách thợ',
  technicianId: 'Mã thợ',
  hasSignature: 'Khách hàng đã ký',
  // signature (hash PayOS) ≠ signatureData (ảnh chữ ký tay — BE không lưu base64 trong log)
  signature: 'Mã xác thực',
  Signature: 'Mã xác thực',
  signerName: 'Người ký',
  requestCode: 'Mã phiếu',
  vehiclePlate: 'Biển số xe',
  exportDate: 'Ngày xuất kho',
  performedByName: 'Người xuất kho',
  performedBy: 'Người thực hiện',
  performed_by: 'Người thực hiện',
  itemCount: 'Số mặt hàng',
  totalQuantity: 'Tổng số lượng',
  currentStepLabel: 'Bước hiện tại',
  repairRedo: 'Xe sửa chữa lại',
  repair_redo: 'Xe sửa chữa lại',
  hasAppointment: 'Xe có đặt hẹn',
  has_appointment: 'Xe có đặt hẹn',
  warrantyVehicle: 'Xe bảo hành',
  warranty_vehicle: 'Xe bảo hành',
  isWarranty: 'Xe bảo hành',
  is_warranty: 'Xe bảo hành',
  dealerKeepsOldParts: 'Đại lý giữ phụ tùng cũ',
  dealer_keeps_old_parts: 'Đại lý giữ phụ tùng cũ',
  returnOldPartsToCustomer: 'Trả phụ tùng cũ cho khách',
  return_old_parts_to_customer: 'Trả phụ tùng cũ cho khách',
  carWash: 'Rửa xe',
  car_wash: 'Rửa xe',
  customerWaitsAtShop: 'Khách hàng chờ tại xưởng',
  customer_waits_at_shop: 'Khách hàng chờ tại xưởng',
  frameNumber: 'Số khung',
  frame_number: 'Số khung',
  engineNumber: 'Số máy',
  engine_number: 'Số máy',
  purchaseDate: 'Ngày mua xe',
  purchase_date: 'Ngày mua xe',
  taxCode: 'Mã số thuế',
  tax_code: 'Mã số thuế',
  cccd: 'CCCD / CMND',
  contactPerson: 'Người liên hệ',
  contact_person: 'Người liên hệ',
  contactPhone: 'SĐT người liên hệ',
  contact_phone: 'SĐT người liên hệ',
  advisorId: 'Mã cố vấn dịch vụ',
  advisor_id: 'Mã cố vấn dịch vụ',
  lastKnownKm: 'Số km lần trước',
  last_known_km: 'Số km lần trước',
  warrantyEndDate: 'Hết hạn bảo hành',
  warranty_end_date: 'Hết hạn bảo hành',
  warrantyKmLimit: 'Hạn định km bảo hành',
  warranty_km_limit: 'Hạn định km bảo hành',
  repairOrderCode: 'Mã lệnh sửa chữa',
  memberIds: 'Danh sách thành viên (ID)',
  teamLeaderId: 'Mã tổ trưởng',
  taskId: 'Mã đầu mục công việc',
  taskName: 'Tên đầu mục công việc',
  isDone: 'Đã hoàn thành',
  occupiedByDeviceId: 'Thiết bị đang chiếm khoang',
  occupiedByUserId: 'Người đang chiếm khoang',
  released: 'Đã nhả khoang',
  appointmentDate: 'Ngày hẹn',
  appointmentTime: 'Giờ hẹn',
  scheduledAt: 'Thời gian hẹn',
  customerId: 'Mã khách hàng',
  customer_id: 'Mã khách hàng',
  customerName: 'Tên khách hàng',
  newCustomerId: 'Mã khách hàng mới',
  vehicleId: 'Mã xe',
  vehicle_id: 'Mã xe',
  licensePlate: 'Biển số xe',
  plateNumber: 'Biển số xe',
  plate_number: 'Biển số xe',
  vin: 'Số khung (VIN)',
  brandId: 'Hãng xe',
  brandName: 'Hãng xe',
  model: 'Dòng xe',
  year: 'Năm sản xuất',
  transferDate: 'Ngày chuyển chủ',
  isSent: 'Đã gửi nhắc',
  productId: 'Mã sản phẩm / phụ tùng',
  product_id: 'Mã sản phẩm / phụ tùng',
  productName: 'Tên sản phẩm',
  orderCode: 'Mã đơn thanh toán',
  expiredAt: 'Hết hạn lúc',
  amount: 'Số tiền',
  totalAmount: 'Tổng tiền',
  paymentMethod: 'Phương thức thanh toán',
  packageId: 'Mã gói dịch vụ',
  serviceId: 'Mã dịch vụ',
  serviceName: 'Tên dịch vụ',
  categoryId: 'Mã danh mục',
  supplierId: 'Mã nhà cung cấp',
  supplier_id: 'Mã nhà cung cấp',
  supplierInvoiceNo: 'Số hóa đơn nhà cung cấp',
  supplier_invoice_no: 'Số hóa đơn nhà cung cấp',
  invoiceNo: 'Số hóa đơn',
  invoice_no: 'Số hóa đơn',
  productCode: 'Mã phụ tùng',
  product_code: 'Mã phụ tùng',
  importDate: 'Ngày nhập kho',
  import_date: 'Ngày nhập kho',
  requestedBy: 'Người tạo phiếu',
  requested_by: 'Người tạo phiếu',
  requestedByName: 'Người nhập kho',
  requested_by_name: 'Người nhập kho',
  minStock: 'Tồn tối thiểu',
  min_stock: 'Tồn tối thiểu',
  stockQuantity: 'Số lượng tồn',
  stock_quantity: 'Số lượng tồn',
  location: 'Vị trí kho',
  unitId: 'Mã đơn vị',
  unit_id: 'Mã đơn vị',
  createdByRole: 'Vai trò người tạo',
  created_by_role: 'Vai trò người tạo',
  seenByManagerAt: 'Thời điểm quản lý đã xem',
  confirmPassword: 'Xác nhận mật khẩu',
  confirm_password: 'Xác nhận mật khẩu',
  employeeId: 'Mã nhân viên',
  employee_id: 'Mã nhân viên',
  specialtyIds: 'Danh sách chuyên môn',
  specialty_ids: 'Danh sách chuyên môn',
  specialtyNames: 'Chuyên môn',
  specialty_names: 'Chuyên môn',
  memberNames: 'Thành viên đội',
  member_names: 'Thành viên đội',
  bayNumbers: 'Danh sách số khoang',
  bay_numbers: 'Danh sách số khoang',
  teamLeaderName: 'Tên tổ trưởng',
  team_leader_name: 'Tên tổ trưởng',
  appointmentAt: 'Thời điểm hẹn',
  appointment_at: 'Thời điểm hẹn',
  fileName: 'Tên tệp',
  file_name: 'Tên tệp',
  dataType: 'Loại dữ liệu',
  data_type: 'Loại dữ liệu',
  recordCount: 'Số bản ghi',
  record_count: 'Số bản ghi',
  durationMs: 'Thời gian xử lý',
  duration_ms: 'Thời gian xử lý',
  durationMin: 'Thời gian thực hiện (phút)',
  duration_min: 'Thời gian thực hiện (phút)',
  purpose: 'Mục đích',
  packageName: 'Tên gói dịch vụ',
  package_name: 'Tên gói dịch vụ',
  serviceIds: 'Danh sách dịch vụ trong gói',
  service_ids: 'Danh sách dịch vụ trong gói',
  vehicleBrandId: 'Hãng xe',
  vehicle_brand_id: 'Hãng xe',
  managerId: 'Mã giám đốc / quản lý',
  manager_id: 'Mã giám đốc / quản lý',
  managerName: 'Tên giám đốc / quản lý',
  manager_name: 'Tên giám đốc / quản lý',
  managerCode: 'Mã giám đốc chi nhánh',
  manager_code: 'Mã giám đốc chi nhánh',
  managerStatus: 'Trạng thái giám đốc',
  manager_status: 'Trạng thái giám đốc',
  modelName: 'Tên dòng xe',
  model_name: 'Tên dòng xe',
  passwordChanged: 'Đã đổi mật khẩu',
  password_changed: 'Đã đổi mật khẩu',
  passwordReset: 'Đã đặt lại mật khẩu',
  password_reset: 'Đã đặt lại mật khẩu',
  appointmentId: 'Mã lịch hẹn',
  appointment_id: 'Mã lịch hẹn',
  revoked: 'Số thiết bị đã đăng xuất',
  isConfirmed: 'Đã xác nhận',
  is_confirmed: 'Đã xác nhận',
  confirmedDate: 'Ngày xác nhận',
  confirmed_date: 'Ngày xác nhận',
  cancelled: 'Đã hủy',
  category: 'Danh mục',
  createdAt: 'Thời gian tạo',
  updatedAt: 'Thời gian cập nhật',
  startedAt: 'Thời gian bắt đầu',
  completedAt: 'Thời gian hoàn thành',
  address: 'Địa chỉ',
  city: 'Thành phố',
  district: 'Quận / huyện',
  ward: 'Phường / xã',
  gender: 'Giới tính',
  dateOfBirth: 'Ngày sinh',
  dob: 'Ngày sinh',

  // Phiếu quyết toán / tiếp nhận xe
  customerRequest: 'Yêu cầu khách hàng',
  customer_request: 'Yêu cầu khách hàng',
  note: 'Ghi chú',
  currentKm: 'Số km hiện tại',
  current_km: 'Số km hiện tại',
  items: 'Hạng mục dịch vụ / phụ tùng',
  subtotal: 'Tổng trước giảm giá',
  discountAmount: 'Số tiền giảm giá',
  discount_amount: 'Số tiền giảm giá',
  discount: 'Giảm giá',
  afterDiscount: 'Tổng sau giảm giá',
  after_discount: 'Tổng sau giảm giá',
  vat: 'Thuế VAT (8%)',
  freeAmount: 'Số tiền miễn phí',
  free_amount: 'Số tiền miễn phí',
  exemptedAmount: 'Số tiền được miễn',
  exempted_amount: 'Số tiền được miễn',
  total: 'Tổng thanh toán',
  signatureData: 'Chữ ký khách hàng',
  signature_data: 'Chữ ký khách hàng',
  signerName: 'Người ký',
  signer_name: 'Người ký',
  signedAt: 'Thời điểm ký',
  signed_at: 'Thời điểm ký',
  deliveryDate: 'Ngày giao xe',
  delivery_date: 'Ngày giao xe',
  unitPrice: 'Đơn giá',
  unit_price: 'Đơn giá',
  qty: 'Số lượng',
  unit: 'Đơn vị',
  lhsc: 'Loại hạng mục',
  httt: 'Hình thức thanh toán',
  repairCategory: 'Loại hình sửa chữa',
  groupId: 'Nhóm hạng mục',
  isGroupParent: 'Là dòng nhóm',
  isFree: 'Miễn phí',

  // In phiếu / payload gửi kèm (tránh lộ key tiếng Anh như Kind, print kind)
  kind: 'Loại bản in',
  printKind: 'Loại bản in',
  print_kind: 'Loại bản in',
  lastPrintKind: 'Loại bản in gần nhất',
  last_print_kind: 'Loại bản in gần nhất',
  customerPhone: 'SĐT khách hàng',
  customer_phone: 'SĐT khách hàng',
  vehicleModel: 'Dòng xe',
  vehicle_model: 'Dòng xe',
  serviceOrderCode: 'Mã phiếu tiếp nhận',
  service_order_code: 'Mã phiếu tiếp nhận',
  taskNames: 'Tên đầu mục công việc',
  completedTaskCount: 'Số đầu mục đã xong',
  paymentStatus: 'Trạng thái thanh toán',
  payment_status: 'Trạng thái thanh toán',
  payosOrderCode: 'Mã đơn PayOS',
  checkoutUrl: 'Link thanh toán',
  step: 'Bước',
  stepLabel: 'Tên bước',
  step_label: 'Tên bước',
  action: 'Hành động',
  tableName: 'Bảng dữ liệu',
  table_name: 'Bảng dữ liệu',
  loaiBanIn: 'Loại bản in',

  // PayOS / thanh toán
  desc: 'Mô tả kết quả',
  Desc: 'Mô tả kết quả',
  success: 'Thành công',
  Success: 'Thành công',
  reference: 'Mã tham chiếu',
  Reference: 'Mã tham chiếu',
  checksumKey: 'Khóa kiểm tra',
  paymentLinkId: 'Mã link thanh toán',
  accountNumber: 'Số tài khoản',
  accountName: 'Tên tài khoản',
  currency: 'Loại tiền',
  amountPaid: 'Số tiền đã thanh toán',

  // Yêu cầu dịch vụ (landing / CVDV)
  issue: 'Vấn đề / nhu cầu',
  issueDescription: 'Mô tả vấn đề',
  issue_description: 'Mô tả vấn đề',
  purchaseBranchId: 'Chi nhánh mua xe',
  purchase_branch_id: 'Chi nhánh mua xe',
  purchaseBranchName: 'Chi nhánh mua xe',
  purchaseBranchOther: 'Chi nhánh mua xe (khác)',
  purchase_branch_other: 'Chi nhánh mua xe (khác)',
  nearestBranchId: 'Chi nhánh gần nhất',
  nearest_branch_id: 'Chi nhánh gần nhất',
  nearestBranchName: 'Chi nhánh gần nhất',
  nearest_branch_name: 'Chi nhánh gần nhất',
  carBrandId: 'Hãng xe',
  car_brand_id: 'Hãng xe',
};

/** Bảng → nhãn tiếng Việt (dùng chung list/detail/dashboard) */
export const AUDIT_TABLE_LABELS = {
  customers: 'Khách hàng',
  vehicles: 'Phương tiện',
  vehicle_models: 'Dòng xe',
  brands: 'Hãng xe',
  branches: 'Chi nhánh',
  users: 'Người dùng',
  user_role: 'Phân quyền người dùng',
  user_specialty: 'Chuyên môn nhân viên',
  user_devices: 'Thiết bị đăng nhập',
  user_notification_settings: 'Cài đặt thông báo',
  roles: 'Vai trò',
  role_permissions: 'Phân quyền theo vai trò',
  role_screen_permissions: 'Quyền màn hình theo vai trò',
  role_screen_matrix: 'Ma trận quyền màn hình',
  permission_request: 'Yêu cầu cấp quyền',
  role_security_mapping: 'Ánh xạ vai trò - bảo mật',
  permissions: 'Phân quyền chi tiết',
  service_categories: 'Danh mục dịch vụ',
  services: 'Dịch vụ',
  service_packages: 'Gói dịch vụ',
  service_package_items: 'Hạng mục gói dịch vụ',
  suppliers: 'Nhà cung cấp',
  products: 'Phụ tùng / Sản phẩm',
  inventory: 'Tồn kho',
  inventory_transactions: 'Giao dịch kho',
  appointments: 'Lịch hẹn',
  work_orders: 'Phiếu sửa chữa',
  work_order_items: 'Hạng mục phiếu sửa',
  repair_orders: 'Lệnh sửa chữa',
  repair_order_tasks: 'Đầu mục công việc',
  repair_settlements: 'Phiếu quyết toán',
  payos_transactions: 'Giao dịch thanh toán PayOS',
  service_orders: 'Phiếu quyết toán',
  service_order_items: 'Hạng mục phiếu quyết toán',
  service_requests: 'Yêu cầu dịch vụ',
  service_request_appointments: 'Lịch hẹn dịch vụ',
  vehicle_bays: 'Khoang xe',
  invoices: 'Hóa đơn',
  payments: 'Thanh toán',
  specialties: 'Chuyên môn',
  warranty_records: 'Lịch sử bảo hành',
  maintenance_reminders: 'Lịch nhắc bảo dưỡng',
  vehicle_owners: 'Chủ phương tiện',
  import_requests: 'Yêu cầu nhập kho',
  import_request_items: 'Chi tiết nhập kho',
  export_requests: 'Yêu cầu xuất kho',
  export_request_items: 'Chi tiết xuất kho',
  entity_definitions: 'Định nghĩa đối tượng',
  login_sessions: 'Phiên đăng nhập',
  login_session_events: 'Sự kiện phiên đăng nhập',
  audit_logs: 'Nhật ký hệ thống',
  notifications: 'Thông báo',
  security_alerts: 'Cảnh báo bảo mật',
  manager: 'Quản lý chi nhánh',
  general_director: 'Giám đốc',
  public: 'Thao tác công khai',
  profile: 'Hồ sơ cá nhân',
};

export function getAuditTableLabel(tableName) {
  if (!tableName) return '—';
  const key = String(tableName).trim();
  return AUDIT_TABLE_LABELS[key] || AUDIT_TABLE_LABELS[key.toLowerCase()] || key;
}

/** Mức độ cảnh báo bảo mật */
export const SECURITY_SEVERITY_LABELS = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  info: 'Thông tin',
};

export function getSecuritySeverityLabel(severity) {
  if (!severity) return '—';
  const key = String(severity).trim().toLowerCase();
  return SECURITY_SEVERITY_LABELS[key] || String(severity);
}

/** Token tiếng Anh → Việt (fallback khi chưa có trong AUDIT_FIELD_LABELS) */
const FIELD_TOKEN_VI = {
  id: 'mã',
  ids: 'danh sách mã',
  code: 'mã',
  name: 'tên',
  status: 'trạng thái',
  type: 'loại',
  date: 'ngày',
  time: 'giờ',
  at: 'lúc',
  by: 'bởi',
  user: 'người dùng',
  actor: 'người thực hiện',
  target: 'đối tượng',
  branch: 'chi nhánh',
  role: 'vai trò',
  phone: 'số điện thoại',
  email: 'email',
  device: 'thiết bị',
  browser: 'trình duyệt',
  os: 'hệ điều hành',
  ip: 'địa chỉ IP',
  reason: 'lý do',
  note: 'ghi chú',
  notes: 'ghi chú',
  description: 'mô tả',
  quantity: 'số lượng',
  count: 'số lượng',
  amount: 'số tiền',
  total: 'tổng',
  price: 'giá',
  service: 'dịch vụ',
  order: 'lệnh / phiếu',
  repair: 'sửa chữa',
  request: 'yêu cầu',
  settlement: 'quyết toán',
  bay: 'khoang',
  number: 'số',
  numbers: 'danh sách số',
  technician: 'thợ',
  technicians: 'danh sách thợ',
  member: 'thành viên',
  members: 'danh sách thành viên',
  team: 'tổ',
  leader: 'trưởng',
  task: 'đầu mục',
  customer: 'khách hàng',
  vehicle: 'xe',
  plate: 'biển số',
  license: 'biển số',
  product: 'sản phẩm',
  package: 'gói',
  category: 'danh mục',
  supplier: 'nhà cung cấp',
  invoice: 'hóa đơn',
  no: 'số',
  import: 'nhập',
  export: 'xuất',
  stock: 'tồn kho',
  min: 'tối thiểu',
  location: 'vị trí',
  requested: 'yêu cầu',
  employee: 'nhân viên',
  confirm: 'xác nhận',
  file: 'tệp',
  data: 'dữ liệu',
  record: 'bản ghi',
  duration: 'thời gian',
  performed: 'thực hiện',
  seen: 'đã xem',
  manager: 'quản lý',
  confirmed: 'xác nhận',
  cancelled: 'đã hủy',
  purpose: 'mục đích',
  brand: 'hãng',
  model: 'dòng',
  year: 'năm',
  payment: 'thanh toán',
  method: 'phương thức',
  appointment: 'lịch hẹn',
  scheduled: 'đã hẹn',
  occupied: 'đang chiếm',
  released: 'đã nhả',
  active: 'hoạt động',
  done: 'hoàn thành',
  sent: 'đã gửi',
  granted: 'đã cấp',
  expired: 'hết hạn',
  created: 'tạo',
  updated: 'cập nhật',
  started: 'bắt đầu',
  completed: 'hoàn thành',
  transfer: 'chuyển',
  new: 'mới',
  old: 'cũ',
  first: 'họ',
  last: 'tên',
  full: 'họ và',
  address: 'địa chỉ',
  city: 'thành phố',
  district: 'quận huyện',
  ward: 'phường xã',
  gender: 'giới tính',
  password: 'mật khẩu',
  specialty: 'chuyên môn',
  permission: 'quyền',
  screen: 'màn hình',
  pending: 'chờ duyệt',
  reject: 'từ chối',
  is: '',
  current: 'hiện tại',
  km: 'km',
  subtotal: 'tạm tính',
  discount: 'giảm giá',
  after: 'sau',
  vat: 'thuế VAT',
  free: 'miễn phí',
  exempted: 'được miễn',
  signature: 'chữ ký',
  signer: 'người ký',
  signed: 'đã ký',
  items: 'hạng mục',
  qty: 'số lượng',
  unit: 'đơn vị',
  kind: 'loại',
  print: 'in',
  worklist: 'danh sách công việc',
  label: 'nhãn',
  step: 'bước',
  url: 'đường dẫn',
  link: 'liên kết',
  desc: 'mô tả',
  success: 'thành công',
  reference: 'tham chiếu',
  issue: 'vấn đề',
  purchase: 'mua xe',
  nearest: 'gần nhất',
  other: 'khác',
  car: 'xe',
  checksum: 'kiểm tra',
  currency: 'tiền tệ',
  account: 'tài khoản',
  paid: 'đã thanh toán',
  has: 'có',
  have: 'có',
  warranty: 'bảo hành',
  dealer: 'đại lý',
  keep: 'giữ',
  keeps: 'giữ',
  part: 'phụ tùng',
  parts: 'phụ tùng',
  return: 'trả',
  to: 'cho',
  for: 'cho',
  of: 'của',
  from: 'từ',
  with: 'kèm',
  and: 'và',
  or: 'hoặc',
  in: 'trong',
  on: 'trên',
  wash: 'rửa',
  wait: 'chờ',
  waits: 'chờ',
  waiting: 'chờ',
  shop: 'xưởng',
  redo: 'sửa lại',
  limit: 'hạn mức',
  end: 'kết thúc',
  known: 'đã biết',
  frame: 'khung',
  engine: 'máy',
  tax: 'thuế',
  contact: 'liên hệ',
  advisor: 'cố vấn',
  intake: 'tiếp nhận',
  checklist: 'danh mục kiểm tra',
  priority: 'mức độ ưu tiên',
  info: 'thông tin',
  wash: 'rửa',
};

function normalizeAuditFieldKey(key) {
  return String(key || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

const FIELD_LABEL_BY_NORM = (() => {
  const map = Object.create(null);
  Object.entries(AUDIT_FIELD_LABELS).forEach(([key, label]) => {
    map[key] = label;
    map[key.toLowerCase()] = label;
    map[normalizeAuditFieldKey(key)] = label;
    map[normalizeAuditFieldKey(key).replace(/_/g, '')] = label;
  });
  return map;
})();

/**
 * Nhãn tiếng Việt cho khóa field trong nhật ký (ưu tiên từ điển, có fallback dễ đọc).
 */
export function getAuditFieldLabel(key) {
  if (key == null || key === '') return '—';
  const raw = String(key).trim();
  if (FIELD_LABEL_BY_NORM[raw]) return FIELD_LABEL_BY_NORM[raw];
  const lower = raw.toLowerCase();
  if (FIELD_LABEL_BY_NORM[lower]) return FIELD_LABEL_BY_NORM[lower];
  const snake = normalizeAuditFieldKey(raw);
  if (FIELD_LABEL_BY_NORM[snake]) return FIELD_LABEL_BY_NORM[snake];
  const compact = snake.replace(/_/g, '');
  if (FIELD_LABEL_BY_NORM[compact]) return FIELD_LABEL_BY_NORM[compact];

  const parts = snake.split('_').filter(Boolean);
  if (!parts.length) return raw;
  const viParts = parts
    .map((p) => (Object.prototype.hasOwnProperty.call(FIELD_TOKEN_VI, p) ? FIELD_TOKEN_VI[p] : p))
    .filter((p) => p !== '');
  if (!viParts.length) return raw;
  const label = viParts.join(' ').replace(/\s+/g, ' ').trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : raw;
}

/** Giá trị kind / lastPrintKind trong payload in phiếu */
const PRINT_KIND_LABELS = {
  settlement: 'Phiếu quyết toán',
  worklist: 'Danh sách công việc',
  print_settlement: 'Phiếu quyết toán',
  print_worklist: 'Danh sách công việc',
  'phiếu quyết toán': 'Phiếu quyết toán',
  'phieu quyet toan': 'Phiếu quyết toán',
  'danh sách công việc': 'Danh sách công việc',
  'danh sach cong viec': 'Danh sách công việc',
};

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  locked: 'Bị khóa',
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  // Trạng thái lệnh / phiếu xưởng
  completed: 'Hoàn thành',
  in_progress: 'Đang sửa chữa',
  inprogress: 'Đang sửa chữa',
  waiting_repair: 'Chờ sửa chữa',
  waitingrepair: 'Chờ sửa chữa',
  waiting_payment: 'Chờ thanh toán',
  waitingpayment: 'Chờ thanh toán',
  invoiced: 'Đã xuất hóa đơn',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  accepted: 'Đã tiếp nhận',
  occupied: 'Đang chiếm',
  free: 'Trống',
  available: 'Sẵn sàng',
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  expired: 'Hết hạn',
};

function getRoleLabel(roleName) {
  if (!roleName) return '—';
  const key = String(roleName).trim();
  return ROLE_LABELS[key] || ROLE_LABELS[key.toLowerCase()] || key;
}

export function getAuditActionLabel(action) {
  if (!action) return 'Thao tác';
  return AUDIT_ACTION_LABELS[action] || 'Thao tác khác';
}

/** HTTP method → tiếng Việt (không hiện POST/DELETE thô) */
export const HTTP_METHOD_LABELS = {
  GET: 'Xem dữ liệu',
  POST: 'Gửi yêu cầu',
  PUT: 'Cập nhật',
  PATCH: 'Cập nhật một phần',
  DELETE: 'Xóa / kết thúc',
  HEAD: 'Kiểm tra',
  OPTIONS: 'Tùy chọn',
};

export function getHttpMethodLabel(method) {
  if (!method) return '—';
  const key = String(method).trim().toUpperCase();
  return HTTP_METHOD_LABELS[key] || key;
}

/** Mã phản hồi HTTP → tiếng Việt ngắn gọn (không hiện dạng "Mã 0") */
export function getResponseStatusLabel(status) {
  // Manual audit thường không gắn HTTP status → DB lưu null/0
  if (status == null || status === '' || Number(status) === 0) {
    return 'Thành công';
  }
  const code = Number(status);
  if (!Number.isFinite(code)) return String(status);
  if (code >= 200 && code < 300) return 'Thành công';
  if (code === 401) return 'Chưa đăng nhập / hết phiên';
  if (code === 403) return 'Không có quyền';
  if (code === 404) return 'Không tìm thấy';
  if (code === 409) return 'Xung đột dữ liệu';
  if (code === 429) return 'Quá nhiều yêu cầu';
  if (code >= 400 && code < 500) return 'Yêu cầu không hợp lệ';
  if (code >= 500) return 'Lỗi hệ thống';
  return `Phản hồi HTTP ${code}`;
}

/** Giải thích thêm (tooltip) — tách khỏi nhãn ngắn để tránh vỡ layout */
export function getResponseStatusDetail(status) {
  if (status == null || status === '' || Number(status) === 0) {
    return 'Thao tác đã được ghi nhận. Nhật ký thủ công không kèm mã phản hồi HTTP.';
  }
  const code = Number(status);
  if (!Number.isFinite(code)) return String(status);
  if (code >= 200 && code < 300) return `HTTP ${code} — máy chủ xử lý thành công.`;
  if (code === 401) return 'HTTP 401 — chưa đăng nhập hoặc phiên đã hết hạn.';
  if (code === 403) return 'HTTP 403 — tài khoản không có quyền thực hiện.';
  if (code === 404) return 'HTTP 404 — không tìm thấy dữ liệu yêu cầu.';
  if (code === 409) return 'HTTP 409 — xung đột trạng thái / dữ liệu.';
  if (code === 429) return 'HTTP 429 — gửi quá nhiều yêu cầu trong thời gian ngắn.';
  if (code >= 400 && code < 500) return `HTTP ${code} — yêu cầu không hợp lệ.`;
  if (code >= 500) return `HTTP ${code} — lỗi phía máy chủ.`;
  return `HTTP ${code}`;
}

/** Tone badge cho kết quả: success | danger | neutral */
export function getResponseStatusTone(status) {
  if (status == null || status === '') return 'neutral';
  const code = Number(status);
  if (!Number.isFinite(code) || code === 0) return 'success'; // 0 = manual audit sau khi thành công
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400) return 'danger';
  return 'neutral';
}

/**
 * Gắn nhãn rõ cho mã nghiệp vụ (LSC / YCDV / ...) để người dùng hiểu,
 * thay vì chỉ hiện chuỗi thô.
 */
export function formatEntityCodeDisplay(entityCode, tableName, entityName) {
  if (entityCode == null || entityCode === '') return null;
  const code = String(entityCode).trim();
  if (!code) return null;

  const table = String(tableName || '').toLowerCase();
  const name = String(entityName || '').toLowerCase();

  if (/^LSC-/i.test(code) || table === 'repair_orders' || table === 'repair_order_tasks' || /sửa chữa|lệnh/.test(name)) {
    return { label: 'Mã lệnh sửa chữa', value: code, hint: 'Mã định danh lệnh sửa chữa trên hệ thống' };
  }
  if (/^YCDV-/i.test(code) || table.includes('service_request') || /yêu cầu dịch vụ/.test(name)) {
    return { label: 'Mã yêu cầu dịch vụ', value: code, hint: 'Mã yêu cầu khách gửi / CVDV tiếp nhận' };
  }
  if (table.includes('repair_settlement') || table === 'service_orders' || /quyết toán/.test(name)) {
    return { label: 'Mã phiếu quyết toán', value: code, hint: 'Mã phiếu quyết toán / tiếp nhận xe' };
  }
  if (table.includes('payos') || /thanh toán|payos/.test(name)) {
    return { label: 'Mã phiếu thanh toán', value: code, hint: 'Liên kết với phiếu quyết toán được thanh toán' };
  }
  if (/^BAY-/i.test(code) || table === 'vehicle_bays' || /khoang/.test(name)) {
    return { label: 'Mã khoang xe', value: code, hint: 'Khoang / bàn làm việc tại xưởng' };
  }
  if (/^NHAC-/i.test(code) || table.includes('maintenance_reminder')) {
    return { label: 'Mã nhắc bảo dưỡng', value: code, hint: 'Nhắc nhở bảo dưỡng theo biển số / ID' };
  }
  if (table === 'users' || /nhân viên|thợ/.test(name)) {
    return { label: 'Mã nhân sự', value: code, hint: 'Mã nhân viên / thợ trên hệ thống' };
  }
  if (table === 'services' || table === 'service_packages') {
    return { label: 'Mã danh mục dịch vụ', value: code, hint: 'Mã dịch vụ hoặc gói dịch vụ' };
  }
  return { label: 'Mã đối tượng', value: code, hint: 'Mã định danh bản ghi liên quan' };
}

export function formatDurationMs(ms) {
  if (ms == null || ms === '') return '—';
  const n = Number(ms);
  if (!Number.isFinite(n)) return String(ms);
  if (n < 1000) return `${Math.round(n)} mili giây`;
  return `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} giây`;
}

/**
 * Đường dẫn API → câu ngắn dễ hiểu (không hiện /api/... thô cho người dùng).
 */
export function humanizeRequestUrl(url) {
  if (!url) return null;
  const path = String(url).split('?')[0].toLowerCase();
  if (/\/devices\/[^/]+\/logout/.test(path)) return 'Đăng xuất một thiết bị đăng nhập';
  if (/\/devices\/user\/[^/]+\/others\/logout/.test(path)) return 'Đăng xuất các thiết bị khác';
  if (/\/devices\/user\/[^/]+\/all\/logout/.test(path)) return 'Đăng xuất toàn bộ thiết bị';
  if (/\/profile\/me\/devices\/logout-all/.test(path)) return 'Đăng xuất mọi thiết bị của tôi';
  if (/\/admin\/users/.test(path)) return 'Quản lý người dùng';
  if (/\/admin\/branches/.test(path)) return 'Quản lý chi nhánh';
  if (/\/admin\/roles/.test(path)) return 'Vai trò';
  if (/\/admin\/specialties/.test(path)) return 'Chuyên môn';
  if (/\/admin\/devices/.test(path)) return 'Quản lý thiết bị đăng nhập';
  if (/\/admin\/audit|\/admin\/logs/.test(path)) return 'Nhật ký hệ thống';
  if (/\/profile\/me\/password/.test(path)) return 'Đổi mật khẩu hồ sơ';
  if (/\/profile\/me/.test(path)) return 'Hồ sơ cá nhân';
  if (/\/auth\/login/.test(path)) return 'Đăng nhập';
  if (/\/auth\/logout/.test(path)) return 'Đăng xuất';
  if (/\/auth\/forgot|\/auth\/reset/.test(path)) return 'Quên / đặt lại mật khẩu';
  if (/\/repair-orders|\/repairorders/.test(path)) return 'Thao tác lệnh sửa chữa';
  if (/\/repair-settlements|\/service-orders/.test(path)) return 'Thao tác phiếu quyết toán';
  if (/\/public\/gate\/[^/]+\/confirm-exit/.test(path)) return 'Bảo vệ mở cổng / xe ra cổng';
  if (/\/public\/gate/.test(path)) return 'Màn hình bảo vệ tại cổng';
  if (/\/import-requests/.test(path)) return 'Thao tác phiếu nhập kho';
  if (/\/export-requests/.test(path)) return 'Thao tác phiếu xuất kho';
  if (/\/inventory/.test(path)) return 'Thao tác tồn kho';
  if (/\/products/.test(path)) return 'Thao tác phụ tùng';
  if (/\/suppliers/.test(path)) return 'Thao tác nhà cung cấp';
  if (/\/manager/.test(path)) return 'Thao tác quản lý chi nhánh';
  if (/\/general-director/.test(path)) return 'Thao tác giám đốc';
  if (/\/customers/.test(path)) return 'Thao tác khách hàng';
  if (/\/service-requests/.test(path)) return 'Thao tác yêu cầu dịch vụ';
  if (/\/vehicle-bays/.test(path)) return 'Thao tác khoang xe';
  if (/\/payos/.test(path)) return 'Thanh toán PayOS';
  return 'Thao tác trên hệ thống';
}

/** Parse JSON an toàn */
export function parseAuditJson(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Đổi mô tả kỹ thuật (cả log cũ) sang tiếng Việt dễ đọc.
 * @param {string} description
 * @param {string} action
 * @param {object|string} newValue
 * @param {{ entityCode?: string, entityName?: string }|string} [metaOrEntityCode]
 */
export function humanizeAuditDescription(description, action, newValue, metaOrEntityCode) {
  const details = parseAuditJson(newValue) || {};
  const actionLabel = getAuditActionLabel(action);
  const meta = typeof metaOrEntityCode === 'string'
    ? { entityCode: metaOrEntityCode }
    : (metaOrEntityCode || {});
  const entityCodeHint = meta.entityCode || details.entityCode || null;
  const entityNameHint = meta.entityName || details.entityName || null;

  // Buộc đăng xuất: không hiện ID/tên thiết bị trong danh sách
  if (action === 'FORCE_LOGO' || action === 'FORCE_LOGOUT') {
    const raw = String(description || '');
    if (/toàn bộ|tat ca thiet bi|all devices/i.test(raw)) return 'Đăng xuất toàn bộ thiết bị';
    if (/thiết bị khác|thiet bi khac|others/i.test(raw)) return 'Đăng xuất các thiết bị khác';
    return 'Đăng xuất thiết bị';
  }

  // Ưu tiên dựng lại từ details nếu có permission/screen/role
  const hasUsefulDetails =
    details.permissionKey ||
    details.screenKey ||
    details.roleName ||
    details.role ||
    details.targetUserId != null ||
    details.itemCount != null ||
    details.pendingId ||
    details.granted === true ||
    details.granted === false;

  if (hasUsefulDetails) {
    const screenLabel =
      getPermissionScreenLabel(details.permissionKey) !== '—'
        ? getPermissionScreenLabel(details.permissionKey)
        : getScreenLabel(details.screenKey);
    const roleLabel = getRoleLabel(details.roleName || details.role);
    const target =
      details.targetUserName ||
      details.targetEmail ||
      (details.targetUserId != null ? `người dùng #${details.targetUserId}` : null);
    const itemCount = details.itemCount != null ? Number(details.itemCount) : null;

    switch (action) {
      case 'APPROVE_PERMISSION_REQUEST':
        return [
          'Đã duyệt yêu cầu cấp quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          target ? `cho ${target}` : null,
        ].filter(Boolean).join(' ');
      case 'REJECT_PERMISSION_REQUEST':
        return [
          'Đã từ chối yêu cầu cấp quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          target ? `của ${target}` : null,
          details.reason ? `(lý do: ${details.reason})` : null,
        ].filter(Boolean).join(' ');
      case 'SAVE_SCREEN_MATRIX': {
        const parts = [
          'Đã lưu ma trận quyền màn hình',
          roleLabel !== '—' ? `cho vai trò ${roleLabel}` : null,
          itemCount != null ? `(${itemCount} mục)` : null,
        ];
        const activeItems = details.activeItems != null ? Number(details.activeItems) : null;
        const l1Granted = details.l1Granted != null ? Number(details.l1Granted) : null;
        const l1Revoked = details.l1Revoked != null ? Number(details.l1Revoked) : null;
        if (activeItems != null) parts.push(`— ${activeItems} mục đang có quyền`);
        if (l1Granted > 0) parts.push(`— cấp thêm ${l1Granted} quyền truy cập`);
        if (l1Revoked > 0) parts.push(`— thu hồi ${l1Revoked} quyền truy cập`);
        return parts.filter(Boolean).join(' ');
      }
      case 'GRANT_SCREEN':
        return [
          'Đã cấp quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          roleLabel !== '—' ? `cho vai trò ${roleLabel}` : null,
        ].filter(Boolean).join(' ');
      case 'REVOKE_SCREEN':
        return [
          'Đã thu hồi quyền truy cập màn hình',
          screenLabel && screenLabel !== '—' ? `«${screenLabel}»` : null,
          roleLabel !== '—' ? `của vai trò ${roleLabel}` : null,
        ].filter(Boolean).join(' ');
      case 'APPROVE_LOGIN_CHALLENGE':
        return [
          'Đã đồng ý cho thiết bị khác đăng nhập',
          [details.browser, details.os].filter(Boolean).join(' · ') || details.device || null,
        ].filter(Boolean).join(' — ');
      case 'REJECT_LOGIN_CHALLENGE':
        return [
          'Đã từ chối đăng nhập từ thiết bị khác',
          [details.browser, details.os].filter(Boolean).join(' · ') || details.device || null,
        ].filter(Boolean).join(' — ');
      default:
        break;
    }
  }

  let text = String(description || '').trim();

  // Gắn tên thật từ newValue khi mô tả còn dạng kỹ thuật ID-n
  const personLabel = [
    details.firstName || details.first_name,
    details.lastName || details.last_name,
  ].filter(Boolean).join(' ').trim()
    || details.name
    || details.userName
    || details.user_name
    || details.email
    || details.targetName
    || null;
  const specialtyLabel =
    details.specialtyName || details.specialty_name
      ? [
        details.specialtyCode || details.specialty_code || details.code,
        details.specialtyName || details.specialty_name,
      ].filter(Boolean).join(' — ')
      : (details.specialtyCode || details.specialty_code || null);
  const roleLabel =
    details.roleName || details.role_name || details.roleLabel || details.role || null;
  const branchLabel =
    details.branchName || details.branch_name || details.branchCode || details.branch_code || null;

  if (!text) {
    if (specialtyLabel || details.isActive != null || details.is_active != null) {
      const label = specialtyLabel ? String(specialtyLabel) : '';
      if (action === 'CREATE') return label ? `Tạo mới chuyên môn ${label}` : 'Tạo mới chuyên môn';
      if (details.isActive === false || details.is_active === false || details.isActive === 0) {
        return label ? `Vô hiệu hóa chuyên môn ${label}` : 'Vô hiệu hóa chuyên môn';
      }
      if (details.isActive === true || details.is_active === true || details.isActive === 1) {
        return label ? `Kích hoạt chuyên môn ${label}` : 'Kích hoạt chuyên môn';
      }
      return label ? `Cập nhật chuyên môn ${label}` : 'Cập nhật chuyên môn';
    }
    if (personLabel) {
      if (action === 'CREATE') return `Tạo mới người dùng ${personLabel}`;
      return `Cập nhật người dùng ${personLabel}`;
    }
    return actionLabel;
  }

  // Thay «Người dùng ID-12» / «Chuyên môn ID-8» bằng tên nếu có trong newValue
  text = text.replace(/\bNgười dùng\s+ID-(\d+)\b/gi, (_, id) => (
    personLabel ? `người dùng ${personLabel}` : `người dùng #${id}`
  ));
  text = text.replace(/\bChuyên môn\s+ID-(\d+)\b/gi, (_, id) => (
    specialtyLabel ? `chuyên môn ${specialtyLabel}` : `chuyên môn #${id}`
  ));
  text = text.replace(/\bvai trò\s+ID-(\d+)\b/gi, (_, id) => (
    roleLabel ? `vai trò ${getRoleLabel(roleLabel)}` : `vai trò #${id}`
  ));
  text = text.replace(/\bchi nhánh\s+ID-(\d+)\b/gi, (_, id) => (
    branchLabel ? `chi nhánh ${branchLabel}` : `chi nhánh #${id}`
  ));
  text = text.replace(/\buser\s+ID\s+(\d+)\b/gi, (_, id) => (
    personLabel ? `người dùng ${personLabel}` : `người dùng #${id}`
  ));
  text = text.replace(/\bID-(\d+)\b/g, (_, id) => {
    if (personLabel && /người dùng|user/i.test(text)) return personLabel;
    if (specialtyLabel && /chuyên môn/i.test(text)) return specialtyLabel;
    return `#${id}`;
  });

  // Thay mã action đầu chuỗi
  Object.keys(AUDIT_ACTION_LABELS).forEach((code) => {
    const re = new RegExp(`^${code}\\s*:\\s*`, 'i');
    if (re.test(text)) {
      text = text.replace(re, `${AUDIT_ACTION_LABELS[code]}: `);
    }
  });

  // Thay permission / screen keys trong câu
  text = text.replace(/screen:[a-z0-9_.:-]+/gi, (m) => {
    const label = getPermissionScreenLabel(m);
    return label && label !== '—' ? `«${label}»` : m;
  });
  text = text.replace(/\bmàn\s+([a-z0-9_.:-]+)/gi, (_, key) => {
    const label = getScreenLabel(key);
    return label && label !== '—' ? `màn hình «${label}»` : `màn hình ${key}`;
  });
  text = text.replace(/\bquyền\s+(screen:[a-z0-9_.:-]+)/gi, (_, key) => {
    const label = getPermissionScreenLabel(key);
    return label && label !== '—' ? `quyền truy cập màn hình «${label}»` : `quyền ${key}`;
  });
  text = text.replace(/\bvai trò\s+([a-z0-9_]+)/gi, (_, role) => `vai trò ${getRoleLabel(role)}`);

  // Làm sạch tiền tố kỹ thuật còn sót
  text = text
    .replace(/\bpermissionKey\b/gi, 'mã quyền')
    .replace(/\bscreenKey\b/gi, 'màn hình')
    .replace(/\bitemCount\b/gi, 'số mục');

  // Làm rõ mã nghiệp vụ (LSC / YCDV / ...) trong câu mô tả
  text = text.replace(/\b(Phiếu|Lệnh)\s+sửa\s+chữa\s+(LSC-[A-Z0-9-]+)\b/gi, 'lệnh sửa chữa số $2');
  text = text.replace(/\b(LSC-[A-Z0-9-]+)\b/g, (m) => (text.includes(`số ${m}`) ? m : `số ${m}`));
  // Tránh "số số"
  text = text.replace(/\bsố\s+số\s+/gi, 'số ');

  // Nếu mô tả chưa có mã nhưng meta có entityCode → bổ sung
  const codeHint = entityCodeHint || null;
  if (codeHint && !text.includes(String(codeHint))) {
    const display = formatEntityCodeDisplay(codeHint, null, entityNameHint);
    if (display) {
      text = `${text} (${display.label}: ${display.value})`;
    }
  }

  return text || actionLabel;
}

const MONEY_FIELD_KEYS = new Set([
  'subtotal',
  'discountAmount',
  'discount_amount',
  'discount',
  'afterDiscount',
  'after_discount',
  'vat',
  'freeAmount',
  'free_amount',
  'exemptedAmount',
  'exempted_amount',
  'total',
  'totalAmount',
  'amount',
  'unitPrice',
  'unit_price',
]);

/** Đồng bộ với ManagerPage / RepairSettlement — mã loại hình sửa chữa */
const REPAIR_CATEGORY_LABELS = {
  ER: 'Sửa chữa động cơ',
  CB: 'Sửa chữa gầm',
  EE: 'Sửa chữa điện - điện tử',
  BP: 'Đồng sơn',
  PM: 'Bảo dưỡng định kỳ',
};

const LHSC_LABELS = {
  DV: 'Dịch vụ / công thợ',
  PT: 'Phụ tùng / vật tư',
};

const HTTT_LABELS = {
  KHT: 'Khách hàng thanh toán',
  BHH: 'Bảo hành hãng xe',
  BH: 'Bảo hiểm chi trả',
  NB: 'Nội bộ chịu phí',
};

function formatMoneyVi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function formatKmVi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('vi-VN')} km`;
}

/** Tóm tắt 1 dòng hạng mục (phiếu QT / xuất kho) */
function formatSettlementItemLine(item, index) {
  if (!item || typeof item !== 'object') return `${index + 1}. ${String(item)}`;
  const name = item.description || item.productName || item.name || item.code || item.productCode || `Hạng mục ${index + 1}`;
  const code = item.code || item.productCode || null;
  const qty = item.qty != null ? Number(item.qty) : (item.quantity != null ? Number(item.quantity) : null);
  const unit = item.unit || '';
  const price = item.unitPrice != null ? Number(item.unitPrice) : null;
  const lineTotal = item.total != null ? Number(item.total) : null;
  const parts = [`${index + 1}. ${name}`];
  if (code) parts.push(`(mã ${code})`);
  if (qty != null) parts.push(`— SL: ${qty}${unit ? ` ${unit}` : ''}`);
  if (price != null && price > 0) parts.push(`× ${formatMoneyVi(price)}`);
  if (lineTotal != null) parts.push(`= ${formatMoneyVi(lineTotal)}`);
  if (item.isFree) parts.push('(miễn phí)');
  return parts.join(' ');
}

/** Flatten intake checklist JSON (phiếu QT) thành các cờ Có/Không để hiện trong nhật ký. */
export function flattenIntakeChecklistFields(source) {
  const obj = parseAuditJson(source);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const nested = obj.intakeChecklist || obj.intake_checklist;
  const cl = nested && typeof nested === 'object' ? nested : obj;
  const p = cl.priority && typeof cl.priority === 'object' ? cl.priority : {};
  const o = cl.otherInfo && typeof cl.otherInfo === 'object' ? cl.otherInfo : {};
  const out = {};
  const take = (key, raw) => {
    if (raw == null && obj[key] == null) return;
    out[key] = Boolean(obj[key] ?? raw);
  };
  take('repairRedo', p.repairRedo);
  take('hasAppointment', p.hasAppointment);
  take('warrantyVehicle', p.warranty);
  take('dealerKeepsOldParts', o.dealerKeepsOldParts);
  take('returnOldPartsToCustomer', o.returnOldPartsToCustomer);
  take('carWash', o.carWash);
  take('customerWaitsAtShop', o.customerWaitsAtShop);
  if (obj.isWarranty != null && out.warrantyVehicle == null) {
    out.warrantyVehicle = Boolean(obj.isWarranty);
  }
  const customer = obj.customer;
  if (customer && typeof customer === 'object' && !Array.isArray(customer)) {
    if (customer.fullName || customer.name) out.customerName = customer.fullName || customer.name;
    if (customer.phone || customer.phoneNumber) out.customerPhone = customer.phone || customer.phoneNumber;
    if (customer.address) out.address = customer.address;
    if (customer.taxCode) out.taxCode = customer.taxCode;
    if (customer.cccd) out.cccd = customer.cccd;
    if (customer.email) out.email = customer.email;
    if (customer.contactPerson) out.contactPerson = customer.contactPerson;
    if (customer.contactPhone) out.contactPhone = customer.contactPhone;
  }
  const vehicle = obj.vehicle;
  if (vehicle && typeof vehicle === 'object' && !Array.isArray(vehicle)) {
    if (vehicle.licensePlate) out.licensePlate = vehicle.licensePlate;
    if (vehicle.vehicleModel || vehicle.model) out.vehicleModel = vehicle.vehicleModel || vehicle.model;
    if (vehicle.currentKm != null) out.currentKm = vehicle.currentKm;
    if (vehicle.frameNumber) out.frameNumber = vehicle.frameNumber;
    if (vehicle.engineNumber) out.engineNumber = vehicle.engineNumber;
  }
  return out;
}

/**
 * Bổ sung cờ checklist từ request_body (log cũ không lưu trong snapshot).
 * Không ghi đè field đã có trong snapshot.
 */
export function enrichAuditDisplaySource(value, requestBody) {
  const extra = flattenIntakeChecklistFields(requestBody);
  if (!Object.keys(extra).length) return value;
  const obj = parseAuditJson(value);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return value;
  if (obj.lifecycle && obj.snapshot && typeof obj.snapshot === 'object') {
    return {
      ...obj,
      snapshot: { ...extra, ...obj.snapshot },
    };
  }
  return { ...extra, ...obj };
}

/** Unwrap lifecycle payload { lifecycle, steps, snapshot } → object phẳng để hiển thị */
export function unwrapLifecycleAuditValue(newValue) {
  const obj = parseAuditJson(newValue);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  if (!obj.lifecycle || !obj.snapshot || typeof obj.snapshot !== 'object') return obj;
  return {
    ...flattenIntakeChecklistFields(obj.snapshot),
    ...obj.snapshot,
    _lifecycleSteps: Array.isArray(obj.steps) ? obj.steps : [],
  };
}

/** Nhãn bước lifecycle (fallback khi thiếu label tiếng Việt). */
export const LIFECYCLE_STEP_LABELS = {
  created: 'Tạo mới',
  updated: 'Cập nhật',
  locked: 'Khóa / ngừng hoạt động',
  reactivated: 'Kích hoạt lại',
  deleted: 'Xóa',
  approved: 'Duyệt',
  rejected: 'Từ chối',
  assigned: 'Nhận việc & phân công',
  reassigned: 'Cập nhật phân công thợ',
  completed: 'Hoàn thành',
  status: 'Cập nhật trạng thái',
  signed: 'Khách đã ký',
  paid: 'Đã thanh toán',
  printed: 'In phiếu',
  team_members: 'Cập nhật thành viên đội',
  bays: 'Cập nhật khoang xe phụ trách',
  role_assigned: 'Gán vai trò',
  role_revoked: 'Thu hồi vai trò',
  password_reset: 'Đặt lại mật khẩu',
  password_changed: 'Đổi mật khẩu',
  force_logout: 'Đăng xuất thiết bị',
  manager_assigned: 'Gán giám đốc chi nhánh',
};

export function getLifecycleStepLabel(step) {
  if (!step) return 'Bước';
  const key = String(step).trim();
  return LIFECYCLE_STEP_LABELS[key] || LIFECYCLE_STEP_LABELS[key.toLowerCase()] || key;
}

export function getLifecycleSteps(newValue) {
  const obj = parseAuditJson(newValue);
  if (Array.isArray(obj?.steps)) return obj.steps;
  return [];
}

/**
 * Lay map thay doi cua buoc gan nhat (hoac buoc chi dinh) — dung de highlight dung.
 * @returns {Record<string, {old:any,new:any}>|null}
 */
export function getLifecycleStepChanges(newValue, stepIndex = null) {
  const obj = parseAuditJson(newValue);
  if (!obj || typeof obj !== 'object') return null;
  const steps = Array.isArray(obj.steps) ? obj.steps : [];
  if (stepIndex != null && stepIndex >= 0 && stepIndex < steps.length) {
    const ch = steps[stepIndex]?.changes;
    if (ch && typeof ch === 'object' && !Array.isArray(ch) && Object.keys(ch).length) return ch;
  }
  if (obj.lastChanges && typeof obj.lastChanges === 'object' && !Array.isArray(obj.lastChanges)
    && Object.keys(obj.lastChanges).length) {
    return obj.lastChanges;
  }
  if (steps.length) {
    const last = steps[steps.length - 1];
    if (last?.changes && typeof last.changes === 'object' && Object.keys(last.changes).length) {
      return last.changes;
    }
  }
  return null;
}

/** Snapshot phang tu lifecycle (bo lastChanges/steps) — dung so sanh fallback. */
export function getAuditSnapshotForDiff(value) {
  const obj = parseAuditJson(value);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  if (obj.lifecycle && obj.snapshot && typeof obj.snapshot === 'object') {
    return { ...flattenIntakeChecklistFields(obj.snapshot), ...obj.snapshot };
  }
  return obj;
}

/**
 * Tao hang diff tu lastChanges / step.changes.
 */
export function buildDiffRowsFromChanges(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes).map(([key, pair]) => {
    const oldRaw = pair && typeof pair === 'object' ? pair.old : null;
    const newRaw = pair && typeof pair === 'object' ? pair.new : pair;
    const kind = getAuditFieldDisplayKind(key, newRaw ?? oldRaw);
    const label = getAuditFieldLabel(key);
    return {
      key,
      label,
      kind,
      changed: true,
      oldRow: {
        key,
        label,
        kind,
        raw: oldRaw,
        value: formatAuditFieldValue(key, oldRaw),
      },
      newRow: {
        key,
        label,
        kind,
        raw: newRaw,
        value: formatAuditFieldValue(key, newRaw),
      },
    };
  });
}

export function formatSettlementItems(items) {
  const list = Array.isArray(items) ? items : parseAuditJson(items);
  if (!Array.isArray(list) || !list.length) return '—';
  return list.map((item, i) => formatSettlementItemLine(item, i)).join('\n');
}

export function isAuditSignatureValue(value) {
  if (value == null) return false;
  const s = String(value);
  // Hash HMAC/SHA PayOS (64 hex) — không phải ảnh chữ ký tay
  if (/^[a-f0-9]{32,128}$/i.test(s.trim())) return false;
  return s.startsWith('data:image/') || (s.length > 200 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 80)));
}

/** Chuẩn hóa địa danh VN thiếu dấu (vd HA NOI → Hà Nội) khi hiển thị log */
const PLACE_LABELS_VI = {
  'ha noi': 'Hà Nội',
  hanoi: 'Hà Nội',
  'tp ha noi': 'Hà Nội',
  'thanh pho ha noi': 'Hà Nội',
  'ho chi minh': 'TP. Hồ Chí Minh',
  hcm: 'TP. Hồ Chí Minh',
  'tp hcm': 'TP. Hồ Chí Minh',
  'tp. hcm': 'TP. Hồ Chí Minh',
  saigon: 'TP. Hồ Chí Minh',
  'sai gon': 'TP. Hồ Chí Minh',
  'da nang': 'Đà Nẵng',
  danang: 'Đà Nẵng',
  'hai phong': 'Hải Phòng',
  haiphong: 'Hải Phòng',
  'can tho': 'Cần Thơ',
  cantho: 'Cần Thơ',
  'ha long': 'Hạ Long',
  halong: 'Hạ Long',
  'quang ninh': 'Quảng Ninh',
  'binh duong': 'Bình Dương',
  'dong nai': 'Đồng Nai',
  'khanh hoa': 'Khánh Hòa',
  'nghe an': 'Nghệ An',
  'thanh hoa': 'Thanh Hóa',
  hue: 'Huế',
  'thua thien hue': 'Thừa Thiên Huế',
};

function formatPlaceVi(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const norm = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const compact = norm.replace(/\s+/g, '');
  return PLACE_LABELS_VI[norm] || PLACE_LABELS_VI[compact] || null;
}

const RESULT_VALUE_LABELS = {
  success: 'Thành công',
  successful: 'Thành công',
  failed: 'Thất bại',
  failure: 'Thất bại',
  error: 'Lỗi',
  pending: 'Đang chờ',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
};

const GENDER_LABELS = {
  male: 'Nam',
  female: 'Nữ',
  nam: 'Nam',
  nu: 'Nữ',
  'nữ': 'Nữ',
  other: 'Khác',
};

/**
 * Phân loại hiển thị field (UI render theo kind).
 * @returns {'text'|'money'|'km'|'items'|'signature'}
 */
export function getAuditFieldDisplayKind(key, value) {
  const k = String(key || '');
  // Chỉ render ảnh khi đúng signatureData (base64). Field `signature` của PayOS là hash.
  if (/signatureData|signature_data/i.test(k) && isAuditSignatureValue(value)) return 'signature';
  if ((k === 'items' || k === 'Items') && (Array.isArray(value) || typeof value === 'string')) {
    const parsed = Array.isArray(value) ? value : parseAuditJson(value);
    if (Array.isArray(parsed) && parsed.some((x) => x && typeof x === 'object')) return 'items';
  }
  if (MONEY_FIELD_KEYS.has(k)) return 'money';
  if (k === 'currentKm' || k === 'current_km') return 'km';
  return 'text';
}

/** Format 1 giá trị field cho DiffView */
export function formatAuditFieldValue(key, value) {
  const k = String(key || '');
  if (value === null || value === undefined || value === '') {
    if (/paymentMethod|payment_method|httt/i.test(k)) return 'Chưa chọn';
    if (/signature|signer/i.test(k)) return 'Chưa ký';
    return '—';
  }
  const kind = getAuditFieldDisplayKind(k, value);

  if (/password/i.test(k)) return '••••••••';
  if (typeof value === 'boolean'
    || value === 'true'
    || value === 'false') {
    const truthy = value === true || value === 'true';
    if (k === 'isActive' || k === 'is_active') return truthy ? 'Hoạt động' : 'Ngừng hoạt động';
    return truthy ? 'Có' : 'Không';
  }
  if (k === 'durationMin' || k === 'duration_min') {
    const n = Number(value);
    if (Number.isFinite(n)) return `${n.toLocaleString('vi-VN')} phút`;
  }
  if (k === 'dataType' || k === 'data_type') {
    const DATA_TYPE_LABELS = {
      customers: 'Khách hàng',
      vehicles: 'Xe',
      products: 'Phụ tùng',
    };
    const norm = String(value).trim().toLowerCase();
    return DATA_TYPE_LABELS[norm] || getAuditTableLabel(norm) || String(value);
  }
  if (
    k === 'confirmedDate'
    || k === 'confirmed_date'
    || k === 'importDate'
    || k === 'import_date'
    || k === 'exportDate'
    || k === 'export_date'
  ) {
    return formatDateOnly(value) || String(value);
  }
  if (k === 'phone' || k === 'phoneNumber' || k === 'phone_number' || k === 'customerPhone') {
    const formatted = formatPhoneDisplay(value);
    return formatted || '—';
  }
  if (kind === 'signature') return 'Đã ký (có ảnh chữ ký)';
  if (kind === 'items') return formatSettlementItems(value);
  if (kind === 'money') return formatMoneyVi(value);
  if (kind === 'km') return formatKmVi(value);
  if (k === 'deliveryDate' || k === 'delivery_date' || k === 'intakeDate' || k === 'intake_date') {
    return formatDateOnly(value) || String(value);
  }

  // Hash xác thực PayOS (không phải ảnh chữ ký tay)
  if (
    (k === 'signature' || k === 'Signature')
    && typeof value === 'string'
    && /^[a-f0-9]{32,128}$/i.test(value.trim())
  ) {
    const hex = value.trim();
    return hex.length > 20 ? `${hex.slice(0, 12)}…${hex.slice(-8)}` : hex;
  }

  if (k === 'desc' || k === 'Desc' || k === 'message' || k === 'result') {
    const raw = String(value).trim();
    const norm = raw.toLowerCase();
    return RESULT_VALUE_LABELS[norm] || raw;
  }
  if (k === 'success' || k === 'Success') {
    if (value === true || value === 1 || value === 'true') return 'Có';
    if (value === false || value === 0 || value === 'false') return 'Không';
    const norm = String(value).trim().toLowerCase();
    return RESULT_VALUE_LABELS[norm] || String(value);
  }
  if (k === 'gender') {
    const norm = String(value).trim().toLowerCase();
    return GENDER_LABELS[norm] || String(value);
  }
  if (k === 'city' || k === 'address' || k === 'district' || k === 'ward') {
    const place = formatPlaceVi(value);
    if (place) return place;
  }

  if (k === 'status' || k === 'paymentStatus' || k === 'payment_status') {
    const raw = String(value);
    const norm = raw.toLowerCase().replace(/[\s-]+/g, '_');
    return STATUS_LABELS[norm] || STATUS_LABELS[raw.toLowerCase()] || raw;
  }
  if (
    k === 'kind'
    || k === 'printKind'
    || k === 'print_kind'
    || k === 'lastPrintKind'
    || k === 'last_print_kind'
    || k === 'loaiBanIn'
  ) {
    const raw = String(value).trim();
    const norm = raw.toLowerCase().replace(/[\s-]+/g, '_');
    const spaced = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    return (
      PRINT_KIND_LABELS[norm]
      || PRINT_KIND_LABELS[spaced]
      || PRINT_KIND_LABELS[raw.toLowerCase()]
      || raw
    );
  }
  if (k === 'step') {
    const raw = String(value).trim();
    const norm = raw.toLowerCase().replace(/[\s-]+/g, '_');
    return PRINT_KIND_LABELS[norm] || STATUS_LABELS[norm] || raw;
  }
  if (k === 'repairCategory' || k === 'repair_category') {
    const code = String(value).trim().toUpperCase();
    return REPAIR_CATEGORY_LABELS[code] || String(value);
  }
  if (k === 'lhsc') {
    const code = String(value).trim().toUpperCase();
    return LHSC_LABELS[code] || String(value);
  }
  if (k === 'httt') {
    const code = String(value).trim().toUpperCase();
    return HTTT_LABELS[code] || String(value);
  }
  if (k === 'paymentMethod' || k === 'payment_method') {
    const raw = String(value).trim();
    const norm = raw.toLowerCase().replace(/[\s-]+/g, '_');
    const PAYMENT_METHOD_LABELS = {
      cash: 'Tiền mặt',
      transfer: 'Chuyển khoản',
      bank_transfer: 'Chuyển khoản',
      card: 'Thẻ',
      payos: 'PayOS',
      qr: 'QR PayOS',
      tien_mat: 'Tiền mặt',
      'tiền mặt': 'Tiền mặt',
      'chuyển khoản': 'Chuyển khoản',
    };
    return PAYMENT_METHOD_LABELS[norm] || PAYMENT_METHOD_LABELS[raw.toLowerCase()] || raw;
  }
  if (k === 'granted') return value === true || value === 1 || value === 'true' ? 'Đã cấp' : 'Thu hồi / chưa cấp';
  if (k === 'isDone' || k === 'released' || k === 'isSent' || k === 'isActive' || k === 'is_active' || k === 'isFree' || k === 'isGroupParent') {
    return value === true || value === 1 || value === 'true' ? 'Có' : 'Không';
  }
  if (k === 'permissionKey') {
    const label = getPermissionScreenLabel(value);
    return label && label !== '—' ? label : 'Quyền màn hình';
  }
  if (k === 'screenKey') {
    const label = getScreenLabel(value);
    return label && label !== '—' ? label : 'Màn hình';
  }
  if (k === 'roleName' || k === 'role' || k === 'role_name') return getRoleLabel(value);
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    if (value.every((v) => typeof v !== 'object' || v == null)) {
      return value.map((v) => String(v)).join(', ');
    }
    return formatSettlementItems(value);
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const s = String(value);
  if (s.startsWith('data:image/')) return 'Đã ký (có ảnh chữ ký)';
  const statusHit = STATUS_LABELS[s.toLowerCase()];
  if (statusHit && /status|trạng thái/i.test(k)) return statusHit;
  const resultHit = RESULT_VALUE_LABELS[s.toLowerCase()];
  if (resultHit && /desc|success|result|message|status/i.test(k)) return resultHit;
  // Enum in phiếu còn sót tiếng Anh dù key lạ
  const printNorm = s.toLowerCase().replace(/[\s-]+/g, '_');
  if (PRINT_KIND_LABELS[printNorm] && /kind|print|loai|step/i.test(k)) {
    return PRINT_KIND_LABELS[printNorm];
  }
  if (PRINT_KIND_LABELS[printNorm] && (printNorm === 'settlement' || printNorm === 'worklist')) {
    return PRINT_KIND_LABELS[printNorm];
  }
  const placeHit = formatPlaceVi(s);
  if (placeHit && /city|address|district|ward|tinh|thanh/i.test(k)) return placeHit;
  // Không cắt ngắn số / mã ngắn; chỉ cắt chuỗi rất dài (không phải chữ ký — đã xử lý)
  if (s.length > 200) return `${s.slice(0, 120)}…`;
  return s;
}

const SETTLEMENT_PREFERRED_KEYS = [
  'requestCode',
  'code',
  'customerId',
  'customerName',
  'customerPhone',
  'vehicleId',
  'licensePlate',
  'vehiclePlate',
  'plateNumber',
  'vehicleModel',
  'customerRequest',
  'note',
  'notes',
  'repairRedo',
  'hasAppointment',
  'warrantyVehicle',
  'dealerKeepsOldParts',
  'returnOldPartsToCustomer',
  'carWash',
  'customerWaitsAtShop',
  'currentKm',
  'exportDate',
  'repairOrderCode',
  'serviceOrderCode',
  'bayNumber',
  'technicianNames',
  'technicians',
  'items',
  'itemCount',
  'totalQuantity',
  'subtotal',
  'discountAmount',
  'afterDiscount',
  'vat',
  'freeAmount',
  'exemptedAmount',
  'total',
  'amount',
  'signerName',
  'hasSignature',
  'signatureData',
  'signedAt',
  'deliveryDate',
  'performedByName',
  'status',
  'taskNames',
  'completedTaskCount',
  'lastPrintKind',
  'kind',
  'printKind',
  'loaiBanIn',
  'paymentMethod',
  'paymentStatus',
  'supplierId',
  'supplierInvoiceNo',
  'importDate',
  'requestedBy',
  'requestedByName',
  'productCode',
  'minStock',
  'stockQuantity',
  'location',
  'requestCode',
];

/**
 * Dựng danh sách dòng hiển thị từ object audit (nhãn Việt + kind).
 * @returns {Array<{key,label,value,kind,raw}>}
 */
export function buildAuditDisplayRows(data, { maxRows = 40 } = {}) {
  const unwrapped = unwrapLifecycleAuditValue(data);
  const obj = unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)
    ? unwrapped
    : parseAuditJson(data);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const merged = { ...flattenIntakeChecklistFields(obj), ...obj };

  const preferred = [
    ...SETTLEMENT_PREFERRED_KEYS,
    'serviceOrderId',
    'service_order_id',
    'repairOrderId',
    'repairOrderCode',
    'bayId',
    'bayNumber',
    'bayNumbers',
    'technicianIds',
    'taskId',
    'taskName',
    'isDone',
    'productId',
    'quantity',
    'orderCode',
    'amount',
    'totalAmount',
    'occupiedByDeviceId',
    'occupiedByUserId',
    'released',
    'deviceId',
    'memberIds',
    'permissionKey',
    'screenKey',
    'specialtyNames',
    'specialtyIds',
    'memberNames',
    'memberIds',
    'bayNumbers',
    'roleName',
    'role',
    'targetUserName',
    'targetEmail',
    'targetUserId',
    'granted',
    'activeItems',
    'l1Granted',
    'l1Revoked',
    'reason',
    'rejectReason',
    'browser',
    'os',
    'ip',
    'device',
    'email',
    'phone',
    'firstName',
    'lastName',
    'userName',
    'branchName',
    'name',
    'isSent',
  ];

  const rows = [];
  const used = new Set();

  const pushKey = (key) => {
    if (used.has(key)) return;
    if (
      key === '_lifecycleSteps'
      || key === 'lifecycle'
      || key === 'steps'
      || key === 'snapshot'
      || key === 'currentStepLabel'
      || key === 'currentStep'
      || key === 'lastChanges'
      || key === 'changes'
      || key === 'intakeChecklist'
      || key === 'intake_checklist'
      || key === 'customer'
      || key === 'vehicle'
      || key === 'priority'
      || key === 'otherInfo'
    ) return;
    if (key === 'isWarranty' && (merged.warrantyVehicle != null)) return;
    if ((key === 'specialtyIds' || key === 'specialty_ids') && merged.specialtyNames) return;
    if ((key === 'memberIds' || key === 'member_ids') && merged.memberNames) return;
    if ((key === 'roleId' || key === 'role_id') && merged.roleName) return;
    if ((key === 'branchId' || key === 'branch_id') && merged.branchName) return;
    if ((key === 'teamLeaderId' || key === 'team_leader_id') && merged.teamLeaderName) return;
    if ((key === 'productId' || key === 'product_id') && merged.productName) return;
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') return;
    if ((key === 'l1Granted' || key === 'l1Revoked') && Number(merged[key]) === 0) return;
    // Ẩn ID thô nếu đã có tên thợ
    if (key === 'technicianIds' && merged.technicianNames) return;
    const raw = merged[key];
    if (key === 'technicians' && Array.isArray(raw)) {
      used.add(key);
      const names = raw.map((t) => (typeof t === 'object' ? (t.name || t.fullName || `#${t.id}`) : String(t))).filter(Boolean).join(', ');
      if (!names || merged.technicianNames) return;
      rows.push({
        key,
        label: getAuditFieldLabel(key),
        value: names,
        kind: 'text',
        raw,
      });
      return;
    }
    if (key === 'taskNames' && Array.isArray(raw)) {
      used.add(key);
      rows.push({
        key,
        label: 'Đầu mục đã hoàn thành',
        value: raw.filter(Boolean).join('; ') || '—',
        kind: 'text',
        raw,
      });
      return;
    }
    if (key === 'hasSignature') {
      used.add(key);
      rows.push({
        key,
        label: getAuditFieldLabel(key),
        value: raw ? 'Có' : 'Chưa',
        kind: 'text',
        raw,
      });
      return;
    }
    // Bỏ object lồng nhau phức tạp (không phải mảng hạng mục)
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) return;
    used.add(key);
    rows.push({
      key,
      label: getAuditFieldLabel(key),
      value: formatAuditFieldValue(key, raw),
      kind: getAuditFieldDisplayKind(key, raw),
      raw,
    });
  };

  preferred.forEach(pushKey);
  Object.keys(merged).forEach((key) => {
    if (rows.length >= maxRows) return;
    pushKey(key);
  });

  return rows;
}

/**
 * Tóm tắt "giá trị mới" dạng danh sách dễ đọc (không dump JSON thô mặc định).
 * @returns {{ rows: Array<{key,label,value,kind,raw}>, summary: string } | null}
 */
export function summarizeAuditNewValue(newValue, action) {
  const rows = buildAuditDisplayRows(newValue);
  if (!rows.length) return null;

  const summary = humanizeAuditDescription('', action, newValue);
  const actionLabel = getAuditActionLabel(action);
  // Không lặp lại nhãn hành động trần (vd. chỉ "Tạo mới") ngay trên bảng
  const cleanSummary = summary && summary !== actionLabel ? summary : '';
  return { rows, summary: cleanSummary };
}

/**
 * Đưa object phẳng thành bảng nhãn Việt (dùng cho "Dữ liệu gửi kèm").
 */
export function summarizeAuditObjectRows(data) {
  const rows = buildAuditDisplayRows(data);
  return rows.length ? rows : null;
}

/** So sánh 2 payload audit (bỏ qua khác biệt serialize) */
export function isSameAuditPayload(a, b) {
  const oa = parseAuditJson(a);
  const ob = parseAuditJson(b);
  if (!oa && !ob) return true;
  if (!oa || !ob) return false;
  try {
    return JSON.stringify(oa) === JSON.stringify(ob);
  } catch {
    return false;
  }
}

export function formatAuditTime(value) {
  if (value == null || value === '') return { main: '—', ago: '' };
  const main = formatDateSafeWithOffset(value, {
    timeZone: 'Asia/Ho_Chi_Minh',
    withSeconds: true,
  });
  const offset = getClockOffsetMs();
  const sec = secondsSince(value, Date.now() + offset);
  let ago = '';
  if (sec == null) ago = '';
  else if (sec < -120) ago = ''; // lech gio lon — khong hien "vừa xong" gia
  else if (sec < 0) ago = 'vừa xong';
  else if (sec < 5) ago = 'vừa xong';
  else if (sec < 60) ago = `${sec} giây trước`;
  else if (sec < 3600) ago = `${Math.floor(sec / 60)} phút trước`;
  else if (sec < 86400) ago = `${Math.floor(sec / 3600)} giờ trước`;
  else if (sec < 2592000) ago = `${Math.floor(sec / 86400)} ngày trước`;
  else ago = `${Math.floor(sec / 2592000)} tháng trước`;

  return { main, ago };
}
