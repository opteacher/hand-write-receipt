<template>
  <div class="h-100">
    <div v-if="!tempInfo.imgURL">
      <div class="center-container temp-list">
        <a-list class="w-100" bordered item-layout="horizontal" :data-source="templates">
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
            bkHost,
            '/hand-write-receipt',
            '/api/v1/template/file/upload'
          ].join('')"
          @change="onSelImgChanged"
        >
          <a-button type="primary">
            <a-icon type="upload"/> 上传模板图片
          </a-button>
        </a-upload>
      </div>
    </div>
    <div v-else class="h-100">
      <a-page-header
        style="border: 1px solid rgb(235, 237, 240); padding: 1vh 2vw"
        :sub-title="tempInfo.name || '新建模板'"
        @back="resetTempInfo"
      />
      <img-with-cvs :top="53" :bottom="80"
        :tempInfo="tempInfo" :mode="mode"
        :onSelRectCreated="(selMode) => {mode = selMode}"
      />
      <div class="fix-bottom">
        <div class="mb-5 d-flex justify-content-around">
          <a-button class="w-100 mr-1"
            :type="mode === 'edit' ? 'danger' : 'default'"
            :disabled="mode === 'store'"
            @click="mode = mode !== 'edit' ? 'edit' : 'view'"
          >标记需编辑区域</a-button>
          <a-button class="w-100"
            :type="mode === 'store' ? 'primary' : 'default'"
            :disabled="mode === 'edit'"
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
          <a-input-search placeholder="输入模板名" v-model="tempInfo.name">
            <a-button slot="enterButton" @click.native="onUseImgNameClicked">使用图片名</a-button>
          </a-input-search>
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
      bkHost: process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:4000',
      mode: 'view',
      tempInfo: {
        _id: '',
        imgURL: '',
        editRects: [],
        storeRect: {
          width: 1, height: 1
        }
      },
      templates: [],
      configDlg: {
        visible: false,
        confirming: false,
      }
    }
  },
  created () {
    this.resetTempInfo()
    this.refreshTemplates()
  },
  methods: {
    async refreshTemplates () {
      const url = this.bkHost + '/hand-write-receipt/mdl/v1/templates'
      this.templates = await utils.reqBack(this, axios.get(url)) || []
    },
    async onSelImgChanged (e) {
      if (e.file.response) {
        const resp = e.file.response
        if (resp.error) {
          this.$error({
            title: '选择文件错误！',
            content: resp.error,
          })
        } else {
          this.tempInfo.imgURL = resp.result
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
      let url = this.bkHost + '/hand-write-receipt/mdl/v1/template'
      url += this.tempInfo._id ? `/${this.tempInfo._id}` : ''
      const method = this.tempInfo._id ? 'put' : 'post'
      delete this.tempInfo._id
      const result = await utils.reqBack(this, axios[method](url, this.tempInfo))
      const newTemp = result[0]
      console.log(newTemp)
      this.configDlg.confirming = false
      this.configDlg.visible = false
      this.$message.success(this.tempInfo._id ? '模板保存成功！' : '模板创建成功', 2, () => {
        this.resetTempInfo()
        this.refreshTemplates()
      })
    },
    onUseImgNameClicked () {
      const url = URL.parse(this.tempInfo.imgURL)
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
          await axios.delete(`${self.bkHost}/hand-write-receipt/mdl/v1/template/${tmpId}`)
          return self.refreshTemplates()
        },
      })
    },
    resetTempInfo () {
      this.tempInfo = {
        _id: '',
        name: '',
        imgURL: '',
        editRects: [],
        storeRect: {
          width: 1, height: 1
        }
      }
    }
  }
}
</script>

<style>
.ant-page-header-back {
  margin-top: 3px !important;
}

.temp-list {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 47px;
  padding: 1vh 1vw;
  overflow-y: scroll;
}
</style>
