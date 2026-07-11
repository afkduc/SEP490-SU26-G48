# AutoGara – Backend API

Node.js + Express, kiến trúc phân lớp (Layered Architecture), kết nối SQL Server.

---

## Yêu cầu

- Node.js >= 18
- SQL Server (đã tạo database `AutoGaraDB` từ file `Database/AutoGara.sql`)

---

## Cài đặt

```bash
npm install
```

---

## Cấu hình môi trường

Sửa file `.env` theo thông tin SQL Server của bạn:

```env
PORT=5000
NODE_ENV=development

DB_SERVER=localhost
DB_NAME=AutoGaraDB
DB_USER=sa
DB_PASSWORD=<mật_khẩu_sa_của_bạn>
DB_TRUST_CERT=true

JWT_SECRET=autogara_sep490_g48_secret_2024
JWT_EXPIRES_IN=8h
```

---

## Chạy

```bash
# Môi trường dev (tự reload khi sửa file)
npm run dev

# Môi trường production
npm start
```

Server khởi động tại: `http://localhost:5000`

---

## API chính

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/auth/login` | Đăng nhập, trả về JWT | Không |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại | Bearer token |

### Ví dụ đăng nhập

```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@autogara.vn",
  "password": "123456"
}
```

---

## Cấu trúc thư mục

```
src/
├── config/             # Cấu hình (port, db, jwt)
├── domain/
│   ├── entities/       # Domain models
│   └── repositories/   # Abstract repository interfaces
├── application/
│   ├── dto/            # Data Transfer Objects
│   └── services/       # Business logic
├── infrastructure/
│   ├── database/       # Kết nối SQL Server
│   └── repositories/   # Concrete repository implementations
├── presentation/
│   ├── controllers/    # HTTP handlers
│   └── routes/         # Express routers
├── middlewares/        # auth, logger, errorHandler
└── utils/              # ApiError, response helpers
```

---

## Tài khoản mặc định

| Email | Role | Password |
|-------|------|----------|
| `admin@autogara.vn` | Quản trị hệ thống | 123456 |
| `generaldirecter@autogara.vn` | Giám đốc | 123456 |
| `qlcn1@autogara.vn` | Quản lý chi nhánh HN | 123456 |
| `cvdvcn1nv1@autogara.vn` | Cố vấn dịch vụ HN | 123456 |
| `nvkcn1nv1@autogara.vn` | Nhân viên kho HN | 123456 |

---

## Luồng Admin (13 Use Cases)

Dự án triển khai đầy đủ 13 use case cho luồng quản trị hệ thống. Xem chi tiết tại [README_ADMIN.md](./README_ADMIN.md).

### Danh sách 13 Use Cases

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

### Tóm tắt kế hoạch implement

- **70 commits trong 7 ngày**
- Pattern: BE trước → FE sau, mỗi commit một việc rõ ràng
- Ngày 1: Foundation + Auth/Profile (UC-01–04)
- Ngày 2: Change Password + Forgot Password (UC-05, UC-06)
- Ngày 3: View All Users (UC-07)
- Ngày 4: Add/Edit/Detail User (UC-08, UC-09, UC-10)
- Ngày 5: View Roles + Assign Role (UC-11, UC-12)
- Ngày 6: System Logs (UC-13)
- Ngày 7: Polish, tích hợp, tài liệu

Chi tiết: [README_ADMIN.md](./README_ADMIN.md)
