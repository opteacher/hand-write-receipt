const $ = require('jquery')
const axios = require('axios')

module.exports = {
  async waitFor (select, cdFun = null, lpLimit = 500) {
    let ret = []
    for (let i = 0; i < lpLimit; ++i) {
      ret = $(select)
      if (ret.length) {
        if (cdFun && cdFun(ret)) {
          return Promise.resolve(ret)
        }
      }
      await new Promise(res => setTimeout(res, 200))
    }
    return Promise.resolve(ret)
  },
  async until (cdFun, lpLimit = 500) {
    for (let i = 0; i < lpLimit; ++i) {
      if (cdFun()) {
        return Promise.resolve()
      }
      await new Promise(res => setTimeout(res, 200))
    }
    return Promise.reject()
  },
  acsObjAttr (obj, keys) {
    for (const key of keys.split('.')) {
      obj = obj[key]
    }
    return obj
  },
  bkHost: process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:4000',
  async reqBack (self, path, method, params = {}) {
    const hide = self.$message.loading('加载中……')
    const resp = await axios[method](this.bkHost + path, params)
    hide()
    if (!resp.data) {
      self.$message.error('返回体没有data字段！')
      return Promise.reject()
    }
    if (!resp.data.data && !resp.data.result) {
      self.$message.error(JSON.stringify(resp.data))
      return Promise.reject()
    }
    return Promise.resolve(resp.data.data || resp.data.result)
  },
  clrMap: {
    edit: '#ff4d4f',
    store: '#1890ff',
    editRGB: '255, 77, 79',
    storeRGB: '24, 144, 255'
  }
}
