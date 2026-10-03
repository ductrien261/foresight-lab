import type { FallbackProps } from 'react-error-boundary';

import ui from './ui.module.css';

export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className={ui.card}>
      <h2 className={ui.cardTitle}>Phần này gặp lỗi khi hiển thị</h2>
      <p className={ui.cardLead}>Các phần khác của trang vẫn dùng được. Bạn có thể thử lại.</p>
      <div className={ui.actions}>
        <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={resetErrorBoundary}>
          Thử lại
        </button>
      </div>
    </div>
  );
}
