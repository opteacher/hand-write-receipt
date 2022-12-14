const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const toml = require('toml')
const axios = require('axios')
const qiniu = require('qiniu')
const crypto = require('crypto')

const exp = {
  // @block{scanPath}:扫描指定目录和子目录
  // @type:function
  // @includes:lodash
  // @includes:fs
  // @includes:path
  // @params{dirPath}[string]:指定的目录
  // @params{options}[object]:扫描方式
  //          * *ignores*[```array```]：忽略的目录和文件
  //          * *ext*[```string```]：匹配的文件格式
  // @return{subPathAry}[array]:扫描出来的文件（带相对路径）
  scanPath (dirPath, options) {
    // @steps{1}:参数配置，默认扫描方式为空
    if (!options) {
      options = {}
    }
    if (!options.ignores) {
      options.ignores = []
    }
    if (options.ext) {
      if (options.ext[0] !== '.') {
        options.ext = '.' + options.ext
      }
      options.ext = options.ext.toLowerCase()
    }
    if (!options.orgPath) {
      options.orgPath = dirPath
    }

    // @steps{2}:扫描当前目录下所有子目录和文件
    let subPathAry = []
    fs.readdirSync(dirPath).map(file => {
      let absPth = path.join(dirPath, file)
      let relPth = absPth.replace(`${options.orgPath}${path.sep}`, '')
      let fstat = fs.statSync(absPth)
      if (fstat.isDirectory()) {
        // @steps{2_1}:如果是目录，递归调用并把返回值合并进返回值中
        subPathAry = subPathAry.concat(exp.scanPath(absPth, options))
      } else if (fstat.isFile()) {
        const pthInfo = path.parse(relPth)
        // @steps{2_2}:如果是文件，查看是否指定忽略
        let bIgnore = false
        options.ignores.map(ignore => {
          if (ignore[0] === '*') {
            // @steps{2_2_1}:如果文件名为*，则检查文件后缀
            let ext = ignore.slice(1)
            if (pthInfo.ext === ext) {
              bIgnore = true
            }
          } else {
            // @steps{2_2_2}:如果忽略的是目录，查看相对路径的前ignore\
            //         长度的字符串是否相等
            //         ```
            //         ignore -> node_modules/
            //         relPth -> node_modules/koa/Readme.md
            //         ```
            let pth = relPth
            if (relPth.length > ignore.length) {
              pth = relPth.slice(0, ignore.length)
            }
            // @_steps{2_2_3}:如果忽略的是文件，查看相对路径的后ignore\
            //         长度的字符串是否相等
            //         ```
            //         ignore -> Readme.md
            //         relPth -> node_modules/koa/Readme.md
            //         ```
            // if(pth === ignore) { bIgnore = true }
            // if(relPth.length > ignore.length) {
            //   pth = relPth.slice(-ignore.length)
            // }
            if (pth === ignore) {
              bIgnore = true
            }
          }
        })
        let extMatch = true
        if (options.ext) {
          extMatch = pthInfo.ext.toLowerCase() === options.ext
        }
        // @steps{2_3}:最后把子文件路径塞入返回值中
        if (!bIgnore && extMatch) {
          subPathAry.push(relPth)
        }
      }
    })
    return subPathAry
  },
  rootPath () {
    return path.resolve(__dirname, '..')
  },
  readConfig (cfgFile, withEnv = false) {
    const env = withEnv && process.env.ENV ? `.${process.env.ENV}` : ''
    return toml.parse(fs.readFileSync(`${cfgFile}${env}.toml`, {encoding: 'utf8'}))
  },
  fixStartsWith (text, prefix) {
    return (text.substring(0, prefix.length) !== prefix ? prefix : '') + text
  },
  fixEndsWith (text, suffix) {
    return text + (text.substring(text.length - suffix.length) !== suffix ? suffix : '')
  },
  rmvEndsOf (text, suffix) {
    const index = text.indexOf(suffix)
    return index !== -1 ? text.substring(0, index) : text
  },
  getDatabase () {
    return require(`../databases/${
      this.readConfig('./configs/model').type
    }`)
  },
  async uploadToQiniu(key, readableStream) {
    const qnCfg = this.readConfig('./configs/qiniu')
    const mac = new qiniu.auth.digest.Mac(qnCfg.accessKey, qnCfg.secretKey)

    const config = new qiniu.conf.Config()
    // 空间对应的机房
    config.zone = qiniu.zone.Zone_z2

    const url = `http://cdn.opteacher.top/${key}`
    let needRefresh = false
    try {
      const resp = await axios.get(new URL(url).href)
      needRefresh = resp.status === 200
    } catch (e) {}
    
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${qnCfg.bucket}:${key}`
    })
    const uploadToken = putPolicy.uploadToken(mac)

    const formUploader = new qiniu.form_up.FormUploader(config)
    const putExtra = new qiniu.form_up.PutExtra()
    await new Promise((res, rej) => {
      formUploader.putStream(uploadToken, key, readableStream, putExtra, (respErr, respBody, respInfo) => {
        if (respErr) {
          rej(respErr)
        }
        if (respInfo.statusCode == 200) {
          res(respBody)
        } else {
          console.log(respInfo.statusCode)
          rej(respBody)
        }
      })
    })
    if (needRefresh) {
      // 刷新缓存
      const cdnManager = new qiniu.cdn.CdnManager(mac)
      await new Promise((res, rej) => {
        cdnManager.refreshUrls([url], function (err) {
          err ? rej(err) : res()
        })
      })
    }
    return url
  }
}

module.exports = exp
