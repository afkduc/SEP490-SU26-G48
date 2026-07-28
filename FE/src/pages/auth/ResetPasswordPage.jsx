import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordApi } from '../../services/authApi';
import './LoginPage.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Thiếu mã đặt lại mật khẩu. Hãy mở lại link trong email.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Xác nhận mật khẩu không khớp');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordApi(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message || 'Không đặt lại được mật khẩu. Link có thể đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-shell login-shell--narrow">
        <div className="login-panel-left">
          <img className="login-panel-logo" src="/AutoGaraLogo-Photoroom.png" alt="AutoGara" />
          <span className="login-panel-eyebrow">Bảo mật tài khoản</span>
          <h2 className="login-panel-headline">Tạo mật khẩu mới cho tài khoản của bạn</h2>
        </div>

        <div className="login-panel-right">
          <h2 className="login-title">Đặt lại mật khẩu</h2>
          <p className="login-subtitle">Nhập mật khẩu mới rồi đăng nhập lại hệ thống.</p>

          {!token && (
            <p className="login-error">
              Link không hợp lệ. Vui lòng yêu cầu lại từ trang quên mật khẩu.
            </p>
          )}

          {done ? (
            <div className="login-success-box">
              <p>Đặt lại mật khẩu thành công. Đang chuyển về trang đăng nhập…</p>
              <Link to="/login" className="login-btn" style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none', marginTop: 16 }}>
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label htmlFor="password">
                  Mật khẩu mới <span className="required">*</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    disabled={!token}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="confirm">
                  Xác nhận mật khẩu <span className="required">*</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    id="confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                    disabled={!token}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="login-btn" disabled={loading || !token}>
                {loading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
              </button>

              <p className="login-back-link">
                <Link to="/forgot-password">Gửi lại link</Link>
                {' · '}
                <Link to="/login">Đăng nhập</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
