# Admin Flow – Kế hoạch 70 Commits / 7 Ngày

> Kế hoạch implement luồng Admin (UC-01 đến UC-13) cho dự án AutoGara SEP490-G48.

## Mục lục

- [Bối cảnh](#bối-cảnh)
- [Quy ước chung](#quy-ước-chung)
- [Ngày 1 – Foundation + Auth/Profile (UC-01–04)](#ngày-1--foundation--authprofile-uc-01-04--10-commits)
- [Ngày 2 – Change Password + Forgot Password (UC-05, UC-06)](#ngày-2--change-password--forgot-password-uc-05-uc-06--10-commits)
- [Ngày 3 – View All Users (UC-07)](#ngày-3--view-all-users-uc-07--10-commits)
- [Ngày 4 – Add/Edit/Detail User (UC-08, UC-09, UC-10)](#ngày-4--addeditdetail-user-uc-08-uc-09-uc-10--10-commits)
- [Ngày 5 – View Roles + Assign Role (UC-11, UC-12)](#ngày-5--view-roles--assign-role-uc-11-uc-12--10-commits)
- [Ngày 6 – System Logs (UC-13)](#ngày-6--system-logs-uc-13--10-commits)
- [Ngày 7 – Polish, tích hợp, tài liệu](#ngày-7--polish-tích-hợp-tài-liệu--10-commits)
- [Tóm tắt phân bổ commit theo UC](#tóm-tắt-phân-bổ-commit-theo-uc)
- [Migrations sẽ tạo](#migrations-sẽ-tạo)
- [File mới sẽ tạo](#file-mới-sẽ-tạo)
- [Quy tắc khi thực thi](#quy-tắc-khi-thựcthi)

---

## Bối cảnh

### Tech stack

| Layer | Công nghệ |
|-------|-----------|
| **BE** | Node.js + Express, kiến trúc phân lớp (domain/application/infrastructure/presentation), SQL Server |
| **FE** | React 18 + Vite + react-router-dom v7 |
| **Auth** | JWT + bcryptjs |

### File BE hiện có (tham khảo khi sửa)

- `BE/src/presentation/controllers/AdminController.js`
- `BE/src/presentation/routes/adminRoutes.js`
- `BE/src/presentation/controllers/UserController.js`
- `BE/src/application/services/UserService.js`
- `BE/src/infrastructure/repositories/UserRepositoryImpl.js`
- `BE/src/application/services/AuthService.js`
- `BE/src/presentation/controllers/AuthController.js`
- `BE/src/presentation/routes/authRoutes.js`
- `BE/src/middlewares/auth.js` (`authenticate`, `requireAdmin`)

### File FE hiện có (tham khảo khi sửa)

- `FE/src/pages/admin/AdminDashboardPage.jsx`
- `FE/src/services/adminApi.js`
- `FE/src/pages/auth/LoginPage.jsx`
- `FE/src/contexts/AppContext.jsx`
- `FE/src/components/ProtectedRoute.jsx`
- `FE/src/components/layout/Navbar.jsx` (đã có `ADMIN_NAV`)
- `FE/src/constants/routes.js` (đã khai báo `ADMIN_USERS`, `ADMIN_ROLES`, `ADMIN_LOGS`)

### Database

- SQL Server `AutoGaraDB`
- Có sẵn: `users`, `user_role`, `roles`, `branches`
- **Chưa có**: role `admin` trong bảng `roles`, bảng `system_logs`
- Folder `Database/migrations/`: có `V2__add_inventory_columns.sql` (còn trống)

### Style commit đang dùng

Format: `type(scope): mô tả` (tiếng Việt, scope tiếng Anh)

Ví dụ:
```
feat(inventory): add Product domain layer
fix(fe): correct import paths in hooks
chore(db): add V2 migration for products table
```

### Routes FE đã khai báo, chưa implement

| Route | Trạng thái |
|-------|-----------|
| `/admin/users` | Đã có link trong Navbar, chưa implement page |
| `/admin/roles` | Đã khai báo trong routes.js, chưa implement |
| `/admin/logs` | Đã khai báo trong routes.js, chưa implement |

---

## Quy ước chung

1. **Mỗi commit làm đúng một việc** (một file mới, một route, một màn hình). Tránh commit gộp.
2. **BE trước → FE sau** cho mỗi UC, theo pattern:
   `domain → repository → service → controller → route → FE service/hook → FE page → route wiring`
3. **Scope commit** gợi ý:
   - `db` – migration
   - `be` – backend
   - `fe` – frontend
   - `admin` – tài liệu / cấu hình chung
4. **Không commit** `node_modules`, `dist`, `.env`.
5. **Mỗi commit phải build được**: BE `npm run dev` chạy, FE `npm run dev` chạy.
6. **Cuối mỗi ngày** (ngày 1–6): commit checkpoint nếu cần.

---

## Ngày 1 – Foundation + Auth/Profile (UC-01, UC-02, UC-03, UC-04) – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 1 | `chore(db): tạo V3__add_admin_role_and_columns.sql` | `Database/migrations/V3__add_admin_role_and_columns.sql` – INSERT role `admin`, thêm cột `last_login_at`, `created_by` vào `users` |
| 2 | `feat(be): thêm User entity mở rộng (fullName, phone, branchId, roles, status)` | Sửa `BE/src/domain/entities/User.js` |
| 3 | `feat(be): thêm UserResponseDto.fromUserRow mapping đầy đủ cột` | Sửa `BE/src/application/dto/UserResponseDto.js` |
| 4 | `feat(be): thêm UserService.getCurrentUser(req.user.id)` | Sửa `BE/src/application/services/UserService.js` |
| 5 | `feat(be): thêm AuthController.getMe trả về full profile (UC-03)` | Sửa `BE/src/presentation/controllers/AuthController.js` |
| 6 | `feat(be): PUT /api/users/me – update profile (UC-04)` | Sửa `BE/src/presentation/routes/userRoutes.js` + `UserController.updateMe` |
| 7 | `feat(fe): thêm userApi.getMe + updateMe` | Sửa `FE/src/services/userApi.js` |
| 8 | `feat(fe): hook useCurrentUser + useUpdateProfile` | Mới: `FE/src/hooks/useCurrentUser.js`, `FE/src/hooks/useUpdateProfile.js` |
| 9 | `feat(fe): trang UserProfilePage (UC-03) – hiển thị + nút Edit` | Mới: `FE/src/pages/profile/UserProfilePage.jsx` + CSS |
| 10 | `feat(fe): trang EditProfilePage (UC-04) – form email/phone + validation` | Mới: `FE/src/pages/profile/EditProfilePage.jsx` + route `/profile/edit` |

**Checkpoint cuối ngày 1**: User đăng nhập → xem profile → sửa email/phone lưu thành công.

---

## Ngày 2 – Change Password + Forgot Password (UC-05, UC-06) – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 11 | `feat(be): AuthService.changePassword (verify old, hash new, ApiError 401/400)` | Sửa `BE/src/application/services/AuthService.js` |
| 12 | `feat(be): AuthController.changePassword` | Sửa `BE/src/presentation/controllers/AuthController.js` |
| 13 | `feat(be): POST /api/auth/change-password` | Sửa `BE/src/presentation/routes/authRoutes.js` |
| 14 | `feat(fe): changePasswordApi + hook useChangePassword` | Sửa `FE/src/services/authApi.js` + `FE/src/hooks/useChangePassword.js` |
| 15 | `feat(fe): trang ChangePasswordPage (UC-05) – 3 field + validate` | Mới: `FE/src/pages/profile/ChangePasswordPage.jsx` |
| 16 | `feat(db): V4__add_password_reset_tokens.sql` | Mới: `Database/migrations/V4__add_password_reset_tokens.sql` |
| 17 | `feat(be): AuthRepositoryImpl.createPasswordResetToken / findValidToken / markUsed` | Sửa `BE/src/infrastructure/repositories/AuthRepositoryImpl.js` |
| 18 | `feat(be): AuthService.requestPasswordReset (token 30 phút, log link ra console.log)` | Sửa `BE/src/application/services/AuthService.js` |
| 19 | `feat(be): AuthService.resetPassword + AuthController + 2 route /forgot-password, /reset-password (UC-06)` | Sửa `AuthController.js`, `authRoutes.js` |
| 20 | `feat(fe): ForgotPasswordPage + ResetPasswordPage + link Quên mật khẩu từ LoginPage` | Mới: `FE/src/pages/auth/ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx` |

**Checkpoint cuối ngày 2**: Đổi mật khẩu thành công; quên mật khẩu nhận được link trong terminal BE.

> **Lưu ý UC-06**: Link reset password được log ra `console.log` ở BE. Khi implement thật sẽ cần tích hợp SMTP server.

---

## Ngày 3 – View All Users (UC-07) – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 21 | `feat(be): AdminUserRepository.findAll với filter (branch, role, status, search, paging)` | Mới: `BE/src/infrastructure/repositories/AdminUserRepositoryImpl.js` |
| 22 | `feat(be): AdminUserRepository.countAllUsers` | Mở rộng file trên |
| 23 | `feat(be): AdminUserService.listUsers (validate query, gọi repo, trả về {items, total, page, pageSize})` | Mới: `BE/src/application/services/AdminUserService.js` |
| 24 | `feat(be): AdminController.listUsers thay thế stub hiện tại` | Sửa `BE/src/presentation/controllers/AdminController.js` |
| 25 | `feat(be): adminRoutes GET /api/admin/users?search=&branchId=&roleId=&status=&page=&pageSize=` | Sửa `BE/src/presentation/routes/adminRoutes.js` |
| 26 | `feat(be): thêm GET /api/admin/branches cho filter dropdown` | Sửa `adminRoutes.js` + repository |
| 27 | `feat(be): thêm GET /api/admin/roles cho filter dropdown (dùng chung UC-11 sau)` | Sửa `adminRoutes.js` |
| 28 | `feat(fe): adminUsersApi.list + adminBranchesApi.list + adminRolesApi.list` | Sửa `FE/src/services/adminApi.js` |
| 29 | `feat(fe): hook useAdminUsers (params, debounce search, return {data, loading, error, refetch})` | Mới: `FE/src/hooks/admin/useAdminUsers.js` |
| 30 | `feat(fe): AdminUsersPage với UsersTable + FilterBar (UC-07)` | Mới: `FE/src/pages/admin/users/AdminUsersPage.jsx` + route `/admin/users` + thêm `ADMIN_USERS` vào Navbar admin |

**Checkpoint cuối ngày 3**: Admin truy cập `/admin/users` thấy danh sách có filter, search, paging.

---

## Ngày 4 – Add/Edit/Detail User (UC-08, UC-09, UC-10) – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 31 | `feat(be): AdminUserService.createUser (validate email unique, bcrypt password, ApiError 400/409)` | Mở rộng `AdminUserService.js` |
| 32 | `feat(be): AdminUserRepository.create + findByEmail` | Mở rộng `AdminUserRepositoryImpl.js` |
| 33 | `feat(be): POST /api/admin/users (UC-08)` | Sửa `adminRoutes.js` + `AdminController.createUser` |
| 34 | `feat(be): AdminUserService.updateUser (toggle status, đổi role, validate)` | Mở rộng `AdminUserService.js` |
| 35 | `feat(be): AdminUserRepository.update` | Mở rộng `AdminUserRepositoryImpl.js` |
| 36 | `feat(be): PUT /api/admin/users/:id (UC-09)` | Sửa `adminRoutes.js` + `AdminController.updateUser` |
| 37 | `feat(be): AdminUserService.getUserDetail (join user_role, branch)` | Mở rộng `AdminUserService.js` |
| 38 | `feat(be): GET /api/admin/users/:id (UC-10)` | Sửa `adminRoutes.js` + `AdminController.getUserDetail` |
| 39 | `feat(fe): adminUsersApi.create + update + getDetail` | Sửa `FE/src/services/adminApi.js` |
| 40 | `feat(fe): UserFormModal (create/edit) + UserDetailDrawer (UC-08/09/10) + wire vào AdminUsersPage` | Mới: `FE/src/pages/admin/users/UserFormModal.jsx`, `UserDetailDrawer.jsx` |

**Checkpoint cuối ngày 4**: Admin tạo user mới, sửa user, xem chi tiết user qua drawer.

---

## Ngày 5 – View Roles + Assign Role (UC-11, UC-12) – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 41 | `feat(be): RoleRepository.findAll + findById + countUsersByRole` | Mới: `BE/src/infrastructure/repositories/RoleRepositoryImpl.js` |
| 42 | `feat(be): RoleService.listRoles + getRoleDetail` | Mới: `BE/src/application/services/RoleService.js` |
| 43 | `feat(be): GET /api/admin/roles + GET /api/admin/roles/:id (UC-11)` | Sửa `adminRoutes.js` + `AdminController.listRoles/getRoleDetail` |
| 44 | `feat(be): UserRoleRepository.assignRole + removeRole + listByUser` | Mới: `BE/src/infrastructure/repositories/UserRoleRepositoryImpl.js` |
| 45 | `feat(be): UserRoleService.assign + revoke` | Mới: `BE/src/application/services/UserRoleService.js` |
| 46 | `feat(be): POST /api/admin/users/:userId/roles + DELETE /:userId/roles/:roleId (UC-12)` | Sửa `adminRoutes.js` |
| 47 | `feat(fe): adminRolesApi.list + getDetail` | Sửa `FE/src/services/adminApi.js` |
| 48 | `feat(fe): hook useAdminRoles` | Mới: `FE/src/hooks/admin/useAdminRoles.js` |
| 49 | `feat(fe): AdminRolesPage dạng grid card (UC-11) + route /admin/roles` | Mới: `FE/src/pages/admin/roles/AdminRolesPage.jsx` |
| 50 | `feat(fe): AssignRoleModal (multi-select checkbox) + nút "Phân quyền" trong UserDetailDrawer (UC-12)` | Mới: `FE/src/pages/admin/users/AssignRoleModal.jsx` |

**Checkpoint cuối ngày 5**: Admin xem danh sách role, phân quyền cho user qua drawer.

---

## Ngày 6 – System Logs (UC-13) – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 51 | `feat(db): V5__add_system_logs_table.sql` | Mới: `Database/migrations/V5__add_system_logs_table.sql` |
| 52 | `feat(be): LoggerService (info/warn/error, ghi vào bảng system_logs, không chặn main flow)` | Mới: `BE/src/application/services/LoggerService.js` |
| 53 | `feat(be): LogRepository.insert + findAll` | Mới: `BE/src/infrastructure/repositories/LogRepositoryImpl.js` |
| 54 | `feat(be): ghi log trong AuthService.login (action=LOGIN, success/fail)` | Sửa `AuthService.js` |
| 55 | `feat(be): ghi log trong AdminUserService (CREATE_USER/UPDATE_USER/DELETE_USER/ASSIGN_ROLE/REVOKE_ROLE)` | Sửa `AdminUserService.js`, `UserRoleService.js` |
| 56 | `feat(be): LogService.listLogs (filter action, actor, date range, paging)` | Mới: `BE/src/application/services/LogService.js` |
| 57 | `feat(be): LogController.listLogs + GET /api/admin/logs (UC-13)` | Mới: `BE/src/presentation/controllers/LogController.js`, sửa `adminRoutes.js` |
| 58 | `feat(fe): adminLogsApi.list` | Sửa `FE/src/services/adminApi.js` |
| 59 | `feat(fe): hook useAdminLogs` | Mới: `FE/src/hooks/admin/useAdminLogs.js` |
| 60 | `feat(fe): AdminLogsPage với FilterBar + LogsTable (UC-13) + route /admin/logs + menu Navbar` | Mới: `FE/src/pages/admin/logs/AdminLogsPage.jsx` |

**Checkpoint cuối ngày 6**: Mỗi thao tác admin đều xuất hiện trong `/admin/logs` với filter theo actor/action/ngày.

> **Lưu ý UC-13**: Logging được ghi tự động qua `LoggerService` bên trong các service (auth/admin), không qua HTTP middleware để tránh chặn response.

---

## Ngày 7 – Polish, tích hợp, tài liệu – 10 commits

| # | Commit message | File/Thay đổi chính |
|---|---------------|----------------------|
| 61 | `chore(fe): thêm dropdown Profile/Đổi mật khẩu/Đăng xuất trong Navbar (áp dụng mọi role)` | Sửa `FE/src/components/layout/Navbar.jsx` |
| 62 | `feat(fe): LoadingSpinner + ErrorBanner component dùng chung cho admin pages` | Mới: `FE/src/components/common/LoadingSpinner.jsx`, `ErrorBanner.jsx` |
| 63 | `refactor(fe): gom các hook admin vào FE/src/hooks/admin/index.js` | Mới: `FE/src/hooks/admin/index.js` |
| 64 | `fix(be): chuẩn hóa response error {code, message} cho toàn bộ admin routes` | Sửa `BE/src/utils/response.js`, các `AdminController` |
| 65 | `fix(be): rate-limit POST /api/auth/forgot-password (max 5 req / 15 phút / IP)` | Sửa `authRoutes.js` (in-memory map đơn giản) |
| 66 | `fix(fe): AdminUsersPage giữ filter state khi đóng/mở modal` | Sửa `AdminUsersPage.jsx` |
| 67 | `test(be): unit test AdminUserService.listUsers với 3 case filter` | Mới: `BE/src/application/services/__tests__/AdminUserService.test.js` |
| 68 | `test(be): unit test AuthService.changePassword với 2 case pass/fail` | Mới: `BE/src/application/services/__tests__/AuthService.test.js` |
| 69 | `chore(admin): thêm file README_ADMIN.md mô tả API + cách test 13 UC` | Tạo file `README_ADMIN.md` (file này) |
| 70 | `docs(admin): cập nhật README gốc – bảng tổng hợp 13 UC, link tới README_ADMIN` | Sửa `README.md` |

**Checkpoint cuối ngày 7**: Toàn bộ 13 UC chạy được, tài liệu đầy đủ, có test cho phần auth/user.

---

## Tóm tắt phân bổ commit theo UC

| UC | Mô tả | Số commit | Ngày |
|----|-------|-----------|------|
| UC-01 | Login | 0 (dùng code hiện tại) | – |
| UC-02 | Logout | 0 (dùng code hiện tại) | – |
| UC-03 | View Profile | 2 | Ngày 1 |
| UC-04 | Edit Profile | 2 | Ngày 1 |
| UC-05 | Change Password | 5 | Ngày 2 |
| UC-06 | Forgot Password | 6 | Ngày 2 |
| UC-07 | View All Users | 10 | Ngày 3 |
| UC-08 | Add User | 4 (trong ngày 4) | Ngày 4 |
| UC-09 | Edit User | 3 (trong ngày 4) | Ngày 4 |
| UC-10 | Detail User | 2 (trong ngày 4) | Ngày 4 |
| UC-11 | View All Roles | 7 | Ngày 5 |
| UC-12 | Assign Role | 4 (trong ngày 5) | Ngày 5 |
| UC-13 | View System Logs | 10 | Ngày 6 |
| Polish/Docs/Test | Tích hợp, tài liệu | 10 | Ngày 7 |
| **Tổng** | | **70** | **7 ngày** |

---

## Migrations sẽ tạo

```
Database/migrations/
├── V2__add_inventory_columns.sql    (đã có, còn trống)
├── V3__add_admin_role_and_columns.sql  ← mới
├── V4__add_password_reset_tokens.sql   ← mới
└── V5__add_system_logs_table.sql       ← mới
```

### V3 – Admin role và mở rộng users

```sql
-- INSERT role admin
INSERT INTO roles (role_name, role_label) VALUES ('admin', N'Quản trị hệ thống');

-- ALTER TABLE users – thêm cột
ALTER TABLE users ADD last_login_at DATETIME NULL;
ALTER TABLE users ADD created_by BIGINT NULL;
ALTER TABLE users ADD CONSTRAINT users_createdby_fkey FOREIGN KEY (created_by) REFERENCES users(id);
```

### V4 – Password reset tokens

```sql
CREATE TABLE password_reset_tokens (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    token       VARCHAR(255) NOT NULL,
    expires_at  DATETIME NOT NULL,
    used_at     DATETIME NULL,
    created_at  DATETIME DEFAULT GETDATE(),
    CONSTRAINT prt_user_fkey FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT prt_token_uq UNIQUE (token)
);
```

### V5 – System logs

```sql
CREATE TABLE system_logs (
    id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    actor_id   BIGINT NULL,
    actor_name VARCHAR(100) NULL,
    action     VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NULL,
    target_id  BIGINT NULL,
    details    NVARCHAR(MAX) NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    created_at DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_logs_actor ON system_logs(actor_id);
CREATE INDEX idx_logs_action ON system_logs(action);
CREATE INDEX idx_logs_created ON system_logs(created_at);
```

---

## File mới sẽ tạo

### Backend (BE)

```
BE/src/
├── application/services/
│   ├── AdminUserService.js        ← mới (mở rộng)
│   ├── RoleService.js             ← mới
│   ├── UserRoleService.js         ← mới
│   ├── LogService.js              ← mới
│   └── LoggerService.js           ← mới
├── infrastructure/repositories/
│   ├── AdminUserRepositoryImpl.js ← mới
│   ├── RoleRepositoryImpl.js      ← mới
│   ├── UserRoleRepositoryImpl.js  ← mới
│   └── LogRepositoryImpl.js       ← mới
└── presentation/controllers/
    └── LogController.js           ← mới
```

### Frontend (FE)

```
FE/src/
├── pages/
│   ├── profile/
│   │   ├── UserProfilePage.jsx      ← mới
│   │   ├── EditProfilePage.jsx      ← mới
│   │   └── ChangePasswordPage.jsx   ← mới
│   ├── auth/
│   │   ├── ForgotPasswordPage.jsx   ← mới
│   │   └── ResetPasswordPage.jsx    ← mới
│   └── admin/
│       ├── users/
│       │   ├── AdminUsersPage.jsx     ← mới
│       │   ├── UserFormModal.jsx      ← mới
│       │   ├── UserDetailDrawer.jsx   ← mới
│       │   └── AssignRoleModal.jsx    ← mới
│       ├── roles/
│       │   └── AdminRolesPage.jsx     ← mới
│       └── logs/
│           └── AdminLogsPage.jsx      ← mới
├── hooks/
│   ├── useCurrentUser.js             ← mới
│   ├── useUpdateProfile.js           ← mới
│   ├── useChangePassword.js          ← mới
│   └── admin/
│       ├── useAdminUsers.js          ← mới
│       ├── useAdminRoles.js          ← mới
│       ├── useAdminLogs.js           ← mới
│       └── index.js                  ← mới
└── components/common/
    ├── LoadingSpinner.jsx            ← mới (ngày 7)
    └── ErrorBanner.jsx               ← mới (ngày 7)
```

---

## Quy tắc khi thực thi

1. **Mỗi sáng**: Tạo branch mới từ `dev` (ví dụ: `feat/admin-day1`), rebase mỗi tối.
2. **Trước mỗi commit**: Chạy `cd BE && npm run dev` (5 giây) để đảm bảo không vỡ boot; tương tự với `cd FE && npm run dev`.
3. **Với file mới**: Check `git status` không kéo theo `node_modules`/`dist`.
4. **Nếu commit quá lớn**: Tách đôi trước khi push – ưu tiên tách theo từng file.
5. **Cuối ngày 1–6**: Commit checkpoint `chore(admin): smoke test ngày X – ghi chú thủ công` nếu còn slot (tối đa 70, không vượt).

---

## Danh sách 13 Use Case

| UC | Tên | Actor |
|----|-----|-------|
| UC-01 | Login | All Actor |
| UC-02 | Logout | All Actor |
| UC-03 | View Profile | All Actor |
| UC-04 | Edit Profile | All Actor |
| UC-05 | Change Password | All Actor |
| UC-06 | Forgot Password | All Actor |
| UC-07 | View All Users | Admin |
| UC-08 | Add User | Admin |
| UC-09 | Edit User | Admin |
| UC-10 | Detail User | Admin |
| UC-11 | View All Roles | Admin |
| UC-12 | Assign Role | Admin |
| UC-13 | View System Logs | Admin |

---

*Document này được tạo tự động từ kế hoạch 70 commits. Cập nhật lần cuối: Ngày bắt đầu implement.*
