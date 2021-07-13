<template>
  <div>
    <canvas id="tagsCanvas" :width="width" :height="height">
      你的浏览器不支持canvas，请升级浏览器
    </canvas>
    <div v-show="mode !== ''" style="position: fixed; bottom: 80px; left: 0; padding: 1vh 1vw">
      <a-button :type="mode === 'edit' ? 'danger' : 'primary'" icon="plus" @click="onAddSelRect"/>
    </div>
    <a-modal
      title="输入编辑区域描述文字"
      :visible="editDescDlg.visible"
      @ok="onEdtDscDlgConfirmed"
      @cancel="editDescDlg.visible = false"
    >
      <a-input placeholder="输入描述文字" v-model="editDescDlg.descWords"/>
    </a-modal>
  </div>
</template>

<script>
import utils from '../commons/utils'
export default {
  props: {
    'width': Number,
    'height': Number,
    'mode': String,
    'onSelRectCreated': Function
  },
  data () {
    return {
      canvas: null,
      context: null,
      history: [],
      dragging: false,
      operRect: null,
      mousedown: {
        x: 0, y: 0, t: ''
      },
      selColor: null,
      editSelRects: [],
      storeSelRect: {},
      cvsWH: {
        rcpWid: 0, rcpHgt: 0
      },
      clrMap: {
        edit: '#ff4d4f',
        store: '#1890ff'
      },
      editDescDlg: {
        visible: false,
        descWords: '',
        index: -1
      }
    }
  },
  watch: {
    'mode': function (n) {
      this.selColor = this.clrMap[n]
    }
  },
  async created () {
    this.editSelRects = []
    this.resetRect(this.storeSelRect, 'store')
    await utils.waitFor('#tempImage', $img => $img.height() > 0)
    this.canvas = document.getElementById('tagsCanvas')
    this.resetCvsWH()
    this.context = this.canvas.getContext('2d')
    const self = this
    this.canvas.onmousedown = function (e) {
      e.preventDefault()
      self.mousedown = self.wdsToCvs(e.clientX, e.clientY, e.which)
      for (const editSelRect of self.editSelRects) {
        self.mosDownInSelRect(editSelRect)
      }
      self.mosDownInSelRect(self.storeSelRect)
      if (self.mode !== '') {
        self.dragging = true
      }
      self.refreshScreen()
    }
    this.canvas.onmousemove = function (e) {
      e.preventDefault()
      const mosPos = self.wdsToCvs(e.clientX, e.clientY, e.which)
      if (self.dragging) {
        self.clrLastHis()
        self.updSelRect(mosPos)
      }
      for (const editSelRect of self.editSelRects) {
        self.mosMoveInSelRect(editSelRect, mosPos)
      }
      self.mosMoveInSelRect(self.storeSelRect, mosPos)
    }
    this.canvas.onmouseup = function (e) {
      e.preventDefault()
      for (const editSelRect of self.editSelRects) {
        self.mosUpInSelRect(editSelRect)
      }
      self.mosUpInSelRect(self.storeSelRect)
      if (self.dragging) {
        self.dragging = false
        const bdRect = self.buildRect(
          self.mousedown, self.wdsToCvs(e.clientX, e.clientY, e.which)
        )
        let rect = null
        if (self.mode === 'edit') {
          if (self.operRect) {
            rect = self.operRect
          } else {
            rect = self.resetRect({}, 'edit')
            self.editSelRects.push(rect)
          }
        } else {
          rect = self[`${self.mode}SelRect`]
        }
        rect.left = bdRect.left
        rect.top = bdRect.top
        rect.width = bdRect.width
        rect.height = bdRect.height
        self.onSelRectCreated()
      }
      self.refreshScreen()
    }
    this.addHistory()
  },
  updated () {
    this.refreshScreen()
  },
  methods: {
    mosDownInSelRect (rect) {
      if (rect.close.in) {
        rect.close.down = true
      } else if (rect.desc && rect.desc.in) {
        rect.desc.down = true
      } else if (rect.move.in) {
        rect.move.down = true
        rect.move.dx = rect.left - this.mousedown.x * this.cvsWH.rcpWid
        rect.move.dy = rect.top - this.mousedown.y * this.cvsWH.rcpHgt
      } else if (rect.resizes.lftTop.in) {
        rect.resizes.lftTop.down = true
        this.resizeStart(rect, 'right', 'bottom')
      } else if (rect.resizes.rgtTop.in) {
        rect.resizes.rgtTop.down = true
        this.resizeStart(rect, 'left', 'bottom')
      } else if (rect.resizes.rgtBtm.in) {
        rect.resizes.rgtBtm.down = true
        this.resizeStart(rect, 'left', 'top')
      } else if (rect.resizes.lftBtm.in) {
        rect.resizes.lftBtm.down = true
        this.resizeStart(rect, 'right', 'top')
      }
    },
    mosMoveInSelRect (rect, mosPos) {
      if (rect.width && rect.height) {
        this.switchMouseHover(rect, 'close', 'pointer', mosPos)
        if (rect.desc) {
          this.switchMouseHover(rect, 'desc', 'pointer', mosPos)
        }
        this.switchMouseHover(rect, 'move', 'move', mosPos)
        if (rect.move.down) {
          rect.left = mosPos.x * this.cvsWH.rcpWid + rect.move.dx
          rect.top = mosPos.y * this.cvsWH.rcpHgt + rect.move.dy
          this.refreshScreen()
        }
        this.switchMouseHover(rect, 'resizes.lftTop', 'nw-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.top', 'n-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.rgtTop', 'ne-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.right', 'e-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.rgtBtm', 'se-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.bottom', 's-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.lftBtm', 'sw-resize', mosPos)
        this.switchMouseHover(rect, 'resizes.left', 'w-resize', mosPos)
      }
    },
    mosUpInSelRect (rect) {
      if (rect.close.in) {
        this.resetRect(rect, rect.mode)
        document.body.style.cursor = 'default'
      } else if (rect.desc && rect.desc.in) {
        this.editDescDlg.visible = true
        this.operRect = rect
        rect.desc.down = false
        document.body.style.cursor = 'default'
      } else if (rect.move.in || rect.move.down) {
        rect.move.down = false
        document.body.style.cursor = 'default'
      } else if (rect.resizes.lftTop.in) {
        rect.resizes.lftTop.down = false
      } else if (rect.resizes.rgtTop.in) {
        rect.resizes.rgtTop.down = false
      } else if (rect.resizes.rgtBtm.in) {
        rect.resizes.rgtBtm.down = false
      } else if (rect.resizes.lftBtm.in) {
        rect.resizes.lftBtm.down = false
      }
    },
    resizeStart (rect, xAxios, yAxios) {
      this.mousedown = {
        x: (rect.left + (xAxios === 'right' ? rect.width : 0)) * this.canvas.width,
        y: (rect.top + (yAxios === 'bottom' ? rect.height : 0)) * this.canvas.height
      }
      this.dragging = true
      this.operRect = rect
      this.onSelRectCreated(rect.mode)
    },
    resetCvsWH () {
      this.cvsWH.rcpWid = 1 / this.canvas.width
      this.cvsWH.rcpHgt = 1 / this.canvas.height
    },
    updSelRect (tgtPoi) {
      const left = Math.min(tgtPoi.x, this.mousedown.x)
      const top = Math.min(tgtPoi.y, this.mousedown.y)
      const width = Math.abs(tgtPoi.x - this.mousedown.x)
      const height = Math.abs(tgtPoi.y - this.mousedown.y)

      this.context.save()
      this.context.beginPath()
      this.context.strokeStyle = this.selColor
      this.context.rect(left, top, width, height)
      this.context.stroke()
      if (this.operRect) {
        this.drawResizeBtns(this.operRect, {
          left, top, width, height
        })
      }
      this.context.restore()
    },
    refreshScreen () {
      if (!this.context) {
        return
      }
      this.clrScreen()
      this.context.save()
      this.context.beginPath()
      this.drawSelRect(this.storeSelRect)
      for (const editSelRect of this.editSelRects) {
        this.drawSelRect(editSelRect)
      }
      this.context.restore()
      this.addHistory()
    },
    drawSelRect (rect) {
      if (rect.width && rect.height) {
        const left = rect.left * this.canvas.width
        const top = rect.top * this.canvas.height
        const width = rect.width * this.canvas.width
        const height = rect.height * this.canvas.height

        this.context.fillStyle = rect.color + '55'
        this.context.fillRect(left, top, width, height)
        if (rect.desc && rect.desc.words) {
          const descWords = rect.desc.words
          const fontSz = Math.min(width / descWords.length, height)
          this.context.fillStyle = rect.color
          this.context.font = `${fontSz}px Arial`
          const txtRect = this.context.measureText(descWords)
          this.context.fillText(descWords,
            left + (width >> 1) - (txtRect.width >> 1),
            top + (height >> 1) + (fontSz >> 1)
          )
        }
        this.drawCtrlBtn(rect, left, top, width)
        if (!this.dragging) {
          this.drawResizeBtns(rect, {
            left, top, width, height
          })
        }
      }
    },
    drawCtrlBtn (rect, left, top, width) {
      const right = left + width
      const clsBtnL = right + 20
      let clsBtnT = top - 10
      if (rect.close.down) {
        this.context.fillStyle = 'grey'
      } else {
        this.context.fillStyle = 'white'
      }
      this.context.fillRect(clsBtnL, clsBtnT, 20, 20)
      const clsBtnR = clsBtnL + 20
      let clsBtnB = clsBtnT + 20
      rect.close.l = clsBtnL
      rect.close.t = clsBtnT
      rect.close.r = clsBtnR
      rect.close.b = clsBtnB
      this.context.strokeStyle = 'black'
      this.context.moveTo(clsBtnL + 3, clsBtnT + 3)
      this.context.lineTo(clsBtnR - 3, clsBtnB - 3)
      this.context.moveTo(clsBtnR - 3, clsBtnT + 3)
      this.context.lineTo(clsBtnL + 3, clsBtnB - 3)
      this.context.stroke()

      if (rect.move.down) {
        this.context.fillStyle = 'grey'
      } else {
        this.context.fillStyle = 'white'
      }
      clsBtnT += 30
      this.context.fillRect(clsBtnL, clsBtnT, 20, 20)
      clsBtnB += 30
      rect.move.l = clsBtnL
      rect.move.t = clsBtnT
      rect.move.r = clsBtnR
      rect.move.b = clsBtnB
      this.context.moveTo(clsBtnL + 10, clsBtnT + 2)
      this.context.lineTo(clsBtnL + 10, clsBtnB - 2)
      this.context.moveTo(clsBtnL + 2, clsBtnT + 10)
      this.context.lineTo(clsBtnR - 2, clsBtnT + 10)

      this.context.moveTo(clsBtnL + 10, clsBtnT + 2)
      this.context.lineTo(clsBtnL + 8, clsBtnT + 5)
      this.context.moveTo(clsBtnL + 10, clsBtnT + 2)
      this.context.lineTo(clsBtnL + 12, clsBtnT + 5)

      this.context.moveTo(clsBtnL + 10, clsBtnB - 2)
      this.context.lineTo(clsBtnL + 8, clsBtnB - 5)
      this.context.moveTo(clsBtnL + 10, clsBtnB - 2)
      this.context.lineTo(clsBtnL + 12, clsBtnB - 5)

      this.context.moveTo(clsBtnL + 2, clsBtnT + 10)
      this.context.lineTo(clsBtnL + 5, clsBtnT + 8)
      this.context.moveTo(clsBtnL + 2, clsBtnT + 10)
      this.context.lineTo(clsBtnL + 5, clsBtnT + 12)

      this.context.moveTo(clsBtnR - 2, clsBtnT + 10)
      this.context.lineTo(clsBtnR - 5, clsBtnT + 8)
      this.context.moveTo(clsBtnR - 2, clsBtnT + 10)
      this.context.lineTo(clsBtnR - 5, clsBtnT + 12)

      this.context.stroke()

      if (!rect.desc) {
        return
      }
      if (rect.desc.down) {
        this.context.fillStyle = 'grey'
      } else {
        this.context.fillStyle = 'white'
      }
      clsBtnT += 30
      this.context.fillRect(clsBtnL, clsBtnT, 20, 20)
      clsBtnB += 30
      rect.desc.l = clsBtnL
      rect.desc.t = clsBtnT
      rect.desc.r = clsBtnR
      rect.desc.b = clsBtnB
      this.context.moveTo(clsBtnL + 4, clsBtnT + 4)
      this.context.lineTo(clsBtnL + 7, clsBtnB - 4)
      this.context.lineTo(clsBtnL + 10, clsBtnT + 4)
      this.context.lineTo(clsBtnR - 7, clsBtnB - 4)
      this.context.lineTo(clsBtnR - 4, clsBtnT + 4)
      this.context.stroke()
    },
    drawResizeBtns (rctIns, rect) {
      const right = rect.left + rect.width
      const bottom = rect.top + rect.height
      // const hfWid = rect.width >> 1
      // const hfHgt = rect.height >> 1
      this.drawResizeBtn(rctIns, 'lftTop', rect.left, rect.top)
      // this.drawResizeBtn(rctIns, 'top', rect.left + hfWid, rect.top)
      this.drawResizeBtn(rctIns, 'rgtTop', right, rect.top)
      // this.drawResizeBtn(rctIns, 'right', right, rect.top + hfHgt)
      this.drawResizeBtn(rctIns, 'rgtBtm', right, bottom)
      // this.drawResizeBtn(rctIns, 'bottom', right - hfWid, bottom)
      this.drawResizeBtn(rctIns, 'lftBtm', rect.left, bottom)
      // this.drawResizeBtn(rctIns, 'left', rect.left, bottom - hfHgt)
    },
    drawResizeBtn (rect, rszKey, cx, cy) {
      if (rect.resizes[rszKey].down) {
        this.context.fillStyle = rect.color
      } else {
        this.context.fillStyle = 'white'
      }
      rect.resizes[rszKey].l = cx - 5
      rect.resizes[rszKey].t = cy - 5
      rect.resizes[rszKey].r = cx + 5
      rect.resizes[rszKey].b = cy + 5
      this.context.fillRect(cx - 5, cy - 5, 10, 10)
    },
    switchMouseHover (rect, subKeys, cursor, mosPos) {
      const attr = utils.acsObjAttr(rect, subKeys)
      if (this.insideBox(attr, mosPos)) {
        document.body.style.cursor = cursor
        attr.in = true
      } else if (attr.in) {
        document.body.style.cursor = 'default'
        attr.in = false
      }
    },
    wdsToCvs (x, y, t) {
      const bbox = this.canvas.getBoundingClientRect()
      return {
        x: x - bbox.left * (this.canvas.width / bbox.width),
        y: y - bbox.top * (this.canvas.height / bbox.height),
        t
      }
    },
    buildRect (ltPoi, rbPoi) {
      return {
        left: Math.min(ltPoi.x, rbPoi.x) * this.cvsWH.rcpWid,
        top: Math.min(ltPoi.y, rbPoi.y) * this.cvsWH.rcpHgt,
        width: Math.abs(rbPoi.x - ltPoi.x) * this.cvsWH.rcpWid,
        height: Math.abs(rbPoi.y - ltPoi.y)  * this.cvsWH.rcpHgt
      }
    },
    addHistory () {
      this.history.push(this.context.getImageData(
        0, 0, this.canvas.width, this.canvas.height
      ))
    },
    clrLastHis () {
      this.context.putImageData(
        this.history[this.history.length - 1], 0, 0
      )
    },
    clrScreen () {
      if (!this.history.length) {
        return
      }
      this.history = [this.history[0]]
      this.context.putImageData(this.history[0], 0, 0)
    },
    onAddSelRect () {
    },
    insideBox (box, pos) {
      return pos.x >= box.l && pos.x <= box.r
        && pos.y >= box.t && pos.y <= box.b
    },
    resetRect (rect, mode) {
      rect.mode = mode
      rect.color = this.clrMap[mode]
      rect.left = 0
      rect.top = 0
      rect.width = 0
      rect.height = 0
      rect.resizes = {
        lftTop: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        top: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        rgtTop: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        left: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        right: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        lftBtm: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        bottom: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
        rgtBtm: {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false
        },
      }
      rect.close = {
        l: 0, r: 0, t: 0, b: 0,
        in: false, down: false
      }
      rect.move = {
        l: 0, r: 0, t: 0, b: 0,
        in: false, down: false,
        dx: 0, dy: 0
      }
      if (rect.mode === 'edit') {
        rect.desc = {
          l: 0, r: 0, t: 0, b: 0,
          in: false, down: false,
          words: ''
        }
      }
      return rect
    },
    onEdtDscDlgConfirmed () {
      this.operRect.desc.words = this.editDescDlg.descWords
      this.editDescDlg.descWords = ''
      this.editDescDlg.visible = false
      this.operRect = null
    }
  }
}
</script>

<style>
#tagsCanvas {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0 auto;
}
</style>