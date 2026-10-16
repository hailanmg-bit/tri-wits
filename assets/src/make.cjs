// 生成 App 图标与启动图（SVG → PNG），运行：node assets/src/make.cjs（需 puppeteer-core 与本机 Chrome）
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');

const SPADE = 'M12 2C9 6 3.5 9.2 3.5 13.3c0 2.6 2 4.6 4.5 4.6 1.4 0 2.5-.6 3.2-1.5-.3 2.2-1.2 3.7-2.7 5.1h7c-1.5-1.4-2.4-2.9-2.7-5.1.7.9 1.8 1.5 3.2 1.5 2.5 0 4.5-2 4.5-4.6C20.5 9.2 15 6 12 2z';
const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.7 1.3 5.4 3.3 1.7-2 3.2-3.3 5.4-3.3 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z';
const CLUB = 'M12 2.5a4.2 4.2 0 0 0-3.9 5.8A4.2 4.2 0 1 0 10.9 15c-.3 2.6-1.2 4.3-2.9 6h8c-1.7-1.7-2.6-3.4-2.9-6a4.2 4.2 0 1 0 2.8-6.7A4.2 4.2 0 0 0 12 2.5z';

const felt = `
  <radialGradient id="felt" cx="50%" cy="42%" r="70%">
    <stop offset="0" stop-color="#1B5E50"/><stop offset=".65" stop-color="#0F3D35"/><stop offset="1" stop-color="#0A2B25"/>
  </radialGradient>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity=".45"/></filter>`;

/** 一张牌：宽 300 高 430，大花色居中 */
function card(x, y, rot, suit, color, raised) {
  const w = 300, h = 430;
  return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#sh)">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="34" fill="#FBF8F1" ${raised ? 'stroke="#E2C27E" stroke-width="16"' : 'stroke="rgba(26,28,34,.18)" stroke-width="3"'}/>
    <path d="${suit}" fill="${color}" transform="translate(-105 -105) scale(8.75)"/>
  </g>`;
}

/** 三张扇形牌，scale 控制整体大小（自适应图标前景需要缩进安全区） */
function fan(scale) {
  return `<g transform="translate(512 548) scale(${scale})">
    ${card(-170, 40, -16, SPADE, '#1A1C22')}
    ${card(170, 40, 16, CLUB, '#1A1C22')}
    ${card(0, -18, 0, HEART, '#C8323F', true)}
  </g>`;
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>${felt}</defs><rect width="1024" height="1024" fill="url(#felt)"/>
  <circle cx="512" cy="512" r="440" fill="none" stroke="#E2C27E" stroke-opacity=".22" stroke-width="6"/>
  ${fan(1)}</svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${felt}</defs>${fan(0.66)}</svg>`;
const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${felt}</defs><rect width="1024" height="1024" fill="url(#felt)"/></svg>`;

/** 启动图：Logo + 字标，内容放在中心 1/3 内，适配各种裁切 */
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" width="2732" height="2732">
  <defs>${felt}</defs><rect width="2732" height="2732" fill="url(#felt)"/>
  <g transform="translate(1366 1250)">
    <circle r="150" fill="none" stroke="#C9A45C" stroke-width="12"/>
    <circle cy="-62" r="33" fill="#C9A45C"/><circle cx="-62" cy="41" r="33" fill="#F3EEE2"/><circle cx="62" cy="41" r="33" fill="#C8323F"/>
  </g>
  <text x="1366" y="1560" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="190" fill="#F3EEE2" letter-spacing="-3">TriWits</text>
</svg>`;

(async () => {
  const out = path.resolve(__dirname, '..');
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  const font = fs.readFileSync(require.resolve('@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2', { paths: [path.resolve(__dirname, '../..')] })).toString('base64');
  const shot = async (svg, size, file, transparent) => {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await p.setContent(`<style>@font-face{font-family:Fraunces;src:url(data:font/woff2;base64,${font})}html,body{margin:0;background:transparent}</style>${svg}`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, file), omitBackground: !!transparent, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shot(icon, 1024, 'icon-only.png');
  await shot(fg, 1024, 'icon-foreground.png', true);
  await shot(bg, 1024, 'icon-background.png');
  await shot(splash, 2732, 'splash.png');
  await shot(splash, 2732, 'splash-dark.png');
  fs.writeFileSync(path.join(out, 'src', 'icon.svg'), icon);
  await b.close();
  console.log('ok');
})();
