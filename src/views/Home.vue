<template>
  <div class="h-100`">
    <div v-if="!$route.query.t" class="center-container">
      <h5>{{noIdMsg}}</h5>
    </div>
    <div v-else>
      <img-with-cvs ref="img-with-cvs" :bottom="47" :tempInfo="tempInfo"/>
      <div class="fix-bottom">
        <a-button type="primary" block @click="onReceiptClicked">提交</a-button>
        <a-modal title="个人信息" centered
          :visible="sbtInfo.visible"
          :confirm-loading="sbtInfo.loading"
          @ok="onReceiptSubmit"
          @cancel="sbtInfo.visible = false"
        >
          <a-input class="mb-5" placeholder="输入姓名" v-model="sbtInfo.name"/>
          <a-input-search placeholder="输入主题" v-model="sbtInfo.topic">
            <a-button slot="enterButton" @click.native="sbtInfo.topic = tempInfo.name">
              使用模板名
            </a-button>
          </a-input-search>
        </a-modal>
      </div>
    </div>
  </div>
</template>

<script>
import utils from '../commons/utils'
import imgWithCvs from '../components/imgWithCvs'
export default {
  components: {
    'img-with-cvs': imgWithCvs
  },
  data () {
    return {
      noIdMsg: '未指定模板，请携带模板ID再请求该页面！',
      tempInfo: {
        imgURL: '',
        editRects: [],
        selectRects: [],
        storeRect: {
          width: 1, height: 1
        }
      },
      sbtInfo: {
        visible: false,
        loading: false,
        name: '',
        topic: ''
      }
    }
  },
  async created () {
    if (!this.$route.query.t) {
      return
    }
    const path = `/hand-write-receipt/mdl/v1/template/${this.$route.query.t}`
    const result = await utils.reqBack(this, path, 'get')
    this.tempInfo = result[0]
  },
  methods: {
    onReceiptClicked () {
      if (this.$refs['img-with-cvs'].validReceipt()) {
        this.sbtInfo.visible = true
      } else {
        this.$message.error('请完整填写所需信息！')
      }
    },
    async onReceiptSubmit () {
      this.sbtInfo.loading = true
      const rcptName = `${this.sbtInfo.topic}-${this.sbtInfo.name}.png`
      const rcptImgURL = await this.$refs['img-with-cvs'].cutReceipt(rcptName)
      const path = '/hand-write-receipt/mdl/v1/receipt'
      const newRcpt = await utils.reqBack(this, path, 'post', {
        name: this.sbtInfo.name,
        topic: this.sbtInfo.topic,
        imgURL: rcptImgURL,
      })
      console.log(newRcpt)
      this.sbtInfo.loading = false
      this.sbtInfo.visible = false
      this.$message.success('回执提交成功！')
    }
  }
}
</script>
