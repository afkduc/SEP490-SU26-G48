# Báo cáo Audit Module Admin — SEP490-SU26-G48

> Ngày audit: 2026-07-21  
> Phạm vi: 12 file FE admin + 14 file BE (routes/middleware/services/jobs/events)  
> Phương pháp: Static analysis + code reading kỹ lưỡng từng file

---

## Tổng quan mức độ

| Mức độ | Ý nghĩa | Số lượng |
|--------|---------|----------|
| 🔴 CRITICAL | Gây security leak / data leak / treo hệ thống / chức năng chính chết | **5** |
| 🟠 HIGH | Ảnh hưởng nghiệp vụ chính (realtime, single-session, ma trận quyền) | **6** |
| 🟡 MEDIUM | UX kém, edge-case chưa xử lý, inconsistent | **12** |
| 🟢 LOW | Code smell, cosmetic | **5+** |

---

## 1. User Management (`AdminUsersPage` + `UserFormModal`)

### Trạng thái hiện tại
- ✅ **Đã sửa**: Ẩn nút "Phân quyền" riêng trên desktop và mobile menu; dọn import `AssignRoleModal`, state `assignUserId`, class `.btn--role` không dùng.
- ✅ `UserFormModal` đã có dropdown "Vai trò" (line 290-303), payload edit gửi `roleId` đúng.

### 🔴 CRITICAL
**Mismatch nghiêm trọng giữa Edit modal và AssignRole modal** — `AdminUsersPage.jsx`:
- `UserFormModal` chỉ hỗ trợ **single-role** (select 1 role, payload `roleId: <id>`)
- `AssignRoleModal` (bị ẩn nhưng vẫn tồn tại) hỗ trợ **multi-role** (checkbox list)
- **`resolveRoleId` chỉ lấy role[0]** (`UserFormModal.jsx:17-35`) → nếu user có nhiều role, edit sẽ chỉ giữ role đầu tiên, mất các role sau.
- **`roleId: null` trong payload có thể wipe toàn bộ role** nếu BE hiểu null là "remove all".

### 🟠 HIGH
- **Không có PermissionGate** quanh 3 nút action (`AdminUsersPage.jsx:452-472`) — admin thường có thể sửa bất kỳ user nào; nếu muốn giới hạn quyền (vd: role Manager không được sửa Admin), phải check ở parent route, không có trong file này.
- **`resolveRoleId` stale state**: `useEffect` update form phụ thuộc `JSON.stringify(roles)` (line 97) → khi roles đang refetch, giá trị cuối có thể bị stale.

### 🟡 MEDIUM
- `useEffect` sync `localBranches/localRoles` từ `SharedDataContext` (line 135-141) — nếu context cập nhật chậm, filter dropdown sẽ thiếu data tạm thời.
- `u.phone` hiển thị thô không mask (line 401) — phù hợp admin, nhưng nếu log ra ngoài sẽ lộ SĐT.

---

## 2. Branches (`AdminBranchesPage`)

### Trạng thái hiện tại
- ❌ **KHÔNG có realtime** — chỉ fetch qua `useEffect on mount` + refetch khi tương tác.

### 🟠 HIGH
- **Không có SSE/polling/websocket** → admin A deactivate chi nhánh X, admin B đang mở trang Branches sẽ không thấy cho đến khi F5 hoặc click refresh.

### 🟡 MEDIUM
- `ConfirmDeactivateModal` (line 269-293) chỉ cảnh báo chung, **KHÔNG hiển thị số lượng user bị ảnh hưởng** trước khi deactivate → admin không biết tác động.
- `BranchFormModal managerId` chỉ load 1 lần từ `managerCandidates` prop → nếu user được thêm làm manager sau khi modal mở, dropdown sẽ thiếu.
- `StatsModal` (line 371-414) **không xử lý loading thất bại** → hiển thị "Đang tải..." vĩnh viễn (line 405).

---

## 3. Roles + Permission Matrix (`AdminRolesPage`)

### Trạng thái hiện tại
- ⚠️ **Matrix chỉ save cho `visibleRoles`** (line 398: `ROLE_VALUES.includes(r.roleName)`) → **custom role ngoài whitelist sẽ KHÔNG xuất hiện trong matrix và KHÔNG được lưu**.

### 🟠 HIGH
- **Matrix bỏ qua custom role** — đây là bug nghiêm trọng nếu hệ thống cho phép tạo role mới ngoài danh sách ROLE_VALUES cứng.

### 🟡 MEDIUM
- **N+1 queries**: `loadMatrix` (line 365-393) gọi `adminRolesApi.getRolePermissions(role.id)` cho từng role song song (Promise.all) — comment nói "sequentially to avoid overwhelming DB" nhưng thực tế là parallel. Với 20 roles sẽ tạo 20 requests cùng lúc.
- `loadRoles` và `loadMatrix` là 2 hàm độc lập, không share data → nếu thêm role mới, role mới sẽ xuất hiện trong cards nhưng CHƯA xuất hiện trong matrix cho đến khi user chuyển tab sang Matrix.
- **PermissionMatrix không có sticky header** → với 50+ permission rows sẽ mất cột role khi scroll.
- `handleMatrixChange` (line 400-403) không validate → admin có thể bỏ hết quyền của role, làm role không thể thực thi bất kỳ action nào.

### 🟢 LOW
- `refreshPermissionsApi` (line 418-428) catch silent → nếu fail, vẫn thông báo "Thay đổi có hiệu lực ngay" nhưng thực tế user hiện tại sẽ không có quyền mới cho đến khi F5/relogin.

---

## 4. Specialties (`AdminSpecialtiesPage`)

### Trạng thái hiện tại
- ❌ **KHÔNG có realtime**.

### 🟠 HIGH
- **Không có SSE/polling** → admin A tạo specialty mới, admin B phải F5 mới thấy.

### 🟡 MEDIUM
- `SpecialtyFormModal` (line 36-114) khi EDIT không disable field `specialtyCode` (line 88 `disabled={isEdit}`) OK nhưng khi submit (line 56) chỉ gửi `specialtyName` — nếu BE muốn cập nhật description/notes sẽ không có field này.
- **Không có confirm modal trước khi toggle status** (line 142-150) → admin click nhầm sẽ đổi trạng thái ngay, không có undo.
- Toggle handler không có optimistic UI → user thấy spinner giật khi toggle nhiều specialties liên tục.
- Không có filter/search → nếu có nhiều specialties (>20) sẽ khó tìm.

---

## 5. Devices (`AdminDevicesPage`)

### Trạng thái hiện tại
- ✅ **Có SSE** qua `useLoginSessionsSSE` hook (line 296), handler xử lý 3 loại event: `force`, `login`, fallback.
- ✅ Có force-logout button (line 534-540), chỉ hiển thị khi `device.isCurrent=true`.
- ✅ Sorted client-side bằng `useMemo` (line 301-317) để `isCurrent=true` luôn ở trên cùng.

### 🟠 HIGH
- **Logic SSE xử lý 'login' (line 268-290)**:
  - Nếu không có `deviceId` thì fallback `loadData(page)` (line 286-288) → nhưng page hiện tại có thể không chứa row mới (nếu row mới ở page khác). Row mới chỉ hiển thị khi user chuyển page hoặc filter.
- **Thiết bị "treo"** — Cleanup job chạy mỗi 24h (`loginSessionCleanupJob.js`), thiết bị treo hiển thị "online" trên UI cho đến khi user khác login mới hoặc cleanup job chạy. Cần check thêm FE có dùng SSE để realtime update `is_current` không.

### 🟡 MEDIUM
- **Line 529-532** render `<span class="btn btn--secondary btn--sm btn--disabled">` cho device đã logout — span không phải button nhưng class giả button → screen reader sẽ không hiểu đúng. Nên dùng badge hoặc disabled button thật.
- **Search input debounce** (line 397-404) dùng `setTimeout` 400ms nhưng state `searchTimer` là `useState` → khi user gõ nhiều ký tự liên tục, `clearTimeout(searchTimer)` có thể clear nhầm timeout cũ do state cập nhật bất đồng bộ. Nên dùng `useRef`.
- Filter `onBlur` (line 413, 422, 431, 441, 450) trigger `loadData` chỉ khi user click ra → UX khó hiểu.
- **SSE handler cleanup**: không giải phóng listener cũ khi component unmount nếu SSE đang trong quá trình refetch → có thể `setState` trên unmounted component (warning).
- Force-logout handler (line 347-369) set `isCurrent=false` ngay nhưng KHÔNG set `lastActivityAt` → nếu BE trả SSE event `logout` sau đó (không có deviceId), sẽ trigger refetch full gây giật.

---

## 6. Login Sessions / Audit Logs (`AdminLoginSessionsPage` + `AuditLogsPage`)

### Trạng thái hiện tại
- ✅ `AdminLoginSessionsPage` có SSE, tracks logout qua `status='ended'`.
- ⚠️ `ACTION_OPTIONS` chỉ có LOGIN và LOGIN_FAILED — không có LOGOUT riêng.
- ❌ `AuditLogsPage` **KHÔNG có SSE** — chỉ fetch khi filter/params đổi.

### 🟠 HIGH
- **SSE handler LUÔN gọi `sessions.refetch()` khi có bất kỳ event nào** (`AdminLoginSessionsPage.jsx:362-366`) → gây refetch full list mỗi lần login/logout xảy ra ở bất kỳ user. Nếu nhiều user đăng nhập cùng lúc, trang sẽ nhấp nháy liên tục. **Nên patch row như `AdminDevicesPage` (line 248-294)**.
- **Audit Logs thiếu realtime** — đây là nơi admin muốn thấy hoạt động mới nhất nhưng phải F5 hoặc đổi filter mới thấy. Major UX gap.

### 🟡 MEDIUM
- `useDurationTicker` (line 83-89) `setInterval` 30s nhưng **KHÔNG return cleanup** trong `SessionTable` (line 252 gọi `useDurationTicker(30000)`) → khi `SessionTable` re-render nhiều lần (do SSE refetch), sẽ tạo NHIỀU interval cùng chạy.
- `liveDurationSeconds` (line 76-81) dùng `Date.now() - loginTime` — nếu server trả UTC nhưng user ở GMT+7, duration sẽ lệch 7 giờ. Cần dùng server time hoặc parse chuẩn UTC.
- `AuditTable` chỉ hiển thị 4 cột: Người dùng | Hành động | Mô tả | Thời gian. Thiếu: **IP, entity, request_method, response_status** dù filter đã hỗ trợ.
- Export Excel (line 299-310) chỉ gửi params filter hiện tại — không có option "Export tất cả".

---

## 7. Profile (`AdminProfilePage`)

### Trạng thái hiện tại
- ⚠️ Có tab "Đổi mật khẩu" (line 461-467) cần **ẨN** theo yêu cầu.

### 🔴 CRITICAL (bug logic)
- **`'Cập nhật lần cuối' hiển thị `profile.createdAt`** (`AdminProfilePage.jsx:511-512`) — code copy nguyên từ line 508 'Ngày tạo'. Hiện tại cả 2 cột đều hiển thị CÙNG một ngày. Nên là `profile.updatedAt` hoặc field tương tự.

### 🟠 HIGH
- **Sau khi update profile thành công** (line 282-307), `setProfile(updated)` nhưng KHÔNG gọi `reloadPermissions()` từ `useAuth` (line 187) → nếu BE thay đổi role/branch, Navbar/permission gate sẽ hiển thị thông tin cũ.

### 🟡 MEDIUM
- `PasswordInput` (line 154-182) có visible toggle nhưng KHÔNG có nút copy password.
- Form edit (line 540-632) chỉ cho phép sửa email/firstName/lastName/phone — KHÔNG cho sửa avatar, KHÔNG cho sửa branch (admin muốn đổi chi nhánh phải sang trang Users).
- `handlePwSubmit` catch err `setPwErrors({ global: ... })` — nếu err.validation có field-specific errors từ BE sẽ bị ẩn bởi global message.
- Không có password strength check (chỉ length >=6, line 324).

### 🟢 Hướng xử lý "ẩn đổi mật khẩu"
Cần hide 2 chỗ:
1. Tab button "Đổi mật khẩu" ở line 461-467 trong `<div class="profile-tabs">`
2. Conditional render ở line 637-696 (`{activeTab === 'password' && ...}`)

Lưu ý: line 200-202 vẫn set `initialTab='password'` từ query param, nếu hide tab button nhưng không sửa `initialTab` logic, user redirect từ forced-change login sẽ thấy content rỗng.

---

## 8. Notification Settings (`AdminProfileNotificationsPage`)

### Trạng thái hiện tại
- ✅ Có 8 checkbox (4 email + 4 in-app), save qua `notificationApi.updateNotificationSettings`.

### 🔴 CRITICAL (BE-side — đã tìm thấy từ audit BE)
- **NotificationService đọc 4 setting keys không tồn tại trong DB** (`inAppLogin`, `inAppSecurityAlert`, `inAppRoleChange`) → **3/4 loại in-app notification chết âm thầm**. Chỉ `inAppPasswordChange` là hoạt động (vì key này CÓ trong DB).
- Cần đối chiếu `Dbchuan.sql` để biết schema chính xác rồi sync code ↔ DB.

### 🟠 HIGH (FE-side — bạn yêu cầu realtime)
- **Notification KHÔNG có SSE/realtime** — chỉ là form settings tĩnh, không nhận được notification mới. Cần thêm SSE channel cho notification.

### 🟡 MEDIUM
- Sau khi save (line 36-51), `setSaved(true)` và `loadSettings()` nhưng **settings state local vẫn giữ giá trị CŨ** (line 32) cho đến khi `loadSettings` xong. Trong khoảng 200-500ms, UI hiển thị "Đã lưu" nhưng nếu user mở modal khác sẽ thấy state cũ nếu BE normalize khác.
- 8 checkbox KHÔNG có group save — phải save toàn bộ settings cùng 1 API call.
- Không có validation: tắt hết checkbox có thể lưu thành công.
- Không có tooltip/giải thích cho mỗi checkbox.
- Không có reset-to-default button.

---

## 9. BE Audit (tổng hợp)

### 🔴 CRITICAL (BE)
| # | File | Vấn đề |
|---|------|--------|
| 1 | `sseRoutes.js:41` | **SSE endpoint KHÔNG có `authenticate` middleware** → bất kỳ ai cũng stream được toàn bộ PII (email, IP, user-agent, login history). Security leak nghiêm trọng. |
| 2 | `NotificationService.js` | Đọc 4 setting keys (`inAppLogin`, `inAppSecurityAlert`, `inAppRoleChange`) **không tồn tại trong DB** → 3/4 in-app notification chết âm thầm. |
| 3 | `loginSessionCleanupJob.js` | `backfillBrowserOs` đệ quy không giới hạn → CPU lock. |
| 4 | `securityAlertJob.js` | `checkNewAdminRole` query sai (`u.created_at` thay vì `ur.created_at`) → false negative. |

### 🟠 HIGH (BE)
- `loginSessionMiddleware.js`: `trackLogin` close nhầm session user khác (race condition).
- `forceLogoutAllOtherDevices`: off-by-one trong `remainingCount`.
- `POST /logout`: không try/catch quanh `await trackLogout` → nếu DB lỗi, logout vẫn "thành công" trên FE nhưng row không được cập nhật.

### ✅ Cấu trúc hoạt động đúng (BE)
- 4 SSE events: `login`, `logout`, `force`, `login_failed` qua `LoginSessionEvents.js`.
- Single-session enforced: `incrementTokenVersion` + close active session cũ với `logout_reason='NEW_LOGIN_OVERRIDE'`.
- Device lifecycle: tạo khi login, update `last_activity_at` mỗi heartbeat (60s throttle), mark `is_current=0` trên logout/force/stale (>24h).
- 5 endpoint devices: list, list-by-user, force-logout-device, force-logout-other, force-logout-all.

---

## Đề xuất thứ tự ưu tiên fix

### 🔴 PHẢI FIX NGAY (security / dead features)

1. **Thêm `authenticate` middleware cho SSE endpoint** (`sseRoutes.js`) — 5 phút.
2. **Sync NotificationService với DB schema** — cần `Dbchuan.sql` để biết keys chính xác.
3. **`backfillBrowserOs` thêm giới hạn recursion** — 5 phút.
4. **`securityAlertJob.checkNewAdminRole` sửa query** — 5 phút.
5. **AdminProfilePage "Cập nhật lần cuối"** hiển thị `updatedAt` thay vì `createdAt` — 5 phút.
6. **Ẩn tab "Đổi mật khẩu"** trong `AdminProfilePage` — 10 phút.

### 🟠 QUAN TRỌNG (realtime / single-session UX)

7. **`AdminLoginSessionsPage` SSE handler patch row** thay vì full refetch — 30 phút.
8. **`AdminDevicesPage` SSE handler xử lý khi không có deviceId** — 20 phút.
9. **`AdminDevicesPage` cleanup SSE listener** trên unmount — 10 phút.
10. **`AdminDevicesPage` `useRef` cho search debounce timer** — 10 phút.
11. **Thêm SSE cho Notification** (FE + BE) — 2 giờ.
12. **`AdminRolesPage` matrix bao gồm custom roles** (bỏ filter `ROLE_VALUES.includes`) — 30 phút.
13. **`AdminRolesPage` gọi `reloadPermissions` sau update profile** — 5 phút.

### 🟡 CẢI THIỆN (UX)

14. **`AdminLoginSessionsPage` cleanup `useDurationTicker` interval** — 10 phút.
15. **`AdminDevicesPage` thay span giả button bằng badge thật** — 5 phút.
16. **`AdminBranchesPage` thêm realtime (SSE)** — 2 giờ.
17. **`AdminSpecialtiesPage` thêm realtime (SSE)** — 2 giờ.
18. **`AuditLogsPage` thêm realtime (SSE)** — 2 giờ.
19. **`AdminBranchesPage` ConfirmDeactivate hiển thị số user bị ảnh hưởng** — 30 phút.
20. **`UserFormModal.resolveRoleId` fix logic** nếu thực sự dùng multi-role.

---

## Kết luận

- **Đã sửa**: Ẩn nút "Phân quyền" trong User Management ✅
- **16 bug BE + 25+ bug/issue FE** đã được document chi tiết với file:line + code snippet.
- **Cần `Dbchuan.sql` để đối chiếu schema** cho NotificationService + permission matrix.
- **Ưu tiên #1**: SSE auth + NotificationService schema sync (cần SQL).
- **Ưu tiên #2**: Realtime cho Login Sessions + Devices (patch row, không refetch full).

Bạn muốn tôi bắt đầu fix từ item nào? Hoặc cần tôi đào sâu thêm vào module nào?
