/*
 * 旧版系统 WebView 兼容（安卓 9 出厂 Chrome 66，Chrome 84 之前不支持弹性布局的 gap）。
 * 检测到不支持时，按各容器计算出的 row-gap / column-gap 给子元素补外边距；支持时什么都不做。
 */
function supportsFlexGap(): boolean {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
  el.appendChild(document.createElement('div'));
  el.appendChild(document.createElement('div'));
  document.body.appendChild(el);
  const ok = el.scrollHeight === 1;
  el.remove();
  return ok;
}

function applyGaps(root: HTMLElement): void {
  const all = root.querySelectorAll<HTMLElement>('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const cs = getComputedStyle(el);
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue;
    const rg = parseFloat(cs.rowGap) || 0, cg = parseFloat(cs.columnGap) || 0;
    if (!rg && !cg) continue;
    const dir = cs.flexDirection, wrap = cs.flexWrap !== 'nowrap';
    const kids = Array.prototype.filter.call(el.children, (k: HTMLElement) => getComputedStyle(k).position !== 'absolute' && getComputedStyle(k).display !== 'none') as HTMLElement[];
    kids.forEach((k, j) => {
      const first = j === 0;
      if (wrap) { k.style.marginRight = cg + 'px'; k.style.marginBottom = rg + 'px'; return; }
      if (dir === 'row') k.style.marginLeft = first ? '' : cg + 'px';
      else if (dir === 'row-reverse') k.style.marginRight = first ? '' : cg + 'px';
      else if (dir === 'column') k.style.marginTop = first ? '' : rg + 'px';
      else k.style.marginBottom = first ? '' : rg + 'px';
    });
  }
}

export function installFlexGapFallback(): void {
  if (supportsFlexGap()) return;
  let queued = false;
  const run = () => { queued = false; applyGaps(document.body); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', queue);
  queue();
}
