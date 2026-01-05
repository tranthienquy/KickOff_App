# AI Young Guru - Event Sync System (Orange Edition)

Hệ thống điều khiển sự kiện đồng bộ thời gian thực sử dụng Firebase Realtime Database.

## Tính năng
- **Client View (iPad/Màn hình LED):** Hiển thị video đồng bộ, splash screen, và hiệu ứng chữ chạy.
- **Admin View (Laptop):** Điều khiển trạng thái (Waiting, Countdown, Activated), upload video, và thay đổi nội dung chữ theo thời gian thực.

## Cài đặt
1. `npm install`
2. `npm run dev`

## Cấu trúc
- `/` -> Giao diện hiển thị (Client)
- `/admin` -> Giao diện điều khiển (Admin)

## ⚠️ Hướng dẫn Upload lên GitHub Mới
Nếu bạn muốn đẩy code này sang một Repository khác, hãy mở **Terminal** và chạy các lệnh sau:

```bash
# 1. Xóa lịch sử git cũ
rm -rf .git

# 2. Khởi tạo lại
git init
git branch -M main

# 3. Commit code hiện tại
git add .
git commit -m "Move project to new repository"

# 4. Đẩy lên Github mới (Thay LINK_REPO_MOI bằng link của bạn)
git remote add origin <LINK_REPO_MOI>
git push -u origin main --force
```
