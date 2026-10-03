# Foresight Lab

Mô phỏng và dự báo nhu cầu năng lượng Việt Nam bằng mô hình DeGNA (CMES, 2026), kèm công cụ để người dùng tự dự báo với dữ liệu của họ. Web tĩnh, không có backend: phần tính toán chạy ngay trên trình duyệt.

- **Năng lượng Việt Nam**: dự báo và kịch bản (thanh trượt IIP, FDI), cân đối với quy hoạch (QĐ 893, QĐ 768), phân tích tác động.
- **Công cụ dự báo**: tải Excel/CSV → kiểm tra dữ liệu → đề xuất biến → huấn luyện DeGNA bằng Pyodide → chỉ số sai số trên tập kiểm tra → dự báo 3–36 tháng (hai cách ngoại suy xu hướng) và xuất kết quả.

## Chạy trên máy (Windows)

Cần Node.js 20.12+ và Python 3.10+.

```bash
npm install
npm run dev          # mở http://localhost:5173
npm test             # test giao diện và bộ máy dự báo (TypeScript)
npm run test:py      # test lõi Python (cần: pip install numpy scipy statsmodels pandas openpyxl pytest)
npm run build        # bản build trong thư mục dist/
```

## Bật đầy đủ lớp Năng lượng Việt Nam

`src/data/vietnam.json` chứa số liệu, kết quả và tham số mô hình xuất từ script dưới đây. Nếu thiếu tham số mô hình, thanh trượt tự do và tab Phân tích tác động sẽ khóa. Để tạo lại:

```bash
python python/scripts/train_vietnam.py "đường/dẫn/Data_Energy_Vietnam.xlsx"
```

Script huấn luyện lại đúng cấu hình bài báo (GWO 30 lần × 80 sói × 200 vòng, khoảng 1 phút), in ra so sánh với chỉ số đã công bố trên tập kiểm tra (dự báo 1 bước, MAPE 4,1052%), in tổng năm của cả hai cách ngoại suy xu hướng, rồi ghi đè `src/data/vietnam.json`. Phần dự báo tương lai khớp notebook v9.

### Dự báo dài hạn (giống Mục 4.4 của báo cáo, notebook v9)

GM(1,1) cửa sổ trượt 12 tháng (bước 3 của DeGNA) được thiết kế cho dự báo một bước, mỗi tháng nạp số thực mới; các chỉ số trên tập kiểm tra 2022–2024 đo theo cách này. Khi dự báo nhiều năm không còn số thực mới, nên (xem `python/foresight/longterm.py`):

1. **Cửa sổ GM(1,1)** cho dự báo dài hạn được chọn lại bằng kiểm định quá khứ nhiều mốc (5 mốc, dự báo 6 năm, so trên tổng năm; mỗi mốc chỉ dùng dữ liệu đến mốc đó). Với dữ liệu Việt Nam: cửa sổ 60 tháng, MAPE 9,64%.
2. **Kịch bản** dịch đường GM(1,1) theo hệ số co giãn giữa tốc độ tăng của biến mục tiêu và của biến ngoại sinh đầu tiên (dữ liệu năm, bỏ 2020–2021): `(1 + β·(g − g_gốc))^(k/12)`. Với dữ liệu Việt Nam: β ≈ 0,023 theo IIP, mức gốc là kịch bản Cơ sở (6,5%).
3. GWO-ANFIS dự báo phần mùa vụ – phần dư với bộ chuẩn hóa của tập train.

Hồi quy xu hướng theo thời gian và các biến ngoại sinh (`TrendModel`, chế độ `aligned`) được vẽ làm đường so sánh ở cả hai lớp.

Lớp Công cụ chạy đúng quy trình trên (Denton–Cholette giải bằng SLSQP như notebook, GWO 30 × 80 × 200). Tải `Data_Energy_Vietnam.xlsx` vào Công cụ cho ra cùng mô hình với lớp Năng lượng (MAPE 4,1052, cửa sổ 60, cùng β); đặt "Tốc độ tăng IIP ứng với xu hướng GM(1,1) gốc" bằng 6,5 và IIP/FDI bằng 6,5/5,5 thì ra cùng dự báo với kịch bản Cơ sở (sai khác ≤ 0,01 tỷ kWh do cách giải Denton cho chuỗi IIP/FDI tương lai).

## Triển khai lên GitHub Pages

1. `npm run build`
2. Đưa nội dung thư mục `dist/` lên nhánh `gh-pages` (hoặc bật GitHub Pages từ GitHub Actions).
3. Web dùng hash routing (`/#/nang-luong`), nên mở thẳng link con không bị lỗi 404.

## Cấu hình

Chép `.env.example` thành `.env`:

- `VITE_PYODIDE_URL`: nơi tải Pyodide (mặc định CDN jsDelivr).
- `VITE_AI_PROXY_URL`: URL hàm chuyển tiếp AI (xem `ai-proxy/README.md`). Để trống thì ẩn ô hỏi đáp tự do.

## Cấu trúc

```
python/foresight/   lõi DeGNA: denton, gm11, anfis, gwo, pipeline, checks, selection, api
python/scripts/     train_vietnam.py (xuất mô hình cho web), make_engine_fixture.py
src/engine/         bản TypeScript của Denton và lượt dự báo, kiểm tra khớp với Python
src/pages/          Energy (bảng điều khiển 3 tab), Tool
src/workers/        Pyodide worker cho Công cụ dự báo
ai-proxy/           hàm chuyển tiếp AI tùy chọn (Cloudflare Worker)
```
