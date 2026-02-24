# Web Scraper Pro - Câu Chuyện Người Dùng & Tình Huống Sử Dụng

Tài liệu này mô tả các câu chuyện người dùng, điểm đau được giải quyết, và hướng dẫn từng bước cho các tính năng chính.

---

## Mục Lục

1. [Thu Thập Dữ Liệu Sản Phẩm E-commerce](#user-story-1-thu-thập-dữ-liệu-sản-phẩm-e-commerce)
2. [Phân Tích & Báo Cáo Dữ Liệu](#user-story-2-phân-tích--báo-cáo-dữ-liệu)
3. [Trực Quan Hóa & Presentation](#user-story-3-trực-quan-hóa--presentation)
4. [Theo Dõi Giá Cả Đối Thủ](#user-story-4-theo-dõi-giá-cả-đối-thủ)
5. [Nghiên Cứu Thị Trường](#user-story-5-nghiên-cứu-thị-trường)
6. [Thu Thập Dữ Liệu Mạng Xã Hội](#user-story-6-thu-thập-dữ-liệu-mạng-xã-hội)
7. [Ghi Lại Quy Trình Làm Việc](#user-story-7-ghi-lại-quy-trình-làm-việc)
8. [Kiểm Thử & Tái Tạo Bug](#user-story-8-kiểm-thử--tái-tạo-bug)
9. [Học Tiếng Trung Từ Dữ Liệu](#user-story-9-học-tiếng-trung-từ-dữ-liệu-thu-thập)
10. [Trích Xuất Nâng Cao với Crawl4AI](#user-story-10-trích-xuất-nâng-cao-với-crawl4ai)

---

## User Story 1: Thu Thập Dữ Liệu Sản Phẩm E-commerce

### Nhân Vật
**Linh**, chuyên viên phân tích dữ liệu tại một công ty mỹ phẩm, cần thu thập dữ liệu sản phẩm son môi từ Shopee để phân tích thị trường.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Sao chép thủ công** | Copy-paste từng sản phẩm mất hàng giờ, dễ sai sót |
| **Cuộn vô hạn** | Shopee dùng infinite scroll, không thể "Select All" |
| **Dữ liệu lộn xộn** | Giá, đánh giá, số lượng bán nằm chung trong 1 chuỗi text |
| **Hình ảnh bị bỏ qua** | Copy text không lấy được URL hình ảnh sản phẩm |
| **Mất thời gian** | Thu thập 200 sản phẩm thủ công mất 2-3 giờ |

### Web Scraper Pro Giải Quyết

- **Phát hiện mẫu tự động**: Chỉ cần hover vào 1 sản phẩm, hệ thống nhận diện tất cả sản phẩm tương tự
- **Cuộn tự động**: Auto-scroll xử lý infinite scroll, tự động click "Xem thêm"
- **Trích xuất có cấu trúc**: Xuất JSON/CSV với các trường riêng biệt (tên, giá, rating, số bán)
- **Thu thập hình ảnh**: Tự động lấy URL hình ảnh sản phẩm
- **Nhanh gấp 50 lần**: Thu thập 200 sản phẩm trong 3-5 phút

### Hướng Dẫn Từng Bước

#### Bước 1: Cài Đặt Extension
```bash
# Build extension
bun run build

# Load vào Chrome
1. Mở chrome://extensions
2. Bật "Developer mode"
3. Click "Load unpacked" → chọn thư mục dist/
```

#### Bước 2: Truy Cập Trang Cần Thu Thập
- Mở Shopee và tìm kiếm "son môi"
- Áp dụng bộ lọc nếu cần (giá, đánh giá, vị trí)

#### Bước 3: Cấu Hình Match Strategy
1. Click icon Web Scraper Pro trên toolbar
2. Vào tab **Match Strategy**
3. Bật các tùy chọn:
   - ✅ Match Tag Name
   - ✅ Match Classes
   - ⬜ Match ID (tắt vì ID thường unique)
4. Đặt throttle: **1500ms** (Shopee load chậm)

#### Bước 4: Bắt Đầu Thu Thập
1. Quay về tab **Dashboard**
2. Click **Start Scanning**
3. Hover vào một sản phẩm → Tất cả sản phẩm tương tự sáng lên
4. Auto-scroll bắt đầu thu thập

#### Bước 5: Theo Dõi Tiến Trình
- Xem số lượng **Items Collected** tăng dần
- Click **Pause** nếu cần dừng tạm
- Click **Resume** để tiếp tục

#### Bước 6: Xuất Dữ Liệu
1. Vào tab **Extraction**
2. Click **Export Data**
3. Chọn định dạng: JSON, CSV, hoặc Excel
4. File tự động tải về

### Kết Quả Mẫu

```json
{
  "image": "https://down-vn.img.susercontent.com/file/...",
  "link": "https://shopee.vn/Son-Romand-...",
  "text": "Son Romand Juicy Tint 23 Nucadamia căng mọng môi",
  "price": "189.000₫",
  "rating": "4.9",
  "sold": "100k+",
  "location": "Bắc Ninh"
}
```

---

## User Story 2: Phân Tích & Báo Cáo Dữ Liệu

### Nhân Vật
**Minh**, quản lý marketing cần phân tích dữ liệu son môi đã thu thập để hiểu thị trường và đưa ra quyết định kinh doanh.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Dữ liệu thô khó đọc** | File CSV hàng trăm dòng, không biết bắt đầu từ đâu |
| **Thiếu kỹ năng Excel** | Tính trung bình, tìm outlier, pivot table phức tạp |
| **Mất thời gian tổng hợp** | Đọc và tổng hợp thủ công mất nửa ngày |
| **Thiếu insight** | Chỉ thấy số liệu, không thấy xu hướng và pattern |
| **Báo cáo không chuyên nghiệp** | Paste số vào Word, không có biểu đồ trực quan |

### Web Scraper Pro Giải Quyết

- **Phân tích tự động**: Chạy 1 lệnh, nhận báo cáo đầy đủ
- **Thống kê chi tiết**: Min, max, trung bình, median, độ lệch chuẩn
- **Phát hiện pattern**: Tự động nhóm theo giá, rating, vị trí, thương hiệu
- **Nhận diện outlier**: Cảnh báo giá trị bất thường
- **Báo cáo có cấu trúc**: Text report với formatting chuyên nghiệp

### Hướng Dẫn Từng Bước

#### Bước 1: Chuẩn Bị Dữ Liệu
- Đảm bảo file CSV/JSON đã được xuất từ bước thu thập
- Đặt file trong thư mục dễ truy cập

#### Bước 2: Chạy Phân Tích
```bash
# Sử dụng skill scraper-data-analysis
# Khi chat với Claude Code, gõ:
"apply scraper-data-analysis skill to [đường dẫn file]"
```

#### Bước 3: Xem Báo Cáo Tự Động

Báo cáo bao gồm các phần:

**A. Thống Kê Tổng Quan**
```
═══════════════════════════════════════════
           BÁO CÁO PHÂN TÍCH DỮ LIỆU
═══════════════════════════════════════════

📊 THỐNG KÊ CHUNG
───────────────────────────────────────────
  Tổng sản phẩm:      182
  Tổng trường dữ liệu: 6
  Tỷ lệ hoàn chỉnh:    98.9%
```

**B. Phân Tích Giá**
```
💰 PHÂN TÍCH GIÁ
───────────────────────────────────────────
  Giá thấp nhất:      6.999₫
  Giá cao nhất:       860.000₫
  Giá trung bình:     139.330₫
  Giá trung vị:       99.000₫

  Phân bố giá:
    Dưới 50k       66 (36.7%) ███████████
    50k - 100k     25 (13.9%) ████
    100k - 200k    48 (26.7%) ████████
    200k - 500k    36 (20.0%) ██████
    Trên 500k       5 ( 2.8%) █
```

**C. Phân Tích Đánh Giá**
```
⭐ PHÂN TÍCH ĐÁNH GIÁ
───────────────────────────────────────────
  Đánh giá trung bình: 4.80 / 5.0

  5.0 sao          30 (16.9%) █████
  4.8-4.9 sao     107 (60.1%) ██████████████████
  4.5-4.7 sao      35 (19.7%) ██████
```

**D. Top Sản Phẩm Bán Chạy**
```
🏆 TOP 10 BÁN CHẠY
───────────────────────────────────────────
  1. Son Môi CmaaDu15 Matte           500.000+ đã bán
  2. Son PERFECT DIARY DreamMatte     400.000+ đã bán
  3. Son Romand Juicy Tint 23         100.000+ đã bán
```

**E. Nhận Định Chính (Key Insights)**
```
🔍 NHẬN ĐỊNH CHÍNH
═══════════════════════════════════════════
  • 51% sản phẩm giá dưới 100k - thị trường bình dân
  • 77% sản phẩm đánh giá 4.8+ - chất lượng cao
  • Son lì (matte) chiếm 63% - xu hướng thịnh hành
  • 75% sản phẩm đang giảm giá - cạnh tranh khốc liệt
  • Hà Nội chiếm 36% người bán - trung tâm phân phối
```

---

## User Story 3: Trực Quan Hóa & Presentation

### Nhân Vật
**Hương**, giám đốc sản phẩm cần trình bày kết quả nghiên cứu thị trường cho ban lãnh đạo trong cuộc họp tuần tới.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Không biết làm biểu đồ** | Excel chart phức tạp, khó tùy chỉnh |
| **Slide xấu** | PowerPoint mặc định trông nghiệp dư |
| **Mất thời gian thiết kế** | Làm 1 slide đẹp mất 30 phút |
| **Không responsive** | Slide không hiển thị tốt trên các thiết bị |
| **Khó cập nhật** | Thay đổi số liệu phải làm lại từ đầu |

### Web Scraper Pro Giải Quyết

- **Tự động tạo presentation**: HTML slides với Chart.js
- **Thiết kế chuyên nghiệp**: Dark mode, gradient, animation
- **Responsive**: Hiển thị tốt trên desktop, tablet, mobile
- **Dễ cập nhật**: Chỉ cần đổi số liệu trong code
- **Xuất nhiều định dạng**: HTML, PDF, hình ảnh

### Hướng Dẫn Từng Bước

#### Bước 1: Yêu Cầu Tạo Báo Cáo Visual
```bash
# Sau khi phân tích xong, yêu cầu:
"generate HTML presentation in Vietnamese"
```

#### Bước 2: Xem Kết Quả
Mở file HTML trong trình duyệt để xem:

**A. Header với KPI Cards**
- Tổng sản phẩm
- Giá trung bình
- Đánh giá trung bình
- Tổng doanh số
- Tỷ lệ khuyến mãi

**B. Biểu Đồ Trực Quan**
- Bar chart: Phân bố giá
- Doughnut chart: Phân bố đánh giá
- Polar area: Loại sản phẩm
- Horizontal bar: Thương hiệu

**C. Progress Bars**
- Phân bố người bán theo khu vực

**D. Bảng Xếp Hạng**
- Top 10 sản phẩm bán chạy

**E. Insight Cards**
- 6 nhận định chính với highlight

#### Bước 3: Tùy Chỉnh (Tùy Chọn)

```html
<!-- Đổi màu chủ đạo -->
:root {
  --primary: #ee4d2d;  /* Màu Shopee */
  --primary: #1877f2;  /* Đổi sang màu Facebook */
}

<!-- Đổi tiêu đề -->
<h1>Phân Tích Dữ Liệu Son Môi</h1>
<h1>Báo Cáo Thị Trường Q1/2026</h1>
```

#### Bước 4: Xuất & Chia Sẻ
- **Mở trực tiếp**: Double-click file HTML
- **In PDF**: Ctrl+P → Save as PDF
- **Chia sẻ**: Upload lên Google Drive, gửi link

### Kết Quả Mẫu

```
📁 bao-cao-phan-tich-son-moi.html
├── Header với gradient Shopee
├── 6 KPI cards với animation
├── 4 biểu đồ Chart.js
├── Progress bars khu vực
├── Bảng top 10 bán chạy
└── 6 insight cards
```

---

## User Story 4: Theo Dõi Giá Cả Đối Thủ

### Nhân Vật
**Tuấn**, chủ shop bán mỹ phẩm online, cần theo dõi giá đối thủ hàng tuần để điều chỉnh giá bán.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Kiểm tra thủ công** | Mỗi tuần phải vào từng shop đối thủ xem giá |
| **Bỏ lỡ thay đổi** | Đối thủ giảm giá flash sale, mình không biết |
| **Không có lịch sử** | Không biết xu hướng giá theo thời gian |
| **Dữ liệu rời rạc** | Ghi chép vào nhiều file Excel khác nhau |

### Web Scraper Pro Giải Quyết

- **Scheduled Tasks**: Tự động chạy hàng ngày/tuần
- **Webhook Integration**: Gửi alert khi có thay đổi
- **Lịch sử dữ liệu**: So sánh giá giữa các lần thu thập
- **Dashboard tập trung**: Xem tất cả task một chỗ

### Hướng Dẫn Từng Bước

#### Bước 1: Tạo Task Mới
1. Mở Web Scraper Pro
2. Click **New Task**
3. Điền thông tin:
   - **Task Name**: "Giá đối thủ - Son Romand"
   - **Target URL**: Link trang sản phẩm đối thủ
   - **Description**: "Theo dõi giá son Romand của shop ABC"

#### Bước 2: Cấu Hình Lịch
- **Frequency**: Daily (hàng ngày) hoặc Weekly (hàng tuần)
- **Time**: 8:00 AM (trước giờ mở cửa)
- **Max Items**: 50
- **Timeout**: 300 giây

#### Bước 3: Cấu Hình Export
- **Format**: CSV (dễ mở bằng Excel)
- **Auto-export**: Bật
- **Webhook URL**: (nếu muốn nhận thông báo)

#### Bước 4: Cấu Hình Webhook (Tùy Chọn)
```json
{
  "url": "https://hooks.slack.com/services/...",
  "events": ["task_completed", "price_changed"],
  "include_data": true
}
```

#### Bước 5: Theo Dõi
- Xem danh sách task trong **Scheduled Tasks**
- Kiểm tra **History** để xem các lần chạy trước
- So sánh dữ liệu để phát hiện thay đổi giá

---

## User Story 5: Nghiên Cứu Thị Trường

### Nhân Vật
**Mai**, nhà nghiên cứu thị trường tại agency, cần thu thập dữ liệu từ nhiều nguồn để báo cáo cho khách hàng.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Nhiều nguồn dữ liệu** | Shopee, Lazada, Tiki, Sendo - mỗi site khác nhau |
| **Format không đồng nhất** | Mỗi site có cấu trúc HTML riêng |
| **Khó tổng hợp** | Ghép dữ liệu từ nhiều nguồn rất phức tạp |
| **Deadline gấp** | Khách hàng cần báo cáo trong 2 ngày |

### Web Scraper Pro Giải Quyết

- **Multi-site support**: Hoạt động trên mọi website
- **Flexible matching**: Tự động thích ứng với cấu trúc HTML khác nhau
- **Unified export**: Xuất format chuẩn cho mọi nguồn
- **Batch processing**: Chạy nhiều task song song

### Hướng Dẫn Từng Bước

#### Bước 1: Tạo Task Cho Mỗi Nguồn

**Task 1: Shopee**
- URL: `https://shopee.vn/search?keyword=son+môi`
- Match: Tag + Classes
- Throttle: 1500ms

**Task 2: Lazada**
- URL: `https://www.lazada.vn/catalog/?q=son+môi`
- Match: Tag + Data Attributes
- Throttle: 2000ms

**Task 3: Tiki**
- URL: `https://tiki.vn/search?q=son+môi`
- Match: Tag + Classes
- Throttle: 1000ms

#### Bước 2: Chạy Đồng Thời
- Mở 3 tab Chrome
- Chạy Web Scraper Pro trên mỗi tab
- Thu thập song song

#### Bước 3: Tổng Hợp Dữ Liệu
```javascript
// Thêm cột nguồn khi export
{
  "source": "shopee",
  "name": "Son Romand...",
  "price": 189000
}
```

#### Bước 4: Phân Tích So Sánh
- So sánh giá giữa các platform
- Tìm sản phẩm exclusive của từng platform
- Phân tích chênh lệch giá

---

## User Story 6: Thu Thập Dữ Liệu Mạng Xã Hội

### Nhân Vật
**Đức**, social media analyst cần thu thập bài viết từ Facebook Groups để phân tích sentiment.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Feed vô hạn** | Bài viết cũ biến mất khi scroll xuống |
| **Mất metadata** | Copy text không lấy được likes, comments, thời gian |
| **Nội dung tạm thời** | Bài có thể bị xóa trước khi phân tích |
| **Rate limit** | Facebook hạn chế scraping |

### Web Scraper Pro Giải Quyết

- **Immediate extraction**: Lưu dữ liệu ngay khi bài xuất hiện
- **MutationObserver**: Phát hiện bài mới tự động
- **In-memory storage**: Giữ dữ liệu dù DOM bị xóa
- **Throttle control**: Tránh bị rate limit

### Hướng Dẫn Từng Bước

#### Bước 1: Đăng Nhập Trước
- Đăng nhập Facebook trên Chrome
- Vào Group cần thu thập

#### Bước 2: Cấu Hình Cho Social Media
- **Throttle**: 2000-3000ms (tránh rate limit)
- **Max Items**: Đặt giới hạn hợp lý (100-200)
- **Match Strategy**: Tag + Classes

#### Bước 3: Thu Thập
- Hover vào một bài viết
- Để auto-scroll chạy
- Dữ liệu được lưu ngay lập tức

#### Bước 4: Export & Phân Tích
- Xuất JSON để phân tích sentiment
- Mỗi record bao gồm:
  - Nội dung bài viết
  - Số likes/reactions
  - Số comments
  - Thời gian đăng
  - Link bài viết

---

## User Story 7: Ghi Lại Quy Trình Làm Việc

### Nhân Vật
**Nam**, trainer nội bộ cần tạo tài liệu hướng dẫn sử dụng hệ thống cho nhân viên mới.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Screenshot thủ công** | Chụp từng màn hình rất mất thời gian |
| **Thiếu context** | Screenshot không cho thấy thứ tự thao tác |
| **Viết hướng dẫn lâu** | Mô tả từng bước bằng text rất tedious |
| **Khó cập nhật** | UI thay đổi phải làm lại từ đầu |

### Web Scraper Pro Giải Quyết

- **DOM Event Capture**: Ghi lại mọi click, input, navigation
- **Video Recording**: Quay màn hình với cursor mượt
- **LLM Generation**: Tự động tạo hướng dẫn từ recording
- **Multi-format export**: Markdown, PDF, Video

### Hướng Dẫn Từng Bước

#### Bước 1: Cấu Hình Recording
1. Mở Recording Panel
2. Bật **Capture Video**
3. Bật **Capture DOM Events**
4. Bật **Cursor Smoothing**

#### Bước 2: Cấu Hình LLM (Tùy Chọn)
- Provider: OpenAI hoặc Anthropic
- API Key: Nhập key của bạn
- Model: GPT-4 hoặc Claude 3

#### Bước 3: Ghi Lại Workflow
1. Click **Start Recording**
2. Thực hiện các bước cần ghi
3. Click **Stop** khi hoàn thành

#### Bước 4: Export
- **Markdown**: Cho wiki/documentation
- **PDF**: Cho in ấn
- **Video**: Cho training

### Kết Quả Mẫu (Markdown)

```markdown
## Bước 1: Đăng Nhập Hệ Thống
Truy cập trang đăng nhập và nhập thông tin tài khoản.

## Bước 2: Vào Menu Quản Lý
Click vào **Menu** ở góc trái, chọn **Quản lý sản phẩm**.

## Bước 3: Thêm Sản Phẩm Mới
Click nút **Thêm mới** ở góc phải trên cùng.
...
```

---

## User Story 8: Kiểm Thử & Tái Tạo Bug

### Nhân Vật
**Lan**, QA engineer cần document chính xác các bước để reproduce bug.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Mô tả mơ hồ** | "Click vào nút đó thì bị lỗi" - nút nào? |
| **Developer không reproduce được** | Thiếu context, thiếu bước |
| **Mất thời gian viết** | Mô tả chi tiết 10 bước rất lâu |
| **Không có video evidence** | Chỉ có text, developer nghi ngờ |

### Web Scraper Pro Giải Quyết

- **Precise Event Logging**: Ghi chính xác selector, action
- **Video Evidence**: Quay lại bug xảy ra
- **Auto-generated Steps**: Tự động tạo repro steps
- **Export to Markdown**: Paste thẳng vào JIRA

### Hướng Dẫn Từng Bước

#### Bước 1: Chuẩn Bị
- Navigate đến trang có bug
- Mở Recording Panel

#### Bước 2: Record Bug
1. Click **Start Recording**
2. Thực hiện các bước gây ra bug
3. Để bug xảy ra trên màn hình
4. Click **Stop**

#### Bước 3: Export Bug Report
- Click **Markdown** để export text
- Click **Video** nếu cần visual proof

### Kết Quả Mẫu

```markdown
## Bug: Không thể submit form đăng ký

### Các bước tái tạo:
1. Truy cập `/register`
2. Điền email: test@example.com
3. Điền password: 12345678
4. Click nút "Đăng ký"
5. **Bug**: Form không submit, không có thông báo lỗi

### Environment:
- Browser: Chrome 120
- URL: https://example.com/register
- Timestamp: 2026-01-28 15:30:00

### Selectors:
- Email input: `#email-input`
- Submit button: `button[type="submit"]`
```

---

## User Story 9: Học Tiếng Trung Từ Dữ Liệu Thu Thập

### Nhân Vật
**Huy**, sinh viên học tiếng Trung, thu thập dữ liệu sản phẩm từ Taobao/1688 và muốn học từ vựng từ tên sản phẩm.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Không hiểu chữ Hán** | Tên sản phẩm toàn chữ Trung, không biết nghĩa |
| **Tra từ điển mất thời gian** | Phải copy từng chữ vào Google Translate |
| **Không nhớ được** | Không có cách học cấu tạo chữ |

### Web Scraper Pro Giải Quyết

- **Vocabulary Extraction**: Tự động trích xuất từ vựng tiếng Trung từ dữ liệu
- **IDS Decomposition**: Phân tích cấu tạo chữ Hán (⿰, ⿱, ⿲...)
- **Vietnamese Meanings**: 186 bộ thủ có nghĩa tiếng Việt
- **Browser TTS**: Phát âm không cần API key

### Tính Năng Mới (02/2026)

| Module | Mô Tả |
|--------|-------|
| `vocabularyExtractor.ts` | Nhận diện ngôn ngữ (zh, ja, ko, vi, en), trích xuất từ vựng |
| `ids/idsParser.ts` | Phân tích cấu tạo chữ theo chuẩn IDS |
| `ids/dataLoader.ts` | 186 nghĩa tiếng Việt cho bộ thủ thông dụng |
| `browserTts.ts` | Web Speech API với mapping bộ thủ → chữ phát âm được |

### Ví Dụ

```typescript
// Phân tích chữ 休 (nghỉ ngơi)
const ids = '⿰亻木';  // Trái-Phải: người + cây
const components = ['亻', '木'];
const meanings = {
  vi: 'người (bộ) + cây, gỗ',
  en: 'person + tree'
};
```

---

## User Story 10: Trích Xuất Nâng Cao với Crawl4AI

### Nhân Vật
**Phong**, data engineer cần thu thập dữ liệu từ các trang web phức tạp với JavaScript rendering và cần xử lý batch hàng trăm URL.

### Điểm Đau (Pain Points)

| Vấn Đề | Mô Tả |
|--------|-------|
| **Trang web động** | JavaScript render, selector không ổn định |
| **Batch processing chậm** | Thu thập tuần tự từng URL mất thời gian |
| **Dữ liệu không cấu trúc** | HTML lộn xộn, khó trích xuất chính xác |
| **Token limit** | Gửi HTML thô vào LLM tốn quá nhiều token |

### Web Scraper Pro + Crawl4AI Giải Quyết

- **LLM-powered extraction**: Dùng AI để trích xuất dữ liệu từ trang phức tạp
- **Batch URL processing**: Xử lý song song nhiều URL cùng lúc
- **Fit Markdown**: Output tối ưu cho LLM (giảm 67% token)
- **Hybrid architecture**: Tự động chọn local hoặc Crawl4AI tùy độ phức tạp
- **Graceful fallback**: Tự động dùng local extraction nếu Crawl4AI không khả dụng

### Kiến Trúc

```
Extension ──┬──▶ Local Extraction (nhanh, offline)
            │    └── Cho trang đơn giản
            │
            └──▶ Crawl4AI Docker (localhost:11235)
                 ├── LLM Extraction (AI-powered)
                 ├── Batch Processing (song song)
                 └── Fit Markdown (token-efficient)
```

### Hướng Dẫn Nhanh

#### Bước 1: Khởi Động Crawl4AI Docker
```bash
docker run -d -p 11235:11235 unclecode/crawl4ai:latest
```

#### Bước 2: Bật Trong Settings
1. Mở Web Scraper Pro → Settings
2. Cuộn đến **Crawl4AI Backend**
3. Bật **Enable Crawl4AI**
4. Kiểm tra trạng thái "Connected"

#### Bước 3: Chọn Strategy
- **Auto**: Extension tự chọn backend phù hợp
- **Local Only**: Luôn dùng local (nhanh nhất)
- **Always Crawl4AI**: Luôn dùng Crawl4AI (mạnh nhất)

### Khi Nào Dùng Crawl4AI?

| Tình Huống | Khuyến Nghị |
|------------|-------------|
| Trang tĩnh, selector đơn giản | Local |
| JavaScript-heavy, SPA | Crawl4AI |
| Batch 50+ URL | Crawl4AI |
| Cần AI trích xuất | Crawl4AI + LLM |
| Offline / Speed critical | Local |

Xem chi tiết tại [docs/CRAWL4AI_SETUP.md](CRAWL4AI_SETUP.md).

---

## Bảng Tổng Hợp: Tính Năng → Điểm Đau Được Giải Quyết

| Tính Năng | Điểm Đau Được Giải Quyết |
|-----------|--------------------------|
| **Pattern Detection** | Chọn thủ công, dữ liệu không nhất quán |
| **Auto-Scroll** | Infinite scroll, dữ liệu không đầy đủ |
| **Data Analysis** | Không biết phân tích, thiếu insight |
| **HTML Presentation** | Báo cáo xấu, không có biểu đồ |
| **Scheduled Tasks** | Công việc lặp lại, bỏ lỡ cập nhật |
| **Webhook Integration** | Dữ liệu rời rạc, không tự động hóa |
| **DOM Event Capture** | Thiếu chi tiết tương tác |
| **Video Recording** | Không có bằng chứng visual |
| **LLM Generation** | Viết documentation tốn thời gian |
| **Multi-format Export** | Format không tương thích |
| **MutationObserver** | Mất dữ liệu từ virtualized lists |
| **Shadow DOM Handler** | Không truy cập được web components |
| **Vocabulary Extraction** | Không hiểu từ vựng tiếng Trung |
| **IDS Decomposition** | Không nhớ cấu tạo chữ Hán |
| **Browser TTS** | Cần API key để phát âm |
| **Crawl4AI Backend** | Trang web động, JavaScript rendering |
| **LLM Extraction** | Dữ liệu không cấu trúc, cần AI |
| **Batch Processing** | Xử lý nhiều URL chậm |
| **Fit Markdown** | Token limit khi dùng LLM |
| **Hybrid Architecture** | Cân bằng tốc độ và độ mạnh |

---

## Checklist Bắt Đầu

- [ ] Cài extension (`bun run build` → load thư mục `dist/`)
- [ ] Cấu hình match strategy phù hợp với trang web
- [ ] Cài API key LLM (nếu cần tạo content tự động)
- [ ] Tạo scheduled task đầu tiên
- [ ] Cấu hình webhook (nếu cần thông báo)
- [ ] Thu thập và xuất dữ liệu đầu tiên
- [ ] Chạy phân tích và tạo báo cáo

---

## Liên Hệ & Hỗ Trợ

- **Documentation**: Xem thêm tại `/docs`
- **Issues**: Báo lỗi tại GitHub Issues
- **Feature Requests**: Đề xuất tính năng mới

---

*Tài liệu được cập nhật: 24/02/2026*
