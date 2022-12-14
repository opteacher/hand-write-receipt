const path = require('path')
const Koa = require('koa')
const koaBody = require('koa-body')
const json = require('koa-json')
const logger = require('koa-logger')
const statc = require('koa-static')
const views = require('koa-views')
const cors = require('koa2-cors')

const models = require('./models/index').index
const router = require('./router/index')

const app = new Koa()

// 跨域配置
app.use(cors())
// 上传配置
app.use(koaBody({
  multipart: true,
  formidable: {
    maxFileSize: 200*1024*1024    // 设置上传文件大小最大限制，默认2M
  },
  jsonLimit: '100mb',
  onError: function (err, ctx) {
    ctx.throw(`Error happened! ${err}`)
  }
}))
// json解析
app.use(json())
// 日志输出
app.use(logger())
// 指定静态目录
app.use(statc(path.join(__dirname, 'public')))
// 模型路由
app.use(models.routes(), models.allowedMethods())
// 路径分配
app.use(router.routes(), router.allowedMethods())
// 指定页面目录
app.use(views('./views', {extension: 'html'}))
// 以页面路由结尾
app.use(async ctx => {
  await ctx.render('index')
})

app.listen(process.env.PORT || 4000)
