import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from './views/Home'
import Admin from './views/Admin'
import Receipt from './views/Receipt'

Vue.use(VueRouter)

const routes = [{
  path: '/hand-write-receipt/home',
  name: 'Home',
  component: Home
}, {
  path: '/hand-write-receipt/admin',
  name: 'Admin',
  component: Admin
}, {
  path: '/hand-write-receipt/receipt',
  name: 'Receipt',
  component: Receipt
}]

const router = new VueRouter({
  routes,
  mode: 'history',
})

export default router
