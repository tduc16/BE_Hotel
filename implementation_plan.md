# Hệ Thống Booking Khách Sạn (Backend)

Implementation Plan này mô tả chi tiết cách xây dựng tính năng Đặt Phòng chuẩn thực tế bằng NestJS và PostgreSQL, bao gồm phân tích Logic, Database Schema và danh sách các module cụ thể. 

## User Review Required

> [!IMPORTANT]
> - Chúng ta sẽ cần thư viện `@nestjs/schedule` để chạy Cron Jobs cho tính năng (Hủy tự động các booking `PENDING` bị quá hạn 15 phút). Mình sẽ cài package này tự động trong quá trình thực hiện.
> - Bật tính năng Cron trong `AppModule` qua thẻ `@Module()`.

## Proposed Changes

### 1. Database Schema (Entities)
Thêm mới Entity cho Booking kèm khai báo Enum:

#### [NEW] `src/bookings/entities/booking.entity.ts`
- Định nghĩa các cột theo đúng chuẩn: `id`, `booking_code`, `customer_name`, `phone`, `email`, `note`, `room_category_id`, `room_id`, `check_in_date`, `check_out_date`, `guest_count`, `night_count`, `room_price`, `total_amount`.
- Enums: `PaymentMethod` (CASH, BANK_TRANSFER, EWALLET), `PaymentStatus` (UNPAID, PAID, REFUNDED), `BookingStatus` (PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, EXPIRED).
- Relationships: 
  - `ManyToOne` -> `RoomCategory`
  - `ManyToOne` -> `Room` 

#### [MODIFY] `src/rooms/entities/room-category.entity.ts`
- Thêm `OneToMany` relationship sang `Booking` để thuận tiện trong việc populate.

#### [MODIFY] `src/rooms/entities/room.entity.ts`
- Thêm `OneToMany` relationship sang `Booking`.

---
### 2. DTO & Validation

#### [NEW] `src/bookings/dto/create-booking.dto.ts`
- Sử dụng `class-validator` để validate dữ liệu đầu vào.
- Validate định dạng Date (Check-in, Check-out), check-out phải sau check-in.
- Ràng buộc phone format Việt Nam, Email, số `guest_count` lớn hơn 0.

#### [NEW] `src/bookings/dto/query-booking.dto.ts` (Admin)
- Các query params để phục vụ tính năng GET Admin Booking: filter từ khoá `search`, `payment_status`, `booking_status`, `check_in_date`, paging...

---
### 3. Khách Hàng API (Customer Bookings)

#### [NEW] `src/bookings/bookings.service.ts`
Chứa Core Logic 5 Bước (Clean Coded, Transactional QueryRunner):
1. **Tính ngày**: Tính Difference in Days để có `night_count`.
2. **Lấy giá**: Truy xuất `room_category` base price, nhân lên thành `total_amount`.
3. **Kiểm tra sức chứa (Capacity)**: Bắn lỗi nếu `guest_count > category.capacity`.
4. **Thuật toán Room Availability**:
   - Khởi tạo sub-query đếm xem có bao nhiêu booking đang chiếm loại phòng này trong khoảng in-out (đang `PENDING`, `CONFIRMED`, `CHECKED_IN`).
   - `Available = (Total Rooms) - (Occupied Bookings)`.
   - Nếu `Available <= 0` trả về Exception "Phòng đã hết".
5. **Assign Room (Gán phòng tự động)**: Lấy phòng trống đầu tiên. Nếu có thì gán vào `room_id` của booking.
6. **Xác định trạng thái**: Set PENDING + expire time hoặc CONFIRMED tuỳ `PaymentMethod`.

#### [NEW] `src/bookings/bookings.controller.ts`
- API `POST /bookings` tạo mới.
- API `GET /bookings/:booking_code` để khách hàng tra cứu tiến độ với code (Không lộ Auth ID).

#### [NEW] `src/bookings/cron.service.ts`
- Run `@Cron` mỗi 1 phút: Check các PENDING bookings vượt quá `expired_at`, đổi thành `EXPIRED` qua QueryBuilder tối ưu hiệu suất, giải phóng phòng.

---
### 4. Admin Booking APIs

#### [NEW] `src/admin/bookings/admin-bookings.service.ts`
- Chứa các logic truy vấn (filter, pagination, relations).
- Helper action update states: `CONFIRM`, `CHECKIN`, `CHECKOUT`, `CANCEL`. Kéo theo trigger status của Room trong DB.

#### [NEW] `src/admin/bookings/admin-bookings.controller.ts`
- Trỏ các phương thức `GET`, `PATCH /:id/checkin`, v.v...
- Tích hợp AuthGuard Admin hiện tại.

#### [MODIFY] `src/admin/admin.module.ts`
- Đăng kí route cho module admin bookings.

---
### 5. Khai Báo Module Chính

#### [NEW] `src/bookings/bookings.module.ts`
- Mount các Feature cho Bookings, cấu hình DI cho Services, Controllers.

#### [MODIFY] `src/app.module.ts`
- Import `ScheduleModule.forRoot()`.
- Import bảng `BookingsModule`.

## Open Questions

Không có câu hỏi mở phức tạp. Thiết kế DB cùng với logic đếm Date overlaps (tránh trùng lịch phòng) sẽ được thiết kế rất tối ưu trong SQL của TypeORM.

## Verification Plan

### Automated / Manual Test
- Chạy `npm run build` để xác nhận Typescript compiler qua 100%.
- Cung cấp cURL Scripts / Log testing check-flow từ Booking rỗng -> Đặt 2 phòng (đoán overlap check trống) -> Phân biệt Expired (sau 15p) -> Checkout luồng API chuẩn của Admin.
