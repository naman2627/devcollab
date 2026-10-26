/**
 * Shared pagination contract for every list endpoint.
 *
 * WHY one helper: the client has a single `hasMore` check and a single
 * `totalPages` display, so all nine list endpoints must agree on the envelope
 * exactly. Doing it by hand per controller is how `total` ends up meaning
 * "this page" in one place and "all rows" in another.
 *
 * The hard limit cap is the important part: without it, ?limit=100000 is a
 * free denial-of-service against our own database.
 */
export const readPaging = (query, { defaultLimit = 10, maxLimit = 50 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const paginated = ({ page, limit, total, data }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    success: true,
    page,
    total,
    totalPages,
    // Derived server-side so the client never has to recompute it and get the
    // off-by-one wrong on the last page.
    hasMore: page < totalPages,
    data,
  };
};
