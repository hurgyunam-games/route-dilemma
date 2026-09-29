import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "@/ui/App.vue";
import { initLocale } from "@/ui/i18n";
import "@/ui/global.css";

initLocale();

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
