import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-bold text-brand-soft">404</p>
      <h1 className="mt-4 text-xl font-semibold text-white">That page does not exist.</h1>
      <p className="mt-2 text-sm text-slate-400">
        The link may be broken, or the project may have been deleted by its owner.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/feed" className="btn-primary">
          Explore projects
        </Link>
        <Link to="/" className="btn-ghost">
          Go home
        </Link>
      </div>
    </div>
  );
}
