# Session Summary

## Hiện tại — 2026-11-26: lớp hoàn thiện thị giác (Claude)

- Thêm `src/theme.css` (nạp sau `meeting-ui.css` trong `App.jsx`): token màu, bóng, bo góc; nút/ô nhập có focus ring xanh.
- `Avatar` trong `Common.jsx`: màu cố định theo tên, dùng ở menu tài khoản, bảng Người tham gia và bảng điều hành.
- Trang chủ: lời chào "Xin chào, <tên>", launcher gradient, đồng hồ nền xanh, danh sách cuộc họp có hover.
- Xem trước: nút mic/camera tròn nổi trên khung video (đỏ khi tắt), video tự soi gương.
- Phòng họp: ô video, chip tên, bảng bên, menu, hộp xác nhận theo tông tối thống nhất; nút mic/camera đang bật không tô nền.
- Kiểm tra: lint, build, `npm test` 6/6, `npm run test:ui` PASS; chụp Chrome thật với API/LiveKit live.

## Trước đó — 2026-11-26: chỉnh trình bày theo ảnh Chrome shots5

Mục này bổ sung và thay thế các thông số trình bày liên quan ở lịch sử bên dưới.

### Đã sửa
- Đã xem đủ `06-guest-waiting.png`, `05-guest-gate.png`, `07c-guest-prejoin.png`, `10-chat.png`, `14-mobile-room.png`, `14b-mobile-more.png` trong `scratchpad/shots5/` theo đường dẫn người dùng cung cấp.
- Guest gate và các thẻ trạng thái dùng nền #242424, chữ trắng/xám, field và nút tối đồng bộ preview. Phòng chờ giữ tên cuộc họp từ admission, làm rõ câu “Vui lòng đợi, chủ trì sẽ cho bạn vào.”, rút chữ phụ và dùng spinner nhẹ có hỗ trợ reduced motion. Giữ nhãn Hủy chờ và tiêu đề mà test sử dụng.
- Root cause panel mobile: rule cuối ở breakpoint 760px giới hạn width 320px. Nay ở <=640px panel phủ toàn bộ chiều ngang vùng nội dung bằng left/right 0, width 100%.
- Toolbar <=640px dùng 5 cột control và cột Rời riêng, padding ngoài 12px. Mũi tên chọn thiết bị thu gọn ở góc trên, icon mic/camera dịch nhẹ để chừa chỗ; vẫn truy cập các menu thiết bị hiện có. Nút Rời/Kết thúc cao 44px, mobile rộng tối thiểu 44px, padding đồng nhất.
- Preview ở chiều cao <=820px dùng flex phân bổ chỗ cho field và actions; vùng video nhận không gian còn lại, container units giữ tỷ lệ 16:9 theo cả chiều rộng/cao khả dụng. Nút Vào cuộc họp rộng tối thiểu 200px, cao tối thiểu 44px.
- Chip Trong phòng chuyển nền tối; nút Gửi tin nhắn disabled dùng xám nhạt với selector riêng để không bị primary ghi đè.
- Chỉ đổi markup trình bày và CSS; giữ nhãn/aria-label của control, handler nghiệp vụ, API/auth/hooks, polling/renewal/topics, điều kiện quyền/disabled và dependency. Không sửa test.

### File thay đổi trong lượt này
- `src/pages/MeetingPage.jsx`
- `src/components/MeetingPreview.jsx`
- `src/meeting-ui.css`
- `SESSION_SUMMARY.md`
- `dist/` được tái tạo bởi build.

### Kiểm tra và giới hạn
- `npm run lint`: PASS, exit 0.
- `npm run build`: PASS, exit 0.
- `npm test`: PASS, 6/6, exit 0.
- `npm run test:ui`: PASS, exit 0; React DOM/jsdom với API/LiveKit/media mô phỏng.
- Chrome headless thử khởi chạy nhưng thoát mã 134 trong sandbox; chưa có ảnh render sau sửa. DOM tests không xác nhận layout pixel, WebRTC hay thiết bị thật.
- Workspace không có `.git`; không commit/deploy.

## Hiện tại — 2026-11-26: bố cục app họp và bước xem trước

Các mục lịch sử bên dưới mô tả các lượt trước; trạng thái hiện tại ở mục này thay thế các mô tả cũ về split button, avatar, header và form tạo trong thẻ.

### Đã triển khai
- Giữ thương hiệu/logo ICHI MEET, tiếng Việt có dấu; không dùng tên/logo/tài sản Zoom, không thêm dependency.
- Phòng nền #1a1a1a, video đen, bo 7px, gap 4–6px; tên đầy đủ ở giữa khi tắt camera (co theo container), chip nền đen mờ với mic tắt đỏ đứng trước tên/vai trò, viền xanh lá khi đang nói.
- Header tối giản: popover thông tin (tên, mã đầy đủ, link + sao chép, vai trò), tên phòng, menu Người nói/Lưới, đồng hồ thời lượng. Bỏ nút copy lớn trên header.
- Toolbar ba cụm: mic/camera với menu chọn thiết bị (kể cả loa trình duyệt cung cấp), người tham gia/chat/chia sẻ xanh lá/giơ tay/bảo mật, nút đỏ Rời hoặc Kết thúc. Không vẽ viền quanh control đang bật. Mobile giữ gom Thêm.
- Host bấm Kết thúc mở menu: Kết thúc cuộc họp cho mọi người hoặc Rời cuộc họp. Giữ xác nhận và handler DELETE hiện có; người thường bấm Rời để rời ngay.
- Người tham gia có avatar nhỏ/tên/Bạn/vai trò, mic/camera status; admin hover có Tắt tiếng và menu Thêm, focus/touch vẫn truy cập được. Phòng chờ ở đầu, Cho vào/Xóa; chân bảng có Mời/Tắt tiếng tất cả/Hạ tay tất cả (admin). Khách/người thường có Mời và không thêm quyền quản trị.
- Chat tên + giờ + nội dung, Gửi đến: Mọi người, compose dưới đáy; Enter gửi, Shift+Enter xuống dòng, không gửi khi IME đang composing. Toast đen mờ ở trên giữa.
- Mọi admission từ tạo/join/khách/polling đều qua MeetingPreview trước khi mount LiveKitRoom. Mic/camera mặc định tắt; có preview tự dựng bằng getUserMedia, chọn thiết bị, tên chỉ đọc, tên phòng và Vào cuộc họp. Chỉ truyền lựa chọn media đã capture thành công; nếu lỗi/no device vẫn vào với media lỗi tắt. Settings/token publish grants chặn control tương ứng và có lý do.
- Track preview dừng khi đổi lựa chọn, vào phòng, hủy/unmount và khi capture trả muộn sau unmount. Preview vẫn chạy cơ chế gia hạn token cũ; lỗi gia hạn hiển thị notice/retry. Media không tự bật lại sau renewal trong phòng như hành vi trước.
- Trang chủ hai cột: launcher 2×2, Cuộc họp mới màu cam; Lên lịch/Chia sẻ màn hình disabled có tooltip Sắp có. Đồng hồ/ngày tiếng Việt và danh sách phòng đang diễn ra ở phải. Tạo/Tham gia dùng native modal dialog, giữ đủ trường và nhãn test; bỏ hero/breadcrumb/footer. Login/guest gate đồng bộ nền/nút.

### Phạm vi giữ nguyên
- Không sửa src/api/*, src/hooks/*, src/auth/*, package.json/package-lock.json, API contract, cách gọi API, polling 4 giây, thời điểm/logic renewal, topics hay biểu thức quyền trong phòng.
- Đã đối chiếu src/api, src/hooks, src/auth và package.json với scratchpad/fe-backup-v4: không khác.
- Chỉ chèn UI preview giữa admitted và LiveKitRoom; giữ admission khi tạo để không gọi join dư.
- Không thêm API lên lịch/chia sẻ từ trang chủ hoặc nhắn riêng vì không thuộc contract/yêu cầu.

### File thay đổi
- src/pages/HomePage.jsx, src/pages/MeetingPage.jsx
- src/components/MeetingRoom.jsx, src/components/AdminPanel.jsx, src/components/Common.jsx, src/components/Icon.jsx
- Mới: src/components/MeetingPreview.jsx, src/components/DevicePicker.jsx, src/components/ParticipantMedia.jsx, src/components/FormDialog.jsx
- src/meeting-ui.css, tests/ui-smoke.mjs, README.md, SESSION_SUMMARY.md
- dist/ được tái tạo bằng build.

### Kiểm tra
- npm run lint: PASS, không warning.
- npm run build: PASS.
- npm test: PASS, 6/6.
- npm run test:ui: PASS; giữ các kiểm tra hành vi cũ và cập nhật luồng preview/nhãn mới. Thêm assertions dialog, tên khi camera tắt, thứ tự chip mic, status/device menus, popover mã đầy đủ, Enter gửi qua SDK topic cũ, renewal trong preview, khóa quyền settings/token, lựa chọn thiết bị/media, permission denied, cleanup và late capture; track mic đã nhận được phải dừng ngay cả khi camera vẫn đang chờ prompt quyền.
- UI smoke là React DOM/jsdom với API, LiveKit connection và media mô phỏng; không xác nhận WebRTC/backend/thiết bị hoặc layout thật.
- Đã xem ảnh đầu vào shots4/09-host-2people.png. Không chụp được ảnh browser mới: mở local server trả EPERM và Chrome headless không khởi chạy được trong sandbox. Cần đối chiếu desktop/1024/390px bằng browser khi môi trường cho phép.
- Workspace không có .git; chưa commit/deploy.

## Lịch sử các lượt trước

## Project
- Repo: `fe-meeting-management`, React 19 + Vite 8, JavaScript, LiveKit, react-router-dom.
- Feature: `enterprise-meeting-standalone`.
- Contract: `docs/API_CONTRACT.md`; cấu hình và hướng dẫn chạy: `README.md`.
- Cập nhật: 2026-11-25, Codex — sửa chiều cao split button Rời và focus theo ảnh Chrome trong `shots3` (chi tiết cuối file thay thế thông số chiều cao ở lượt `shots2`).
- Repo chưa có `.git`; không commit hoặc deploy.

## Scope
- Chỉ chỉnh lớp trình bày, UI state/handlers mở đóng menu, panel và dialog; không thêm dependency.
- Giữ ICHI MEET và tiếng Việt có dấu.
- `src/api/*`, `src/hooks/*`, auth, API contract, cách gọi mutation, polling, token, topic và biểu thức quyền/disabled giữ nguyên. Đã đối chiếu với bản trước tại `scratchpad/fe-backup-v2`.
- Riêng nút kết thúc được nối trực tiếp từ menu tới hộp xác nhận và handler `run('', 'DELETE', undefined, onEnded)` hiện có, thay cho việc chỉ mở bảng settings.

## Các mục 1–13
1. Đã làm: Người tham gia (N) gồm Phòng chờ (k) khi có người chờ, duyệt từng người/tất cả rồi danh sách thành viên; Tắt mic tất cả/Hạ tay tất cả ở chân bảng. Bảo mật & cài đặt là bảng riêng. Bỏ tabs và header eyebrow/badge lặp.
2. Đã làm: switch CSS căn phải, giữ native input `role=switch`, checked/disabled/onChange; bỏ khối kết thúc trong settings.
3. Đã làm: panel trên mobile phủ toàn bộ vùng nội dung phòng, không còn dải video bên trái; có nút đóng nổi rõ.
4. Đã làm: chip chat và notice trong phòng dùng tông tối; toast xin vào có nút Xem mở Người tham gia.
5. Đã làm: split button cao 44px liền khối; menu tối có Rời cuộc họp/Kết thúc cho mọi người, đóng bằng outside pointer/Esc/chọn mục; kết thúc mở xác nhận, Hủy không gọi DELETE, Xác nhận gọi handler DELETE hiện có. DOM test kiểm tra request và màn hình kết thúc; chưa kiểm chứng backend/LiveKit thật.
6. Đã làm: toolbar có độ rộng cố định theo breakpoint, active dùng màu/gạch chân nhẹ.
7. Đã làm: mobile chỉ giữ Mic, Camera, Người tham gia, Trò chuyện, Thêm; menu Thêm chứa các điều khiển còn lại với điều kiện quyền/disabled cũ. Rời thu thành icon đỏ; chủ trì giữ mũi tên menu.
8. Đã làm: Speaker bỏ camera của người ở khung chính khỏi thumbnail; thumbnail căn giữa, avatar co theo khung bằng container units.
9. Đã làm: Gallery dùng ResizeObserver của vùng video, chọn số cột/hàng cho ô 16:9 lớn nhất vừa chiều rộng/cao; tính lại khi đổi kích thước hoặc mở/đóng panel.
10. Đã làm: header rút mã còn 8 ký tự, tooltip giữ UUID đầy đủ; giữ Sao chép link mời chứa mã đầy đủ; bỏ badge vai trò trên header.
11. Đã làm: header tối cho trang khách/phòng chờ/trạng thái; hai nút đăng nhập/khách full width. Tên cuộc họp trên trang chờ tiếp tục dùng admission có sẵn. Gate khách chưa xác thực không có tên cuộc họp trong state hiện tại, nên không thêm API để lấy tên.
12. Đã làm: form tạo nằm trong thẻ Cuộc họp mới, autoFocus tiêu đề; account header gom avatar/tên và menu Tài khoản của tôi/Tạo tài khoản/Đăng xuất.
13. Đã làm phần tài nguyên: khai báo `/favicon.svg` rõ trong HTML, thay icon mẫu bằng biểu tượng ICHI. Source trước có SVG nhưng không khai báo favicon và không có favicon.ico; đây là nguồn khả dĩ của request favicon mặc định. Chưa có Network/console trực tiếp để khẳng định request 404 ban đầu hoặc xác nhận đã sạch console.

## Files Changed
- `src/components/MeetingRoom.jsx`
- `src/components/AdminPanel.jsx`
- `src/components/Common.jsx`
- `src/components/MeetingAccess.jsx`
- `src/pages/HomePage.jsx`
- `src/pages/MeetingPage.jsx`
- `src/meeting-ui.css`
- `index.html`
- `public/favicon.svg`
- `tests/ui-smoke.mjs`
- `SESSION_SUMMARY.md`
- `dist/` được tái tạo bởi build, là output sinh tự động.

## Validation
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm test`: PASS, 6/6 domain tests.
- `npm run test:ui`: PASS, React DOM/jsdom với API/LiveKit giả.
- Giữ kiểm tra hành vi cũ: login/account/guest scope/polling/permissions/realtime/hand/leave/kick/token renewal/ended/401. Chỉ đổi selector theo markup; thêm kiểm tra focus/vị trí form, không lặp speaker thumbnail, tách settings, toast Xem, menu outside/Esc và xác nhận/Hủy/DELETE kết thúc.
- Đã mở xem đủ 16 ảnh gốc (01–16), gồm desktop/tablet/mobile.
- Chưa chụp lại giao diện trong Chrome sau sửa: browser access host báo unavailable. Không thấy backend lắng nghe cổng 3010 trong lượt này. Không suy diễn DOM tests thành kiểm chứng LiveKit/media thật hoặc backend đã chuyển active sang ended.

## Decisions Retained
- Vite proxy `/meeting-api` -> `http://localhost:3010`, override bằng `VITE_MEETING_API_URL`; không dùng CRM.
- Display name dùng `src/hooks/useDisplayName.js`.
- Guest token theo cuộc họp trong sessionStorage `guest:<id>`; phòng chờ polling mỗi 4 giây; RoomView sync/realtime giữ nguyên.
- Không remount LiveKit để refresh UI; không thay đổi flow gia hạn token.

## Remaining Verification
- Chạy lại backend + LiveKit thật, chụp 1440x900, 1024x700, 390x844 để xác nhận bố cục sau sửa.
- Trong cuộc họp test: mở menu Rời, chọn Kết thúc cho mọi người, Xác nhận; kiểm tra DELETE thành công, meeting ended và tất cả client rời phòng.
- Kiểm tra Network để xác nhận không còn 404 tài nguyên.

## Follow-up: 5 chi tiết trình bày (shots2)
- Đã mở xem `16-host-1024.png`, `14-mobile-room.png`, `14b-mobile-more.png`, `14c-mobile-panel.png`, `10-chat.png`, `09-host-2people.png`.
1. Toolbar ở màn hình <=1100px dùng nhãn Thành viên / Chia sẻ (Dừng chia sẻ khi đang chia sẻ) / Bảo mật; giữ aria-label đầy đủ. Bỏ wrap và đồng nhất chiều cao toolbar/split button Rời ở desktop/tablet thành 66px.
2. Mobile chia footer thành 6 cột bằng nhau, 5 cột đầu cho Mic / Camera / Thành viên / Trò chuyện / Thêm; cột cuối cho nhóm Rời (kể cả mũi tên của host). Padding ngoài hai bên 8px; các vùng nút cùng cao 62px. Giữ menu Thêm và điều kiện hiển thị cũ.
3. Mũi tên menu Rời bỏ outline/shadow ở `:focus:not(:focus-visible)`; giữ vòng focus khi dùng bàn phím và hành vi đóng bằng Esc/trả focus hiện có. Esc là thao tác bàn phím nên vòng focus có thể hiện theo heuristic `:focus-visible` của browser.
4. Chat compose dùng flex: ô nhập bên trái, nút Gửi tin nhắn gọn bên phải; bỏ `full`, disabled dùng nền xám và chữ nhạt rõ ràng. Không đổi biểu thức disabled, handler gửi hay nội dung tin nhắn.
5. Badge vai trò trên video dùng 11px trên mọi breakpoint, line-height 16px; nhóm tên/badge căn giữa bằng flex, badge không co; tên dài có ellipsis riêng.

### Files changed trong lượt này
- `src/components/MeetingRoom.jsx`
- `src/meeting-ui.css`
- `SESSION_SUMMARY.md`
- `dist/` được tái tạo bởi `npm run build`.

### Validation trong lượt này
- `npm run lint`: PASS (exit 0).
- `npm run build`: PASS (exit 0).
- `npm test`: PASS, 6/6 (exit 0).
- `npm run test:ui`: PASS (exit 0), React DOM/jsdom với API/LiveKit giả. Không sửa file test.
- `src/api/*` và `src/hooks/*` khớp `scratchpad/fe-backup-v3` qua `diff -rq`; không đổi polling, token, topic, điều kiện quyền/disabled hoặc handlers; không thêm dependency.
- Chưa có ảnh Chrome sau lần sửa này: đã thử CUA inventory, browser access host báo unavailable. DOM/jsdom không xác nhận kích thước, tràn chữ hay heuristic focus của Chrome; cần đối chiếu lại 1024px/390px khi browser access hoạt động.

## Follow-up: chiều cao và focus split button Rời (shots3)
- Đã xem ảnh Chrome gốc `16-host-1024.png`, `09-host-2people.png`, `14-mobile-room.png` tại `/private/tmp/claude-501/-Users-se140866-code-work-meeting-workspace/21dc803d-19e0-478f-9a50-e01aed4af157/scratchpad/shots3/`.
- Root cause: lượt `shots2` đặt cả nhóm Rời, nút chính và summary cao 66px/62px. Focus dùng outline toàn cục 3px với offset 3px; Esc trả focus bằng `focus()` khiến Chrome có thể chuyển sang `:focus-visible` sau thao tác chuột.
- Nhóm Rời và cả hai phần nút nay cao 44px trên mọi breakpoint, `align-self: center`; toolbar giữ nguyên chiều cao và nhãn. Mobile nút icon rộng tối đa 44px, cao 44px, không kéo giãn theo thanh; có thể co ngang ở viewport hẹp để chừa chỗ mũi tên host. Hai phần vẫn liền nhau, bo góc ở hai mép ngoài.
- Focus bàn phím dùng outline 2px, offset -3px để nằm trong biên bo góc từng nút. PopupMenu chỉ ghi nhận modality qua DOM data attribute: pointer giữ trạng thái khi Esc trả focus; thao tác bàn phím tiếp theo hoặc focus ra ngoài xóa trạng thái pointer. CSS chỉ áp dụng ẩn ring pointer cho menu Rời.
- Giữ nguyên đóng menu, trả focus bằng Esc, outside pointer, lựa chọn menu, API, auth, quyền/disabled và các handler nghiệp vụ; không thêm dependency.

### Files changed trong lượt shots3
- `src/meeting-ui.css`
- `src/components/Common.jsx`
- `tests/ui-smoke.mjs`
- `SESSION_SUMMARY.md`
- `dist/` được tái tạo bởi build.

### Validation trong lượt shots3
- `npm run lint`: PASS (exit 0).
- `npm run build`: PASS (exit 0).
- `npm test`: PASS, 6/6 (exit 0).
- `npm run test:ui`: PASS (exit 0), React DOM/jsdom với API/LiveKit giả; bổ sung kiểm tra Esc trả focus, giữ pointer modality sau pointer + Esc, và phục hồi keyboard modality sau Enter + Esc.
- Đã thử lại CUA inventory: `The browser access host is unavailable`. Chưa có ảnh Chrome sau sửa hoặc xác nhận kích thước/heuristic focus trực tiếp bằng browser; DOM test không thay thế kiểm chứng layout Chrome thật.
- Workspace không có `.git`; không commit hoặc deploy.
