import type { Theme } from 'vitepress';
import { inBrowser } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/site.css';
import Layout from './Layout.vue';
import Landing from './components/Landing.vue';
import ClientPicker from './components/ClientPicker.vue';
import ClientDoc from './components/ClientDoc.vue';
import RecipeGrid from './components/RecipeGrid.vue';
import ToolExplorer from './components/ToolExplorer.vue';
import CommandBlock from './components/CommandBlock.vue';
import CodeSnippet from './components/CodeSnippet.vue';
import FaqList from './components/FaqList.vue';
import { bindSiteProductEvents, initSiteAnalytics } from './analytics';

const theme: Theme = {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('Landing', Landing);
    app.component('ClientPicker', ClientPicker);
    app.component('ClientDoc', ClientDoc);
    app.component('RecipeGrid', RecipeGrid);
    app.component('ToolExplorer', ToolExplorer);
    app.component('CommandBlock', CommandBlock);
    app.component('CodeSnippet', CodeSnippet);
    app.component('FaqList', FaqList);

    if (!inBrowser) return;

    initSiteAnalytics();
    bindSiteProductEvents();
  },
};

export default theme;
