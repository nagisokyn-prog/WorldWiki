/**
 * @file navigation.ts
 * @description Навигация и боковая панель
 */

interface NavTarget {
  id?: string;
  type: string;
}

interface NavItem {
  type: string;
  url: string;
  title: string;
  emoji?: string;
  icon?: string;
  entityType?: string;
}

export function navigateTo(target: string | NavTarget): void {
  const urlParams = new URLSearchParams(window.location.search);
  const project = urlParams.get('project');

  let url: string;
  if (typeof target === 'string') {
    url = target;
  } else {
    url = target.id
      ? `app.html?type=${target.type}&id=${target.id}`
      : `app.html?type=${target.type}`;
  }

  if (project && !url.includes('project_launcher')) {
    url += (url.includes('?') ? '&' : '?') + `project=${encodeURIComponent(project)}`;
  }
  window.location.href = url;
}

export async function buildSidebar(): Promise<void> {
  const sidebarContainer = document.querySelector('.app-sidebar') as HTMLElement | null;
  if (!sidebarContainer) return;

  try {
    const response = await fetch('struct/sidebar.json');
    const navItems: NavItem[] = await response.json();

    const currentUrl = window.location.href;

    sidebarContainer.innerHTML = navItems.map(item => {
      const navArg = item.type === 'static' ? `'${item.url}'` : `{type: '${item.entityType}'}`;

      const isActive = currentUrl.includes(item.url) || (item.entityType && currentUrl.includes(item.entityType));
      const activeClass = isActive ? 'active' : '';

      return `
        <div class="sidebar-icon ${activeClass}"
             onclick="navigateTo(${navArg})"
             title="${item.title}">
          ${item.emoji || `<i class="fas ${item.icon}"></i>`}
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error("Sidebar JSON error:", e);
  }
}

declare global {
  interface Window {
    navigateTo: typeof navigateTo;
  }
}

if (typeof window !== 'undefined') {
  window.navigateTo = navigateTo;
  document.addEventListener('DOMContentLoaded', buildSidebar);
}