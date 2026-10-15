import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { store } from './store';

/** 订阅一个带 subscribe 的对象，变化时重新渲染 */
export function useSubscribe(src: { subscribe(l: () => void): () => void } | null | undefined) {
  const [, setN] = useState(0);
  useEffect(() => (src ? src.subscribe(() => setN(n => n + 1)) : undefined), [src]);
}

export function useStore() {
  useSubscribe(store);
  return store.get();
}

/** 元素尺寸 */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** 视口方向：宽 > 高 视为横屏 */
export function useLandscape() {
  const get = () => window.innerWidth > window.innerHeight;
  const [land, setLand] = useState(get);
  useEffect(() => {
    const on = () => setLand(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return land;
}

/** deadline 存在时每 250ms 刷新一次剩余秒数 */
export function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
}
