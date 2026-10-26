import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import Spinner, { PageSpinner } from '../components/Spinner.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [project, setProject] = useState(null);
  const [viewer, setViewer] = useState({ hasLiked: false, isOwner: false, myApplication: null });
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ roleTitle: '', message: '' });
  const [applyError, setApplyError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, commentsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/comments?limit=20`),
      ]);
      setProject(projectRes.data.data);
      setViewer(projectRes.data.viewer);
      setComments(commentsRes.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onLike = async () => {
    if (!user) return navigate('/login');
    // Optimistic update: the like button must feel instant. The server's
    // authoritative count replaces this a moment later, and a failure rolls
    // it back in the catch.
    const previous = { hasLiked: viewer.hasLiked, likes: project.likes };
    setViewer((v) => ({ ...v, hasLiked: !v.hasLiked }));
    setProject((p) => ({
      ...p,
      likes: previous.hasLiked
        ? p.likes.filter((uid) => String(uid) !== String(user._id))
        : [...p.likes, user._id],
    }));

    try {
      const { data } = await api.post(`/projects/${id}/like`);
      setViewer((v) => ({ ...v, hasLiked: data.data.hasLiked }));
      setProject((p) => ({ ...p, likes: new Array(data.data.likeCount).fill('x') }));
    } catch (err) {
      setViewer((v) => ({ ...v, hasLiked: previous.hasLiked }));
      setProject((p) => ({ ...p, likes: previous.likes }));
      setError(err.message);
    }
    return undefined;
  };

  const onComment = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    const text = commentText.trim();
    if (!text) return undefined;

    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${id}/comments`, { text });
      setComments((c) => [data.data, ...c]);
      setProject((p) => ({ ...p, commentCount: (p.commentCount || 0) + 1 }));
      setCommentText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const onDeleteComment = async (commentId) => {
    try {
      await api.delete(`/projects/${id}/comments/${commentId}`);
      setComments((c) => c.filter((item) => item._id !== commentId));
      setProject((p) => ({ ...p, commentCount: Math.max(0, (p.commentCount || 1) - 1) }));
    } catch (err) {
      setError(err.message);
    }
  };

  const onApply = async (e) => {
    e.preventDefault();
    setApplyError('');
    setBusy(true);
    try {
      const { data } = await api.post('/applications', {
        project: id,
        roleTitle: applyForm.roleTitle,
        message: applyForm.message,
      });
      setViewer((v) => ({ ...v, myApplication: data.data }));
      setApplyOpen(false);
    } catch (err) {
      // Shown inside the modal, not on the page behind it.
      setApplyError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    // A plain confirm() is deliberate: a custom confirmation dialog is not
    // worth the time budget, and deleting a project is irreversible.
    // eslint-disable-next-line no-alert, no-restricted-globals
    if (!confirm('Delete this project? Its comments and applications go too.')) return;
    try {
      await api.delete(`/projects/${id}`);
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <PageSpinner label="Loading project" />;
  if (!project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-slate-300">{error || 'That project does not exist.'}</p>
        <Link to="/feed" className="btn-ghost mt-4">
          Back to the feed
        </Link>
      </div>
    );
  }

  const openRoles = (project.rolesNeeded || []).filter((r) => r.filled < r.count);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {project.coverImage?.url && (
        <img
          src={project.coverImage.url}
          alt=""
          className="mb-6 h-48 w-full rounded-xl border border-edge object-cover sm:h-64"
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-edge bg-surface-2 px-2 py-0.5 text-slate-300">
              {project.status}
            </span>
            <span className="text-slate-500">{project.difficulty}</span>
            <span className="text-slate-600">{project.views} views</span>
            {project.aiGenerated && (
              // Shown honestly rather than hidden - the description was drafted
              // by Gemini and the reader deserves to know.
              <span className="rounded-md border border-indigo-900/70 bg-indigo-950/40 px-2 py-0.5 text-indigo-300">
                AI-assisted description
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white sm:text-3xl">{project.title}</h1>
          <p className="mt-2 text-slate-400">{project.summary}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={onLike}
            className={viewer.hasLiked ? 'btn-primary' : 'btn-ghost'}
            aria-pressed={viewer.hasLiked}
          >
            &#9650; {project.likes?.length ?? 0} {viewer.hasLiked ? 'Upvoted' : 'Upvote'}
          </button>

          {viewer.isOwner ? (
            <>
              <Link to={`/projects/${id}/edit`} className="btn-ghost">
                Edit
              </Link>
              <button onClick={onDelete} className="btn-danger">
                Delete
              </button>
            </>
          ) : viewer.myApplication ? (
            // Already applied: show the outcome instead of a button that would
            // only ever return 409.
            <span className="btn-ghost cursor-default">
              Applied &middot; {viewer.myApplication.status}
            </span>
          ) : (
            openRoles.length > 0 && (
              <button
                onClick={() => {
                  if (!user) return navigate('/login');
                  setApplyForm({ roleTitle: openRoles[0].title, message: '' });
                  setApplyOpen(true);
                  return undefined;
                }}
                className="btn-primary"
              >
                Apply to join
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 border-y border-edge py-4">
        <Avatar user={project.owner} size="lg" />
        <div className="min-w-0">
          <Link to={`/u/${project.owner?.username}`} className="font-medium text-white hover:underline">
            {project.owner?.name}
          </Link>
          <p className="text-sm text-slate-500">@{project.owner?.username} &middot; owner</p>
        </div>
        {user && !viewer.isOwner && (
          <Link to={`/chat/${project.owner?._id}`} className="btn-ghost ml-auto">
            Message
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {project.description && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                About this project
              </h2>
              {/* whitespace-pre-line preserves the paragraph breaks the owner
                  typed (and that Gemini returns) without needing a markdown
                  renderer. */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {project.description}
              </p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Discussion ({project.commentCount ?? 0})
            </h2>

            {user ? (
              <form onSubmit={onComment} className="mb-5 flex gap-2">
                <input
                  className="input"
                  placeholder="Ask a question or offer to help..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={1000}
                  aria-label="Write a comment"
                />
                <button className="btn-primary" disabled={busy || !commentText.trim()}>
                  {busy && <Spinner />} Post
                </button>
              </form>
            ) : (
              <p className="mb-5 text-sm text-slate-500">
                <Link to="/login" className="text-brand-soft hover:underline">
                  Log in
                </Link>{' '}
                to join the discussion.
              </p>
            )}

            <ul className="space-y-4">
              {comments.length === 0 && (
                <li className="text-sm text-slate-500">No comments yet. Be the first.</li>
              )}
              {comments.map((comment) => (
                <li key={comment._id} className="flex gap-3">
                  <Avatar user={comment.author} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/u/${comment.author?.username}`}
                        className="text-sm font-medium text-slate-200 hover:underline"
                      >
                        @{comment.author?.username}
                      </Link>
                      <span className="text-xs text-slate-600">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                      {/* Delete shown to the comment author AND the project
                          owner, matching exactly what the API allows. */}
                      {user &&
                        (String(comment.author?._id) === String(user._id) || viewer.isOwner) && (
                          <button
                            onClick={() => onDeleteComment(comment._id)}
                            className="ml-auto text-xs text-slate-600 hover:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-300">{comment.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          {project.techStack?.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tech stack
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {project.techStack.map((tech) => (
                  <li key={tech}>
                    <Link to={`/feed?tech=${encodeURIComponent(tech)}`} className="chip hover:text-white">
                      {tech}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {project.rolesNeeded?.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Roles
              </h2>
              <ul className="space-y-2">
                {project.rolesNeeded.map((role) => (
                  <li key={role._id || role.title} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-300">{role.title}</span>
                    <span
                      className={
                        role.filled >= role.count ? 'chip text-slate-500' : 'chip text-emerald-300'
                      }
                    >
                      {role.filled}/{role.count} filled
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {project.collaborators?.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Collaborators
              </h2>
              <ul className="space-y-2">
                {project.collaborators.map((person) => (
                  <li key={person._id} className="flex items-center gap-2">
                    <Avatar user={person} size="sm" />
                    <Link to={`/u/${person.username}`} className="text-sm text-slate-300 hover:underline">
                      @{person.username}
                    </Link>
                    {user && String(person._id) !== String(user._id) && (
                      <Link to={`/chat/${person._id}`} className="ml-auto text-xs text-brand-soft hover:underline">
                        Chat
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              // noreferrer alongside noopener: without it the linked page can
              // read document.referrer and, in older browsers, window.opener.
              rel="noopener noreferrer"
              className="btn-ghost w-full"
            >
              View repository
            </a>
          )}
        </aside>
      </div>

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply to join">
        <form onSubmit={onApply} className="space-y-4">
          {applyError && (
            <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {applyError}
            </p>
          )}

          <div>
            <label className="label" htmlFor="roleTitle">
              Which role?
            </label>
            <select
              id="roleTitle"
              className="input"
              value={applyForm.roleTitle}
              onChange={(e) => setApplyForm({ ...applyForm, roleTitle: e.target.value })}
              required
            >
              {/* Only roles with space left - applying to a filled role would
                  be rejected server-side anyway. */}
              {openRoles.map((role) => (
                <option key={role.title} value={role.title}>
                  {role.title} ({role.count - role.filled} open)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="applyMessage">
              Why you? (optional)
            </label>
            <textarea
              id="applyMessage"
              className="input min-h-24"
              maxLength={1000}
              placeholder="What you have built before, and how much time you can commit."
              value={applyForm.message}
              onChange={(e) => setApplyForm({ ...applyForm, message: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setApplyOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Spinner />} Send application
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
