import type { Theme } from 'vitepress';
import { inBrowser } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import { bindSiteProductEvents, initSiteAnalytics } from './analytics';

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp() {
    if (!inBrowser) return;

    initSiteAnalytics();
    bindSiteProductEvents();
  },
};

export default theme;
