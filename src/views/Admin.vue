<template>
  <div class="h-100">
    <div v-if="!uploadTemp.imgURL" class="center-container">
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
        <a-button type="primary" @click="uploadTemp.loading = true">
          <a-icon type="upload"/> 上传模板图片
        </a-button>
      </a-upload>
    </div>
    <div v-else class="h-100">
      <div style="position: fixed; left: 0; right: 0; top: 0; bottom: 80px; overflow-y: scroll">
        <div :style="`position: relative; top: ${edtImg.top}px; left: ${edtImg.left}px`">
          <img id="tempImage" :src="uploadTemp.imgURL" :style="`width: ${edtImg.width}%; height: auto`"/>
          <tags-canvas ref="tagsCanvas" :width="edtImg.cvsWid" :height="edtImg.cvsHgt" :mode="edtImg.mode"
            :onSelRectCreated="mode => {edtImg.mode = mode || ''}"
          />
        </div>
        <div style="position: fixed; right: 0; bottom: 80px; padding: 1vh 1vw">
          <ctrl-panel :onCtrlBtnClicked="onCtrlBtnClicked"/>
        </div>
      </div>
      <div style="position: fixed; left: 0; right: 0; bottom: 0; padding: 1vh 1vw">
        <div class="mb-5 d-flex justify-content-around">
          <a-button class="w-100 mr-1"
            :type="edtImg.mode === 'edit' ? 'danger' : 'default'"
            :disabled="edtImg.mode === 'store'"
            @click="edtImg.mode = edtImg.mode !== 'edit' ? 'edit' : ''"
          >标记需编辑区域</a-button>
          <a-button class="w-100"
            :type="edtImg.mode === 'store' ? 'primary' : 'default'"
            :disabled="edtImg.mode === 'edit'"
            @click="edtImg.mode = edtImg.mode !== 'store' ? 'store' : ''"
          >标记回执区域</a-button>
        </div>
        <a-button type="primary" block>提交</a-button>
      </div>
    </div>
  </div>
</template>

<script>
import ctrlPanel from '../components/ctrlPanel'
import tagsCanvas from '../components/tagsCanvas'
import utils from '../commons/utils'
import $ from 'jquery'
export default {
  components: {
    'ctrl-panel': ctrlPanel,
    'tags-canvas': tagsCanvas
  },
  data () {
    return {
      bkHost: process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:4000',
      uploadTemp: {
        imgURL: '',
        loading: false
      },
      edtImg: {
        mode: '',
        top: 0,
        left: 0,
        mvSpd: 10,
        width: 100,
        cvsWid: 0,
        cvsHgt: 0,
        sclSpd: 5
      },
    }
  },
  methods: {
    async onSelImgChanged (e) {
      if (e.file.response) {
        const resp = e.file.response
        if (resp.error) {
          this.$error({
            title: '选择文件错误！',
            content: resp.error,
          })
        } else {
          this.uploadTemp.imgURL = resp.result
          await this.updCanvasWH()
        }
      }
      this.uploadTemp.loading = false
    },
    async onCtrlBtnClicked (dir) {
      switch (dir) {
        case 'up':
          this.edtImg.top -= this.edtImg.mvSpd
          break
        case 'down':
          this.edtImg.top += this.edtImg.mvSpd
          break
        case 'left':
          this.edtImg.left += this.edtImg.mvSpd
          break
        case 'right':
          this.edtImg.left -= this.edtImg.mvSpd
          break
        case 'zoomIn':
          this.edtImg.width += this.edtImg.sclSpd
          this.edtImg.mvSpd += 2
          await this.updCanvasWH()
          break
        case 'zoomOut':
          this.edtImg.width -= this.edtImg.sclSpd
          this.edtImg.mvSpd -= 2
          await this.updCanvasWH()
          this.$refs['tagsCanvas'].resetCvsWH()
          break
        case 'reset':
          this.edtImg.top = 0
          this.edtImg.left = 0
          this.edtImg.width = 100
          await this.updCanvasWH()
          this.$refs['tagsCanvas'].resetCvsWH()
      }
    },
    async updCanvasWH () {
      await utils.until(() => {
        const tmpImgHgt = $('#tempImage').height()
        return tmpImgHgt > 0 && tmpImgHgt !== this.edtImg.cvsHgt
      })
      this.edtImg.cvsWid = $('#tempImage').width()
      this.edtImg.cvsHgt = $('#tempImage').height()
    }
  }
}
</script>
