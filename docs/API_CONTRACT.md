# Bàn giao giao diện: phòng họp doanh nghiệp

Tài liệu cho người dựng FE (`fe-meeting-management`, React 19 + Vite, JavaScript thuần). BE là `meeting-management` (NestJS). Chi tiết schema từng API xem Swagger tại `<MEETING_API>/swagger`.

## 1. Kiến trúc tóm tắt

- **API meeting** (`MEETING_API`, mặc định `http://localhost:3005`): mọi quyết định (ai được vào, ai là admin, khóa phòng, cấm mic...) đều đi qua API này.
- **LiveKit**: chỉ lo media (âm thanh, hình ảnh, chia sẻ màn hình) và chat. FE kết nối bằng `serverUrl` + `token` do API trả về.
- **Xác thực**: hệ thống có tài khoản riêng (bảng `users`), không dùng CRM. Có hai loại token, đều gửi qua `Authorization: Bearer <token>`:
  - **Token tài khoản**: lấy từ `POST /auth/login`. Dùng được mọi API.
  - **Token khách**: người không có tài khoản nhập tên ở trình duyệt, gọi `POST /meetings/:id/guest` để nhận. Chỉ dùng được cho đúng cuộc họp đó, với các API ghi "khách: có" ở mục 4.3 và các API admin ở mục 4.4 (khi khách đang là cohost). Gọi API khác thì nhận 403.
- Thư viện nên dùng: `livekit-client` và `@livekit/components-react` (hoặc chỉ `livekit-client`).
- Token LiveKit **không** có quyền admin. Nút admin phải gọi API, không gọi LiveKit trực tiếp.

## 2. Vai trò

| role | Là admin | Ghi chú |
| --- | --- | --- |
| `host` | Có | Chủ trì, chỉ có một. Không ai mời ra, tắt mic hay khóa phát được chủ trì. Chuyển được quyền chủ trì cho người khác. |
| `cohost` | Có | Đồng chủ trì. Là tài khoản hoặc khách. Phải thu hồi quyền trước khi mời ra hoặc khóa phát. |
| `participant` | Không | Người tham gia thường. Bị giới hạn bởi cài đặt phòng. |

Vai trò của mỗi người trong phòng nằm ở **participant metadata** `{"role":"host"|"cohost"|"participant"}` (parse `participant.metadata`).

## 3. Luồng màn hình

0. **Đăng nhập** (`/login`): tên đăng nhập + mật khẩu → `POST /auth/login`. Lưu `accessToken`, `expiresAt` và `user`. Gặp 401 ở bất kỳ API nào thì xoá phiên và quay về `/login`.
1. **Danh sách**: `GET /meetings` trả các cuộc họp đang diễn ra hoặc đã lên lịch mà tôi đã được vào (cuộc họp đã lên lịch có `scheduledAt`; nên hiển thị giờ hẹn). Nút "Tạo cuộc họp" gọi `POST /meetings`, nút "Lên lịch" gọi `POST /meetings/schedule`.
2. **Tạo cuộc họp**: `POST /meetings`, kết quả giống một lần `join` thành công (có `token`), nên vào phòng ngay.
   - **Lên lịch họp**: `POST /meetings/schedule { title, scheduledAt, maxParticipants?, coHostIds? }` trả `MeetingView` (không có token). Chia sẻ link `/meeting/:id` cho người tham gia. Cuộc họp đã lên lịch **không có phòng chờ**: tới giờ hẹn ai có link (tài khoản hoặc khách) cũng vào thẳng. Trước giờ hẹn chỉ chủ trì/đồng chủ trì vào được để chuẩn bị.
3. **Vào cuộc họp qua link** `/meeting/:id`:
   - **Chưa đăng nhập**: hiện hai lựa chọn: "Đăng nhập" (về `/login` rồi quay lại link) hoặc "Tham gia với tư cách khách" (ô nhập tên). Khách gọi `POST /meetings/:id/guest { name }`, nhận `guest.accessToken` cùng `status`. Lưu token khách theo từng cuộc họp (ví dụ `sessionStorage` key `guest:<meetingId>`). Từ đó khách dùng token này để gọi lại `join` (polling phòng chờ) và các API khác cho khách. Nếu `status: "locked"` hoặc `"not_started"` thì không có token (`guest: null`).
   - **Link có tên** `/meeting/:id?name=<tên>` (gửi từ hệ thống ngoài, nhớ `encodeURIComponent`): chưa đăng nhập thì FE tự gọi `POST /meetings/:id/guest { name }`, không hiện nút chọn hay ô nhập tên, và bỏ qua màn kiểm tra thiết bị (vào phòng với mic/camera tắt). Phòng chờ và khóa phòng vẫn áp dụng như khách thường; cuộc họp đã lên lịch thì tới giờ vào thẳng. Đã đăng nhập thì bỏ qua `name`.
   - **Đã đăng nhập**, hoặc khách đã có token: gọi `POST /meetings/:id/join` rồi xử lý theo `status`:
   - `admitted`: kết nối LiveKit bằng `serverUrl` và `token`.
   - `pending`: màn hình phòng chờ, **gọi lại `join` mỗi 3–5 giây** cho tới khi đổi trạng thái.
   - `denied`: báo "Chủ trì đã từ chối".
   - `kicked`: báo "Bạn đã bị mời ra"; chỉ vào lại được khi admin duyệt lại.
   - `locked`: báo "Cuộc họp đã bị khóa". Có thể cho người dùng thử lại sau.
   - `not_started`: cuộc họp đã lên lịch nhưng chưa tới giờ. Hiện giờ bắt đầu (`meeting.scheduledAt`) và đếm ngược; tới giờ thì gọi lại `join` (hoặc `guest` với khách). Đồng hồ máy người dùng có thể lệch: nếu vẫn nhận `not_started` thì thử lại sau vài giây.
   - HTTP 404 kèm `message` "Cuộc họp đã kết thúc" hoặc "Cuộc họp không tồn tại".
   - Token khách hết hạn (401): xoá token khách và cho nhập tên lại. Người nhập lại là khách mới, phải được duyệt lại.
4. **Trong phòng**: lưới video, thanh điều khiển (mic, camera, chia sẻ màn hình, giơ tay, chat, rời phòng). Admin có thêm bảng điều khiển (mục 5).
   - Khi mở phòng và khi nhận các sự kiện ở mục 6, gọi `GET /meetings/:id/room` để đồng bộ trạng thái.
5. **Token LiveKit hết hạn** (`expiresAt` của join): gọi lại `join` để lấy token mới.
6. **Rời phòng**: chỉ cần ngắt LiveKit. **Kết thúc cho mọi người** (admin): `DELETE /meetings/:id`.

## 4. API

Lỗi trả về theo định dạng của NestJS: `{ "statusCode": 403, "message": "...", "error": "Forbidden" }`. `message` là tiếng Việt, hiển thị thẳng được. Lỗi validate trả `message` dạng mảng chuỗi.

### 4.1. Dữ liệu chung

```jsonc
// MeetingView
{
  "id": "uuid",
  "title": "Họp tuần",
  "hostId": "uuid",
  "waitingRoom": true,
  "maxParticipants": 100,
  "status": "active", // | "ended"
  "settings": {
    "locked": false,
    "waitingRoom": true,
    "allowMicrophone": true,
    "allowCamera": true,
    "allowScreenShare": true,
    "allowChat": true
  },
  "scheduledAt": "ISO|null", // giờ bắt đầu đã hẹn; null nếu họp ngay
  "joinUrl": "https://<fe>/meeting/<id>|null", // link chia sẻ; khách thêm ?name=<tên> để vào thẳng
  "createdAt": "ISO",
  "endedAt": null,
  "myRole": "host", // | "cohost" | "participant" | null
  "myStatus": "admitted" // | "pending" | "denied" | "kicked" | null
}

// MemberView
{ "userId": "uuid", "name": "Nguyễn Văn A", "isGuest": false,
  "role": "participant", "status": "pending", "canPublish": true,
  "requestedAt": "ISO|null", "decidedAt": "ISO|null", "decidedBy": "uuid|null" }

// ParticipantView (người đang có mặt trong phòng)
{ "userId": "uuid", "name": "Khách Lan", "isGuest": true,
  "role": "participant", "canPublish": true,
  "joinedAt": "ISO|null", "handRaisedAt": "ISO|null",
  "microphone": "on", // | "muted" | "off"
  "camera": "off", "screenShare": "off" }
```

```jsonc
// UserView (không bao giờ có mật khẩu)
{ "id": "uuid", "name": "Nguyễn Văn A", "username": "nguyen.van.a",
  "createdAt": "ISO", "updatedAt": "ISO", "createdBy": "uuid|null", "updatedBy": "uuid|null" }
```

Tên hiển thị: `name` có trong MemberView, ParticipantView và cũng là `participant.name` trong LiveKit. Với tài khoản là tên tài khoản, với khách là tên khách nhập. Hiển thị nhãn "Khách" khi `isGuest`.

### 4.2. Tài khoản

| Method | Path | Body | Trả về |
| --- | --- | --- | --- |
| `POST` | `/auth/login` (công khai) | `{ username, password }` | `{ accessToken, expiresAt, user: { id, name, username } }`. Sai: 401 "Tên đăng nhập hoặc mật khẩu không đúng" |
| `GET` | `/auth/me` | | UserView |
| `PATCH` | `/auth/me` | `{ name?, password?, currentPassword? }` (đổi mật khẩu cần `currentPassword`) | UserView |
| `POST` | `/users` | `{ name, username, password }` | UserView. Tên đăng nhập 3-50 ký tự `a-z 0-9 . _ -`, không phân biệt hoa thường; mật khẩu ≥ 8 ký tự; trùng: 409 |
| `GET` | `/users?q=` | | `UserView[]` (tối đa 50), dùng để chọn đồng chủ trì khi tạo cuộc họp |

Hệ thống không có phân quyền tài khoản: mọi tài khoản đã đăng nhập đều tạo được tài khoản mới. Tài khoản đầu tiên tạo bằng lệnh ở backend (`npm run user:create`).

### 4.3. Cuộc họp (cho mọi người)

| Method | Path | Khách | Body | Trả về |
| --- | --- | --- | --- | --- |
| `POST` | `/meetings/:id/guest` (công khai) | | `{ name }` | JoinResult + `guest: { id, name, accessToken, expiresAt } \| null` |
| `POST` | `/meetings` | không | `{ title, waitingRoom?, maxParticipants?, coHostIds? }` (`coHostIds` là id tài khoản) | JoinResult (admitted) |
| `POST` | `/meetings/schedule` | không | `{ title, scheduledAt, maxParticipants?, coHostIds? }`. `scheduledAt` là ISO 8601 có múi giờ (ví dụ `2026-12-01T09:00:00+07:00`), phải ở tương lai, tối đa 1 năm; không nhận `waitingRoom` | `MeetingView` (`waitingRoom: false`, có `scheduledAt`). Sai giờ: 400 |
| `GET` | `/meetings` | không | | `MeetingView[]` |
| `GET` | `/meetings/:id` | có | | `MeetingView` |
| `POST` | `/meetings/:id/join` | có | | JoinResult |
| `GET` | `/meetings/:id/room` | có | | RoomView (phải đã được vào) |
| `POST` | `/meetings/:id/hand` | có | | `{ userId, handRaisedAt }`. 409 nếu chưa kết nối LiveKit |
| `DELETE` | `/meetings/:id/hand` | có | | `{ userId, handRaisedAt: null, applied }` |

```jsonc
// JoinResult
{ "status": "admitted", "meeting": MeetingView, "serverUrl": "wss://...",
  "token": "jwt", "expiresAt": "ISO", "role": "participant" }
{ "status": "pending" /* | denied | kicked | locked | not_started */, "meeting": MeetingView }

// RoomView
{ "meeting": MeetingView,
  "participants": ParticipantView[], // đã sắp xếp: host, cohost, người giơ tay (sớm trước), rồi theo giờ vào
  "lobbyCount": 2 }                  // null nếu không phải admin
```

### 4.4. Chỉ admin (host/cohost). Người khác nhận 403. Khách đang là cohost gọi được bằng token khách (trừ chuyển chủ trì).

| Method | Path | Body | Ghi chú |
| --- | --- | --- | --- |
| `GET` | `/meetings/:id/members?status=pending` | | Danh sách phòng chờ (bỏ `status` để lấy tất cả) |
| `POST` | `/meetings/:id/members/:userId/admit` | | Duyệt |
| `POST` | `/meetings/:id/members/:userId/deny` | | Từ chối (chỉ khi đang chờ) |
| `POST` | `/meetings/:id/lobby/admit-all` | | `{ admitted: MemberView[] }` |
| `POST` | `/meetings/:id/members/:userId/kick` | | Mời ra |
| `POST` | `/meetings/:id/members/:userId/mute` | `{ audio?: true, video?: false }` | Tắt mic/camera **một lần**; người đó tự bật lại được |
| `POST` | `/meetings/:id/mute-all` | `{ audio?: true, video?: false }` | `{ participants, tracks }`; không tắt admin |
| `PUT` | `/meetings/:id/members/:userId/publish` | `{ allowed: boolean }` | Khóa/mở quyền phát của một người (giữ cả khi người đó vào lại) |
| `PUT` | `/meetings/:id/cohosts/:userId` | | Cấp đồng chủ trì cho tài khoản, hoặc khách đã có trong cuộc họp (đang chờ thì vào thẳng) |
| `DELETE` | `/meetings/:id/cohosts/:userId` | | Thu hồi đồng chủ trì |
| `DELETE` | `/meetings/:id/members/:userId/hand` | | Hạ tay giúp |
| `DELETE` | `/meetings/:id/hands` | | `{ lowered }` |
| `PATCH` | `/meetings/:id/settings` | Một hoặc nhiều trường của `settings` | `{ settings, admitted: userId[], applied }` |
| `PUT` | `/meetings/:id/host/:userId` | | **Chỉ host**: chuyển chủ trì cho tài khoản đã được vào (khách: 409), host cũ thành cohost. `{ previousHost, host }` |
| `DELETE` | `/meetings/:id` | | Kết thúc cho mọi người |

Ý nghĩa của `PATCH /settings`:

- `locked: true`: người **chưa từng** xin vào nhận `status: "locked"`. Người đang chờ vẫn duyệt được, thành viên cũ vẫn vào lại được.
- `waitingRoom: false`: duyệt luôn mọi người đang chờ; `admitted` trả danh sách userId vừa được duyệt.
- Cuộc họp đã lên lịch mặc định không có phòng chờ; admin vẫn bật lại `waitingRoom` hoặc `locked` được nếu muốn chặn người vào.
- `allowMicrophone` / `allowCamera` / `allowScreenShare`: đặt `false` thì người tham gia thường **không bật được** nguồn đó. Track đang phát bị tắt luôn. Admin không bị ảnh hưởng.
- `allowChat: false`: người tham gia thường mất quyền gửi data, nên không gửi được chat.

`applied: false` (ở mọi API admin) nghĩa là DB đã lưu nhưng LiveKit tạm lỗi. Hiển thị cảnh báo nhẹ, không cần thử lại; quyền mới sẽ được áp khi người đó vào lại.

## 5. Gợi ý UI cho admin

- Huy hiệu số người chờ (`lobbyCount`), mở ra danh sách chờ với nút Duyệt / Từ chối / Duyệt tất cả.
- Menu cho từng người: Tắt mic, Tắt camera, Khóa phát / Mở phát, Cấp / Thu hồi đồng chủ trì, Hạ tay, Mời ra, Chuyển chủ trì (chỉ host thấy). Ẩn các thao tác không hợp lệ: không có thao tác nào trên host; với cohost, phải thu hồi quyền trước khi mời ra hoặc khóa phát; với khách (`isGuest`), ẩn Chuyển chủ trì (khách vẫn được cấp đồng chủ trì).
- Phòng chờ hiển thị tên (`name`) và nhãn "Khách" nếu `isGuest`.
- Bảng cài đặt: Khóa phòng, Phòng chờ, Cho phép mic / camera / chia sẻ màn hình / chat.
- Nút "Tắt mic tất cả", "Hạ tay tất cả", "Kết thúc cuộc họp".

Với người tham gia thường: ẩn hoặc vô hiệu nút mic/camera/màn hình/chat khi `settings.allow* = false` hoặc `canPublish = false`. Bấm vẫn sẽ bị LiveKit từ chối, nhưng giao diện không nên cho bấm.

## 6. Realtime (LiveKit)

Lắng nghe `RoomEvent.DataReceived` (tham số `topic`). Payload là JSON (UTF-8):

| topic | Ai nhận | payload | FE làm gì |
| --- | --- | --- | --- |
| `meeting.lobby` | Admin | `{ type: "join_requested", meetingId, userId }` | Báo có người xin vào, tăng `lobbyCount` |
| `meeting.lobby` | Cả phòng | `{ type: "lobby_updated", meetingId, userId, status }` | Tải lại danh sách chờ |
| `meeting.roles` | Cả phòng | `{ type: "role_changed", meetingId, userId, role }` | Cập nhật vai trò; nếu `userId` là mình thì bật/tắt UI admin |
| `meeting.settings` | Cả phòng | `{ type: "settings_changed", meetingId, settings }` | Cập nhật trạng thái nút mic/camera/chat |

Không qua topic:

- **Giơ tay**: participant attribute `handRaisedAt` (ISO, vắng là chưa giơ). Nghe `RoomEvent.ParticipantAttributesChanged`. Client **không tự đặt được** attribute, phải gọi API `/hand`.
- **Vai trò**: `RoomEvent.ParticipantMetadataChanged` → `JSON.parse(metadata).role`.
- **Bị tắt mic bởi admin**: `RoomEvent.TrackMuted` trên track của mình.
- **Bị mời ra / kết thúc**: `RoomEvent.Disconnected` (reason `PARTICIPANT_REMOVED` / `ROOM_DELETED`). Gọi `GET /meetings/:id` hoặc `join` để biết lý do và hiển thị.
- **Quyền thay đổi**: `RoomEvent.ParticipantPermissionsChanged`.
- **Chat**: dùng chat sẵn của LiveKit (`useChat` hoặc `room.localParticipant.sendText(text, { topic: 'lk.chat' })`). Chat **không lưu** ở server; vào sau không thấy tin cũ.

## 7. Giới hạn hiện tại

- Chưa có avatar. Chưa có quản lý tài khoản nâng cao (khoá/xoá tài khoản, phân quyền, quên mật khẩu).
- Khách không có tài khoản: mỗi lần nhập tên lại là một khách mới.
- Lên lịch họp chưa có đổi giờ hẹn, nhắc lịch hay danh sách mời: ai có link cũng vào được khi tới giờ.
- Chưa có điểm danh, ghi hình, lưu chat.
- Không có webhook hay socket riêng: mọi realtime đi qua LiveKit; phòng chờ dùng polling `join`.
