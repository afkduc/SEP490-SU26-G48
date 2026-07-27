import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { routeAfterLogin } from '../../utils/roleRedirect';
import httpClient from '../../services/httpClient';
import './LoginPage.css';

const WRONG_BRANCH_MESSAGE = 'Tài khoản của bạn không có quyền đăng nhập vào chi nhánh này';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [form, setForm] = useState({ identifier: '', password: '', branchId: '' });
  const [branches, setBranches] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWrongBranchModal, setShowWrongBranchModal] = useState(false);
  /** { message, session, waitSeconds, remaining } — chờ takeover rồi force login */
  const [loginWait, setLoginWait] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const waitTimerRef = useRef(null);
  const cancelledWaitRef = useRef(false);

  useEffect(() => {
    let alive = true;
    httpClient
      .get('/public/branches', { omitAuth: true, skipSessionExpired: true })
      .then((data) => {
        if (alive) setBranches(data || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(routeAfterLogin(user), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined;
    const t = setInterval(() => {
      setLockoutSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  useEffect(() => () => {
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    cancelledWaitRef.current = true;
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const stopLoginWait = () => {
    cancelledWaitRef.current = true;
    if (waitTimerRef.current) {
      clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    setLoginWait(null);
  };

  const completeForceLogin = async () => {
    setLoading(true);
    try {
      const result = await login(form.identifier, form.password, rememberMe, form.branchId, {
        force: true,
      });
      if (cancelledWaitRef.current) return;
      setLoginWait(null);
      navigate(routeAfterLogin(result?.user), { replace: true });
    } catch (err) {
      if (cancelledWaitRef.current) return;
      setLoginWait(null);
      setError(err.message || 'Không thể hoàn tất đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  const startLoginWait = ({ message, session, waitSeconds }) => {
    cancelledWaitRef.current = false;
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    let remaining = Math.max(1, Number(waitSeconds) || 5);
    setLoginWait({ message, session, waitSeconds: remaining, remaining });
    waitTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
        setLoginWait((prev) => (prev ? { ...prev, remaining: 0 } : null));
        if (!cancelledWaitRef.current) {
          completeForceLogin();
        }
        return;
      }
      setLoginWait((prev) => (prev ? { ...prev, remaining } : null));
    }, 1000);
  };

  const doLogin = async () => {
    setLoading(true);
    setError('');
    stopLoginWait();
    cancelledWaitRef.current = false;
    try {
      const result = await login(form.identifier, form.password, rememberMe, form.branchId);
      setLoginWait(null);
      navigate(routeAfterLogin(result?.user), { replace: true });
    } catch (err) {
      if (err.status === 403 && err.message === WRONG_BRANCH_MESSAGE) {
        setShowWrongBranchModal(true);
      } else if (
        err.status === 409
        && (err.code === 'LOGIN_WAIT' || err.details?.code === 'LOGIN_WAIT'
          || err.code === 'LOGIN_PENDING' || err.details?.code === 'LOGIN_PENDING')
      ) {
        // LOGIN_WAIT: countdown rồi force. LOGIN_PENDING legacy: cũng countdown force (không poll approve).
        const waitSeconds = err.details?.waitSeconds || 5;
        startLoginWait({
          message: err.message,
          session: err.details?.session || null,
          waitSeconds,
        });
      } else if (err.status === 429 || err.code === 'LOGIN_LOCKED' || err.details?.suggestChangePassword) {
        const wait = err.details?.waitSeconds || Math.ceil((err.details?.remainingMs || 0) / 1000) || 10;
        setLockoutSeconds(wait);
        setError(err.message || 'Vui lòng đợi rồi thử lại. Nên đổi mật khẩu nếu không phải bạn.');
      } else {
        if (err.details?.waitSeconds) setLockoutSeconds(err.details.waitSeconds);
        setError(err.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) {
      setError('Vui lòng nhập đầy đủ email/số điện thoại và mật khẩu');
      return;
    }
    if (!form.branchId) {
      setError('Vui lòng chọn chi nhánh trước khi đăng nhập');
      return;
    }
    if (lockoutSeconds > 0) {
      setError(`Vui lòng đợi ${lockoutSeconds}s trước khi thử lại.`);
      return;
    }
    await doLogin();
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
          <p className="login-subtitle">Dùng email hoặc số điện thoại đã đăng ký</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="identifier">
                Email hoặc số điện thoại <span className="required">*</span>
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                value={form.identifier}
                onChange={handleChange}
                placeholder="email@autogara.vn hoặc 09xxxxxxxx"
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
              <label htmlFor="branchId">
                Chi nhánh <span className="required">*</span>
              </label>
              <select id="branchId" name="branchId" value={form.branchId} onChange={handleChange} required>
                <option value="">Chọn chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="login-error">{error}</p>}
            {lockoutSeconds > 0 && (
              <p className="login-error" style={{ color: '#b45309' }}>
                Thử lại sau <strong>{lockoutSeconds}s</strong>. Nếu không phải bạn, hãy đổi mật khẩu.
              </p>
            )}

            <div className="login-row">
              <label className="login-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <Link to="/forgot-password" className="login-forgot">
                Quên mật khẩu?
              </Link>
            </div>

            <button type="submit" className="login-btn" disabled={loading || lockoutSeconds > 0}>
              {loading ? 'Đang đăng nhập...' : lockoutSeconds > 0 ? `Chờ ${lockoutSeconds}s` : 'Đăng nhập'}
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

      {loginWait && (
        <div className="login-modal-overlay">
          <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-icon" style={{ color: '#4f46e5' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 className="login-modal-title">
              {loginWait.remaining > 0
                ? `Đăng nhập sau ${loginWait.remaining}s`
                : 'Đang đăng nhập...'}
            </h2>
            <p className="login-modal-message">
              {loginWait.message
                || 'Tài khoản đang được sử dụng trên thiết bị khác. Bạn sẽ được đăng nhập tự động.'}
            </p>
            {loginWait.session && (
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
                Phiên hiện tại: {[loginWait.session.browser, loginWait.session.os].filter(Boolean).join(' · ') || 'Thiết bị khác'}
                {loginWait.session.ip ? ` · IP ${loginWait.session.ip}` : ''}
              </p>
            )}
            <button
              type="button"
              className="login-modal-btn"
              style={{ background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }}
              onClick={stopLoginWait}
              disabled={loading || loginWait.remaining <= 0}
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
