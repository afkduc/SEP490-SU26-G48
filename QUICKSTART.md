# 🚀 Quick Start Guide

Bắt đầu nhanh với SEP490-G48 Project

## ⚡ Setup Nhanh (5 phút)

### 1. Backend

```powershell
cd BE
npm install
npm run dev
```

Backend chạy tại: **http://localhost:5000**

### 2. Frontend (terminal khác)

```powershell
cd FE
npm install
npm start
```

Frontend chạy tại: **http://localhost:3000**

## ✅ Kiểm tra Hoạt động

### API Endpoints

```
GET http://localhost:5000/api/health
GET http://localhost:5000/api/hello
```

### Frontend

1. Mở http://localhost:3000
2. Click nút **"Fetch Hello World"**
3. Xem thông báo từ backend hiển thị

## 📁 Cấu trúc

```
BE/         Backend (Express + Node.js)
FE/         Frontend (React)
.gitignore  Git ignore file
README.md   Tài liệu chi tiết
GIT_GUIDE.md  Hướng dẫn Git
```

## 🔧 Các lệnh thường dùng

| Command | Mục đích |
|---------|---------|
| `npm run dev` (BE) | Chạy backend với auto-reload |
| `npm start` (FE) | Chạy frontend dev server |
| `npm run build` (FE) | Build production |
| `npm install` | Cài dependencies |

## 📚 Tài liệu

- **README.md** - Tài liệu đầy đủ
- **GIT_GUIDE.md** - Hướng dẫn Git chi tiết

## ❓ Troubleshooting

**Port 5000 đã sử dụng?**
```powershell
# Thay PORT trong BE/.env
PORT=5001
```

**Port 3000 đã sử dụng?**
```powershell
# Thay port khi chạy (BE phải running)
# Chỉnh sửa trong FE nếu cần
```

**Lỗi npm install?**
```powershell
npm cache clean --force
npm install
```

---

👉 Xem **README.md** và **GIT_GUIDE.md** để có thêm thông tin!
