# ICHI MEET — Phòng họp trực tuyến doanh nghiệp

Frontend React 19, Vite 8, JavaScript thuần và CSS thuần. [docs/API_CONTRACT.md](docs/API_CONTRACT.md) là nguồn chuẩn cho API, payload, vai trò và realtime. Tài khoản và token do API meeting cấp; mọi thao tác quản trị gọi API meeting. LiveKit chỉ phục vụ media và chat.

## Cấu hình và chạy

Dùng Node.js 22.13+ thuộc nhánh 22 LTS hoặc 24+, cùng backend meeting và LiveKit đã cấu hình. Dependency của workspace đã cài sẵn.

```sh
cp .env.example .env.local
npm run dev
```

Vite chỉ proxy `/meeting-api` đến `http://localhost:3005`, bỏ prefix `/meeting-api`. Để trống biến môi trường sẽ dùng proxy này. Khi gọi trực tiếp backend, cấu hình và khởi động lại Vite:

```dotenv
VITE_MEETING_API_URL=https://meeting.example.com
```

Base URL không thêm `/auth` hay `/meetings`. Backend cần cho phép CORS từ origin frontend nếu gọi khác origin. Không đưa secret hoặc LiveKit API key vào biến `VITE_*` vì chúng công khai trong bundle.

`npm run preview` không có dev proxy. Production/preview cần base URL đầy đủ hoặc reverse proxy cùng origin cho `/meeting-api`; web server phải fallback các route SPA về `index.html`. Media production cần HTTPS/WSS và cấu hình mạng/TURN phù hợp.

## Xác thực và tài khoản

- `/login`: gửi `POST /auth/login { username, password }`, đọc trực tiếp `{ accessToken, expiresAt, user: { id, name, username } }`. Lưu phiên trong localStorage với key `enterprise-meeting.session.v2`; không lưu mật khẩu. Phiên cũ không được sử dụng. Đăng nhập xong quay lại link ban đầu.
- `/account`: tải `GET /auth/me`, sửa tên hiển thị và đổi mật khẩu qua `PATCH /auth/me`. Đổi mật khẩu phải nhập mật khẩu hiện tại; bỏ trống mật khẩu mới để chỉ sửa tên. Cập nhật tên trong phiên sau khi lưu thành công.
- `/users/new`: mọi tài khoản đã đăng nhập đều có thể tạo tài khoản bằng `POST /users { name, username, password }`. Tên đăng nhập 3–50 ký tự, chỉ chữ Latin, số, dấu chấm, gạch dưới và gạch ngang; mật khẩu tối thiểu 8 ký tự. Backend kiểm tra trùng và chuẩn hóa chữ hoa/thường.
- Route trang chủ và quản lý tài khoản bắt buộc có token tài khoản. Token khách không cấp quyền truy cập các route này.
- HTTP 401 với token tài khoản xóa phiên, chuyển về đăng nhập và giữ link quay lại. Đăng xuất chỉ xóa phiên frontend; đồng bộ phiên giữa các tab qua storage event. Contract không có refresh/logout endpoint.

## Khách qua link cuộc họp

`/meeting/:id` là route công khai. Người chưa đăng nhập chọn **Đăng nhập** hoặc **Tham gia với tư cách khách**, nhập tên rồi gửi `POST /meetings/:id/guest { name }` không kèm Bearer token.

Lưu đối tượng `guest` chứa access token trong **sessionStorage**, key `guest:<meetingId>`. Token này chỉ được chọn trong context của đúng phòng họp; dùng làm Bearer cho join, detail, room và giơ/hạ tay. Khi tải lại link, phiên khách được đọc lại để gọi join. Không lưu token khách vào phiên tài khoản hoặc dùng cho `/users`, `/auth/me`, danh sách/tạo cuộc họp.

Kết quả `pending` polling join mỗi **4 giây sau khi request trước hoàn tất**, không gửi chồng nhau. `admitted` mở màn xem trước; chỉ kết nối LiveKit sau khi bấm **Vào cuộc họp**; các trạng thái denied/kicked/locked và lỗi 403/404 có thông báo tiếng Việt. `locked` từ guest endpoint có `guest: null`, không lưu phiên. Token khách nhận 401 ở bất kỳ API nào trong phòng sẽ bị xóa, ngắt giao diện phòng và hiện lại form nhập tên; lần nhập lại là khách mới cần duyệt lại.

Khách không có liên kết trang chủ, tạo cuộc họp hay quản lý tài khoản. Hủy chờ dừng polling/abort request; contract chưa có endpoint thu hồi yêu cầu đã gửi lên backend.

## Cuộc họp và LiveKit

- Trang chủ kiểu app: lưới 2×2 Cuộc họp mới/Tham gia/Lên lịch/Chia sẻ màn hình; hai mục cuối vô hiệu với tooltip Sắp có. Bên phải là đồng hồ, ngày tiếng Việt và danh sách phòng đang diễn ra, nút Vào/sao chép link. Tạo và tham gia mở dialog; tạo phòng giữ tiêu đề, phòng chờ, giới hạn người. Chọn nhiều đồng chủ trì bằng tìm kiếm `GET /users?q=` (debounce 300 ms, hủy request cũ), gửi `coHostIds` từ tài khoản đã chọn. Dùng admission trả về khi tạo để mở preview, không gọi join thêm.
- Tên hiển thị tập trung trong `useDisplayName`: ưu tiên `name` từ MemberView/ParticipantView, rồi LiveKit participant.name, tên tài khoản của mình, cuối cùng mới rút gọn ID nếu thiếu tên. Video grid, danh sách thành viên và phòng chờ có nhãn **Khách** theo `isGuest`.
- RoomView tải khi mở phòng/kết nối lại, khi nhận các event `meeting.lobby`, `meeting.roles`, `meeting.settings`, thay đổi metadata/attribute/permission, người vào/ra và track; debounce event, đồng bộ dự phòng mỗi 30 giây.
- Mọi admission (tài khoản, khách và sau duyệt phòng chờ) đều qua preview nền tối: tên chỉ đọc, chọn micro/camera, bật/tắt để kiểm tra. Mic/camera mặc định tắt; tôn trọng settings và quyền publish trong token nếu có. Track preview dừng khi đổi lựa chọn, vào phòng hoặc unmount, kể cả kết quả capture trả muộn. Lỗi thiết bị/quyền hiện thông báo nhẹ; vẫn vào được với thiết bị lỗi tắt. Thiết bị đã chọn và bật thành công được áp dụng khi kết nối LiveKit.
- Phòng nền #1a1a1a, ô video đen, tên lớn khi tắt camera, chip mic đỏ trước tên, viền xanh lá khi nói. Header có popover thông tin/mã đầy đủ/link/vai trò, menu Người nói/Lưới và thời lượng. Toolbar chia ba cụm, menu thiết bị ở cạnh mic/camera, Thêm trên mobile; người thường bấm Rời, host mở menu Kết thúc rồi xác nhận bằng handler cũ. Bảng Người tham gia có trạng thái mic/camera, menu Thêm và nút Mời; chat hiển thị Gửi đến: Mọi người, Enter gửi, Shift+Enter xuống dòng.
- Lưới camera, chia sẻ màn hình, audio, giơ/hạ tay qua API, chat LiveKit. Nút khởi động audio hỗ trợ trường hợp autoplay bị chặn.
- Admin có phòng chờ, duyệt/từ chối/duyệt tất cả, mute, khóa phát, quản lý cohost, hạ tay, chuyển host, settings và kết thúc phòng có xác nhận. Không thao tác trên host/chính mình; phải thu hồi cohost trước khi kick/khóa phát. Với khách, ẩn **Cấp đồng chủ trì** và **Chuyển chủ trì**.
- Settings và quyền LiveKit vô hiệu các control tương ứng và tắt track local khi thu hồi quyền. `applied: false` hiện cảnh báo đã lưu nhưng chưa áp dụng được media; không tự lặp mutation.
- Khi ngắt hẳn, kiểm tra detail/join để phân biệt kick, kết thúc và mất kết nối. Gia hạn token LiveKit vẫn chạy cả khi ở preview bằng join trước expiresAt 30 giây; lỗi mạng retry sau 5 giây. Token mới tạo kết nối media mới, callback từ kết nối cũ bị bỏ qua.

## Kiểm tra

```sh
npm run lint
npm run build
npm test
npm run test:ui
```

`tests/domain.test.js` kiểm tra vai trò, chặn quyền admin với khách, parse link/metadata, lỗi NestJS, Bearer/401 và response trực tiếp. `tests/ui-smoke.mjs` dùng React DOM + jsdom, API và kết nối LiveKit mô phỏng; chạy StrictMode, kiểm tra đăng nhập/quay lại link, quản lý tài khoản, chọn đồng chủ trì, luồng khách/tokens/polling/401/route isolation, tên và nhãn Khách, quyền admin, realtime, settings, hand và token renewal (cả khi còn ở preview). Bổ sung kiểm tra dialog trang chủ, tên khi tắt camera, status icon, Enter gửi chat, lựa chọn preview, quyền settings/token, thiết bị bị từ chối và cleanup/late capture. Vite middleware trong test tắt HMR/WebSocket; không mở socket media hoặc truy cập backend/camera/mic thật.

## Cấu trúc và giới hạn

`src/api` chứa fetch client và meeting API; `src/auth` quản lý phiên tài khoản. `MeetingAccess` tạo context API/token và identity riêng cho phòng. `src/pages` chứa login, trang chủ, tài khoản và trạng thái join/phòng họp. `src/components` chứa room, admin, picker và UI chung; `src/hooks` xử lý tên và đồng bộ phòng.

Giữ nguyên dependency hiện có. Trang họp lazy-load và tách chunk React/LiveKit; SDK LiveKit đóng gói sẵn khoảng 545 kB, ngân sách cảnh báo chunk 600 kB.

Token LiveKit/admission chỉ giữ trong memory. Token tài khoản trong localStorage và token khách trong sessionStorage vẫn chịu rủi ro XSS; tên/chat được render như text của React. Nên cấu hình CSP tại hosting.

Chưa có avatar, quên mật khẩu, khóa/xóa tài khoản, lên lịch, ghi hình, điểm danh hay lưu chat. Đổi loa phụ thuộc hỗ trợ audiooutput của trình duyệt; menu dùng thiết bị trình duyệt cung cấp. Chat chỉ tồn tại trong phiên; gia hạn kết nối reset chat, tắt mic/camera và cần chia sẻ màn hình lại. Backend luôn là nơi quyết định authorization.

Các kiểm tra tự động dùng API/media mô phỏng. Cần xác minh với backend và LiveKit thật: hai tài khoản cùng khách, duyệt/kick/chuyển quyền, token expiry, media/WebRTC, TURN, quyền trình duyệt, CORS, responsive và SPA fallback. Không có kết quả E2E mạng/media thật từ DOM tests.
