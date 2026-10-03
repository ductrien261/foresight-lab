# AI relay (tùy chọn)

Web Foresight Lab là web tĩnh, nên không thể giữ khóa API trong code. Hàm nhỏ này chạy trên Cloudflare Workers, giữ khóa, giới hạn số câu hỏi mỗi ngày cho mỗi người và chỉ chuyển tiếp **số liệu tổng hợp** mà trang gửi lên. Nó không lưu gì khác.

Không cấu hình hàm này thì web vẫn chạy đủ: phần "Giải thích" dùng câu tự sinh từ số liệu, chỉ ẩn ô hỏi đáp tự do.

## Cài đặt

1. Tạo tài khoản Cloudflare, cài `npm i -g wrangler`, chạy `wrangler login`.
2. Trong thư mục này tạo `wrangler.toml`:

   ```toml
   name = "foresight-lab-ai"
   main = "worker.js"
   compatibility_date = "2026-09-01"

   [vars]
   ALLOWED_ORIGIN = "https://<tai-khoan>.github.io"
   DAILY_LIMIT = "20"

   # Tùy chọn: giới hạn lượt hỏi mỗi ngày
   # [[kv_namespaces]]
   # binding = "LIMITS"
   # id = "<id từ: wrangler kv namespace create LIMITS>"
   ```

3. `wrangler secret put ANTHROPIC_API_KEY` rồi dán khóa API.
4. `wrangler deploy`, chép URL nhận được vào `VITE_AI_PROXY_URL` trong file `.env` của web, rồi build lại web.

## Chốt chặn

- Hướng dẫn hệ thống buộc AI chỉ dùng số trong CONTEXT, không khuyên đầu tư.
- Phía web kiểm tra lại: câu trả lời có con số không nằm trong số liệu đã gửi sẽ bị ẩn (`src/utils/numberGuard.ts`).
- Công cụ dự báo chỉ gửi bảng chỉ số tổng hợp, không gửi dữ liệu gốc người dùng tải lên.
