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

interface GlassHandlers {
  interactive?: {
    enter: () => void;
    leave: () => void;
    down: () => void;
    up: () => void;
  };
  ripple?: (e: MouseEvent) => void;
  pushpull?: {
    enter: () => void;
    leave: () => void;
    down: () => void;
    up: () => void;
  };
}

const handlersMap = new WeakMap<HTMLElement, GlassHandlers>();

export const vGlass: ObjectDirective = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const modifiers = binding.modifiers;
    const handlers: GlassHandlers = {};
    
    // v-glass.interactive
    if (modifiers.interactive) {
      const enter = () => interactiveEffects.mouseenter(el);
      const leave = () => interactiveEffects.mouseleave(el);
      const down = () => interactiveEffects.mousedown(el);
      const up = () => interactiveEffects.mouseup(el);
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      handlers.interactive = { enter, leave, down, up };
    }
    
    // v-glass.ripple
    if (modifiers.ripple) {
      el.style.position = el.style.position || 'relative';
      el.style.overflow = 'hidden';
      const ripple = (e: MouseEvent) => rippleEffect(e, el);
      el.addEventListener('mousedown', ripple);
      handlers.ripple = ripple;
    }
    
    // v-glass.pushpull
    if (modifiers.pushpull) {
      const enter = () => el.classList.add('is-pulled');
      const leave = () => el.classList.remove('is-pulled');
      const down = () => el.classList.add('is-pushed');
      const up = () => el.classList.remove('is-pushed');
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      handlers.pushpull = { enter, leave, down, up };
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

    handlersMap.set(el, handlers);
  },

  unmounted(el: HTMLElement) {
    const handlers = handlersMap.get(el);
    if (!handlers) return;

    if (handlers.interactive) {
      el.removeEventListener('mouseenter', handlers.interactive.enter);
      el.removeEventListener('mouseleave', handlers.interactive.leave);
      el.removeEventListener('mousedown', handlers.interactive.down);
      el.removeEventListener('mouseup', handlers.interactive.up);
    }
    if (handlers.ripple) {
      el.removeEventListener('mousedown', handlers.ripple);
    }
    if (handlers.pushpull) {
      el.removeEventListener('mouseenter', handlers.pushpull.enter);
      el.removeEventListener('mouseleave', handlers.pushpull.leave);
      el.removeEventListener('mousedown', handlers.pushpull.down);
      el.removeEventListener('mouseup', handlers.pushpull.up);
    }
    handlersMap.delete(el);
  }
};

export function setupGlass(app: App) {
  app.directive('glass', vGlass);
}
