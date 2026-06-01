# 📚 Hướng Dẫn Đẩy Project Lên Git

## 1️⃣ Khởi tạo Git Repository (Lần Đầu Tiên)

Nếu bạn chưa có repository trên GitHub, hãy:

### Bước 1: Tạo Repository trên GitHub

1. Vào [github.com](https://github.com) và đăng nhập
2. Click **"+"** (New) ở góc trên phải
3. Chọn **"New repository"**
4. Đặt tên: `SEP490-G48`
5. Thêm description: `SEP490 Group 48 - React + Node.js + SQL Server Project`
6. Chọn **"Public"** để mọi người có thể clone
7. **Bỏ chọn** "Initialize this repository with:"
8. Click **"Create repository"**

### Bước 2: Khởi tạo Git tại Local (Windows PowerShell)

```powershell
# Chuyển đến thư mục project
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48

# Khởi tạo git
git init

# Cấu hình Git (lần đầu)
git config --global user.name "Tên của bạn"
git config --global user.email "email@gmail.com"

# Thêm tất cả files
git add .

# Tạo commit đầu tiên
git commit -m "Initial commit - Project structure setup with React, Node.js and SQL Server"

# Đổi tên branch thành main
git branch -M main

# Thêm remote repository (thay YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/SEP490-G48.git

# Push code lên GitHub (lần đầu)
git push -u origin main
```

## 2️⃣ Cách Thành Viên Khác Clone Về

Để các thành viên trong team clone project về:

```powershell
# Clone project
git clone https://github.com/YOUR_USERNAME/SEP490-G48.git
cd SEP490-G48

# Cài đặt Backend
cd BE
npm install
cp .env.example .env

# Cài đặt Frontend
cd ../FE
npm install
cp .env.example .env
```

## 3️⃣ Workflow Hàng Ngày

### Push Thay Đổi

```powershell
# Xem trạng thái
git status

# Thêm files đã thay đổi
git add .

# Commit với message rõ ràng
git commit -m "Chức năng mô tả: Add user authentication"

# Push lên GitHub
git push origin main
```

### Pull Thay Đổi từ Teammates

```powershell
# Lấy thay đổi mới nhất
git pull origin main
```

## 4️⃣ Git Branches (Khuyến nghị)

```powershell
# Tạo branch mới cho feature
git checkout -b feature/user-login

# Làm việc trên branch này
# ... code code code ...

# Push branch lên GitHub
git push origin feature/user-login

# Trên GitHub, tạo Pull Request (PR) để merge vào main
# Sau khi review và approve, merge PR
```

### Cấu trúc Branches:
- **main** - Production code (stable)
- **develop** - Development code
- **feature/feature-name** - Tính năng mới
- **hotfix/issue-name** - Fix bugs nhanh

## 5️⃣ Git Commands Hữu Ích

```powershell
# Xem lịch sử commit
git log --oneline

# Xem chi tiết branch
git branch -a

# Xem thay đổi chưa commit
git diff

# Hủy thay đổi trên 1 file
git checkout -- filename

# Xem remote URL
git remote -v

# Cập nhật từ remote
git fetch origin

# Merge branch khác vào branch hiện tại
git merge feature/user-login
```

## 6️⃣ Giải Quyết Conflicts

Nếu có xung đột merge:

```powershell
# 1. Xem files có conflict
git status

# 2. Mở file và fix conflicts (sẽ thấy <<<<<<, ======, >>>>>>)

# 3. Thêm files đã fix
git add .

# 4. Commit merge
git commit -m "Resolve merge conflicts"

# 5. Push lên
git push origin branch-name
```

## 7️⃣ Git Configuration (Lần Đầu)

```powershell
# Cấu hình global (toàn bộ máy)
git config --global user.name "Tên của bạn"
git config --global user.email "email@gmail.com"

# Hoặc cấu hình cho repo này
git config user.name "Tên của bạn"
git config user.email "email@gmail.com"

# Xem cấu hình
git config --list
```

## 🔐 GitHub Authentication

### Tạo Personal Access Token (Recommended)

1. Vào GitHub → Settings → Developer settings → Personal access tokens
2. Click "Generate new token"
3. Chọn scopes: `repo`, `read:user`
4. Click "Generate token"
5. Copy token

Khi push, nhập:
- Username: `YOUR_USERNAME`
- Password: `Paste token vừa copy`

**Hoặc dùng SSH** (Advanced):
```powershell
# Tạo SSH key
ssh-keygen -t ed25519 -C "email@gmail.com"

# Copy public key vào GitHub Settings → SSH keys
# Thay URL remote sang SSH:
git remote set-url origin git@github.com:YOUR_USERNAME/SEP490-G48.git
```

## 📋 Checklist Trước Khi Push

- ✅ Kiểm tra `.gitignore` không bao gồm các files công khai
- ✅ Kiểm tra `.env` không được commit (chỉ `.env.example`)
- ✅ Kiểm tra code không có console.log debug
- ✅ Kiểm tra dependencies chính xác trong `package.json`
- ✅ Code đã test chạy thành công

## ❓ Troubleshooting

**Q: Quên git config?**
```powershell
git config --list
```

**Q: Push nhưng bị reject?**
```powershell
# Pull thay đổi mới nhất trước
git pull origin main
# Fix conflicts nếu có
git push origin main
```

**Q: Muốn undo commit cuối?**
```powershell
git reset --soft HEAD~1
```

**Q: Quên add file gì?**
```powershell
git log --oneline  # Xem commit
git amend          # Sửa commit cuối
```

---

💡 **Mẹo:** Luôn commit thường xuyên với message rõ ràng để dễ track thay đổi!

Happy coding! 🚀
