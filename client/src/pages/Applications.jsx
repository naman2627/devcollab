import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import Pagination from '../components/Pagination.jsx';
import Spinner, { PageSpinner } from '../components/Spinner.jsx';

const STATUS_STYLE = {
  pending: 'border-amber-900/70 bg-amber-950/40 text-amber-300',
  accepted: 'border-emerald-900/70 bg-emerald-950/40 text-emerald-300',
  rejected: 'border-red-900/70 bg-red-950/40 text-red-300',
};

export default function Applications() {
  const [tab, setTab] = useState('received');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Keyed by application id, so only the row being decided shows a spinner
  // rather than disabling the whole list.
  const [deciding, setDeciding] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/applications/${tab}?page=${page}&limit=10`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (applicationId, status) => {
    setDeciding((d) => ({ ...d, [applicationId]: true }));
    setError('');
    try {
      const { data } = await api.patch(`/applications/${applicationId}`, { status });
      // Patch the single row in place instead of refetching the page - the
      // list order does not change, so a refetch would only cause a flicker.
      setResult((r) => ({
        ...r,
        data: r.data.map((a) => (a._id === applicationId ? { ...a, status: data.data.status } : a)),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeciding((d) => ({ ...d, [applicationId]: false }));
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Applications</h1>
      <p className="mt-1 text-sm text-slate-400">
        Decide who joins your projects, and track the ones you have applied to.
      </p>

      <div className="mb-6 mt-5 flex gap-1 border-b border-edge">
        {[
          ['received', 'Received'],
          ['sent', 'Sent'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setPage(1); // switching tabs must not keep page 3 of the other list
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === key
                ? 'border-brand text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <PageSpinner label="Loading applications" />
      ) : result.data.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-300">
            {tab === 'received' ? 'No applications yet.' : 'You have not applied to anything yet.'}
          </p>
          <Link to="/feed" className="btn-ghost mt-4">
            Browse projects
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {result.data.map((application) => (
            <li key={application._id} className="card p-4">
              {tab === 'received' ? (
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar user={application.applicant} size="lg" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/u/${application.applicant?.username}`}
                        className="font-medium text-white hover:underline"
                      >
                        {application.applicant?.name}
                      </Link>
                      <span className="text-xs text-slate-500">
                        @{application.applicant?.username}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] ${STATUS_STYLE[application.status]}`}
                      >
                        {application.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-400">
                      Applied for <span className="text-slate-200">{application.roleTitle}</span> on{' '}
                      <Link
                        to={`/projects/${application.project?._id}`}
                        className="text-brand-soft hover:underline"
                      >
                        {application.project?.title}
                      </Link>
                    </p>

                    {application.message && (
                      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-slate-300">
                        {application.message}
                      </p>
                    )}

                    {application.applicant?.skills?.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {application.applicant.skills.map((skill) => (
                          <li key={skill} className="chip">
                            {skill}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Buttons only while pending: the API refuses a second
                      decision with a 409, so showing them afterwards would
                      only produce an error. */}
                  {application.status === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="btn-primary"
                        disabled={deciding[application._id]}
                        onClick={() => decide(application._id, 'accepted')}
                      >
                        {deciding[application._id] && <Spinner />} Accept
                      </button>
                      <button
                        className="btn-danger"
                        disabled={deciding[application._id]}
                        onClick={() => decide(application._id, 'rejected')}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {application.status === 'accepted' && (
                    <Link to={`/chat/${application.applicant?._id}`} className="btn-ghost shrink-0">
                      Open chat
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/projects/${application.project?._id}`}
                        className="font-medium text-white hover:underline"
                      >
                        {application.project?.title}
                      </Link>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] ${STATUS_STYLE[application.status]}`}
                      >
                        {application.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      You applied for{' '}
                      <span className="text-slate-200">{application.roleTitle}</span>
                      {application.project?.owner && (
                        <>
                          {' '}
                          &middot; owner{' '}
                          <Link
                            to={`/u/${application.project.owner.username}`}
                            className="text-brand-soft hover:underline"
                          >
                            @{application.project.owner.username}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>

                  {application.status === 'accepted' && application.project?.owner && (
                    <Link
                      to={`/chat/${application.project.owner._id}`}
                      className="btn-ghost shrink-0"
                    >
                      Message owner
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        onChange={setPage}
      />
    </div>
  );
}
