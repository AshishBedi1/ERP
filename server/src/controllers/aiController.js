const OpenAI = require('openai');

const MAX_INPUT_CHARS = 10000;

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) return null;
  return new OpenAI({ apiKey: key.trim() });
}

/**
 * POST /api/ai/refine-plan
 * Improves grammar and professional tone for today's plan text (employee only).
 */
exports.refinePlanText = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized.' });
  }

  const client = getClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'AI refinement is not configured. Set OPENAI_API_KEY on the server.',
    });
  }

  const raw = typeof req.body.text === 'string' ? req.body.text : '';
  const text = raw.trim();

  if (!text.length) {
    return res.status(400).json({ success: false, message: 'Enter some text to refine.' });
  }

  if (raw.length > MAX_INPUT_CHARS) {
    return res.status(400).json({
      success: false,
      message: `Text must be at most ${MAX_INPUT_CHARS} characters.`,
    });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const system = `You improve workplace writing. Fix grammar and spelling, improve clarity, and use a professional, concise tone suitable for a daily work plan shared with a manager. Preserve meaning and intent. Keep lists as lists; do not invent tasks or facts. Respond with only the revised text, no quotes, no preamble or explanation.`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      temperature: 0.35,
      max_tokens: Math.min(4096, Math.ceil(text.length * 1.5) + 500),
    });

    const out =
      typeof completion.choices?.[0]?.message?.content === 'string'
        ? completion.choices[0].message.content.trim()
        : '';

    if (!out.length) {
      return res.status(502).json({ success: false, message: 'AI returned empty text. Try again.' });
    }

    if (out.length > MAX_INPUT_CHARS) {
      return res.json({ success: true, text: out.slice(0, MAX_INPUT_CHARS) });
    }

    return res.json({ success: true, text: out });
  } catch (err) {
    const msg =
      err?.error?.message ||
      err?.message ||
      (typeof err?.response?.data?.error?.message === 'string' ? err.response.data.error.message : null) ||
      'AI request failed.';
    console.error('refinePlanText OpenAI error:', err?.message || err);
    return res.status(502).json({ success: false, message: String(msg) });
  }
};

/**
 * POST /api/ai/refine-note
 * Improves grammar and clarity for Important notes body text (employer + employee).
 */
exports.refineNoteText = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized.' });
  }

  const client = getClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'AI refinement is not configured. Set OPENAI_API_KEY on the server.',
    });
  }

  const raw = typeof req.body.text === 'string' ? req.body.text : '';
  const text = raw.trim();

  if (!text.length) {
    return res.status(400).json({ success: false, message: 'Enter some text to refine.' });
  }

  if (raw.length > MAX_INPUT_CHARS) {
    return res.status(400).json({
      success: false,
      message: `Text must be at most ${MAX_INPUT_CHARS} characters.`,
    });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const system = `You improve internal company notes and reference material. Fix grammar and spelling, improve clarity and structure, and use a professional, readable tone suitable for colleagues. Preserve meaning and intent; do not invent facts, policies, or numbers. Keep lists and line breaks where helpful. Respond with only the revised text, no quotes, no preamble or explanation.`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      temperature: 0.35,
      max_tokens: Math.min(4096, Math.ceil(text.length * 1.5) + 500),
    });

    const out =
      typeof completion.choices?.[0]?.message?.content === 'string'
        ? completion.choices[0].message.content.trim()
        : '';

    if (!out.length) {
      return res.status(502).json({ success: false, message: 'AI returned empty text. Try again.' });
    }

    if (out.length > MAX_INPUT_CHARS) {
      return res.json({ success: true, text: out.slice(0, MAX_INPUT_CHARS) });
    }

    return res.json({ success: true, text: out });
  } catch (err) {
    const msg =
      err?.error?.message ||
      err?.message ||
      (typeof err?.response?.data?.error?.message === 'string' ? err.response.data.error.message : null) ||
      'AI request failed.';
    console.error('refineNoteText OpenAI error:', err?.message || err);
    return res.status(502).json({ success: false, message: String(msg) });
  }
};
