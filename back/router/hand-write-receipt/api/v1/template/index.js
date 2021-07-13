const fs = require('fs')
const router = require('koa-router')()

const tools = require('../../../../../utils/tools')

router.post('/file/upload', async ctx => {
  const file = ctx.request.files.file
  ctx.body = {
    result: await tools.uploadToQiniu(
      file.name, fs.createReadStream(file.path)
    )
  }
})

module.exports = router