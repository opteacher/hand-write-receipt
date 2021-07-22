const fs = require('fs')
const path = require('path')
const stream = require('stream')
const PNG = require("pngjs").PNG
const router = require('koa-router')()

const tools = require('../../../../../utils/tools')

router.post('/data/upload', async ctx => {
  const width = ctx.request.body.width
  const height = ctx.request.body.height
  const data = ctx.request.body.data

  const newPNG = new PNG({width, height})
  for (let i = 0; i < newPNG.data.length; ++i) {
    newPNG.data[i] = (i in data) ? data[i] : 255
  }
  const imgBuf = PNG.sync.write(newPNG.pack(), {colorType: 6})
  const bufferStream = new stream.PassThrough()
  const readableStream = bufferStream.end(imgBuf)

  ctx.body = {
    result: await tools.uploadToQiniu(
      ctx.request.body.fileName, readableStream
    )
  }
})

module.exports = router