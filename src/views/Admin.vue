<template>
  <div class="h-100">
    <div v-if="!tempInfo.imgURLs.length">
      <div class="fix-scroll p-1pc" style="bottom: 47px">
        <a-list class="w-100 h-100" item-layout="horizontal" :data-source="templates">
          <a-list-item slot="renderItem" slot-scope="temp">
            <div class="lg-sg-r-container " style="width: 60vw">
              <a class="long-single-row" @click="onTempClicked(temp)">{{temp.name}}</a>
            </div>
            <a-button type="danger" slot="actions" icon="close" @click="onDelTempClicked(temp._id)"/>
          </a-list-item>
        </a-list>
      </div>
      <div class="fix-bottom">
        <a-upload
          name="file"
          :showUploadList="false"
          :action="[
            utils.bkHost,
            '/hand-write-receipt',
            '/api/v1/template/file/upload'
          ].join('')"
          @change="onSelImgChanged"
        >
          <a-button type="primary" :loading="uploading">上传模板图片</a-button>
        </a-upload>
      </div>
    </div>
    <div v-else class="h-100">
      <a-page-header
        style="border: 1px solid rgb(235, 237, 240); padding: 1vh 2vw"
        :sub-title="tempInfo.name || '新建模板'"
        @back="resetTempInfo"
      >
        <template v-if="tempInfo._id" slot="extra">
          <a-button type="primary" icon="eye"
            @click="$router.push(`/hand-write-receipt/home?t=${tempInfo._id}`)"
          />
          <a-button type="primary" icon="setting" ghost
            @click="configDlg.visible = true"
          />
        </template>
      </a-page-header>
      <img-with-cvs ref="img-with-cvs" :top="53" :bottom="80"
        :tempInfo="tempInfo" :mode="mode"
        :onSelRectCreated="(selMode) => {mode = selMode}"
      />
      <div :style="`position: fixed; left: 0; bottom: 80px; padding: 1vh 1vw`">
        <a-upload
          name="file"
          :showUploadList="false"
          :action="[
            utils.bkHost,
            '/hand-write-receipt',
            '/api/v1/template/file/upload'
          ].join('')"
          @change="onSelImgChanged"
        >
          <a-button type="primary" :loading="uploading">添加图片</a-button>
        </a-upload>
      </div>
      <div class="fix-bottom">
        <div class="mb-5 d-flex justify-content-around">
          <a-button class="w-100 mr-1"
            :class="mode === 'select' ? 'bg-success text-white' : ''"
            :disabled="mode !== 'view' && mode !== 'select'"
            @click="mode = mode !== 'select' ? 'select' : 'view'"
          >标记需勾选区域</a-button>
          <a-button class="w-100 mr-1"
            :type="mode === 'edit' ? 'danger' : 'default'"
            :disabled="mode !== 'view' && mode !== 'edit'"
            @click="mode = mode !== 'edit' ? 'edit' : 'view'"
          >标记需编辑区域</a-button>
          <a-button class="w-100"
            :type="mode === 'store' ? 'primary' : 'default'"
            :disabled="mode !== 'view' && mode !== 'store'"
            @click="mode = mode !== 'store' ? 'store' : 'view'"
          >标记回执区域</a-button>
        </div>
        <a-button type="primary" block @click="onTmpSbtClicked">提交</a-button>
        <a-modal
          title="配置模板信息"
          :visible="configDlg.visible"
          :confirm-loading="configDlg.confirming"
          @ok="onTempSubmit"
          @cancel="configDlg.visible = false"
        >
          <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 19 }">
            <a-form-item label="模板名">
              <a-input-search placeholder="输入模板名" v-model="tempInfo.name">
                <a-button slot="enterButton" @click.native="onUseImgNameClicked">使用图片名</a-button>
              </a-input-search>
            </a-form-item>
            <a-form-item label="规定浏览时限">
              <a-input-number class="w-100" placeholder="输入规定浏览时限"
                :min="0" v-model="tempInfo.require.duration"
              />
            </a-form-item>
          </a-form>
        </a-modal>
      </div>
    </div>
  </div>
</template>

<script>
import imgWithCvs from '../components/imgWithCvs'
import utils from '../commons/utils'
import axios from 'axios'
import URL from 'url'
import path from 'path'
export default {
  components: {
    'img-with-cvs': imgWithCvs
  },
  data () {
    return {
      mode: 'view',
      uploading: false,
      tempInfo: {
        _id: '',
        name: '',
        require: {
          duration: 10
        },
        imgURLs: [],
        editRects: [],
        selectRects: [],
        storeRect: {
          width: 1, height: 1
        }
      },
      templates: [],
      configDlg: {
        visible: false,
        confirming: false,
        sbtForm: this.$form.createForm(this, { name: 'tempConfig' })
      },
      utils
    }
  },
  created () {
    this.resetTempInfo()
    this.refreshTemplates()
  },
  methods: {
    async refreshTemplates () {
      this.templates = await utils.reqBack(this,
        '/hand-write-receipt/mdl/v1/templates', 'get'
      ) || []
    },
    async onSelImgChanged (e) {
      this.uploading = e.file.status !== 'done'
      if (e.file.response) {
        const resp = e.file.response
        if (resp.error) {
          this.$error({
            title: '选择文件错误！',
            content: resp.error,
          })
        } else {
          this.tempInfo.imgURLs.push(resp.result)
          if (this.$refs['img-with-cvs']) {
            await this.$refs['img-with-cvs'].updateImages()
          }
        }
      }
    },
    onTmpSbtClicked () {
      if (!this.tempInfo._id) {
        this.configDlg.visible = true
      } else {
        this.onTempSubmit()
      }
    },
    async onTempSubmit () {
      this.configDlg.confirming = true
      let path = '/hand-write-receipt/mdl/v1/template'
      path += this.tempInfo._id ? `/${this.tempInfo._id}` : ''
      const method = this.tempInfo._id ? 'put' : 'post'
      delete this.tempInfo._id
      await utils.reqBack(this, path, method, Object.assign(this.tempInfo, {
        editRects: this.tempInfo.editRects.map(rect => ({
          left: rect.left, top: rect.top,
          width: rect.width, height: rect.height,
          desc: rect.desc
        })),
        selectRects: this.tempInfo.selectRects.map(rect => ({
          left: rect.left, top: rect.top,
          width: rect.width, height: rect.height,
          group: rect.group
        }))
      }))
      this.configDlg.confirming = false
      this.configDlg.visible = false
      this.resetTempInfo()
      this.$message.success(this.tempInfo._id ? '模板保存成功！' : '模板创建成功')
      this.refreshTemplates()
    },
    onUseImgNameClicked () {
      const url = URL.parse(this.tempInfo.imgURLs[0])
      this.tempInfo.name = path.basename(url.pathname)
    },
    onTempClicked (temp) {
      this.tempInfo = temp
    },
    onDelTempClicked (tmpId) {
      const self = this
      this.$confirm({
        title: '警告?',
        content: '确定删除该模板？',
        async onOk() {
          await axios.delete(`${utils.bkHost}/hand-write-receipt/mdl/v1/template/${tmpId}`)
          return self.refreshTemplates()
        },
      })
    },
    resetTempInfo () {
      this.tempInfo = {
        _id: '',
        name: '',
        require: {
          duration: 10
        },
        imgURLs: [],
        editRects: [],
        selectRects: [],
        storeRect: {
          width: 1, height: 1
        }
      }
    }
  }
}
// 各位居民朋友，现在《全民反诈告知书》可以线上领取啦！扫描下面二维码查看告知书，提高自身反诈识诈意识，
// 共建我们和谐安定的社区环境。在仔细阅读告知书后请按要求填写回执再提交，已经领取过纸质告知书、填写过回执的可以不扫码，谢谢配合！
</script>

<style>
.ant-page-header-back {
  margin-top: 3px !important;
}

.ant-page-header-heading-sub-title {
  width: 60vw;
  word-break: keep-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ant-page-header-heading-extra {
  width: auto !important;
  padding-top: 0 !important;
  float: right !important;
}
</style>
