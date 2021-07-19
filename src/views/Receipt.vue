<template>
  <div>
    <div v-if="!selRcpt">
      <div class="fix-top">
        <a-button type="primary" block ghost>筛选</a-button>
      </div>
      <div class="fix-scroll" style="top: 45px">
        <a-list item-layout="horizontal" :data-source="receipts">
          <a-list-item class="plr-5pc" slot="renderItem" slot-scope="receipt">
            <a-button slot="actions" type="danger" @click="onDelReceipt(receipt)">删除</a-button>
            <a-list-item-meta :description="`${receipt.time}`">
              <a slot="title" @click="selRcpt = receipt">{{ receipt.name }}</a>
            </a-list-item-meta>
            <div class="lg-sg-r-container" style="width: 60vw">
              <a class="long-single-row mb-0" @click="selRcpt = receipt">
                {{ receipt.topic }}
              </a>
            </div>
          </a-list-item>
        </a-list>
      </div>
    </div>
    <div v-else>
      <a-page-header
        style="border: 1px solid rgb(235, 237, 240);  padding: 1vh 2vw"
        :title="selRcpt.name"
        :sub-title="selRcpt.topic"
        @back="selRcpt = null"
      >
        <template slot="extra">
          <a-button type="danger" @click="onDelReceipt(selRcpt)">删除</a-button>
        </template>
      </a-page-header>
      <div class="fix-scroll" style="top: 50px">
        <img :src="selRcpt.imgURL" style="width: 100%; height: auto"/>
      </div>
    </div>
  </div>
</template>

<script>
import utils from '../commons/utils'
export default {
  data () {
    return {
      receipts: [],
      selRcpt: null
    }
  },
  async created () {
    await this.refreshRcpts()
  },
  methods: {
    onDelReceipt (receipt) {
      const self = this
      this.$confirm({
        title: '警告',
        content: '确定删除该回执?',
        okText: '确定',
        okType: 'danger',
        cancelText: '取消',
        async onOk() {
          await utils.reqBack(self, `/hand-write-receipt/mdl/v1/receipt/${receipt._id}`, 'delete')
          self.$message.success('删除成功！')
          self.selRcpt = null
          await self.refreshRcpts()
        }
      })
    },
    async refreshRcpts () {
      const result = await utils.reqBack(this, '/hand-write-receipt/mdl/v1/receipts', 'get')
      this.receipts = result.map(receipt => {
        receipt.time =  new Date(receipt.createdAt).toDateString()
        return receipt
      })
    }
  }
}
</script>

<style>
.topic-content {
  width: 50vw;
  word-break: keep-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ant-list-item-meta {
  text-align: left;
}
</style>


