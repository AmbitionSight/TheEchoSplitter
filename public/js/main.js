// —— 启动壳：内容加载 + 舞台缩放 + 标题/序章（主循环在后续任务接入）——
import { INLINE_CONTENT } from './content-fallback.js';

export async function loadContent() {
  try {
    const res = await fetch('/api/chapter1');
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch { return INLINE_CONTENT; } // 规格 §12：兜底，保证可玩
}

function fitStage(stage) {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.width = `${1280 * s}px`;
  stage.style.height = `${720 * s}px`;
}

function boot() {
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  fitStage(stage);
  addEventListener('resize', () => fitStage(stage));

  const params = new URLSearchParams(location.search);
  loadContent().then(content => {
    window.G = { content, beat: 'title' };
    if (params.get('autostart') === '1') {
      $('title').classList.add('hidden');
      dispatchStart(); return;
    }
    $('title').classList.remove('hidden');
    $('btn-start').addEventListener('click', () => {
      $('title').classList.add('hidden');
      dispatchStart();
    }, { once: true });
  });

  function dispatchStart() {
    // 序章 → game:start（Task 13 由主循环接管；现在的临时监听只报开发提示）
    const pro = $('prologue');
    pro.classList.remove('hidden');
    const go = () => { pro.classList.add('hidden'); pro.removeEventListener('click', go); dispatchEvent(new CustomEvent('game:start')); };
    pro.addEventListener('click', go);
    addEventListener('game:start', () => {
      const toast = $('toast');
      if (!window.__gameLoopOn) { toast.textContent = '（主循环未接入：Task 13 接线）'; toast.classList.remove('hidden'); }
    }, { once: true });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
