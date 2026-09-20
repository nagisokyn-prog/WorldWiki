import type { AppSettings } from '../types/settings';

export function applyCustomBackground(settings: AppSettings): void {
  try {
    const bg = settings.background;
    if (!bg) return;

    let container = document.getElementById('ww-background');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ww-background';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.right = '0';
      container.style.bottom = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.zIndex = '0';
      container.style.pointerEvents = 'none';
      container.style.overflow = 'hidden';
      document.body.prepend(container);
    }

    container.style.opacity = String(bg.opacity ?? 1);
    container.style.filter = bg.blur ? `blur(${bg.blur}px)` : 'none';

    const newPath = bg.type === 'image' ? bg.imagePath : (bg.type === 'video' ? bg.videoPath : '');
    const currentType = container.getAttribute('data-bg-type');
    const currentPath = container.getAttribute('data-bg-path');

    if (currentType === bg.type && currentPath === newPath) {
      return;
    }

    container.setAttribute('data-bg-type', bg.type || 'none');
    container.setAttribute('data-bg-path', newPath || '');
    container.innerHTML = '';

    const applySrc = (el: HTMLImageElement | HTMLVideoElement, path: string) => {
      const isAlreadyUrl = path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:');
      if (isAlreadyUrl) {
        el.src = path;
        return;
      }
      const w = window as unknown as {
        __TAURI__?: { core?: { convertFileSrc?: (p: string) => string }; convertFileSrc?: (p: string) => string };
        __TAURI_INTERNALS__?: { convertFileSrc?: (p: string) => string };
      };
      if (w.__TAURI__?.core?.convertFileSrc) {
        el.src = w.__TAURI__.core.convertFileSrc(path);
      } else if (w.__TAURI__?.convertFileSrc) {
        el.src = w.__TAURI__.convertFileSrc(path);
      } else if (w.__TAURI_INTERNALS__?.convertFileSrc) {
        el.src = w.__TAURI_INTERNALS__.convertFileSrc(path);
      } else {
        el.src = path;
      }
    };

    if (bg.type === 'color') {
      document.documentElement.style.background = 'var(--bg-base)';
      document.body.style.background = 'var(--bg-base)';
      container.style.backgroundColor = 'var(--bg-base)';
    } else if (bg.type === 'image' && bg.imagePath) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      const img = document.createElement('img');
      applySrc(img, bg.imagePath);
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = bg.fit || 'cover';
      img.style.position = 'absolute';
      img.style.top = '0';
      img.style.left = '0';
      container.appendChild(img);
    } else if (bg.type === 'video' && bg.videoPath) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      const video = document.createElement('video');
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      applySrc(video, bg.videoPath);
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = bg.fit || 'cover';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      container.appendChild(video);
      video.play().catch(e => console.warn('[settingsService] Video autoplay blocked/failed:', e));
    } else {
      document.documentElement.style.background = 'var(--bg-base)';
      document.body.style.background = 'var(--bg-base)';
    }
  } catch (e) {
    console.error('Error applying background:', e);
  }
}
