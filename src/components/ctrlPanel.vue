<template>
  <div>
    <div>
      <a-button type="primary" icon="arrow-up" class="ctl-top-btn" @click="onCtrlBtnClicked('up')"/>
      <br/>
      <a-button-group>
        <a-button type="primary" icon="arrow-left" @click="onCtrlBtnClicked('left')"/>
        <a-button type="primary" icon="sync" @click="onCtrlBtnClicked('reset')"/>
        <a-button type="primary" icon="arrow-right" @click="onCtrlBtnClicked('right')"/>
      </a-button-group>
      <br/>
      <a-button type="primary" icon="arrow-down" class="ctl-btm-btn" @click="onCtrlBtnClicked('down')"/>
    </div>
    <br/>
    <a-button-group>
      <a-button type="primary" icon="zoom-in" @click="onCtrlBtnClicked('zoomIn')"/>
      <a-button type="primary" icon="zoom-out" @click="onCtrlBtnClicked('zoomOut')"/>
    </a-button-group>
  </div>
</template>

<script>
export default {
  props: {
    'onCtrlBtnClicked': Function
  }
}
</script>

<style>
.ctl-top-btn {
  border-bottom: 0 !important;
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
.ctl-btm-btn {
  border-top: 0 !important;
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}
</style>
