import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    permissions: ['activeTab', 'scripting', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'MindArmor XAI - Open Side Panel',
    },
  },
});