import { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

import { AvatarArt, BOT_AVATAR, DEFAULT_AVATAR } from './avatars';

/** 座位头像：电脑用固定头像，玩家用建角色时选的头像 */
export function Avatar({ strategy, avatar, size, me }: { strategy?: string | null; avatar?: string; size: number; me?: boolean }) {
  const id = avatar || (strategy && BOT_AVATAR[strategy]) || DEFAULT_AVATAR;
  return <span class={'avatar' + (me ? ' is-me' : '')} style={{ width: size + 'px', height: size + 'px' }}><AvatarArt id={id} size={size} /></span>;
}

const ICONS: Record<string, string> = {
  chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  help: 'M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6M12 16.8v.2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  back: 'M15 5l-7 7 7 7',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'
};

export function Icon({ name, size = 24 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" class="icon">
      <path d={ICONS[name]} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** 底部弹出面板；点遮罩或按 Esc 关闭 */
export function Sheet({ children, onClose, title }: { children: ComponentChildren; onClose(): void; title?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div class="sheet-wrap" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        {title && <h2 class="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
