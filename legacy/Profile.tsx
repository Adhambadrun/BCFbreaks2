/**
 * Signed-in identity card + the environment tier the server actually granted.
 *
 * Adapted from the requested `src/components/Profile.tsx`. Two differences are
 * deliberate: the data comes from this app's `/api/session` endpoint rather than
 * `useUser()` from `@auth0/nextjs-auth0/client` (there is no Next.js runtime here),
 * and the tier is read from the server response rather than recomputed from the
 * email — so the badge can never disagree with what the gate enforced.
 */
import React from 'react';
import { useApp } from './AppContext';

const FALLBACK_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234f46e5'/%3E%3Cpath d='M50 45c7.5 0 13.64-6.14 13.64-13.64S57.5 17.72 50 17.72s-13.64 6.14-13.64 13.64S42.5 45 50 45zm0 6.82c-9.09 0-27.28 4.56-27.28 13.64v3.41c0 1.88 1.53 3.41 3.41 3.41h47.74c1.88 0 3.41-1.53 3.41-3.41v-3.41c0-9.08-18.19-13.64-27.28-13.64z' fill='%23fff'/%3E%3C/svg%3E`;

export const Profile: React.FC = () => {
  const { session } = useApp();
  if (!session) return null;

  const { user, accessLevel, env } = session;
  const isProdAccess = accessLevel === 'production';

  return (
    <div className="flex flex-col gap-2 w-full text-left">
      <div className="flex items-center gap-3 w-full bg-white/[0.04] rounded-xl p-3 border border-white/10">
        <div className="relative shrink-0">
          <div className="p-[2px] rounded-full bg-gradient-to-br from-cyan to-violet-500">
            <img
              src={user.picture || FALLBACK_AVATAR}
              alt={user.name || 'User'}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover bg-zinc-900 block"
              onError={e => {
                (e.target as HTMLImageElement).src = FALLBACK_AVATAR;
              }}
            />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-inter font-semibold truncate">{user.name}</p>
          <p className="text-zinc-400 text-[11px] font-inter truncate mt-0.5">{user.email}</p>
        </div>
        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20 font-orbitron">
          {user.role}
        </span>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] rounded-lg border border-white/[0.06] text-[11px] font-inter">
        <span className="text-zinc-400">
          Granted Environment Tier <span className="text-zinc-600">· {env}</span>
        </span>
        <span className={`font-semibold ${isProdAccess ? 'text-cyan' : 'text-amber-400'}`}>
          {isProdAccess ? 'Production Access' : 'Preview Access'}
        </span>
      </div>
    </div>
  );
};

export default Profile;
