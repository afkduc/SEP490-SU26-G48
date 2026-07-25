# Plan Triển Khai Phân Quyền Theo Màn & Sync Login Sessions

> Ngày tạo: 2026-07-25
> Trạng thái: ✅ Code xong, chờ chạy migration + seed

## 🎯 Mục tiêu

1. **Phân quyền theo màn (Screen × Action)** - Mỗi role có 1 ma trận quyền: chọn screen → bật/tắt từng action (view/create/update/delete/export)
2. **Sync 2 màn (Lịch sử đăng nhập ↔ Thiết bị)** - realtime, đồng bộ, atomic
3. **Notification = Audit log** - mỗi thao tác ghi log đều tạo notification với màu theo severity
4. **IP máy + clockOffset** - Vite proxy + server time sync

## 📁 Files mới / sửa

### PHẦN A — Phân quyền theo màn (Screen × Action)

| File | Loại | Mô tả |
|------|------|--------|
| `BE/scripts/auto-discover-permissions.js` | NEW | Quét 24 file routes → sinh permission_key |
| `BE/sql/migrations/001_create_role_screen_permissions.sql` | NEW | Tạo bảng `role_screen_permissions` + seed 6 business roles |
| `BE/scripts/seed-role-screen-matrix.js` | NEW | Seed admin full permission (140 screens) |
| `BE/scripts/seed-screen-permissions-to-admin.js` | NEW | Tạo permission_key granular cho admin |
| `BE/scripts/seed-single-permission.js` | NEW | Helper seed 1 permission bất kỳ |
| `BE/scripts/test-role-screen-matrix.js` | NEW | Test script cho 4 endpoint matrix |
| `BE/src/infrastructure/repositories/RoleScreenMatrixRepository.js` | NEW | CRUD + bulk upsert (transactional) |
| `BE/src/presentation/controllers/RoleScreenMatrixController.js` | NEW | GET/POST matrix + auto-discover screens |
| `BE/src/presentation/routes/roleScreenMatrixRoutes.js` | NEW | Mount `/api/admin/role-screen-matrix` |
| `BE/src/presentation/routes/index.js` | EDIT | Mount route mới |
| `BE/src/middlewares/permission.js` | EDIT | Thêm `requireScreenAction(screen, action)` |
| `FE/src/pages/admin/RoleScreenMatrixPage.jsx` | NEW | Page "Phân quyền theo màn" |
| `FE/src/pages/admin/RoleScreenMatrixPage.css` | NEW | Style |
| `FE/src/services/adminApi.js` | EDIT | Thêm `roleScreenMatrixApi` |
| `FE/src/routes/AppRoutes.jsx` | EDIT | Route `/admin/role-screen-matrix` |
| `FE/src/components/layout/AdminLayout.jsx` | EDIT | Menu "Phân quyền theo màn" |

### PHẦN B — Sync 2 màn login

| File | Loại | Mô tả |
|------|------|--------|
| `BE/src/middlewares/loginSessionMiddleware.js` | EDIT | Wrap `trackLogin` + `trackLogout` trong transaction |
| `BE/src/application/events/LoginSessionEvents.js` | EDIT | Thêm `serverTime` field vào SSE event |
| `BE/src/jobs/loginSessionCleanupJob.js` | EDIT | Reduce threshold 15→5 phút, 1 phút/lần, transaction |
| `FE/src/hooks/admin/usePaginatedList.js` | EDIT | Thêm `setItems` để patch row inline |
| `FE/src/hooks/admin/useLoginSessions.js` | EDIT | Export `setItems` |
| `FE/src/pages/admin/AdminLoginSessionsPage.jsx` | EDIT | SSE patch row inline (không refetch full) |

### PHẦN C — IP máy + clockOffset

| File | Loại | Mô tả |
|------|------|--------|
| `FE/vite.config.js` | EDIT | Set `X-Forwarded-For` + `X-Real-IP` trong `proxyReq` event |
| `FE/src/contexts/AppContext.jsx` | EDIT | Sau login → gọi `getServerTime` → lưu `clockOffset` |
| `FE/src/utils/dateUtils.js` | EDIT | Thêm `getClockOffsetMs()` + `formatDateSafeWithOffset()` |

### PHẦN D — Notification = Audit log

| File | Loại | Mô tả |
|------|------|--------|
| `BE/src/utils/auditHelper.js` | EDIT | Thêm `auditNotify` (ghi log + notify), `ACTION_TO_NOTIFICATION_EVENT` |
| `BE/src/presentation/controllers/PermissionMatrixController.js` | EDIT | Sau audit → notify users bị ảnh hưởng |

## 🎨 Action → Severity mapping

| Action | Event | Severity | Màu |
|--------|-------|----------|-----|
| CREATE | USER_CREATED | `success` | 🟢 Xanh lá |
| UPDATE | USER_UPDATED | `info` | 🔵 Xanh dương |
| DELETE/DISABLE | USER_DISABLED | `error` | 🔴 Đỏ |
| LOGIN_SUCCESS | LOGIN_SUCCESS | `success` | 🟢 Xanh |
| LOGIN_FAILED | LOGIN_FAILED | `error` | 🔴 Đỏ |
| FORCE_LOGOUT | FORCE_LOGO | `warning` | 🟡 Vàng |
| CHANGE_PASSWORD | PASSWORD_CHANGED | `info` | 🔵 Xanh dương |
| ASSIGN_ROLE | ROLE_CHANGED | `warning` | 🟡 Vàng |

## 🚀 Triển khai

### 1. Chạy migration SQL

```bash
# Chạy trên server SQL (qua SSMS hoặc sqlcmd)
sqlcmd -S <server> -d <db> -i BE/sql/migrations/001_create_role_screen_permissions.sql
```

### 2. Seed admin full quyền

```bash
cd BE
node scripts/seed-role-screen-matrix.js
node scripts/seed-screen-permissions-to-admin.js
node scripts/seed-single-permission.js screen:role_screen_matrix:access "Phan quyen theo man"
```

### 3. Restart BE server

```bash
# BE sẽ tự khởi động loginSessionCleanupJob với threshold mới
# (1 phút/lần, 5 phút stale)
npm start
```

### 4. Test

```bash
# Mở admin page: http://localhost:3000/admin/role-screen-matrix
# Click role "admin" → xem matrix 140 screens
# Toggle 1 cell → Save → kiểm tra DB role_screen_permissions

# Test login sync:
# - Login → Devices page: 1 row active, current
# - Logout → Devices page: 0 row active
# - Login History: tương ứng
```

## 📊 Permission matrix format

### Schema

```sql
CREATE TABLE role_screen_permissions (
  id INT IDENTITY PRIMARY KEY,
  role_id INT NOT NULL,
  screen_key VARCHAR(100) NOT NULL,        -- 'manager:services', 'director:reports'
  can_view BIT NOT NULL DEFAULT 0,
  can_create BIT NOT NULL DEFAULT 0,
  can_update BIT NOT NULL DEFAULT 0,
  can_delete BIT NOT NULL DEFAULT 0,
  can_export BIT NOT NULL DEFAULT 0,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  UNIQUE (role_id, screen_key),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

### Permission key format

```
screen:<module>:<resource>:<action>
```

Ví dụ:
- `screen:manager:services:view` - Manager xem dịch vụ
- `screen:manager:services:create` - Manager tạo dịch vụ
- `screen:director:reports:export` - Director xuất báo cáo

### Middleware usage

```js
const { requireScreenAction } = require('../../middlewares/permission');

// Trong routes:
router.post('/services',
  requireScreenAction('manager:services', 'create'),
  controller.createService);

router.get('/reports/revenue',
  requireScreenAction('director:reports', 'view'),
  controller.getRevenueReports);

router.get('/reports/revenue/export',
  requireScreenAction('director:reports', 'export'),
  controller.exportRevenueReports);
```

## 🐛 Bug fixes trong plan này

1. **Login sync issue**: 5 phien dang hoat dong thuc te chi 1
   - **Root cause**: trackLogin/trackLogout KHONG transactional
   - **Fix**: Wrap trong `executeTransaction`
   - **Bonus**: cleanup job threshold 15→5 phút, chạy 1 phút/lần

2. **IP may khong lay dung**:
   - **Root cause**: Vite proxy KHONG set X-Forwarded-For
   - **Fix**: Set trong `proxyReq` event

3. **Phan quyen theo man**:
   - **Yeu cau**: 7 role, moi role 1 bang, CRUD action con
   - **Fix**: Bang `role_screen_permissions` + auto-discover routes

4. **Notification = audit log**:
   - **Yeu cau**: Moi thao tac ghi log = thong bao
   - **Fix**: `auditNotify` wrapper, mapping action → event → severity
