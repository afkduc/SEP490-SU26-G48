# 🎯 Copy-Paste Commands

Các lệnh dưới đây có thể copy-paste ngay vào Terminal/PowerShell

## ✅ Lần đầu - Setup Project

### 1️⃣ Cấu hình Git (Chỉ cần 1 lần)

```powershell
git config --global user.name "Tên của bạn"
git config --global user.email "email@gmail.com"
```

### 2️⃣ Cài đặt Dependencies

```powershell
# Backend
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48\BE
npm install

# Frontend
cd ..\FE
npm install
```

### 3️⃣ Tạo .env files

```powershell
# Backend
cd ..\BE
copy .env.example .env

# Frontend
cd ..\FE
copy .env.example .env
```

## 🚀 Chạy Project

### Backend (Terminal 1)
```powershell
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48\BE
npm run dev
```

### Frontend (Terminal 2)
```powershell
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48\FE
npm start
```

## 📤 Push lên GitHub

### Bước 1: Tạo repo trên GitHub
- Vào https://github.com/new
- Name: `SEP490-G48`
- Public ✓
- Create repository

### Bước 2: Push từ Local

```powershell
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48

git add .

git commit -m "Initial commit - SEP490 G48 Project Structure"

git branch -M main

git remote add origin https://github.com/YOUR_USERNAME/SEP490-G48.git

git push -u origin main
```

**⚠️ THAY YOUR_USERNAME bằng GitHub username của bạn!**

## 👥 Thành viên Khác Clone

```powershell
git clone https://github.com/YOUR_USERNAME/SEP490-G48.git

cd SEP490-G48

# Cài dependencies
cd BE && npm install && cd ..
cd FE && npm install && cd ..

# Setup .env
copy BE\.env.example BE\.env
copy FE\.env.example FE\.env

# Chạy thử
cd BE
npm run dev

# Terminal 2
cd ..\FE
npm start
```

## 🔄 Thay đổi Hàng Ngày

```powershell
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48

# Pull thay đổi mới nhất
git pull origin main

# Làm việc...

# Push thay đổi
git add .
git commit -m "Chức năng: mô tả ngắn"
git push origin main
```

## 🐛 Xử lý Conflicts

```powershell
# Khi có conflict, sửa file rồi
git add .
git commit -m "Resolve merge conflicts"
git push origin main
```

## 📋 Các Lệnh Hữu Ích

```powershell
# Xem status
git status

# Xem commit log
git log --oneline

# Xem branches
git branch -a

# Switch branch
git checkout branch-name

# Tạo branch mới
git checkout -b feature/feature-name

# Xem thay đổi trước commit
git diff

# Hủy thay đổi file
git checkout -- filename

# Undo commit cuối (giữ code)
git reset --soft HEAD~1

# Undo commit cuối (xóa code)
git reset --hard HEAD~1
```

## 🆘 Troubleshooting

### Lỗi: "Port 5000 đang sử dụng"
```powershell
# Thay đổi PORT trong BE\.env
PORT=5001
```

### Lỗi: "npm: command not found"
- Cài Node.js từ https://nodejs.org/

### Lỗi: "git: command not found"
- Cài Git từ https://git-scm.com/

### Lỗi: "Authentication failed"
```powershell
# Dùng GitHub CLI (dễ nhất)
winget install GitHub.cli
gh auth login
```

---

💡 **Thắc mắc?** Xem README.md, QUICKSTART.md, hoặc GIT_GUIDE.md
