import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';

const STATUS_STYLES = {
  recruiting: 'bg-emerald-950/60 text-emerald-300 border-emerald-900/70',
  'in-progress': 'bg-amber-950/60 text-amber-300 border-amber-900/70',
  completed: 'bg-slate-800/60 text-slate-400 border-slate-700',
};

const DIFFICULTY_LABEL = {
  beginner: 'Beginner friendly',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function ProjectCard({ project }) {
  // Roles still open, computed from count - filled. Shown on the card because
  // "2 roles open" is the single thing that decides whether someone clicks.
  const openRoles = (project.rolesNeeded || []).reduce(
    (sum, role) => sum + Math.max(0, role.count - role.filled),
    0
  );

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:border-slate-600">
      {project.coverImage?.url && (
        <Link to={`/projects/${project._id}`} className="block h-36 overflow-hidden bg-surface-2">
          <img
            src={project.coverImage.url}
            alt=""
            // loading=lazy: a 9-card feed page would otherwise fetch nine
            // images before first paint.
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        </Link>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[project.status]}`}
          >
            {project.status}
          </span>
          <span className="text-[11px] text-slate-500">{DIFFICULTY_LABEL[project.difficulty]}</span>
        </div>

        <div>
          <Link
            to={`/projects/${project._id}`}
            className="line-clamp-2 font-semibold text-white hover:text-brand-soft"
          >
            {project.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{project.summary}</p>
        </div>

        {project.techStack?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {/* Cap at four tags so one project with twelve tags cannot blow up
                the card height and break the grid alignment. */}
            {project.techStack.slice(0, 4).map((tech) => (
              <li key={tech} className="chip">
                {tech}
              </li>
            ))}
            {project.techStack.length > 4 && (
              <li className="chip">+{project.techStack.length - 4}</li>
            )}
          </ul>
        )}

        {/* mt-auto pins the footer to the bottom, so cards in a row line up
            even when their titles wrap to different heights. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-edge pt-3">
          <Link
            to={`/u/${project.owner?.username}`}
            className="flex min-w-0 items-center gap-2 text-xs text-slate-400 hover:text-white"
          >
            <Avatar user={project.owner} size="sm" />
            <span className="truncate">@{project.owner?.username}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
            <span title="Upvotes">&#9650; {project.likes?.length ?? 0}</span>
            <span title="Comments">&#128172; {project.commentCount ?? 0}</span>
          </div>
        </div>

        {openRoles > 0 && (
          <p className="text-xs font-medium text-brand-soft">
            {openRoles} {openRoles === 1 ? 'role' : 'roles'} open
          </p>
        )}
      </div>
    </article>
  );
}
