import { createMemoryHistory, createRouter } from 'vue-router';
import Splash from '../features/shell/Splash.vue';
import ProjectLauncher from '../features/shell/ProjectLauncher.vue';
import EditorView from '../features/shell/EditorView.vue';

const routes = [
  { path: '/', redirect: '/splash' },
  { path: '/splash', component: Splash },
  { path: '/launcher', component: ProjectLauncher },
  { path: '/app', component: EditorView },
];

export const router = createRouter({
  history: createMemoryHistory(),
  strict: true,
  routes,
});
