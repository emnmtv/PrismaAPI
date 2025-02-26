import Vue from 'vue';
import Router from 'vue-router';
import MessageMobile from '../components/MessageMobile.vue';
import ChatWindow from '../components/ChatWindow.vue';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/',
      name: 'MessageMobile',
      component: MessageMobile,
    },
    {
      path: '/chat/:userId',
      name: 'ChatWindow',
      component: ChatWindow,
      props: true,
    },
  ],
}); 