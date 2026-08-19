import type { App, DirectiveBinding, ObjectDirective } from 'vue';

// GSAP may be available globally, but we should check
interface GsapLike {
  to?: (target: unknown, vars: Record<string, unknown>) => void;
}
declare const gsap: GsapLike | undefined;

const interactiveEffects = {
  mouseenter(el: HTMLElement) {
    if (typeof gsap !== 'undefined' && gsap.to) {
      gsap.to(el, { scale: 1.05, duration: 0.3, ease: 'power2.out', overwrite: true });
    }
  },
  mouseleave(el: HTMLElement) {
    if (typeof gsap !== 'undefined' && gsap.to) {
      gsap.to(el, { scale: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
    }
  },
  mousedown(el: HTMLElement) {
    if (typeof gsap !== 'undefined' && gsap.to) {
      gsap.to(el, { scale: 0.98, duration: 0.1, overwrite: true });
    }
  },
  mouseup(el: HTMLElement) {
    if (typeof gsap !== 'undefined' && gsap.to) {
      gsap.to(el, { scale: 1.05, duration: 0.1, overwrite: true });
    }
  }
};

const rippleEffect = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  
  el.appendChild(ripple);
  
  setTimeout(() => {
    ripple.remove();
  }, 600);
};

export const vGlass: ObjectDirective = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const modifiers = binding.modifiers;
    
    // v-glass.interactive
    if (modifiers.interactive) {
      el.addEventListener('mouseenter', () => interactiveEffects.mouseenter(el));
      el.addEventListener('mouseleave', () => interactiveEffects.mouseleave(el));
      el.addEventListener('mousedown', () => interactiveEffects.mousedown(el));
      el.addEventListener('mouseup', () => interactiveEffects.mouseup(el));
    }
    
    // v-glass.ripple
    if (modifiers.ripple) {
      el.style.position = el.style.position || 'relative';
      el.style.overflow = 'hidden';
      el.addEventListener('mousedown', (e) => rippleEffect(e, el));
    }
    
    // v-glass.pushpull
    if (modifiers.pushpull) {
      el.addEventListener('mouseenter', () => el.classList.add('is-pulled'));
      el.addEventListener('mouseleave', () => el.classList.remove('is-pulled'));
      el.addEventListener('mousedown', () => el.classList.add('is-pushed'));
      el.addEventListener('mouseup', () => el.classList.remove('is-pushed'));
    }
    
    // v-glass.breathe
    if (modifiers.breathe) {
      const input = el.querySelector('input, select, textarea');
      if (input) {
        let bg = el.querySelector('.input-breathe-bg');
        if (!bg) {
          bg = document.createElement('div');
          bg.className = 'input-breathe-bg';
          el.insertBefore(bg, el.firstChild);
        }
      }
    }
  }
};

export function setupGlass(app: App) {
  app.directive('glass', vGlass);
}
