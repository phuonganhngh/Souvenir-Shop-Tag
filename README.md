# Tag Studio — Tạo tag giá hàng loạt

Công cụ tiếng Việt, dựa trên List.xlsx (14 sản phẩm) và mẫu tag của Noboribetsu Grand Hotel. Tất cả xử lý ở trình duyệt, không cần tài khoản, API hoặc cơ sở dữ liệu.

## Dành cho người sử dụng

1. Mở bản **Tag-Studio.html** trong Chrome hoặc Edge trên máy tính. Bản này dùng được cả khi không có Internet. Không đổi trình duyệt nếu muốn tiếp tục chỉnh danh sách đã lưu trước đó.
2. Dùng danh sách ban đầu, bấm **Thêm** để nhập tay, hoặc tải **Excel mẫu**, điền sản phẩm rồi tải lên. Chọn sheet và bấm **Nhập sheet**. Việc nhập thay danh sách hiện tại; xuất Excel trong **Hướng dẫn** trước nếu cần giữ các chỉnh sửa.
3. Bấm tên sản phẩm để sửa, đánh dấu sản phẩm cần in và nhập số bản. Kiểm tra giá, tên, bản dịch, quy cách sản phẩm và thuế. Chỉ tự thêm “税込” khi đã xác nhận giá gồm thuế. Những ô thuế trống trong Excel được giữ trống.
4. Chọn kích thước tag. Logo được đóng gói cố định cùng ứng dụng, không có nút tải lên, thay thế hoặc xóa logo. Họa tiết viền được dựng minh họa theo mẫu.
5. Bấm **In / Lưu PDF**. Chọn **A4 dọc**, **tỷ lệ 100%**, bật **đồ họa nền**, tắt **đầu/chân trang**, kiểm tra phần xem trước. Dùng **Lưu dưới dạng PDF** để tạo PDF. In thử một trang và đo kích thước trước khi in cả lô.

Kích thước: 90×55 mm (8 tag/trang), 100×60 mm (4 tag/trang), 180×110 mm (2 tag/trang). Lề A4 10 mm, khoảng cách cắt 4 mm. Nội dung rất dài cần rút gọn hoặc chia dòng phù hợp sau khi xem trước.

Excel: `.xlsx`, tối đa 5 MB / 2.000 dòng; tối đa 100 bản mỗi sản phẩm, 1.000 tag mỗi lần in. Giá là số nguyên JPY không âm. Dòng đầu cần cột `日本語` và `価格 (JPY)`; các cột `English`, `한국어`, `简体中文`, `繁體中文（台灣）`, `価格表示・備考` tùy chọn. Thứ tự cột có thể thay đổi. Sheet Notes không được nhập thành sản phẩm. Không tự dịch hay chạy macro/công thức Excel; chỉ đọc kết quả công thức đã được Excel lưu sẵn.

Dữ liệu lưu bằng localStorage trên thiết bị/trình duyệt đang dùng; chế độ riêng tư hoặc mở file cục bộ có thể hạn chế lưu. Xuất Excel trước khi đóng nếu cần giữ dữ liệu quan trọng. Excel xuất chỉ chứa nội dung sản phẩm, không chứa số bản, lựa chọn in hay thiết lập giao diện. Không có đồng bộ giữa các máy.

## Phát triển

Yêu cầu Node.js 22.12+ (đã kiểm tra Node 24).

```sh
cd /workspace/-Tag
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

```sh
npm test
npm run test:browser
npm run build
npm run build:portable
```

Kiểm thử trình duyệt cần Chromium (`/usr/bin/chromium` mặc định; có thể đặt `CHROMIUM_PATH`). Ứng dụng cần chạy trước tại cổng 5173; có thể thay bằng `APP_URL`. Có thể dùng `EXCEL_FIXTURE=/đường/dẫn/List.xlsx` để kiểm tra file Excel thực tế; mặc định bộ kiểm thử tạo workbook từ 14 sản phẩm có sẵn.

`dist/` là bản website tĩnh có thể đưa lên hosting HTTPS. `portable/index.html` là bản gộp toàn bộ mã, thư viện và font thành một file, có thể đổi tên thành `Tag-Studio.html`, chia sẻ rồi mở trực tiếp bằng trình duyệt. Không cần dịch vụ backend. Các font Noto được đóng gói cục bộ với giấy phép SIL Open Font License trong gói font.

Môi trường cloud đã tách biệt cho từng task: dùng checkout hiện có, không tạo Git worktree nếu người dùng không yêu cầu. Các tiến trình phải khởi động lại khi mở môi trường mới; mã và dependency đã cài có thể được giữ lại qua snapshot.

Logo cố định sử dụng ảnh gốc `src/assets/hotel-logo.png`. Ảnh được Vite đóng gói trong bản website và nhúng vào bản HTML offline. Logo cũ trong localStorage được bỏ qua để không ghi đè logo cố định.
