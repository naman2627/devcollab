import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { draftDescription, geminiEnabled } from '../config/gemini.js';

/**
 * GET /api/ai/status - feature detection for the client.
 *
 * WHY an endpoint instead of baking it into the bundle: the key lives only in
 * the server environment, and the SAME build is deployed everywhere. The
 * client asks at runtime and hides the "Draft with AI" button when the answer
 * is false, so no user ever clicks a button that can only fail.
 */
export const aiStatus = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { enabled: geminiEnabled() } });
});

// POST /api/ai/describe  { title, techStack, notes }
export const describe = asyncHandler(async (req, res) => {
  const { title, techStack, notes } = req.body;
  if (!title || !String(title).trim()) {
    throw new ApiError(400, 'Give the project a title first - the AI needs something to go on.');
  }

  const description = await draftDescription({
    title: String(title).trim(),
    techStack: Array.isArray(techStack)
      ? techStack
      : String(techStack || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    notes: String(notes || '').trim(),
  });

  // aiGenerated is returned so the client can set the honesty flag when it
  // saves the project, rather than the server guessing later.
  res.json({ success: true, data: { description, aiGenerated: true } });
});
