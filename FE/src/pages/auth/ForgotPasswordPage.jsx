import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { forgotPasswordApi } from '../../services/authApi';
import { BASE_PATH } from '../../config';
import './LoginPage.css';

export default function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(() => location.state?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState('');
  const [emailPreviewUrl, setEmailPreviewUrl] = useState('');
  const [mailError, setMailError] = useState('');
  const [mailSent, setMailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ');
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPasswordApi(email.trim());
      setDone(true);
      setMailSent(Boolean(res?.sent));
      if (res?.emailPreviewUrl) setEmailPreviewUrl(res.emailPreviewUrl);
      if (res?.devResetUrl) setDevResetUrl(res.devResetUrl);
      if (res?.mailError) setMailError(res.mailError);
    } catch (err) {
      setError(err.message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-shell login-shell--narrow">
        <div className="login-panel-left">
          <img className="login-panel-logo" src={`${BASE_PATH}/AutoGaraLogo-Photoroom.png`} alt="AutoGara" />
          <span className="login-panel-eyebrow">Bảo mật tài khoản</span>
          <h2 className="login-panel-headline">Khôi phục mật khẩu an toàn qua email</h2>
        </div>

        <div className="login-panel-right">
          <h2 className="login-title">Quên mật khẩu</h2>
          <p className="login-subtitle">
            Nhập Gmail đã đăng ký. Hệ thống sẽ gửi email xác nhận — chỉ sau khi bạn bấm
            liên kết trong email mới được chuyển đến trang đặt mật khẩu mới.
          </p>

          {done ? (
            <div className={mailSent ? 'login-success-box' : 'login-success-box login-success-box--warn'}>
              {mailSent ? (
                <>
                  <p>
                    Chúng tôi đã gửi <strong>email xác nhận đổi mật khẩu</strong> tới hộp thư của bạn
                    (nếu email tồn tại trong hệ thống).
                  </p>
                  <ol className="login-next-steps">
                    <li>Mở Gmail (và thư mục Spam / Quảng cáo).</li>
                    <li>Mở email <em>AutoGara — Xác nhận đổi mật khẩu</em>.</li>
                    <li>Bấm <strong>Xác nhận &amp; đặt mật khẩu mới</strong>.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p>
                    <strong>Chưa gửi được email thật.</strong> Hệ thống chưa cấu hình SMTP
                    (hoặc tài khoản email không tồn tại / không active trong DB).
                  </p>
                  {mailError && <p className="login-hint">{mailError}</p>}
                </>
              )}
              {emailPreviewUrl && (
                <p className="login-dev-link">
                  <strong>Dev — email test (Ethereal):</strong>{' '}
                  <a href={emailPreviewUrl} target="_blank" rel="noreferrer">
                    Xem hộp thư giả lập
                  </a>
                </p>
              )}
              {devResetUrl && (
                <p className="login-dev-link">
                  <strong>Tạm thời dùng link này (chỉ khi đang dev):</strong>{' '}
                  <a href={devResetUrl}>{devResetUrl}</a>
                </p>
              )}
              <Link
                to="/login"
                className="login-btn"
                style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none', marginTop: 16 }}
              >
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label htmlFor="email">
                  Gmail <span className="required">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="ban@gmail.com"
                />
              </div>

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi email xác nhận'}
              </button>

              <p className="login-back-link">
                <Link to="/login">← Quay lại đăng nhập</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
