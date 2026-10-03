import type { Role } from '@/content/vi';

import { cagr, formatNumber, formatSigned } from './format';

export interface InsightInput {
  lastYear: number;
  lastValue: number;
  years: number[];
  forecast: number[];
  low: number[];
  high: number[];
  /** Plan comparisons always use the plan year (2030), whatever horizon is shown. */
  planYear: number;
  planDemand: number;
  supply2030: number;
  seasonalProfile: number[] | null;
}

export interface Insight {
  id: string;
  tag: string;
  big: string;
  unit: string;
  text: string;
  link?: { to: string; label: string };
}

const MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

function at(values: number[], index: number): number {
  return values[index] ?? Number.NaN;
}

export function buildInsights(role: Role, d: InsightInput): Insight[] {
  const horizon = d.years.length;
  const end = at(d.forecast, horizon - 1);
  const added = end - d.lastValue;
  const growth = cagr(d.lastValue, end, horizon);
  const gap = d.planDemand - d.supply2030;
  const floor = cagr(d.lastValue, at(d.low, horizon - 1), horizon);
  const near = Math.min(1, horizon - 1);
  const spreadFirst = (at(d.high, near) - at(d.low, near)) / at(d.forecast, near);
  const spreadEnd = at(d.high, horizon - 1) - at(d.low, horizon - 1);
  const endYear = at(d.years, horizon - 1);

  if (role === 'gov') {
    return [
      {
        id: 'supply',
        tag: 'Cung cần bổ sung',
        big: formatNumber(added / horizon, 0),
        unit: 'tỷ kWh/năm',
        text: `Lượng cung trung bình phải tăng thêm mỗi năm từ ${d.lastYear} đến ${endYear} để theo kịp nhu cầu, theo kịch bản đang chọn.`,
      },
      {
        id: 'plan',
        tag: 'So với quy hoạch',
        big: formatSigned(gap, 0),
        unit: 'tỷ kWh',
        text: `Chênh lệch giữa nhu cầu dự báo ${d.planYear} và mức cung sơ cấp 155 triệu TOE trong QĐ 893/QĐ-TTg. Cần đối chiếu phương pháp thống kê trước khi kết luận.`,
        link: { to: '/nang-luong/can-doi', label: 'Xem cân đối cung – cầu' },
      },
      {
        id: 'horizon',
        tag: 'Độ chắc của kế hoạch',
        big: `≤ ${formatNumber(spreadFirst * 100, 1)}%`,
        unit: `năm ${at(d.years, near)}`,
        text: `Ba kịch bản gần như trùng nhau năm ${at(d.years, near)}: kế hoạch 1–2 năm bám được dự báo; xa hơn nên lập kế hoạch theo cả dải Thấp – Cao.`,
      },
    ];
  }

  if (role === 'inv') {
    return [
      {
        id: 'floor',
        tag: 'Mức tăng sàn',
        big: `${formatNumber(floor * 100, 1)}%`,
        unit: 'mỗi năm',
        text: `Ngay cả kịch bản Thấp, nhu cầu vẫn tăng đều đến ${endYear}. Không kịch bản nào cho thấy thị trường đi ngang.`,
      },
      {
        id: 'market',
        tag: 'Quy mô tăng thêm',
        big: formatSigned(added, 0),
        unit: 'tỷ kWh',
        text: `Thị trường lớn thêm đến ${endYear} so với ${d.lastYear}, tức ${formatSigned((added / d.lastValue) * 100, 0)}%, tăng ${formatNumber(growth * 100, 1)}%/năm theo kịch bản đang chọn.`,
      },
      {
        id: 'spread',
        tag: 'Biên độ kịch bản',
        big: formatNumber(spreadEnd, 0),
        unit: `tỷ kWh năm ${endYear}`,
        text: `Chênh lệch nhu cầu giữa kịch bản Cao và Thấp năm ${endYear} (${formatSigned((spreadEnd / at(d.low, horizon - 1)) * 100, 1)}% so với kịch bản Thấp). Dữ liệu 2009–2024 cho thấy tốc độ tăng IIP theo năm gần như không giải thích được tốc độ tăng nhu cầu năng lượng (hệ số co giãn rất nhỏ), nên quy mô thị trường chủ yếu do quán tính xu hướng quyết định, ít nhạy với giả định tăng trưởng.`,
      },
    ];
  }

  const profile = d.seasonalProfile;
  const low = profile ? profile.indexOf(Math.min(...profile)) : 1;
  const high = profile ? profile.indexOf(Math.max(...profile)) : null;
  return [
    {
      id: 'low-month',
      tag: 'Tháng thấp điểm',
      big: MONTHS[low] ?? '',
      unit: 'hằng năm',
      text: 'Nhu cầu thấp nhất trong năm: thời điểm hợp lý để bảo trì, đại tu dây chuyền.',
    },
    {
      id: 'high-month',
      tag: 'Tháng cao điểm',
      big: high === null ? 'Hè, cuối năm' : (MONTHS[high] ?? ''),
      unit: high === null ? 'theo báo cáo' : 'hằng năm',
      text: 'Nhu cầu cao nhất trong năm, hệ thống căng hơn: nên có phương án dự phòng nguồn trong giai đoạn này.',
    },
    {
      id: 'trend',
      tag: 'Xu hướng chung',
      big: `+${formatNumber(growth * 100, 1)}%`,
      unit: 'mỗi năm',
      text: 'Muốn lập kế hoạch năng lượng cho nhà máy của bạn? Tải số liệu tiêu thụ lên Công cụ dự báo.',
      link: { to: '/cong-cu', label: 'Mở Công cụ dự báo' },
    },
  ];
}
