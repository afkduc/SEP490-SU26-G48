import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { routeAfterLogin } from '../../utils/roleRedirect';
import httpClient from '../../services/httpClient';
import './LoginPage.css';

const WRONG_BRANCH_MESSAGE = 'Tài khoản của bạn không có quyền đăng nhập vào chi nhánh này';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '', branchId: '' });
  const [branches, setBranches] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWrongBranchModal, setShowWrongBranchModal] = useState(false);

  useEffect(() => {
    let alive = true;
    httpClient
      .get('/public/branches', { omitAuth: true, skipSessionExpired: true })
      .then((data) => {
        if (alive) setBranches(data || []);
      })
      .catch(() => {
        // Im lang neu loi - dropdown chi nhanh se rong, khach van thay thong
        // bao "vui long chon chi nhanh" nhu binh thuong khi bam dang nhap.
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      const result = await login(form.email, form.password, rememberMe, form.branchId);
      // Luôn chuyển thẳng về dashboard theo role — bỏ luồng ép đổi mật khẩu tạm.
      navigate(routeAfterLogin(result?.user), { replace: true });
    } catch (err) {
      if (err.status === 403 && err.message === WRONG_BRANCH_MESSAGE) {
        setShowWrongBranchModal(true);
      } else {
        setError(err.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-shell">
        <div className="login-panel-left">
          <img className="login-panel-logo" src="/AutoGaraLogo-Photoroom.png" alt="AutoGara" />
          <span className="login-panel-eyebrow">Hệ thống quản lý</span>
          <h2 className="login-panel-headline">Sửa chữa/Bảo dưỡng ô tô chuyên nghiệp</h2>
        </div>

        <div className="login-panel-right">
          <h2 className="login-title">Đăng nhập</h2>
          <p className="login-subtitle">Nhập thông tin tài khoản để truy cập hệ thống</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="email">
                Email <span className="required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="email@autogara.vn"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">
                Mật khẩu <span className="required">*</span>
              </label>
              <div className="login-input-wrap">
                <span className="login-lock-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="branchId">Chi nhánh</label>
              <select id="branchId" name="branchId" value={form.branchId} onChange={handleChange}>
                <option value="">Chọn chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="login-row">
              <label className="login-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <a href="/forgot-password" className="login-forgot">
                Quên mật khẩu?
              </a>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>

      {showWrongBranchModal && (
        <div className="login-modal-overlay" onClick={() => setShowWrongBranchModal(false)}>
          <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="login-modal-title">Không thể đăng nhập</h2>
            <p className="login-modal-message">{WRONG_BRANCH_MESSAGE}</p>
            <button className="login-modal-btn" onClick={() => setShowWrongBranchModal(false)}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
