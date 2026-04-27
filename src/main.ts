import './style.css';
import { mountSection, type SectionConfig } from './core/section';
import { section01 } from './sections/01-uv-point';
import { section02 } from './sections/02-grid';
import { section03 } from './sections/03-line';
import { section04 } from './sections/04-motion';
import { section05 } from './sections/05-network';

// 所有章节注册到这里，按顺序渲染
const SECTIONS: SectionConfig[] = [
  section01,
  section02,
  section03,
  section04,
  section05,
];

function buildToc(parent: HTMLElement): void {
  const toc = document.createElement('aside');
  toc.className = 'toc';
  const items = SECTIONS.map((s) => {
    const subList = s.children?.length
      ? `<ol class="toc-sub">${s.children
          .map((c) => `<li><a href="#${c.id}">${c.title}</a></li>`)
          .join('')}</ol>`
      : '';
    return `<li><a href="#${s.id}">${s.title}</a>${subList}</li>`;
  }).join('');
  toc.innerHTML = `
    <h1>GalaxyNetwork<small>UE 星座网络材质技术分享</small></h1>
    <ol>${items}</ol>
  `;
  parent.appendChild(toc);

  // 当前章节高亮：以"最靠近视口顶部"的章节为准（一二级都监听）
  const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a'));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = e.target.id;
        for (const a of links) {
          a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
        }
      }
    },
    { rootMargin: '-20% 0px -70% 0px' },
  );
  for (const s of SECTIONS) {
    const el = document.getElementById(s.id);
    if (el) observer.observe(el);
    for (const c of s.children ?? []) {
      const cEl = document.getElementById(c.id);
      if (cEl) observer.observe(cEl);
    }
  }
}

function main(): void {
  const app = document.getElementById('app')!;

  // 主内容容器（先建好，后面的 IntersectionObserver 才能找到章节）
  const main = document.createElement('main');
  main.className = 'main';
  app.appendChild(main);

  for (const s of SECTIONS) {
    mountSection(s, main);
  }

  // 目录最后构建（依赖章节已挂载）
  const tocHolder = document.createElement('div');
  app.insertBefore(tocHolder, main);
  buildToc(tocHolder);
  // 把 toc 替换到正确位置
  const toc = tocHolder.firstElementChild!;
  app.insertBefore(toc, main);
  tocHolder.remove();
}

main();
