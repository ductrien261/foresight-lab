export const APP = {
  name: 'Foresight Lab',
  tagline: 'Mô phỏng và dự báo nhu cầu năng lượng',
  footnote: 'Mô hình DeGNA · CMES, 2026',
} as const;

/** Wording for the long-term trend set-up; numbers are formatted by utils/longTrend.ts. */
export const LONG_TREND = {
  window: (w: string, n: number, from: string, to: string, mape: string) =>
    `Xu hướng dài hạn dùng GM(1,1) cửa sổ ${w} tháng, chọn bằng kiểm định quá khứ ${n} mốc (${from}–${to}) với sai số tổng năm thấp nhất (MAPE ${mape}%).`,
  noBacktest: 'Dữ liệu quá ngắn để kiểm định quá khứ, nên xu hướng dài hạn dùng GM(1,1) cửa sổ 12 tháng.',
  elasticity: (driver: string, beta: string, r: string) =>
    `Kịch bản hiệu chỉnh xu hướng theo tốc độ tăng ${driver} với hệ số co giãn β = ${beta} (r = ${r}).`,
  weak: 'Hệ số này nhỏ nên các kịch bản chỉ chênh nhau ít.',
} as const;

export const NAV = {
  spaces: { energy: 'Năng lượng Việt Nam', tool: 'Công cụ dự báo' },
  guide: 'Hướng dẫn',
} as const;

export const ROLES = {
  gov: 'Quản lý nhà nước',
  inv: 'Nhà đầu tư',
  biz: 'Doanh nghiệp',
} as const;
export type Role = keyof typeof ROLES;

export const ONBOARDING = [
  {
    title: 'Chào mừng đến Foresight Lab',
    body: 'Hệ thống mô phỏng và dự báo nhu cầu năng lượng Việt Nam, dựa trên mô hình DeGNA đã công bố trên CMES (2026). Bạn quan tâm với vai trò nào? App sẽ ưu tiên thông tin phù hợp.',
  },
  {
    title: 'Thử kịch bản',
    body: 'Chọn kịch bản Thấp, Cơ sở, Cao hoặc tự kéo tốc độ tăng IIP và FDI. Biểu đồ, bảng và các thẻ "Điều cần biết" cập nhật ngay.',
  },
  {
    title: 'Hai không gian',
    body: 'Năng lượng Việt Nam dùng mô hình đã huấn luyện sẵn. Công cụ dự báo cho bạn tải dữ liệu riêng để huấn luyện DeGNA và dự báo ngay trên trình duyệt. Mở lại hướng dẫn bất cứ lúc nào từ nút Hướng dẫn.',
  },
] as const;

export const ENERGY = {
  title: 'Dự báo và kịch bản',
  lead: 'Nhu cầu năng lượng sơ cấp toàn quốc, tỷ kWh.',
  perspective: 'Góc nhìn',
  insightsLabel: 'Điều cần biết',
  tabs: { level: 'Nhu cầu theo năm', inc: 'Tăng thêm mỗi năm', monthly: 'Theo tháng', quarterly: 'Theo quý' },
  scenario: {
    title: 'Kịch bản của bạn',
    lead: 'Tốc độ tăng mỗi năm, 2025–2030',
    presets: { low: 'Thấp', base: 'Cơ sở', high: 'Cao' },
    iip: 'Chỉ số sản xuất công nghiệp (IIP)',
    fdi: 'Vốn FDI',
    custom: 'Tự chọn',
    band: 'Hiện dải Thấp – Cao',
    noModel:
      'Chưa có tham số mô hình, nên chỉ xem được 3 kịch bản đã tính sẵn. Chạy python/scripts/train_vietnam.py để bật thanh trượt.',
    source: 'Căn cứ',
  },
  table: {
    title: 'Dự báo theo năm, tỷ kWh',
    yours: 'Kịch bản đang chọn',
    inc: 'Tăng thêm',
    download: 'Tải Excel',
  },
  legend: {
    actual: 'Thực tế',
    forecast: 'Dự báo DeGNA (xu hướng GM(1,1))',
    alt: 'So sánh: xu hướng theo hồi quy IIP, FDI',
    band: 'Dải Thấp – Cao (giữa hai giả định, không phải khoảng tin cậy)',
    target: 'Mục tiêu cung, QĐ 893/QĐ-TTg',
  },
  horizon: {
    title: 'Tầm dự báo',
    years: (n: number) => `${n} năm`,
    toPlan: (year: number) => `Đến ${year}`,
    custom: 'Tùy chọn',
    customLabel: 'Số năm dự báo',
    until: (n: number, year: number) => `${n} năm · đến ${year}`,
    beyondReport: (planYear: number) =>
      `Sau ${planYear} nằm ngoài giai đoạn dự báo của nghiên cứu: số liệu được ngoại suy tiếp bằng cùng mô hình, giả định IIP và FDI giữ nguyên tốc độ tăng. Càng xa càng kém chắc chắn, nên đọc như xu hướng chứ không phải con số kế hoạch.`,
    planNote: (planYear: number) => `So sánh với Quy hoạch luôn tính tại năm ${planYear}.`,
    noModel: 'Chưa có tham số mô hình, nên chỉ dự báo được đến 2030.',
  },
  trend: {
    compare: 'So sánh cách ngoại suy xu hướng',
  },
  captions: {
    monthly: 'Mùa vụ được tách bằng STL và dự báo bằng GWO-ANFIS, theo kịch bản đang chọn.',
    quarterly: 'Tổng nhu cầu mỗi quý (3 tháng), tỷ kWh — theo kịch bản đang chọn.',
  },
  accuracySub: 'Dự báo 1 bước · kiểm tra 2022–2024 · CMES 2026',
  impactFdiNote: (beta: string) =>
    `Xu hướng GM(1,1) chỉ thay đổi theo IIP qua hệ số co giãn β = ${beta}; FDI chỉ tác động qua phần mùa vụ – phần dư (GWO-ANFIS). Vì vậy các thay đổi trên có tác động nhỏ.`,
  scope:
    'Phạm vi: tổng nhu cầu năng lượng sơ cấp toàn quốc. Mô hình dùng IIP và FDI; chưa tính thời tiết, giá năng lượng, chính sách tiết kiệm, công suất đỉnh hay chia theo vùng.',
} as const;

export const BALANCE = {
  title: 'Cân đối cung – cầu năm 2030',
  warn: 'Chưa kết luận là thiếu hụt. Quy hoạch tính bằng TOE, dữ liệu mô hình tính bằng kWh; hai nguồn có thể quy đổi điện tái tạo khác nhau. Cần đối chiếu cùng phương pháp thống kê trước khi dùng con số này.',
  tabs: { primary: 'Năng lượng sơ cấp', electricity: 'Điện thương phẩm' },
  docs: 'Văn bản quy hoạch',
  inUse: 'Đang dùng',
  waiting: 'Chờ dự báo điện',
  electricityTitle: 'Cần dự báo riêng chuỗi điện thương phẩm',
  electricityBody:
    'Quy hoạch điện VIII điều chỉnh đặt mục tiêu điện thương phẩm 2030 là 500,4–557,8 tỷ kWh. Mô hình hiện dự báo năng lượng sơ cấp nên chưa so trực tiếp được. Dữ liệu điện thương phẩm theo tháng đã có; chạy thêm DeGNA trên chuỗi này là so được.',
  customTitle: 'Dùng mốc cung khác',
  customLead: 'Quy hoạch tỉnh, kế hoạch doanh nghiệp hoặc giả định riêng, quy về tỷ kWh năm 2030.',
  customLabel: 'Mốc cung 2030 (tỷ kWh)',
  conversion: 'Tỷ kWh. Cung quy hoạch: 155 triệu TOE × 11,63 MWh/TOE. Quy hoạch chỉ nêu mốc 2030.',
} as const;

export const TOOL = {
  title: 'Dự báo với dữ liệu của bạn',
  steps: ['Dữ liệu', 'Chọn cột', 'Kiểm tra', 'Huấn luyện', 'Kết quả'],
  upload: {
    drop: 'Kéo file vào đây hoặc chọn file',
    hint: 'Excel (.xlsx) hoặc CSV, tối đa 5 MB. Cần ít nhất 6 năm dữ liệu, mỗi bảng có một cột thời gian.',
    choose: 'Chọn file',
    template: 'Tải file mẫu',
    tooBig: 'File lớn hơn 5 MB.',
    empty: 'Không tìm thấy bảng nào có cột thời gian và cột số. Hãy xem file mẫu.',
  },
  map: {
    title: 'Chọn vai trò cho từng cột',
    target: 'Biến cần dự báo',
    indicator: 'Chỉ báo theo tháng để phân rã Denton',
    indicatorHint:
      'Biến cần dự báo không phải số tháng, nên cần một chuỗi tháng có tương quan cao để chia nhỏ.',
    how: 'Giá trị mỗi năm (quý) là',
    howOptions: { sum: 'Tổng các tháng', mean: 'Bình quân các tháng', last: 'Giá trị cuối kỳ' },
    exog: 'Biến ngoại sinh có thể dùng (theo tháng)',
    exogHint: 'Chọn hết các biến có thể liên quan; bước sau sẽ đề xuất giữ biến nào.',
    next: 'Kiểm tra dữ liệu',
  },
  check: {
    title: 'Kết quả kiểm tra dữ liệu',
    drivers: 'Đề xuất biến ngoại sinh',
    driversLead: 'Đo trên giai đoạn huấn luyện, với phần mùa vụ và biến động mà ANFIS học.',
    train: 'Huấn luyện và dự báo',
    blocked: 'Còn lỗi cần sửa trước khi huấn luyện.',
  },
  stages: {
    start: 'Chuẩn bị',
    stl: 'Tách xu hướng và mùa vụ (STL)',
    gm: 'Dự báo xu hướng (GM(1,1))',
    anfis: 'Chuẩn bị ANFIS',
    gwo: 'Tối ưu ANFIS bằng bầy sói xám',
    long: 'Chọn cửa sổ xu hướng dài hạn (kiểm định quá khứ)',
    done: 'Hoàn tất',
  } as Record<string, string>,
  result: {
    metrics: 'Độ chính xác trên tập kiểm tra',
    test: 'Thực tế và dự báo trên tập kiểm tra',
    forecast: 'Dự báo tương lai',
    horizon: 'Tầm dự báo',
    horizonOption: (months: number) => `${months} tháng`,
    longHorizon:
      'Tầm dự báo từ 24 tháng trở lên: không còn số liệu thực mới để cập nhật, độ tin cậy giảm dần theo thời gian. Hãy xem như định hướng, không phải con số chắc chắn.',
    oneStepNote: 'Sai số đo trên dự báo một bước (mỗi tháng dùng số thực của tháng trước).',
    gm: 'DeGNA – xu hướng GM(1,1)',
    regression: 'So sánh: xu hướng theo hồi quy',
    caption:
      'Hai đường chỉ khác nhau ở cách ngoại suy xu hướng; phần mùa vụ – phần dư đều do GWO-ANFIS dự báo. Đường chính dùng GM(1,1) với cửa sổ chọn bằng kiểm định quá khứ, hiệu chỉnh theo tốc độ tăng của biến ngoại sinh đầu tiên; đường so sánh dùng hồi quy xu hướng theo các biến ngoại sinh.',
    noRegression:
      'Chỉ có đường GM(1,1): không có biến ngoại sinh hoặc hồi quy xu hướng theo biến ngoại sinh khớp kém (R² ≤ 0,5), nên không vẽ đường so sánh.',
    driversNote: (driver: string | null) =>
      driver
        ? `Đường GM(1,1) đổi theo ${driver} qua hệ số co giãn β và theo mọi biến qua phần mùa vụ – phần dư; đường hồi quy đổi theo mọi biến.`
        : 'Không có biến ngoại sinh.',
    refLabel: (driver: string) => `Tốc độ tăng ${driver} ứng với xu hướng GM(1,1) gốc (%/năm)`,
    refNote:
      'Mặc định bằng tốc độ tăng bình quân 3 năm gần nhất. Khi kịch bản bằng mức này, xu hướng không bị hiệu chỉnh. Lớp Năng lượng Việt Nam dùng mức của kịch bản Cơ sở (IIP 6,5%).',
    exportExcel: 'Tải kết quả kiểm tra (Excel)',
    exportForecast: 'Tải dự báo (Excel)',
    exportModel: 'Lưu mô hình (.json)',
    restart: 'Làm lại với file khác',
  },
} as const;
