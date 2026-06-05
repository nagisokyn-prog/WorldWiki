/**
 * @file glass-init.ts
 * @description Глобальная инициализация glass-эффектов и анимаций
 * Подключается ко всем страницам проекта
 * Автоматически применяет push/pull, ripple, breathe, Xbox wheel эффекты
 * Основано на src/new_ui/index.html
 * @ts-nocheck
 */

// @ts-nocheck
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initBackgroundGlows();
    initInteractiveElements();
    initRippleEffects();
    initEntranceAnimations();
    initKeyboardShortcuts();
    initXboxWheelDropdowns();
    initPushPullBreathing();
    initInputBreathe();

    console.log('✨ Glass UI initialized');
  });

  function initBackgroundGlows(): void {
    const existingGlows = document.querySelectorAll('.bg-glow');
    if (existingGlows.length > 0) return;

    const body = document.body;

    const topGlow = document.createElement('div');
    topGlow.className = 'bg-glow top-left';
    body.appendChild(topGlow);

    const bottomGlow = document.createElement('div');
    bottomGlow.className = 'bg-glow bottom-right';
    body.appendChild(bottomGlow);
  }

  function initInteractiveElements(): void {
    const elements = document.querySelectorAll('.interactive-el');

    if (typeof gsap !== 'undefined' && gsap.to) {
      elements.forEach(el => {
        el.addEventListener('mouseenter', () => {
          gsap.to(el, {
            scale: 1.05,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: true
          });
        });

        el.addEventListener('mouseleave', () => {
          gsap.to(el, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: true
          });
        });

        el.addEventListener('mousedown', () => {
          gsap.to(el, {
            scale: 0.98,
            duration: 0.1,
            overwrite: true
          });
        });

        el.addEventListener('mouseup', () => {
          gsap.to(el, {
            scale: 1.05,
            duration: 0.1,
            overwrite: true
          });
        });
      });
    }
  }

  function initPushPullBreathing(): void {
    const containers = document.querySelectorAll('.push-pull-container');

    containers.forEach(container => {
      container.addEventListener('mouseenter', () => {
        container.classList.add('is-pulled');
      });

      container.addEventListener('mouseleave', () => {
        container.classList.remove('is-pulled');
      });

      container.addEventListener('mousedown', () => {
        container.classList.add('is-pushed');
      });

      container.addEventListener('mouseup', () => {
        container.classList.remove('is-pushed');
      });
    });
  }

  function initInputBreathe(): void {
    const wrappers = document.querySelectorAll('.input-breathe-wrapper');

    wrappers.forEach(wrapper => {
      const input = wrapper.querySelector('input, select, textarea');
      if (input) {
        let bg = wrapper.querySelector('.input-breathe-bg');
        if (!bg) {
          bg = document.createElement('div');
          bg.className = 'input-breathe-bg';
          wrapper.insertBefore(bg, wrapper.firstChild);
        }
      }
    });
  }

  function initXboxWheelDropdowns(): void {
    convertSelectsToWheelDropdowns();

    const dropdowns = document.querySelectorAll('.dropdown-container');

    dropdowns.forEach(dropdown => {
      const trigger = dropdown.querySelector('.status-trigger');
      const wheelWrapper = dropdown.querySelector('.wheel-wrapper');
      const wheelContainer = dropdown.querySelector('.wheel-container');
      const arrowIcon = dropdown.querySelector('.arrow-icon');

      if (!trigger || !wheelWrapper) return;

      if (!wheelContainer || wheelContainer.children.length === 0) {
        const items = dropdown.querySelectorAll('.wheel-item');
        if (items.length === 0) {
          const options = dropdown.dataset.options;
          if (options) {
            const optionsList = JSON.parse(options) as Array<{ label?: string; value?: string } | string>;
            optionsList.forEach((opt, idx) => {
              const item = document.createElement('div');
              item.className = 'wheel-item';
              item.textContent = typeof opt === 'object' ? (opt.label || opt.value || '') : opt;
              item.dataset.value = typeof opt === 'object' ? (opt.value || opt.label || '') : opt;
              if (idx === 0) item.classList.add('active');
              wheelWrapper.appendChild(item);
            });
          }
        }
      }

      positionWheelItems(wheelWrapper);

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = wheelWrapper.classList.contains('expanded');

        closeAllDropdowns();

        if (!isExpanded) {
          wheelWrapper.classList.add('expanded');
          trigger.classList.add('active');
          if (arrowIcon) arrowIcon.classList.add('rotated');

          wheelWrapper.addEventListener('wheel', onWheelScroll, { passive: false });
        }
      });

      const items = wheelWrapper.querySelectorAll('.wheel-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          selectWheelItem(dropdown as HTMLElement, item as HTMLElement);
        });
      });
    });

    document.addEventListener('click', () => {
      closeAllDropdowns();
    });
  }

  function positionWheelItems(wheelWrapper: HTMLElement): void {
    const items = Array.from(wheelWrapper.querySelectorAll('.wheel-item'));
    const itemHeight = 44;
    const activeIndex = items.findIndex(item => item.classList.contains('active'));

    items.forEach((item, index) => {
      const distance = index - activeIndex;
      const absDistance = Math.abs(distance);

      let scale: number, opacity: number, zIndex: number;
      if (absDistance === 0) {
        scale = 1.15;
        opacity = 1;
        zIndex = 10;
      } else if (absDistance === 1) {
        scale = 0.9;
        opacity = 0.5;
        zIndex = 9;
      } else {
        scale = 0.75;
        opacity = 0.2;
        zIndex = 8;
      }

      const offset = distance * itemHeight;

      (item as HTMLElement).style.transform = `translateY(${offset}px) scale(${scale})`;
      (item as HTMLElement).style.opacity = String(opacity);
      (item as HTMLElement).style.zIndex = String(zIndex);
    });
  }

  function onWheelScroll(e: WheelEvent): void {
    e.preventDefault();
    const wheelWrapper = e.currentTarget as HTMLElement;
    const items = Array.from(wheelWrapper.querySelectorAll('.wheel-item'));
    const activeIndex = items.findIndex(item => item.classList.contains('active'));

    let newIndex = activeIndex;
    if (e.deltaY > 0) {
      newIndex = Math.min(items.length - 1, activeIndex + 1);
    } else {
      newIndex = Math.max(0, activeIndex - 1);
    }

    items.forEach(item => item.classList.remove('active'));
    items[newIndex].classList.add('active');

    positionWheelItems(wheelWrapper);
  }

  function selectWheelItem(dropdown: HTMLElement, item: HTMLElement): void {
    const trigger = dropdown.querySelector('.status-trigger');
    const wheelWrapper = dropdown.querySelector('.wheel-wrapper');
    const arrowIcon = dropdown.querySelector('.arrow-icon');

    if (trigger) {
      const textNode = trigger.childNodes[0];
      if (textNode) {
        textNode.textContent = item.textContent;
      }
    }

    wheelWrapper?.classList.remove('expanded');
    trigger?.classList.remove('active');
    if (arrowIcon) arrowIcon.classList.remove('rotated');

    wheelWrapper?.removeEventListener('wheel', onWheelScroll);

    dropdown.dispatchEvent(new CustomEvent('wheel-select', {
      detail: { value: item.dataset.value, text: item.textContent }
    }));
  }

  function closeAllDropdowns(): void {
    document.querySelectorAll('.wheel-wrapper.expanded').forEach(wrapper => {
      wrapper.classList.remove('expanded');
      wrapper.removeEventListener('wheel', onWheelScroll);
    });
    document.querySelectorAll('.status-trigger.active').forEach(trigger => {
      trigger.classList.remove('active');
    });
    document.querySelectorAll('.arrow-icon.rotated').forEach(arrow => {
      arrow.classList.remove('rotated');
    });
  }

  function convertSelectsToWheelDropdowns(): void {
    const selects = document.querySelectorAll('select:not(.no-wheel)');

    selects.forEach(select => {
      if ((select as HTMLOptionsCollection).dataset?.converted === 'true') return;

      if (select.closest('#calendarBuilderApp') || select.closest('.calendar-builder')) return;

      const options = Array.from(select.options);
      if (options.length === 0) return;

      const container = document.createElement('div');
      container.className = 'dropdown-container';

      const activeIndex = select.selectedIndex || 0;
      const activeOption = options[activeIndex];

      const trigger = document.createElement('div');
      trigger.className = 'status-trigger interactive-el';
      trigger.innerHTML = `
        <span style="font-weight: 500;">${activeOption.textContent}</span>
        <span class="arrow-icon">▼</span>
      `;

      const wheelWrapper = document.createElement('div');
      wheelWrapper.className = 'wheel-wrapper';
      wheelWrapper.tabIndex = 0;

      const wheelContainer = document.createElement('div');
      wheelContainer.className = 'wheel-container';

      options.forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'wheel-item' + (index === activeIndex ? ' active' : '');
        item.textContent = option.textContent || '';
        item.dataset.value = option.value;
        wheelContainer.appendChild(item);
      });

      wheelWrapper.appendChild(wheelContainer);
      container.appendChild(trigger);
      container.appendChild(wheelWrapper);

      select.parentNode?.insertBefore(container, select);
      select.style.display = 'none';
      (select as HTMLOptionsCollection).dataset.converted = 'true';
      container.appendChild(select);

      positionWheelItems(wheelWrapper);

      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const isExpanded = wheelWrapper.classList.contains('expanded');

        closeAllDropdowns();

        if (!isExpanded) {
          wheelWrapper.classList.add('expanded');
          trigger.classList.add('active');
          const arrowIcon = trigger.querySelector('.arrow-icon');
          if (arrowIcon) arrowIcon.classList.add('rotated');

          wheelWrapper.addEventListener('wheel', onWheelScroll, { passive: false });
        }
      });

      wheelContainer.addEventListener('click', function (e) {
        const item = (e.target as HTMLElement).closest('.wheel-item');
        if (!item) return;

        select.value = item.dataset.value || '';
        select.dispatchEvent(new Event('change'));

        const triggerText = trigger.querySelector('span');
        if (triggerText) triggerText.textContent = item.textContent;

        wheelContainer.querySelectorAll('.wheel-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        positionWheelItems(wheelWrapper);

        wheelWrapper.classList.remove('expanded');
        trigger.classList.remove('active');
        const arrowIcon = trigger.querySelector('.arrow-icon');
        if (arrowIcon) arrowIcon.classList.remove('rotated');
        wheelWrapper.removeEventListener('wheel', onWheelScroll);
      });
    });

    document.addEventListener('click', function (e) {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        closeAllDropdowns();
      }
    });
  }

  function initRippleEffects(): void {
    const containers = document.querySelectorAll('.ripple-container, .glass-btn, .btn');

    containers.forEach(container => {
      container.classList.add('ripple-container');
      container.addEventListener('click', createRipple);
    });
  }

  function createRipple(event: MouseEvent): void {
    const container = event.currentTarget as HTMLElement;

    const oldRipples = container.querySelectorAll('.ripple');
    oldRipples.forEach(r => r.remove());

    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    container.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  }

  function initEntranceAnimations(): void {
    if (typeof gsap === 'undefined' || !gsap.fromTo) return;

    const staggerContainers = document.querySelectorAll('.stagger-container');
    staggerContainers.forEach(container => {
      const items = container.querySelectorAll('.stagger-item');
      gsap.fromTo(items,
        { opacity: 0, y: 20, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.05,
          ease: 'power2.out'
        }
      );
    });

    const cards = document.querySelectorAll('.glass-card.entrance-scale');
    if (cards.length > 0) {
      gsap.fromTo(cards,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.4,
          stagger: 0.1,
          ease: 'power2.out'
        }
      );
    }
  }

  function initKeyboardShortcuts(): void {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.querySelector('.glass-modal-overlay.visible');
        if (modal) {
          closeGlassModal(modal as HTMLElement);
        }
      }
    });
  }

  function closeGlassModal(overlay: HTMLElement): void {
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  const GlassUI = {
    openModal: function (overlay: HTMLElement | null) {
      if (!overlay) return;
      overlay.classList.add('visible');
      overlay.removeAttribute('aria-hidden');
      document.body.style.overflow = 'hidden';

      const focusable = overlay.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
      if (focusable) {
        setTimeout(() => focusable.focus(), 100);
      }
    },

    closeModal: function (overlay: HTMLElement | null) {
      if (!overlay) return;
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    },

    showElement: function (el: HTMLElement | null, type: string = 'fade') {
      if (!el) return;
      el.style.display = '';
      el.classList.add(`entrance-${type}`);
    },

    hideElement: function (el: HTMLElement | null) {
      if (!el) return;
      if (typeof gsap !== 'undefined') {
        gsap.to(el, {
          opacity: 0,
          y: -10,
          duration: 0.3,
          onComplete: () => { el.style.display = 'none'; }
        });
      } else {
        el.style.display = 'none';
      }
    },

    addRipple: function (el: HTMLElement | null) {
      if (!el) return;
      el.classList.add('ripple-container');
      el.addEventListener('click', createRipple);
    }
  };

  declare global {
    interface Window {
      GlassUI: typeof GlassUI;
      closeGlassModal: typeof closeGlassModal;
    }
  }

  if (typeof window !== 'undefined') {
    window.GlassUI = GlassUI;
    window.closeGlassModal = closeGlassModal;
  }
})();