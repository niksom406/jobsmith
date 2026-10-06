import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Jobsmith",
    description: "Fill job applications from your CV. Your data stays in this browser.",
    permissions: ["storage", "scripting", "sidePanel", "activeTab"],
    host_permissions: ["https://api.openai.com/*"],
    // Chrome can only grant a site that is covered by optional_host_permissions.
    // <all_urls> is optional: nothing is granted at install. Each toggle or
    // "Enable on this site" asks for one origin. See README.
    optional_host_permissions: ["<all_urls>"],
    action: {
      default_title: "Jobsmith",
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
