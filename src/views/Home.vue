<template>
  <div class="h-100`">
    <div v-if="!$route.query.t" class="center-container">
      <h5>{{noIdMsg}}</h5>
    </div>
    <div v-else>
      <img-with-cvs ref="img-with-cvs" :bottom="47" :tempInfo="tempInfo"/>
      <div class="fix-bottom">
        <a-button type="primary" block>提交</a-button>
      </div>
    </div>
  </div>
</template>

<script>
import utils from '../commons/utils'
import axios from 'axios'
import imgWithCvs from '../components/imgWithCvs'
export default {
  components: {
    'img-with-cvs': imgWithCvs
  },
  data () {
    return {
      bkHost: process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:4000',
      noIdMsg: '未指定模板，请携带模板ID再请求该页面！',
      tempInfo: {
        imgURL: '',
        editRects: [],
        storeRect: {
          width: 1, height: 1
        }
      }
    }
  },
  async created () {
    if (!this.$route.query.t) {
      return
    }
    const url = `${this.bkHost}/hand-write-receipt/mdl/v1/template/${this.$route.query.t}`
    const result = await utils.reqBack(this, axios.get(url))
    this.tempInfo = result[0]
    console.log(typeof this.tempInfo)
  }
}
</script>
