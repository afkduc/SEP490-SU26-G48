# 📤 Hướng Dẫn Push Project Lên GitHub

## Bước 1: Chuẩn bị trên GitHub

1. Đăng nhập vào [GitHub.com](https://github.com)
2. Nhấn dấu **"+"** → **"New repository"**
3. Đặt tên: **`SEP490-G48`**
4. Chọn **"Public"** (để mọi người có thể clone)
5. Bỏ chọn "Initialize this repository"
6. Nhấn **"Create repository"**
7. **Copy URL repository** (ví dụ: `https://github.com/YOUR_USERNAME/SEP490-G48.git`)

## Bước 2: Push từ Local

Mở **PowerShell** hoặc **Command Prompt** tại thư mục project:

```powershell
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48

# Cấu hình Git (nếu lần đầu)
git config --global user.name "Tên của bạn"
git config --global user.email "email@gmail.com"

# Kiểm tra git status
git status

# Thêm tất cả files
git add .

# Tạo commit đầu tiên
git commit -m "Initial commit - SEP490 G48 Project Structure with React, Node.js and SQL Server"

# Thêm remote repository (THAY YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/SEP490-G48.git

# Đổi branch thành main
git branch -M main

# Push lên GitHub (lần đầu)
git push -u origin main
```

## Bước 3: Các thành viên clone về

Các thành viên team khác có thể clone bằng:

```powershell
# Clone project
git clone https://github.com/YOUR_USERNAME/SEP490-G48.git
cd SEP490-G48

# Cài đặt dependencies
cd BE && npm install && cd ..
cd FE && npm install && cd ..

# Tạo .env files từ .env.example
cp BE\.env.example BE\.env
cp FE\.env.example FE\.env

# Chạy thử
cd BE
npm run dev

# Và terminal khác
cd FE
npm start
```

## Bước 4: Công việc hàng ngày

Sau khi setup, để push thay đổi:

```powershell
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48

# Xem trạng thái
git status

# Thêm files
git add .

# Commit
git commit -m "Thêm tính năng: mô tả"

# Push
git push origin main
```

## ⚙️ Cấu hình .env trước khi push

**BE/.env** - Không push lên Git (đã trong .gitignore)
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourPassword123
DB_NAME=sep490_g48
```

**FE/.env** - Không push lên Git (đã trong .gitignore)
```
REACT_APP_API_URL=http://localhost:5000/api
```

Chỉ các file `.env.example` được push.

## 🔐 GitHub Authentication

### Tùy chọn 1: Personal Access Token (Recommended)

1. Vào GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Nhấn "Generate new token"
3. Chọn scopes: `repo` ✓
4. Nhấn "Generate token"
5. Copy token

Khi push lần đầu:
- Username: Nhập GitHub username
- Password: Paste token vừa copy

### Tùy chọn 2: GitHub CLI (Dễ nhất)

```powershell
# Cài GitHub CLI: https://cli.github.com/

# Đăng nhập
gh auth login

# Chọn: GitHub.com → HTTPS → Y (Authenticate Git with GitHub credentials)

# Sau đó git sẽ tự authenticate
git push origin main
```

### Tùy chọn 3: SSH (Advanced)

```powershell
# Tạo SSH key
ssh-keygen -t ed25519 -C "email@gmail.com"

# Lấy public key
Get-Content ~/.ssh/id_ed25519.pub

# Copy vào GitHub → Settings → SSH keys

# Thay URL remote
git remote set-url origin git@github.com:YOUR_USERNAME/SEP490-G48.git

# Push
git push origin main
```

## 📝 Commit Message Guidelines

Viết commit messages rõ ràng:

```
✅ Good commits:
- "Add user authentication endpoint"
- "Fix bug: database connection timeout"
- "Update README with setup instructions"

❌ Bad commits:
- "update"
- "fix stuff"
- "asdfjkl"
```

## ✅ Checklist Trước Push

- [ ] Kiểm tra `.gitignore` - không bao gồm `node_modules/`, `.env`
- [ ] Kiểm tra `.env` files không được commit
- [ ] Chạy test: `npm run dev` (BE), `npm start` (FE)
- [ ] Không có console.log debug
- [ ] File `package.json` chính xác
- [ ] README.md có hướng dẫn rõ ràng

## 🐛 Troubleshooting

### "Authentication failed"

```powershell
# Nếu dùng HTTPS, xóa cached credentials
git config --global credential.helper "manager-core"

# Windows:
git config --global credential.helper wincred
```

### "fatal: not a git repository"

```powershell
# Kiểm tra xem đang ở đúng folder
cd D:\1.FULearning\Summer2026\DATN\SourceCode\SEP490-G48

# Nếu chưa init
git init
```

### "You are not authorized"

```powershell
# Xóa credentials cũ
git config --global --unset credential.helper

# Đặt token mới
git config --global credential.helper store
git push origin main
# Lần đầu sẽ hỏi username/password (nhập token)
```

---

✨ Sau khi push lên GitHub, mọi người có thể clone và bắt đầu code cùng nhau!

**Repository URL:** `https://github.com/YOUR_USERNAME/SEP490-G48`
