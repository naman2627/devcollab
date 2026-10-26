import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import ProjectCard from '../components/ProjectCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function Landing() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Both requests fire together: they are independent, so awaiting them in
    // sequence would make the landing page twice as slow for no reason.
    Promise.all([api.get('/projects/stats'), api.get('/projects?limit=3&sort=new')])
      .then(([statsRes, recentRes]) => {
        setStats(statsRes.data.data);
        setRecent(recentRes.data.data);
      })
      // The landing page is decorative - if stats fail we still show the hero
      // rather than an error screen.
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 text-center sm:py-24">
        <p className="mb-4 inline-block rounded-full border border-edge bg-surface px-3 py-1 text-xs text-slate-400">
          For developers with half-built side projects
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Find people who will actually <span className="text-brand-soft">ship it</span> with you.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 sm:text-lg">
          Post the project, list the roles you need, and let developers apply. Accept the ones you
          want and get a private chat with your new team. No recruiters, no job boards.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/feed" className="btn-primary px-5 py-2.5">
            Explore projects
          </Link>
          {user ? (
            <Link to="/projects/new" className="btn-ghost px-5 py-2.5">
              Post your project
            </Link>
          ) : (
            <Link to="/register" className="btn-ghost px-5 py-2.5">
              Create an account
            </Link>
          )}
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-6" />
        </div>
      ) : (
        stats && (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Projects', stats.totals.projects],
                ['Upvotes', stats.totals.likes],
                ['Comments', stats.totals.comments],
                ['Views', stats.totals.views],
              ].map(([label, value]) => (
                <div key={label} className="card p-4 text-center">
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{label}</p>
                </div>
              ))}
            </section>

            {stats.topTech.length > 0 && (
              <section className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Most wanted skills
                </span>
                {stats.topTech.map((tech) => (
                  <Link
                    key={tech._id}
                    to={`/feed?tech=${encodeURIComponent(tech._id)}`}
                    className="chip hover:text-white"
                  >
                    {tech._id} <span className="ml-1 text-slate-600">{tech.count}</span>
                  </Link>
                ))}
              </section>
            )}
          </>
        )
      )}

      {recent.length > 0 && (
        <section className="py-14">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-semibold text-white">Recently posted</h2>
            <Link to="/feed" className="text-sm text-brand-soft hover:underline">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 border-t border-edge py-14 sm:grid-cols-3">
        {[
          ['1. Post it', 'Describe the project and list the roles you need filled.'],
          ['2. Review applicants', 'See who applied, what they have built, and accept the right ones.'],
          ['3. Build together', 'Accepted collaborators get a private real-time chat with you.'],
        ].map(([title, body]) => (
          <div key={title} className="card p-5">
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-400">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
