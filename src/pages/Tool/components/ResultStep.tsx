import { AssistantPanel } from '@/components/Assistant/AssistantPanel';
import { LineChart, type Point } from '@/components/charts/LineChart';
import ui from '@/components/ui.module.css';
import { TOOL } from '@/content/vi';
import { downloadExcel, downloadText } from '@/utils/download';
import { formatNumber } from '@/utils/format';
import type { TrainResult } from '@/workers/protocol';

import s from '../ToolPage.module.css';
import { ToolForecast } from './ToolForecast';

const T = TOOL.result;

export function ResultStep({
  result,
  fileName,
  onRestart,
}: {
  result: TrainResult;
  fileName: string;
  onRestart: () => void;
}) {
  const degna = result.models[0]!;
  const testMonths = result.months.slice(result.testStart);
  const pts = (values: number[]): Point[] => values.map((v, i) => [i, v]);
  const summary =
    `DeGNA có MAPE ${formatNumber(degna.metrics.mape, 2)}% và sai số lớn nhất ` +
    `${formatNumber(degna.metrics.maxae, 2)} trên ${testMonths.length} tháng kiểm tra.`;

  async function handleExcel() {
    try {
      await downloadExcel(
        [
          ['Tháng', 'Thực tế', 'DeGNA'],
          ...testMonths.map((m, i) => [m, result.actual[result.testStart + i]!, degna.pred[i] ?? null]),
          [],
          [T.oneStepNote],
        ],
        `foresight-lab-${fileName.replace(/\.\w+$/, '')}-kiem-tra.xlsx`,
      );
    } catch (error) {
      console.error('Excel export failed', error);
    }
  }

  return (
    <div className={s.stack}>
      <section className={ui.card} aria-label={T.metrics}>
        <h2 className={ui.cardTitle}>{T.metrics}</h2>
        <p className={ui.cardLead}>
          {testMonths[0]} – {testMonths[testMonths.length - 1]}. {summary}
        </p>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Mô hình</th>
                <th scope="col">MAPE (%)</th>
                <th scope="col">RMSE</th>
                <th scope="col">MAE</th>
                <th scope="col">Sai số lớn nhất</th>
                <th scope="col">R²</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  {degna.name} <span className={s.detail}>{degna.spec}</span>
                </th>
                <td className={ui.hl}>{formatNumber(degna.metrics.mape, 2)}</td>
                <td>{formatNumber(degna.metrics.rmse, 2)}</td>
                <td>{formatNumber(degna.metrics.mae, 2)}</td>
                <td>{formatNumber(degna.metrics.maxae, 2)}</td>
                <td>{formatNumber(degna.metrics.r2, 3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={ui.note}>{T.oneStepNote}</p>
      </section>

      <section className={ui.card} aria-label={T.test}>
        <h2 className={ui.cardTitle}>{T.test}</h2>
        <LineChart
          label="Thực tế và dự báo DeGNA trên tập kiểm tra"
          series={[
            {
              id: 'actual',
              label: 'Thực tế',
              points: pts(result.actual.slice(result.testStart)),
              tone: 'ink',
              hasDots: true,
            },
            { id: 'degna', label: 'DeGNA', points: pts(degna.pred), tone: 'accent', isDashed: true },
          ]}
          formatX={(i) => testMonths[i] ?? ''}
          xTicks={testMonths.map((_, i) => i).filter((i) => i % 6 === 0)}
        />
      </section>

      <ToolForecast result={result} fileName={fileName} />

      <AssistantPanel
        topic={`Kết quả dự báo cho dữ liệu "${fileName}"`}
        quickExplanation={summary}
        suggestions={['Sai số này có chấp nhận được không?', 'MAPE và sai số lớn nhất khác nhau thế nào?']}
        context={{
          metrics: { name: degna.name, ...degna.metrics },
          testMonths: testMonths.length,
          evaluation: 'one-step-ahead',
        }}
      />

      <div className={ui.actions}>
        <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={() => void handleExcel()}>
          {T.exportExcel}
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.secondary}`}
          onClick={() =>
            downloadText(JSON.stringify({ source: fileName, ...result }), 'foresight-lab-mo-hinh.json')
          }
        >
          {T.exportModel}
        </button>
        <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={onRestart}>
          {T.restart}
        </button>
      </div>
    </div>
  );
}
