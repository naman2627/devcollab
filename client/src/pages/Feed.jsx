import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import ProjectCard from '../components/ProjectCard.jsx';
import Pagination from '../components/Pagination.jsx';
import { PageSpinner } from '../components/Spinner.jsx';
import { useAuthStore } from '../store/authStore.js';

const STATUSES = ['', 'recruiting', 'in-progress', 'completed'];
const SORTS = [
  ['new', 'Newest'],
  ['popular', 'Most active'],
  ['oldest', 'Oldest'],
];

export default function Feed() {
  const user = useAuthStore((s) => s.user);

  /**
   * Filter state lives in the URL, not in useState.
   *
   * WHY: it makes every filtered view shareable and bookmarkable, Back works
   * the way a user expects, and the landing page can link straight to
   * /feed?tech=react. Mirroring it into component state would mean keeping two
   * sources of truth in sync.
   */
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const tab = params.get('feed') === 'following' ? 'following' : 'all';
  const tech = params.get('tech') || '';
  const status = params.get('status') || '';
  const sort = params.get('sort') || 'new';
  const q = params.get('q') || '';

  // Separate state for the text input so typing does not re-run the query on
  // every keystroke; the URL only updates on submit.
  const [search, setSearch] = useState(q);
  const [result, setResult] = useState({ data: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Any filter change resets to page 1 - staying on page 4 of a different
    // result set shows an empty grid and looks broken.
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '9', sort });
      if (tech) query.set('tech', tech);
      if (status) query.set('status', status);
      if (q) query.set('q', q);
      if (tab === 'following') query.set('feed', 'following');

      const { data } = await api.get(`/projects?${query}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, sort, tech, status, q, tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Explore projects</h1>
          <p className="mt-1 text-sm text-slate-400">
            {result.total} {result.total === 1 ? 'project' : 'projects'} looking for collaborators.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', search.trim());
          }}
          className="flex gap-2"
        >
          <input
            className="input w-48 sm:w-64"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search projects"
          />
          <button className="btn-ghost" type="submit">
            Search
          </button>
        </form>
      </div>

      {/* Tabs. The Following tab is hidden when logged out, because the
          endpoint requires auth and a 401 is not a useful thing to show. */}
      <div className="mb-4 flex gap-1 border-b border-edge">
        {[['all', 'All projects'], ...(user ? [['following', 'Following']] : [])].map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setParam('feed', key === 'following' ? 'following' : '')}
              className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
                tab === key
                  ? 'border-brand text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s || 'any'} value={s}>
              {s ? s : 'Any status'}
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => setParam('sort', e.target.value)}
          aria-label="Sort order"
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          className="input w-auto"
          placeholder="Filter by tech, e.g. react"
          defaultValue={tech}
          // onBlur rather than onChange: firing a request per keystroke here
          // would be nine requests to type "react".
          onBlur={(e) => setParam('tech', e.target.value.trim().toLowerCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setParam('tech', e.currentTarget.value.trim().toLowerCase());
          }}
          aria-label="Filter by technology"
        />

        {(tech || status || q || sort !== 'new') && (
          <button
            className="text-xs text-slate-500 underline hover:text-white"
            onClick={() => {
              setSearch('');
              // Keep the tab, drop everything else.
              setParams(tab === 'following' ? { feed: 'following' } : {});
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <PageSpinner label="Loading projects" />
      ) : error ? (
        <p role="alert" className="card p-6 text-center text-sm text-red-300">
          {error}
        </p>
      ) : result.data.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-300">No projects match that.</p>
          <p className="mt-1 text-sm text-slate-500">
            {tab === 'following'
              ? 'Follow a few developers and their projects will show up here.'
              : 'Try clearing the filters, or post the project yourself.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        onChange={(next) => {
          setParam('page', String(next));
          // Jump back to the top: paginating and landing mid-grid is
          // disorienting on a long page.
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
