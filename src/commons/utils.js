const $ = require('jquery')

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
  }
}
