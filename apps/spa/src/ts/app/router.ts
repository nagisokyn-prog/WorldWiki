import { createWebHashHistory, createRouter } from 'vue-router';
import Splash from '../features/shell/components/splash/Splash/Splash.vue';
import ProjectLauncher from '../features/shell/components/launcher/ProjectLauncher/ProjectLauncher.vue';
import EditorView from '../features/shell/EditorView.vue';

const routes = [
  { path: '/', redirect: '/splash' },
  { path: '/splash', component: Splash },
  { path: '/launcher', component: ProjectLauncher },
  { path: '/app', component: EditorView },
];

export const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  routes,
});
