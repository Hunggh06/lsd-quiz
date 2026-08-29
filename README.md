# Trắc nghiệm Lịch sử Đảng Cộng sản Việt Nam

Trang web ôn thi trắc nghiệm ABCD phong cách "paper", ~350 câu chia theo chương & bài.
Chọn đúng → tô xanh + giải thích; chọn sai → tô đỏ + gợi ý + hiện đáp án đúng.
Thống kê (đúng/sai, tỉ lệ %) lưu tự động trên trình duyệt.

## Cấu trúc
- `index.html` — trang chính
- `styles.css` — giao diện phong cách giấy
- `app.js` — engine trắc nghiệm + thống kê (localStorage)
- `data.js` — 350 câu hỏi (tự động sinh, không cần sửa)
- `render.yaml` — cấu hình deploy Render (static site)

## Chạy local
Mở trực tiếp `index.html` bằng trình duyệt (không cần server).

## Deploy lên Render (miễn phí, static site)

### Cách 1: Dùng Blueprint (tự động)
1. Đẩy repo này lên GitHub.
2. Vào https://dashboard.render.com → **New** → **Blueprint**.
3. Kết nối repo → Render đọc `render.yaml` → **Apply** → **Deploy**.
4. Truy cập URL Render cấp (dạng `https://lsd-quiz.onrender.com`).

### Cách 2: Tạo Static Site thủ công
1. Đẩy repo lên GitHub.
2. Render → **New** → **Static Site** → chọn repo.
3. Cấu hình:
   - **Build Command**: để trống
   - **Publish Directory**: `.` (dấu chấm = thư mục gốc)
4. **Create Static Site** → chờ deploy vài phút.

Sau khi deploy, mọi thay đổi đẩy lên `main` sẽ tự động cập nhật (auto-deploy).

## Cập nhật câu hỏi
Sửa các file JSON trong `../.omo/quiz/` rồi chạy `python3 merge.py` (tại thư mục đó)
để tái sinh `data.js`, sau đó commit & push.
