import DefaultTheme from 'vitepress/theme';
import CourseHome from './CourseHome.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) { app.component('CourseHome', CourseHome); },
};
