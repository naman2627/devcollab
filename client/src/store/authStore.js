import { create } from 'zustand';
import api from '../api/client.js';

/**
 * Auth state.
 *
 * WHY Zustand and not Context: the auth object is read by the navbar, every
 * protected route, the like buttons and the chat. With Context, any change to
 * it re-renders the entire subtree under the provider. Zustand subscribes each
 * component to just the slice it selects, so logging in does not re-render the
 * whole feed.
 *
 * Note there is no token in here. The JWT lives in an httpOnly cookie that
 * JavaScript cannot read, which is the point - `user` is only a cache of who
 * the server says we are.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  // Starts true so the first paint shows a spinner rather than flashing the
  // login page at an already-authenticated user on a hard refresh.
  loading: true,

  /** Called once on app mount: asks the server who this cookie belongs to. */
  init: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, loading: false });
    } catch {
      // A 401 here is the normal case for a visitor, not an error worth showing.
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    set({ user: data.data });
    return data.data;
  },

  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    set({ user: data.data });
    return data.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Clear locally even if the request failed - the user asked to be logged
      // out, and leaving them "logged in" because of a network blip is worse
      // than a stale cookie the server will reject anyway.
      set({ user: null });
    }
  },

  updateUser: (partial) => set({ user: { ...get().user, ...partial } }),

  /** Keeps the follow button honest without refetching the whole user. */
  setFollowing: (targetId, following) => {
    const user = get().user;
    if (!user) return;
    const list = following
      ? [...new Set([...user.following.map(String), String(targetId)])]
      : user.following.map(String).filter((id) => id !== String(targetId));
    set({ user: { ...user, following: list } });
  },
}));
