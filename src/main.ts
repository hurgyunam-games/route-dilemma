import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "@/ui/App.vue";
import "@/ui/global.css";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
