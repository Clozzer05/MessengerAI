# Smart AI Chat

Ứng dụng nhắn tin thời gian thực tích hợp AI: chat nhóm có trợ lý AI, tự dịch tin nhắn theo ngôn ngữ của từng thành viên, gọi thoại/video, phòng tư vấn (có chế độ ẩn danh) và trang quản trị kiểm duyệt nội dung.

<!-- Thêm link demo và ảnh chụp màn hình tại đây -->

## Tính năng chính

### Nhắn tin thời gian thực (Socket.IO)
- Chat 1-1 và chat nhóm: sửa/xóa tin nhắn, thả cảm xúc, trạng thái đã xem, đang nhập.
- Gửi ảnh, file, tin nhắn thoại, vị trí, sticker, danh thiếp, bình chọn (poll).
- Ghim và chuyển tiếp tin nhắn, đặt biệt danh, duyệt thành viên mới, chuyển quyền trưởng nhóm.
- Kết bạn, trạng thái online, "note" 24 giờ (tự xóa bằng TTL index của MongoDB).

### Tích hợp AI (Groq)
- Trợ lý AI trong nhóm chat, bật/tắt theo phòng; trả lời theo ngữ cảnh hội thoại.
- Tóm tắt cuộc trò chuyện.
- Tự dịch tin nhắn sang ngôn ngữ ưu tiên của từng người nhận (12 ngôn ngữ), dịch gộp nhiều ngôn ngữ trong một lần gọi, có cache trong bộ nhớ và giới hạn tốc độ gọi API để không vượt quota.
- Phân tích ảnh chụp màn hình khi chia sẻ màn hình.

### Gọi thoại / video (WebRTC)
- Gọi 1-1 và gọi nhóm, mời thêm thành viên vào cuộc gọi, chia sẻ màn hình.
- Signaling qua Socket.IO; máy chủ STUN/TURN lấy từ Metered, có cấu hình TURN dự phòng.

### Tư vấn và cộng đồng
- Phòng tư vấn theo 5 lĩnh vực (tâm lý, pháp luật, bạo lực gia đình, sức khỏe, giáo dục), AI tư vấn có quy tắc an toàn riêng, chuyên gia (role `expert`) nhận phiên tư vấn.
- Chế độ ẩn danh: mọi chỗ chứa mã tài khoản người hỏi (người gửi, thành viên, đã xem, reaction, phiếu bầu...) được thay bằng `anonymous` trước khi gửi tới người khác, nên không tra ngược được hồ sơ.
- Phòng chủ đề công khai theo danh mục và tag.

### Kiểm duyệt và quản trị
- Phân quyền `user`, `expert`, `sub_admin`, `super_admin`.
- Bộ lọc từ cấm do admin quản lý; vi phạm 5 lần thì tài khoản tự bị khóa 60 phút.
- Người dùng báo cáo vi phạm; admin xử lý báo cáo, khóa tạm thời hoặc cấm vĩnh viễn (người bị xử lý bị ngắt kết nối ngay qua socket).
- Thống kê, nhật ký thao tác của admin, cấu hình hệ thống.

### Tài khoản và giao diện
- Đăng ký xác thực OTP qua email, đăng nhập Google OAuth, quên/đặt lại mật khẩu, JWT.
- 11 theme, khung bong bóng chat, giao diện tiếng Việt/tiếng Anh, cài được dạng PWA.
- Văn phòng ảo: nhúng [SkyOffice](https://github.com/kevinshen56714/SkyOffice) (mã nguồn mở, giấy phép MIT) qua iframe.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, Framer Motion, Socket.IO client, simple-peer |
| Backend | Node.js, Express 5, Socket.IO, Mongoose, JWT, Multer, Nodemailer |
| Cơ sở dữ liệu | MongoDB |
| AI | Groq SDK (`openai/gpt-oss-120b` cho chat và dịch, `llama-3.2-90b-vision-preview` cho phân tích ảnh) |
| Realtime khác | WebRTC, Colyseus (văn phòng ảo) |
| Triển khai | Docker Compose, Render (backend), Vercel (frontend), Nginx |

## Cấu trúc thư mục

```
smart-ai/
├── backend/
│   ├── config/        # Kết nối DB, CORS, mailer, upload
│   ├── controllers/   # Xử lý REST API
│   ├── routes/        # auth, users, rooms, friends, admin, counseling, topics, notes, upload
│   ├── models/        # Mongoose schema
│   ├── socket/        # Sự kiện realtime: tin nhắn, AI, bạn bè, WebRTC, presence
│   ├── services/      # Gọi AI, dịch tin nhắn
│   ├── middlewares/   # Xác thực, phân quyền admin, xử lý lỗi
│   └── utils/         # Ẩn danh, lọc từ cấm, chế tài tài khoản
├── frontend/
│   └── src/
│       ├── pages/       # Chat, Admin, Counseling, Office, Profile, Settings...
│       ├── components/  # chat, call, friend, room, topic, ui
│       ├── contexts/    # Auth, Socket, Call, Theme, Language
│       └── hooks/
├── deploy/            # Cấu hình triển khai
└── docker-compose.yml
SkyOffice/             # Mã nguồn SkyOffice (bên thứ ba)
```

## Chạy dự án

### Bằng Docker Compose

```bash
cd smart-ai
cp .env.example .env   # điền GROQ_API_KEY, JWT_SECRET, MAIL_USER...
docker compose up --build
```

Frontend chạy ở `http://localhost`, backend ở `http://localhost:5000`, văn phòng ảo ở `http://localhost:3000`.

### Chạy thủ công

Cần Node.js và MongoDB.

```bash
# Backend
cd smart-ai/backend
cp ../.env.example .env   # điền các biến môi trường, thêm PORT=5001 cho khớp proxy của Vite
npm install
npm run dev               # http://localhost:5001

# Frontend (terminal khác)
cd smart-ai/frontend
npm install
npm run dev               # http://localhost:5173, /api được proxy sang backend
```

Danh sách biến môi trường xem trong [`smart-ai/.env.example`](smart-ai/.env.example).

## Thành viên

<!-- Điền tên và phần việc của từng người -->
