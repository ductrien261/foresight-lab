// Foresight Lab AI relay (Cloudflare Worker).
// Keeps the API key off the static site, limits each visitor's questions per day,
// and only forwards the aggregated numbers the page sends. It stores nothing else.
//
// Secrets / vars (wrangler): ANTHROPIC_API_KEY (secret), ALLOWED_ORIGIN, DAILY_LIMIT (default 20)
// Optional KV binding for the daily limit: LIMITS

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM = `Bạn là trợ lý giải thích số liệu trong Foresight Lab, một công cụ dự báo nhu cầu năng lượng.
Quy tắc:
- Chỉ dùng số liệu trong khối CONTEXT. Không tự đưa ra con số nào khác, không ước tính thêm.
- Nếu câu hỏi cần số liệu không có trong CONTEXT, nói rõ "Ứng dụng không có số liệu này".
- Không khuyên đầu tư hay ra quyết định thay người dùng; chỉ giải thích.
- Trả lời tiếng Việt, tối đa 5 câu, giọng trung tính.`;

function cors(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': origin === allowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function overLimit(env, ip) {
  if (!env.LIMITS) return false;
  const key = `${new Date().toISOString().slice(0, 10)}:${ip}`;
  const used = Number((await env.LIMITS.get(key)) ?? 0);
  if (used >= Number(env.DAILY_LIMIT ?? 20)) return true;
  await env.LIMITS.put(key, String(used + 1), { expirationTtl: 86400 });
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const headers = cors(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST' || origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403, headers });
    if (await overLimit(env, request.headers.get('CF-Connecting-IP') ?? 'unknown')) {
      return new Response('Too many requests', { status: 429, headers });
    }

    const body = await request.json().catch(() => null);
    const question = String(body?.question ?? '').slice(0, 400);
    const context = JSON.stringify(body?.context ?? {}).slice(0, 12000);
    if (!question) return new Response('Bad request', { status: 400, headers });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `CHỦ ĐỀ: ${String(body?.topic ?? '').slice(0, 200)}\nCONTEXT (JSON): ${context}\n\nCÂU HỎI: ${question}`,
          },
        ],
      }),
    });
    if (!res.ok) return new Response('Upstream error', { status: 502, headers });
    const data = await res.json();
    const answer = (data.content ?? []).map((c) => c.text ?? '').join('').trim();
    return new Response(JSON.stringify({ answer }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  },
};
