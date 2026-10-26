const SIZES = {
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
};

/**
 * Avatar with an initials fallback.
 *
 * WHY a fallback at all: Cloudinary is optional, so most users in a fresh
 * install have no avatar URL. A broken <img> on every row would look like a
 * bug, whereas initials look deliberate.
 */
export default function Avatar({ user, size = 'md', className = '' }) {
  const initials = (user?.name || user?.username || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const base = `${SIZES[size]} shrink-0 rounded-full object-cover ${className}`;

  if (user?.avatar?.url) {
    return (
      <img
        src={user.avatar.url}
        alt={user.name || user.username}
        className={`${base} border border-edge`}
        // Hide a dead URL rather than showing the browser's broken-image icon.
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <span
      className={`${base} flex items-center justify-center bg-gradient-to-br from-brand/80 to-indigo-900 font-semibold text-white`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
