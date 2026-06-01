# SEP490 - Group 48 Project

Dự án quản lý được xây dựng bằng **React** (Frontend), **Node.js + Express** (Backend), và **SQL Server** (Database).

## 📁 Cấu trúc Dự án

```
SEP490-G48/
├── BE/                    # Backend (Node.js + Express)
│   ├── src/
│   │   ├── app.js        # Express app configuration
│   │   ├── server.js     # Server entry point
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # API controllers
│   │   ├── routes/       # API routes
│   │   ├── models/       # Database models
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   └── utils/        # Utility functions
│   ├── package.json      # Backend dependencies
│   └── .env.example      # Environment variables template
│
├── FE/                    # Frontend (React)
│   ├── public/
│   │   └── index.html    # HTML entry point
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── index.js      # React root
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── styles/       # CSS files
│   │   ├── services/     # API services
│   │   └── hooks/        # Custom React hooks
│   ├── package.json      # Frontend dependencies
│   └── .env.example      # Environment variables template
│
├── .gitignore            # Git ignore file
└── README.md             # This file
```

## 🚀 Hướng dẫn Cài đặt

### Prerequisites
- **Node.js** v14+ ([Download](https://nodejs.org/))
- **npm** hoặc **yarn**
- **SQL Server** (bất kỳ phiên bản hỗ trợ)
- **Git**

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/SEP490-G48.git
cd SEP490-G48
```

### 2. Cài đặt Backend

```bash
cd BE
npm install
cp .env.example .env
```

**Cấu hình file `.env`:**
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourPassword123
DB_NAME=sep490_g48
```

### 3. Cài đặt Frontend

```bash
cd ../FE
npm install
cp .env.example .env
```

**Cấu hình file `.env`:**
```
REACT_APP_API_URL=http://localhost:5000/api
```

## 🏃 Chạy Ứng dụng

### Chạy Backend

```bash
cd BE
npm run dev
```

Server sẽ chạy tại `http://localhost:5000`

**Test API:**
- Health check: `http://localhost:5000/api/health`
- Hello World: `http://localhost:5000/api/hello`

### Chạy Frontend (trong terminal khác)

```bash
cd FE
npm start
```

Ứng dụng sẽ mở tại `http://localhost:3000`

## 📦 Cấu Hình Database

### Tạo Database trong SQL Server

```sql
CREATE DATABASE sep490_g48;
USE sep490_g48;

-- Bạn có thể thêm các tables khác tại đây
```

### Kết nối với Backend

Cập nhật file `.env` trong thư mục `BE` với credentials của SQL Server của bạn.

## 🧪 Demo Hello World

1. **Chạy Backend:** `npm run dev` (trong `BE/`)
2. **Chạy Frontend:** `npm start` (trong `FE/`)
3. **Nhấn nút "Fetch Hello World"** trên giao diện
4. Xem kết quả từ backend hiển thị trên màn hình

## 📝 Git Workflow

### Lần đầu Push

```bash
git init
git add .
git commit -m "Initial commit - Project structure setup"
git branch -M main
git remote add origin https://github.com/yourusername/SEP490-G48.git
git push -u origin main
```

### Push thay đổi

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Các branches khuyến nghị

- `main` - Production ready code
- `develop` - Development branch
- `feature/feature-name` - Feature branches
- `hotfix/issue-name` - Hotfix branches

## 👥 Thành viên Team

- Người quản lý dự án
- Frontend Developers
- Backend Developers
- Database Administrator

## 📚 Tài liệu

- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [SQL Server Documentation](https://docs.microsoft.com/en-us/sql/sql-server/)

## 📞 Support

Nếu có vấn đề, vui lòng tạo issue trên GitHub repository.

---

**Happy Coding! 🎉**
