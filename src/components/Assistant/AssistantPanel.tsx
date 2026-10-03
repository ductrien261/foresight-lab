import { useId, useRef, useState } from 'react';

import { ApiError, askAssistant, isAiEnabled } from '@/api/ai';
import ui from '@/components/ui.module.css';
import { findUnsupportedNumbers } from '@/utils/numberGuard';

import s from './AssistantPanel.module.css';

interface AssistantPanelProps {
  topic: string;
  context: Record<string, unknown>;
  quickExplanation: string;
  suggestions: string[];
}

type State =
  | { status: 'idle' }
  | { status: 'loading'; question: string }
  | { status: 'answered'; question: string; answer: string }
  | { status: 'rejected'; question: string }
  | { status: 'error'; question: string; message: string };

export function AssistantPanel({ topic, context, quickExplanation, suggestions }: AssistantPanelProps) {
  const inputId = useId();
  const [state, setState] = useState<State>({ status: 'idle' });
  const [draft, setDraft] = useState('');
  const abort = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setState({ status: 'loading', question: q });
    try {
      const answer = await askAssistant({ question: q, context, topic }, abort.current.signal);
      const unsupported = findUnsupportedNumbers(answer, context);
      setState(
        unsupported.length
          ? { status: 'rejected', question: q }
          : { status: 'answered', question: q, answer },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const message = error instanceof ApiError ? error.message : 'Có lỗi khi hỏi trợ lý. Thử lại sau.';
      if (!(error instanceof ApiError)) console.error('Assistant failed', error);
      setState({ status: 'error', question: q, message });
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void ask(draft);
    setDraft('');
  }

  return (
    <section className={`${ui.card} ${s.panel}`} aria-label="Giải thích và hỏi đáp">
      <div className={s.head}>
        <h2 className={ui.cardTitle}>Giải thích</h2>
        <span className={s.badge}>{isAiEnabled ? 'Có trợ lý AI' : 'Tự động từ số liệu'}</span>
      </div>
      <p className={s.quick}>{quickExplanation}</p>

      {isAiEnabled ? (
        <>
          <div className={s.chips}>
            {suggestions.map((q) => (
              <button key={q} type="button" className={s.chip} onClick={() => void ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <form className={s.form} onSubmit={handleSubmit}>
            <label htmlFor={inputId} className={s.label}>
              Hoặc tự đặt câu hỏi về số liệu trên trang
            </label>
            <div className={s.row}>
              <input
                id={inputId}
                type="text"
                maxLength={400}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={s.input}
              />
              <button
                type="submit"
                className={`${ui.btn} ${ui.primary}`}
                disabled={state.status === 'loading'}
              >
                Hỏi
              </button>
            </div>
          </form>
          <AnswerView state={state} />
          <p className={s.fine}>
            AI chỉ nhận số liệu tổng hợp đang hiển thị. Câu trả lời có con số không nằm trong số liệu sẽ bị
            ẩn.
          </p>
        </>
      ) : (
        <p className={ui.note}>Trợ lý AI hỏi đáp tự do chưa được bật cho bản này (xem ai-proxy/README.md).</p>
      )}
    </section>
  );
}

function AnswerView({ state }: { state: State }) {
  if (state.status === 'idle') return null;
  return (
    <div className={s.answer} aria-live="polite">
      <p className={s.question}>{state.question}</p>
      {state.status === 'loading' && <p className={s.muted}>Đang trả lời…</p>}
      {state.status === 'answered' && <p>{state.answer}</p>}
      {state.status === 'rejected' && (
        <p className={s.warn}>
          Câu trả lời có con số không có trong dữ liệu nên đã bị ẩn. Hãy hỏi cụ thể hơn.
        </p>
      )}
      {state.status === 'error' && <p className={s.warn}>{state.message}</p>}
    </div>
  );
}
