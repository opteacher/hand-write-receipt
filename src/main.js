import Vue from 'vue'
import App from './App.vue'
import router from './router.js'
import store from './store.js'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'
import './commons/styles.css'

Vue.config.productionTip = false

Vue.use(Antd)

new Vue({
  render: h => h(App),
  router,
  store
}).$mount('#app')
