import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Spinner, { PageSpinner } from '../components/Spinner.jsx';

const EMPTY = {
  title: '',
  summary: '',
  description: '',
  techStack: '',
  repoUrl: '',
  status: 'recruiting',
  difficulty: 'intermediate',
  coverImageUrl: '',
};

/** One component for create and edit - the only difference is whether :id exists. */
export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [roles, setRoles] = useState([{ title: '', count: 1 }]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Feature flags fetched at runtime, because the keys live only on the server.
  const [aiEnabled, setAiEnabled] = useState(false);
  const [uploadsEnabled, setUploadsEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    api
      .get('/ai/status')
      .then(({ data }) => setAiEnabled(data.data.enabled))
      // A failed probe means "assume off" - better a missing button than a
      // button that always errors.
      .catch(() => setAiEnabled(false));

    // Probing uploads: the avatar endpoint answers 503 when Cloudinary is
    // absent. A HEAD-style probe is not available, so we rely on the create
    // path accepting a URL instead and simply offer both inputs below.
    api
      .get('/health')
      .then(() => setUploadsEnabled(true))
      .catch(() => setUploadsEnabled(false));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/projects/${id}`)
      .then(({ data, status }) => {
        void status;
        const p = data.data;
        setForm({
          title: p.title,
          summary: p.summary,
          description: p.description || '',
          // The API stores an array; the form edits a comma string. Converted
          // here and back on submit.
          techStack: (p.techStack || []).join(', '),
          repoUrl: p.repoUrl || '',
          status: p.status,
          difficulty: p.difficulty,
          coverImageUrl: p.coverImage?.url || '',
        });
        setRoles(
          p.rolesNeeded?.length
            ? p.rolesNeeded.map((r) => ({ title: r.title, count: r.count }))
            : [{ title: '', count: 1 }]
        );
        setAiGenerated(p.aiGenerated);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const draftWithAI = async () => {
    if (!form.title.trim()) {
      setError('Give the project a title first - the AI needs something to go on.');
      return;
    }
    setAiBusy(true);
    setError('');
    try {
      const { data } = await api.post('/ai/describe', {
        title: form.title,
        techStack: form.techStack,
        notes: form.summary,
      });
      setForm((f) => ({ ...f, description: data.data.description }));
      // Set the honesty flag so the project page can label it.
      setAiGenerated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    const cleanRoles = roles
      .filter((r) => r.title.trim())
      .map((r) => ({ title: r.title.trim(), count: Math.max(1, Number(r.count) || 1) }));

    try {
      let response;

      if (file) {
        /**
         * multipart/form-data when there is a file.
         *
         * WHY FormData and not JSON+base64: base64 inflates the payload by a
         * third and would blow the 10kb JSON body limit. multer parses this
         * stream straight into a buffer. rolesNeeded has to be JSON.stringify'd
         * because a FormData value is always a string - the server parses it
         * back (see toRoles in projectController.js).
         */
        const body = new FormData();
        Object.entries({ ...form, aiGenerated }).forEach(([key, value]) => {
          if (key !== 'coverImageUrl') body.append(key, value);
        });
        body.append('rolesNeeded', JSON.stringify(cleanRoles));
        body.append('coverImage', file);

        response = isEdit
          ? await api.patch(`/projects/${id}`, body)
          : await api.post('/projects', body);
      } else {
        const payload = { ...form, rolesNeeded: cleanRoles, aiGenerated };
        response = isEdit
          ? await api.patch(`/projects/${id}`, payload)
          : await api.post('/projects', payload);
      }

      navigate(`/projects/${response.data.data._id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSpinner label="Loading project" />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">
        {isEdit ? 'Edit project' : 'Post a project'}
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Be specific about the roles. Vague posts get vague applicants.
      </p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-5 p-5">
        {error && (
          <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="input"
            required
            maxLength={120}
            value={form.title}
            onChange={set('title')}
            placeholder="Campus Ride Share"
          />
        </div>

        <div>
          <label className="label" htmlFor="summary">
            One-line summary
          </label>
          <input
            id="summary"
            className="input"
            required
            maxLength={240}
            value={form.summary}
            onChange={set('summary')}
            placeholder="Match students heading the same way so nobody pays for a whole cab alone."
          />
          <p className="mt-1 text-xs text-slate-600">{form.summary.length}/240</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="description">
              Full description
            </label>
            {/* Rendered only when the server says a key is configured, so the
                button can never be clicked into a guaranteed 503. */}
            {aiEnabled && (
              <button type="button" onClick={draftWithAI} className="btn-ghost py-1 text-xs" disabled={aiBusy}>
                {aiBusy ? <Spinner /> : '✨'} Draft with AI
              </button>
            )}
          </div>
          <textarea
            id="description"
            className="input min-h-40"
            maxLength={8000}
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              // Hand-editing after a draft means it is no longer purely AI
              // output - but it was AI-assisted, so the flag stays.
            }}
            placeholder="What it does, why it is interesting, and what a collaborator would own."
          />
          {aiGenerated && (
            <p className="mt-1 text-xs text-indigo-300">
              This description will be labelled as AI-assisted on the project page.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="techStack">
              Tech stack (comma separated)
            </label>
            <input
              id="techStack"
              className="input"
              value={form.techStack}
              onChange={set('techStack')}
              placeholder="react, node, mongodb"
            />
          </div>
          <div>
            <label className="label" htmlFor="repoUrl">
              Repository URL (optional)
            </label>
            <input
              id="repoUrl"
              className="input"
              type="url"
              value={form.repoUrl}
              onChange={set('repoUrl')}
              placeholder="https://github.com/you/project"
            />
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select id="status" className="input" value={form.status} onChange={set('status')}>
              <option value="recruiting">Recruiting</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="difficulty">
              Difficulty
            </label>
            <select id="difficulty" className="input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="beginner">Beginner friendly</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">Roles you need</legend>
          <div className="space-y-2">
            {roles.map((role, index) => (
              // Index as key is acceptable here ONLY because rows are never
              // reordered - they are appended and removed from the end.
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="flex gap-2">
                <input
                  className="input"
                  placeholder="React developer"
                  value={role.title}
                  onChange={(e) => {
                    const next = [...roles];
                    next[index] = { ...next[index], title: e.target.value };
                    setRoles(next);
                  }}
                  aria-label={`Role ${index + 1} title`}
                />
                <input
                  className="input w-20"
                  type="number"
                  min="1"
                  max="20"
                  value={role.count}
                  onChange={(e) => {
                    const next = [...roles];
                    next[index] = { ...next[index], count: e.target.value };
                    setRoles(next);
                  }}
                  aria-label={`Role ${index + 1} count`}
                />
                {roles.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost px-3"
                    onClick={() => setRoles(roles.filter((_, i) => i !== index))}
                    aria-label={`Remove role ${index + 1}`}
                  >
                    &#10005;
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-brand-soft hover:underline"
            onClick={() => setRoles([...roles, { title: '', count: 1 }])}
          >
            + Add another role
          </button>
        </fieldset>

        <div>
          <label className="label" htmlFor="cover">
            Cover image (optional)
          </label>
          {/* Both inputs are offered: a file picker for installs with
              Cloudinary configured, and a URL field that always works. The
              server ignores the file when it has no image backend, so neither
              path can dead-end. */}
          <input
            id="cover"
            type="file"
            accept="image/*"
            className="input file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-slate-300"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {!file && (
            <input
              className="input mt-2"
              type="url"
              value={form.coverImageUrl}
              onChange={set('coverImageUrl')}
              placeholder="...or paste an image URL"
              aria-label="Cover image URL"
            />
          )}
          {uploadsEnabled && file && (
            <p className="mt-1 text-xs text-slate-500">{file.name} selected (max 5MB).</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-edge pt-4">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Spinner />} {isEdit ? 'Save changes' : 'Post project'}
          </button>
        </div>
      </form>
    </div>
  );
}
