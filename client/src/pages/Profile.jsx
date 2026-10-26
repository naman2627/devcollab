import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import Spinner, { PageSpinner } from '../components/Spinner.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function Profile() {
  const { username } = useParams();
  const me = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const setFollowing = useAuthStore((s) => s.setFollowing);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', skills: '', githubUrl: '', avatarUrl: '' });

  const isMe = me && profile && String(me._id) === String(profile._id);
  const amFollowing =
    me && profile && (me.following || []).map(String).includes(String(profile._id));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/users/${username}`);
      setProfile(data.data);
      setForm({
        name: data.data.name,
        bio: data.data.bio || '',
        skills: (data.data.skills || []).join(', '),
        githubUrl: data.data.githubUrl || '',
        avatarUrl: data.data.avatar?.url || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const onFollow = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/users/${profile._id}/follow`);
      // Update both the viewed profile's count and my own following list, so
      // the Following feed tab is correct immediately without a refetch.
      setProfile((p) => ({
        ...p,
        followers: data.data.following
          ? [...p.followers, { _id: me._id, username: me.username, name: me.name }]
          : p.followers.filter((f) => String(f._id) !== String(me._id)),
      }));
      setFollowing(profile._id, data.data.following);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch('/users/me', {
        name: form.name,
        bio: form.bio,
        skills: form.skills,
        githubUrl: form.githubUrl,
        // Only sent as a plain URL - the server ignores it when Cloudinary is
        // configured, where the file endpoint is used instead.
        avatarUrl: form.avatarUrl,
      });
      updateUser(data.data);
      setProfile((p) => ({ ...p, ...data.data }));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onAvatarFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('image', file);
      const { data } = await api.patch('/users/me/avatar', body);
      updateUser(data.data);
      setProfile((p) => ({ ...p, avatar: data.data.avatar }));
    } catch (err) {
      // A 503 here is the "no Cloudinary configured" case, and the message
      // from the server already explains the URL alternative.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSpinner label="Loading profile" />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-slate-300">{error || 'No such user.'}</p>
        <Link to="/feed" className="btn-ghost mt-4">
          Back to the feed
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <Avatar user={profile} size="xl" />
          {isMe && (
            <label className="mt-2 block cursor-pointer text-center text-xs text-brand-soft hover:underline">
              Change
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onAvatarFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white">{profile.name}</h1>
          <p className="text-sm text-slate-500">@{profile.username}</p>
          {profile.bio && <p className="mt-3 text-sm text-slate-300">{profile.bio}</p>}

          {profile.skills?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <li key={skill} className="chip">
                  {skill}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>
              <span className="font-semibold text-white">{profile.followers?.length ?? 0}</span>{' '}
              followers
            </span>
            <span>
              <span className="font-semibold text-white">{profile.following?.length ?? 0}</span>{' '}
              following
            </span>
            <span>
              <span className="font-semibold text-white">{profile.projectCount ?? 0}</span> projects
            </span>
            {profile.githubUrl && (
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-soft hover:underline"
              >
                GitHub
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {isMe ? (
            <button className="btn-ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cancel' : 'Edit profile'}
            </button>
          ) : (
            me && (
              <>
                <button
                  className={amFollowing ? 'btn-ghost' : 'btn-primary'}
                  onClick={onFollow}
                  disabled={busy}
                >
                  {busy && <Spinner />} {amFollowing ? 'Following' : 'Follow'}
                </button>
                <Link to={`/chat/${profile._id}`} className="btn-ghost">
                  Message
                </Link>
              </>
            )
          )}
        </div>
      </header>

      {editing && isMe && (
        <form onSubmit={onSave} className="card mt-4 space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pname">
                Name
              </label>
              <input
                id="pname"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={60}
              />
            </div>
            <div>
              <label className="label" htmlFor="pgithub">
                GitHub URL
              </label>
              <input
                id="pgithub"
                className="input"
                type="url"
                value={form.githubUrl}
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="pbio">
              Bio
            </label>
            <textarea
              id="pbio"
              className="input min-h-20"
              maxLength={300}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-600">{form.bio.length}/300</p>
          </div>

          <div>
            <label className="label" htmlFor="pskills">
              Skills (comma separated)
            </label>
            <input
              id="pskills"
              className="input"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="react, node, mongodb"
            />
          </div>

          <div>
            <label className="label" htmlFor="pavatar">
              Avatar image URL
            </label>
            <input
              id="pavatar"
              className="input"
              type="url"
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              placeholder="https://..."
            />
            <p className="mt-1 text-xs text-slate-600">
              Use this if image uploads are not configured on this server.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy && <Spinner />} Save
            </button>
          </div>
        </form>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {isMe ? 'Your projects' : `Projects by ${profile.name}`}
        </h2>

        {profile.projects?.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            {isMe ? (
              <>
                You have not posted a project yet.{' '}
                <Link to="/projects/new" className="text-brand-soft hover:underline">
                  Post one
                </Link>
                .
              </>
            ) : (
              'No projects yet.'
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.projects.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
