import ApiError from '../utils/ApiError.js';

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Gemini is OPTIONAL, exactly like Cloudinary. The client calls
// GET /api/ai/status, and hides the "Draft with AI" button when this is false.
export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

/**
 * Ask Gemini to write a project description.
 *
 * WHY raw fetch instead of the @google/generative-ai SDK: one HTTP call does
 * not justify another dependency in the deploy bundle, and the REST shape is
 * stable. Node 18+ ships fetch globally, so there is nothing to install.
 */
export async function draftDescription({ title, techStack = [], notes = '' }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // 503, not 500: the feature is unconfigured, the server is healthy.
    throw new ApiError(503, 'AI drafting is not configured on this server.');
  }

  const prompt = [
    'You are helping a developer write the description for a side project they are recruiting collaborators for.',
    'Write 2 to 3 short paragraphs in plain prose, second person plural ("we"), no headings, no markdown, no emoji.',
    'Cover: what the project does, why it is interesting to build, and what a collaborator would actually work on.',
    'Do not invent funding, users, or launch dates.',
    '',
    `Project title: ${title}`,
    techStack.length ? `Tech stack: ${techStack.join(', ')}` : '',
    notes ? `Extra notes from the owner: ${notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // AbortController + 20s budget. WHY: a hung upstream call would otherwise
  // hold an Express worker and the browser spinner indefinitely. fetch has no
  // built-in timeout, so this is the only way to bound it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[gemini] upstream error', res.status, body.slice(0, 400));
      // 502: we are a healthy gateway reporting a bad upstream response. The
      // user never sees Google's raw error body.
      throw new ApiError(502, 'The AI service rejected that request. Try again in a moment.');
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();

    if (!text) {
      // A safety block or an empty candidate still returns HTTP 200, so an
      // explicit emptiness check is required here.
      throw new ApiError(502, 'The AI service returned an empty description.');
    }

    return text;
  } catch (err) {
    // AbortError is the only way we learn the 20s budget blew.
    if (err.name === 'AbortError') {
      throw new ApiError(504, 'The AI service took too long to respond.');
    }
    throw err;
  } finally {
    clearTimeout(timer); // never leak the timer, success or failure
  }
}
