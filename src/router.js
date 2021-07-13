import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from './views/Home'
import Admin from './views/Admin'

Vue.use(VueRouter)

const routes = [{
  path: '/hand-write-receipt/home',
  name: 'Home',
  component: Home
}, {
  path: '/hand-write-receipt/admin',
  name: 'Admin',
  component: Admin
}]

const router = new VueRouter({
  routes,
  mode: 'history',
})

export default router
