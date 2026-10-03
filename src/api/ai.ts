export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

const PROXY_URL = String(import.meta.env.VITE_AI_PROXY_URL ?? '');

export const isAiEnabled = PROXY_URL.length > 0;

export interface AskInput {
  question: string;
  /** Aggregated numbers only, never the user's raw data. */
  context: Record<string, unknown>;
  topic: string;
}

export async function askAssistant(input: AskInput, signal?: AbortSignal): Promise<string> {
  if (!isAiEnabled) throw new ApiError('AI relay is not configured', 0, '');
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, question: input.question.slice(0, 400) }),
    signal,
  });
  if (!res.ok) {
    const message =
      res.status === 429 ? 'Đã hết lượt hỏi hôm nay, thử lại sau.' : 'Trợ lý AI đang không trả lời được.';
    throw new ApiError(message, res.status, PROXY_URL);
  }
  const body = (await res.json()) as { answer?: unknown };
  if (typeof body.answer !== 'string') throw new ApiError('Phản hồi không hợp lệ.', res.status, PROXY_URL);
  return body.answer;
}
