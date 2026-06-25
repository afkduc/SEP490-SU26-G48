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
