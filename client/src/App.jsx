import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { PageSpinner } from './components/Spinner.jsx';
import { useAuthStore } from './store/authStore.js';
import { useSocketStore } from './store/socketStore.js';

/**
 * Every page is lazy-loaded.
 *
 * WHY: a visitor landing on / should not download the chat page, the project
 * editor and the applications dashboard before anything renders. React.lazy
 * makes Vite emit one chunk per page, so the landing page ships only what it
 * needs and the rest arrives on navigation.
 */
const Landing = lazy(() => import('./pages/Landing.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Feed = lazy(() => import('./pages/Feed.jsx'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.jsx'));
const ProjectForm = lazy(() => import('./pages/ProjectForm.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Applications = lazy(() => import('./pages/Applications.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);

  // Rehydrate the session once, on mount. This is what makes a hard refresh
  // keep you logged in: the cookie is still there, we just have to ask who it
  // belongs to.
  useEffect(() => {
    init();
  }, [init]);

  // Open the socket only once we know who the user is - the server rejects an
  // unauthenticated handshake, so connecting earlier would just fail and retry.
  useEffect(() => {
    if (user) connect();
    return undefined;
  }, [user, connect]);

  // Close it when the tab goes away, so the server's presence map does not
  // keep a dead socket id for this user.
  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* One Suspense boundary for all lazy routes - a per-route boundary
            would mean ten copies of the same fallback. */}
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/u/:username" element={<Profile />} />

            {/* /projects/new is declared BEFORE /projects/:id/edit but after
                /projects/:id - React Router v6 ranks static segments above
                dynamic ones, so "new" is never read as an id. */}
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/edit"
              element={
                <ProtectedRoute>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications"
              element={
                <ProtectedRoute>
                  <Applications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:userId"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="border-t border-edge px-4 py-6 text-center text-xs text-slate-600">
        DevCollab - MERN end-term project. Built with MongoDB, Express, React and Node.
      </footer>
    </div>
  );
}
