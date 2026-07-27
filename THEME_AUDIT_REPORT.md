# Theme Audit Report — Dark / Light (Admin)

Ngày: 2026-07-26  
Phạm vi: Admin shell + component dùng chung (button, form, table, modal, badge, card).  
**Không đổi** API / route / permission / nghiệp vụ.

## Tóm tắt

Đã đưa Design Token (`--ag-*`) cho Light/Dark, gắn vào Admin shell và `AdminShared`. Mục tiêu: WCAG AA, chữ/nút/card dễ đọc, card tách nền, sidebar tách content.

## Màu / Token đã chuẩn hóa

| Token | Light | Dark |
|---|---|---|
| `--ag-bg` | `#f1f5f9` | `#0b1220` |
| `--ag-card` / surface | `#ffffff` / `#f8fafc` | `#151c2c` / `#121a2b` |
| `--ag-text-primary` | `#0f172a` | `#f1f5f9` |
| `--ag-text-secondary` / muted | `#475569` / `#64748b` | `#cbd5e1` / `#94a3b8` |
| `--ag-primary` | `#4f46e5` | `#818cf8` |
| `--ag-border` | `#e2e8f0` | `#2a3548` |
| `--ag-success` | `#15803d` + soft bg | `#4ade80` + soft bg |
| `--ag-warning` | `#a16207` + soft bg | `#fbbf24` + soft bg |
| `--ag-danger` | `#b91c1c` + soft bg | `#f87171` + soft bg |
| `--ag-info` | `#1d4ed8` + soft bg | `#60a5fa` + soft bg |
| Sidebar | `#1e1b4b` | `#0f1430` (tách rõ khỏi content) |

File: `FE/src/styles/theme-tokens.css`, `FE/src/styles/theme-admin.css`.

## Component đã chuẩn hóa

- Admin shell / topbar / sidebar hover-active  
- Buttons: primary, secondary, outline, ghost, danger, success, warning, disabled, focus  
- Inputs / select / textarea / placeholder / focus / error  
- Tables: header, row, hover, striped, empty  
- Badges / status: success, warning, danger, info, pending, draft, inactive, approved, rejected  
- Modal confirm + overlay  
- Loading / empty / error states  
- Matrix tabs, role cards, dashboard widgets (surface tokens)

## Bảng audit (Screen × Issue)

| Screen | Component | Issue | Mức độ | Đã sửa |
|---|---|---|---|---|
| Admin shell | Background / Sidebar | Sidebar + content cùng tông → khó tách | High | Có — sidebar tối hơn, content `--ag-bg` |
| Admin shell | Topbar / Theme toggle | Contrast thấp ở dark | Medium | Có — token topbar + focus |
| Tổng quan | Stat / Widget cards | Card hòa nền; text phụ mờ | High | Có — card token + border/shadow |
| Tổng quan | Alert / Activity | Nền pastel trên dark khó đọc | High | Có — soft semantic tokens |
| Người dùng | Title / Table | Text dark trên nền dark | High | Có — text/table tokens |
| Chi nhánh | Header / Stat | Số & label chìm | High | Có |
| Vai trò | Table / Toggle | Button ghost khó nhìn dark | Medium | Có |
| Ma trận quyền | Role cards / Tip banner | Banner trắng chói; label key | High | Có — card/tip tokens + VI labels |
| Yêu cầu cấp quyền | Action buttons | Nút wrap / danger không outline | Medium | Có (trước đó) + token |
| Nhật ký | Table striped | Text tối trên hàng tối | High | Có |
| Lịch sử đăng nhập | Filter inputs | Placeholder / value chìm | High | Có — input tokens |
| Thiết bị | Table body trắng trên dark | Clash light/dark | High | Có |
| Chuyên môn | Header / Table | Title chìm; rows trắng | High | Có |
| Hồ sơ | Field labels | Label quá tối trên dark | High | Có |
| Cài đặt thông báo | Setting rows | Title/desc chìm | High | Có |
| Toàn cục | Modal / Drawer | Overlay & surface không đồng bộ | Medium | Có (confirm modal) |
| Toàn cục | Focus ring | Thiếu visible focus | Medium | Có — `:focus-visible` |
| Non-admin layouts | AppLayout / role pages | Chưa có theme toggle | Medium | **Chưa** — giữ Light; token sẵn sàng mở rộng |
| Toast | Snackbar colors | Severity đã map; chưa full token CSS toast | Low | Một phần — cần review designer |
| Date picker native | Browser UI | Phụ thuộc OS/browser | Low | Designer review |
| Dashboard gradients | Stat cards | Nhiều gradient khác nhau | Low | Designer review (giữ brand banner) |

## Thiếu contrast đã xử lý

- Primary / secondary / muted text trên dark card  
- Table header & body  
- Placeholder input  
- Ghost/secondary buttons  
- Danger outline (viền + chữ đỏ)  
- Badge soft (không neon bão hòa)

## Còn cần Designer review

1. Gradient nhiều màu trên Dashboard statistic cards (đồng bộ palette vs giữ điểm nhấn).  
2. Toast / Snackbar CSS toàn cục (ngoài severity map).  
3. Native `<input type="date">` / browser select trên dark.  
4. Dark mode cho role ngoài Admin (GD, Manager, …) — token đã có, chưa bật toggle.  
5. Chart / LIVE badge saturation trên welcome banner.

## Cách kiểm tra nhanh

1. Login Admin → bật/tắt nút theme trên topbar.  
2. Quét: Dashboard, Users, Branches, Matrix, Logs, Sessions, Devices, Specialties, Profile, Notifications.  
3. Kiểm tra: title, table, filter, modal, badge, button hover/focus/disabled.  
4. Không đổi nghiệp vụ: duyệt quyền, CRUD user/branch vẫn như cũ.

## File chính

- `FE/src/styles/theme-tokens.css`  
- `FE/src/styles/theme-admin.css`  
- `FE/src/styles/index.css`  
- `FE/src/pages/admin/AdminShared.css`  
- `FE/src/components/layout/AdminLayout.jsx` (`data-theme`)  
- `FE/src/components/layout/AdminLayout.css` (đã gỡ dark override cứng cũ)
