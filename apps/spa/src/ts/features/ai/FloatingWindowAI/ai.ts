import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AiApp from './AiApp.vue';

// Use same core styles as app.ts
import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/app.css';
import '@worldwiki/resources/styles/glass-animations.css';

const app = createApp(AiApp);
const pinia = createPinia();
app.use(pinia);

app.mount('#app');
