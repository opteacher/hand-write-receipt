<template>
  <div class="fix-scroll" :style="`top: ${top}px; bottom: ${bottom}px`">
    <div :style="`position: relative; top: ${cvsInfo.imgTop}px; left: ${cvsInfo.imgLft}px`">
      <img id="tempImage" :src="tempInfo.imgURL" :style="`width: ${cvsInfo.imgWid}%; height: auto`"/>
      <canvas id="tagsCanvas" :width="cvsInfo.width" :height="cvsInfo.height">
        你的浏览器不支持canvas，请升级浏览器
      </canvas>
      <a-modal title="手写文字" centered :visible="hdWrteDlg.visible" @cancel="hdWrteDlg.visible = false">
        <template slot="footer">
          <div style="text-align: center">
            <canvas id="hdWtVwCvs" :width="hdWtCvs.width" height="32" style="background-color: #cccccc"/>
          </div>
          <div class="mt-5">
            <a-button type="primary" @click="onHdWtFinish">完成</a-button>
            <a-button type="primary" @click="onHdWtNext" ghost>下一个</a-button>
          </div>
        </template>
        <canvas id="hdWtCanvas"
          :width="hdWtCvs.width" :height="hdWtCvs.height"
          style="background-color: #cccccc"
        >
          你的浏览器不支持canvas，请升级浏览器
        </canvas>
      </a-modal>
    </div>
    <div :style="`position: fixed; right: 0; bottom: ${bottom}px; padding: 1vh 1vw`">
      <ctrl-panel
        :onCtrlBtnClicked="onCtrlBtnClicked"
        :zoomPerc="cvsInfo.imgWid"
        :hideMoveCtrl="mode === ''"
      />
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
import ctrlPanel from './ctrlPanel'
import utils from '../commons/utils'
export default {
  props: {
    'top': {
      type: Number,
      default: 0
    },
    'bottom': {
      type: Number,
      default: 0
    },
    'tempInfo': {
      type: Object,
      default: () => ({
        imgURL: '',
        editRects: [],
        storeRect: {
          width: 1, height: 1
        }
      })
    },
    'mode': {
      type: String,
      default: ''
    },
    'onSelRectCreated': {
      type: Function,
      default: null
    }
  },
  components: {
    'ctrl-panel': ctrlPanel
  },
  data () {
    return {
      cvsInfo: {
        imgLft: 0,
        imgTop: 0,
        mvSpd: 10,
        imgWid: 100,
        width: 0,
        height: 0,
        canvas: null,
        context: null,
        rcpWid: 0,
        rcpHgt: 0
      },
      history: [],
      dragging: false,
      operRect: null,
      mousedown: {
        x: 0, y: 0
      },
      selColor: null,
      editDescDlg: {
        visible: false,
        descWords: '',
      },
      hdWrteDlg: {
        visible: false
      },
      hdWtCvs: {
        canvas: null,
        context: null,
        width: 0,
        height: 0,
        writing: false,
        strokes: [],
        lastStk: [],
        words: [],
        writeBoard: null,
        viewBoard: null,
        vwContext: null
      }
    }
  },
  async created () {
    await utils.until(() => this.tempInfo.imgURL)
    this.resetRect(this.tempInfo.storeRect, 'store')
    for (let i = 0; i < this.tempInfo.editRects.length; ++i) {
      this.resetRect(this.tempInfo.editRects[i], 'edit')
    }
    await this.updCanvasWH()
    this.cvsInfo.canvas = document.getElementById('tagsCanvas')
    this.cvsInfo.context = this.cvsInfo.canvas.getContext('2d')
    this.addHistory()
    this.refreshScreen()
    
    const self = this
    this.cvsInfo.canvas.onmousedown = function (e) {
      e.preventDefault()
      self.mousedown = self.wdsToCvs(e.clientX, e.clientY)
      for (const editRect of self.tempInfo.editRects) {
        self.mosDownInRect(editRect)
      }
      self.mosDownInRect(self.tempInfo.storeRect)
      if (self.mode === 'edit' || self.mode === 'store') {
        self.dragging = true
      }
      self.refreshScreen()
    }
    this.cvsInfo.canvas.onmousemove = function (e) {
      e.preventDefault()
      const mosPos = self.wdsToCvs(e.clientX, e.clientY)
      if (self.dragging) {
        self.clrLastHis()
        self.updSelRect(mosPos)
      }
      for (const editRect of self.tempInfo.editRects) {
        self.mosMoveInRect(editRect, mosPos)
      }
      self.mosMoveInRect(self.tempInfo.storeRect, mosPos)
    }
    this.cvsInfo.canvas.onmouseup = function (e) {
      e.preventDefault()
      for (const editRect of self.tempInfo.editRects) {
        self.mosUpInRect(editRect)
      }
      self.mosUpInRect(self.tempInfo.storeRect)
      if (self.dragging) {
        self.dragging = false
        const bdRect = self.buildRect(
          self.mousedown, self.wdsToCvs(e.clientX, e.clientY)
        )
        let rect = null
        if (self.mode === 'edit') {
          if (self.operRect) {
            rect = self.operRect
          } else {
            rect = self.resetRect({}, 'edit')
            self.tempInfo.editRects.push(rect)
          }
        } else {
          rect = self.tempInfo.storeRect
        }
        rect.left = bdRect.left
        rect.top = bdRect.top
        rect.width = bdRect.width
        rect.height = bdRect.height
        if (self.onSelRectCreated) {
          self.onSelRectCreated('view')
        }
      }
      self.refreshScreen()
    }
  },
  methods: {
    mosDownInRect (rect) {
      if (!this.mode && rect.rect.in) {
        rect.rect.down = true
      } else if (rect.btnClose.in) {
        rect.btnClose.down = true
      } else if (rect.btnDesc && rect.btnDesc.in) {
        rect.btnDesc.down = true
      } else if (rect.btnMove.in) {
        rect.btnMove.down = true
        rect.btnMove.dx = rect.left - this.mousedown.x * this.cvsInfo.rcpWid
        rect.btnMove.dy = rect.top - this.mousedown.y * this.cvsInfo.rcpHgt
      } else if (rect.btnResizes.lftTop.in) {
        rect.btnResizes.lftTop.down = true
        this.resizeStart(rect, 'right', 'bottom')
      } else if (rect.btnResizes.rgtTop.in) {
        rect.btnResizes.rgtTop.down = true
        this.resizeStart(rect, 'left', 'bottom')
      } else if (rect.btnResizes.rgtBtm.in) {
        rect.btnResizes.rgtBtm.down = true
        this.resizeStart(rect, 'left', 'top')
      } else if (rect.btnResizes.lftBtm.in) {
        rect.btnResizes.lftBtm.down = true
        this.resizeStart(rect, 'right', 'top')
      }
    },
    mosMoveInRect (rect, mosPos) {
      if (rect.width && rect.height) {
        this.switchMouseHover(rect, 'btnClose', 'pointer', mosPos)
        if (rect.btnDesc) {
          this.switchMouseHover(rect, 'btnDesc', 'pointer', mosPos)
        }
        this.switchMouseHover(rect, 'btnMove', 'move', mosPos)
        if (rect.btnMove.down) {
          rect.left = mosPos.x * this.cvsInfo.rcpWid + rect.btnMove.dx
          rect.top = mosPos.y * this.cvsInfo.rcpHgt + rect.btnMove.dy
          this.refreshScreen()
        }
        this.switchMouseHover(rect, 'btnResizes.lftTop', 'nw-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.top', 'n-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.rgtTop', 'ne-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.right', 'e-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.rgtBtm', 'se-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.bottom', 's-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.lftBtm', 'sw-resize', mosPos)
        this.switchMouseHover(rect, 'btnResizes.left', 'w-resize', mosPos)
        if (!this.mode) {
          this.switchMouseHover(rect, 'rect', 'pointer', mosPos)
        }
      }
    },
    mosUpInRect (rect) {
      if (!this.mode && rect.mode === 'edit' && rect.rect.down) {
        rect.rect.down = false
        this.hdWrteDlg.visible = true
        this.operRect = rect
        document.body.style.cursor = 'default'
        if (!this.hdWtCvs.viewBoard || !this.hdWtCvs.writeBoard) {
          this.initHdWtCvs()
        }
      } else if (rect.btnClose.down) {
        if (rect.mode === 'edit') {
          for (let i = 0; i < this.tempInfo.editRects.length; ++i) {
            if (rect === this.tempInfo.editRects[i]) {
              this.tempInfo.editRects.splice(i, 1)
            }
          }
        } else {
          this.resetRect(rect, rect.mode, true)
        }
        document.body.style.cursor = 'default'
      } else if (rect.btnDesc && rect.btnDesc.down) {
        this.editDescDlg.visible = true
        this.operRect = rect
        this.editDescDlg.descWords = rect.desc
        rect.btnDesc.down = false
        document.body.style.cursor = 'default'
      } else if (rect.btnMove.in || rect.btnMove.down) {
        rect.btnMove.down = false
        document.body.style.cursor = 'default'
      } else if (rect.btnResizes.lftTop.in) {
        rect.btnResizes.lftTop.down = false
      } else if (rect.btnResizes.rgtTop.in) {
        rect.btnResizes.rgtTop.down = false
      } else if (rect.btnResizes.rgtBtm.in) {
        rect.btnResizes.rgtBtm.down = false
      } else if (rect.btnResizes.lftBtm.in) {
        rect.btnResizes.lftBtm.down = false
      }
    },
    resizeStart (rect, xAxios, yAxios) {
      this.mousedown = {
        x: (rect.left + (xAxios === 'right' ? rect.width : 0)) * this.cvsInfo.width,
        y: (rect.top + (yAxios === 'bottom' ? rect.height : 0)) * this.cvsInfo.height
      }
      this.dragging = true
      this.operRect = rect
      if (this.onSelRectCreated) {
        this.onSelRectCreated(rect.mode)
      }
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
    updSelRect (tgtPoi) {
      const left = Math.min(tgtPoi.x, this.mousedown.x)
      const top = Math.min(tgtPoi.y, this.mousedown.y)
      const width = Math.abs(tgtPoi.x - this.mousedown.x)
      const height = Math.abs(tgtPoi.y - this.mousedown.y)

      const context = this.cvsInfo.context
      context.save()
      context.beginPath()
      context.strokeStyle = utils.clrMap[this.mode]
      context.rect(left, top, width, height)
      context.stroke()
      if (this.operRect) {
        this.drawResizeBtns(this.operRect,
          left, top, width, height
        )
      }
      context.restore()
    },
    refreshScreen () {
      if (!this.cvsInfo.context) {
        return
      }
      this.clrScreen()
      this.cvsInfo.context.save()
      this.cvsInfo.context.beginPath()
      if (this.tempInfo.storeRect.width !== 1
      && this.tempInfo.storeRect.height !== 1) {
        this.drawSelRect(this.tempInfo.storeRect, 'store')
      }
      for (const editRect of this.tempInfo.editRects) {
        this.drawSelRect(editRect, 'edit')
      }
      this.cvsInfo.context.restore()
      this.addHistory()
    },
    drawSelRect (rect, mode) {
      if (rect.width && rect.height) {
        const left = rect.left * this.cvsInfo.width
        const top = rect.top * this.cvsInfo.height
        const width = rect.width * this.cvsInfo.width
        const height = rect.height * this.cvsInfo.height

        const context = this.cvsInfo.context
        rect.rect.l = left
        rect.rect.t = top
        rect.rect.r = left + width
        rect.rect.b = top + height
        if (!this.mode && rect.data.length) {
          this.drawHdWtWds(context, rect.data, height, height, left, top)
          return
        }
        context.fillStyle = `rgba(255, 77, 79, ${!rect.rect.down ? '.3' : '1'})`
        context.fillRect(left, top, width, height)
        if (rect.desc) {
          const fontSz = Math.min(width / rect.desc.length, height)
          context.fillStyle = utils.clrMap[mode]
          context.font = `${fontSz}px Arial`
          const txtRect = context.measureText(rect.desc)
          context.fillText(rect.desc,
            left + (width >> 1) - (txtRect.width >> 1),
            top + (height >> 1) + (fontSz >> 1)
          )
        }
        if (this.mode) {
          this.drawCtrlBtn(rect, left, top, width)
          if (!this.dragging) {
            this.drawResizeBtns(rect, left, top, width, height)
          }
        }
      }
    },
    drawCtrlBtn (rect, left, top, width) {
      const context = this.cvsInfo.context
      const right = left + width
      let clsBtnL = right + 20
      let clsBtnT = top - 10
      if (rect.btnClose.down) {
        context.fillStyle = 'grey'
      } else {
        context.fillStyle = '#cdcdcd'
      }
      context.fillRect(clsBtnL, clsBtnT, 20, 20)
      let clsBtnR = clsBtnL + 20
      let clsBtnB = clsBtnT + 20
      rect.btnClose.l = clsBtnL
      rect.btnClose.t = clsBtnT
      rect.btnClose.r = clsBtnR
      rect.btnClose.b = clsBtnB
      context.strokeStyle = 'black'
      context.moveTo(clsBtnL + 3, clsBtnT + 3)
      context.lineTo(clsBtnR - 3, clsBtnB - 3)
      context.moveTo(clsBtnR - 3, clsBtnT + 3)
      context.lineTo(clsBtnL + 3, clsBtnB - 3)
      context.stroke()

      if (rect.btnMove.down) {
        context.fillStyle = 'grey'
      } else {
        context.fillStyle = '#cdcdcd'
      }
      clsBtnL = left - 40
      context.fillRect(clsBtnL, clsBtnT, 20, 20)
      clsBtnR = clsBtnL + 20
      rect.btnMove.l = clsBtnL
      rect.btnMove.t = clsBtnT
      rect.btnMove.r = clsBtnR
      rect.btnMove.b = clsBtnB
      context.moveTo(clsBtnL + 10, clsBtnT + 2)
      context.lineTo(clsBtnL + 10, clsBtnB - 2)
      context.moveTo(clsBtnL + 2, clsBtnT + 10)
      context.lineTo(clsBtnR - 2, clsBtnT + 10)

      context.moveTo(clsBtnL + 10, clsBtnT + 2)
      context.lineTo(clsBtnL + 8, clsBtnT + 5)
      context.moveTo(clsBtnL + 10, clsBtnT + 2)
      context.lineTo(clsBtnL + 12, clsBtnT + 5)

      context.moveTo(clsBtnL + 10, clsBtnB - 2)
      context.lineTo(clsBtnL + 8, clsBtnB - 5)
      context.moveTo(clsBtnL + 10, clsBtnB - 2)
      context.lineTo(clsBtnL + 12, clsBtnB - 5)

      context.moveTo(clsBtnL + 2, clsBtnT + 10)
      context.lineTo(clsBtnL + 5, clsBtnT + 8)
      context.moveTo(clsBtnL + 2, clsBtnT + 10)
      context.lineTo(clsBtnL + 5, clsBtnT + 12)

      context.moveTo(clsBtnR - 2, clsBtnT + 10)
      context.lineTo(clsBtnR - 5, clsBtnT + 8)
      context.moveTo(clsBtnR - 2, clsBtnT + 10)
      context.lineTo(clsBtnR - 5, clsBtnT + 12)

      context.stroke()

      if (!rect.btnDesc) {
        return
      }
      if (rect.btnDesc.down) {
        context.fillStyle = 'grey'
      } else {
        context.fillStyle = '#cdcdcd'
      }
      clsBtnL = right + 20
      clsBtnT += 30
      context.fillRect(clsBtnL, clsBtnT, 20, 20)
      clsBtnR = clsBtnL + 20
      clsBtnB += 30
      rect.btnDesc.l = clsBtnL
      rect.btnDesc.t = clsBtnT
      rect.btnDesc.r = clsBtnR
      rect.btnDesc.b = clsBtnB
      context.moveTo(clsBtnL + 4, clsBtnT + 4)
      context.lineTo(clsBtnL + 7, clsBtnB - 4)
      context.lineTo(clsBtnL + 10, clsBtnT + 4)
      context.lineTo(clsBtnR - 7, clsBtnB - 4)
      context.lineTo(clsBtnR - 4, clsBtnT + 4)
      context.stroke()
    },
    drawResizeBtns (rect, left, top, width, height) {
      const right = left + width
      const bottom = top + height
      // const hfWid = width >> 1
      // const hfHgt = height >> 1
      this.drawResizeBtn(rect, 'lftTop', left, top)
      // this.drawResizeBtn(rect, 'top', left + hfWid, top)
      this.drawResizeBtn(rect, 'rgtTop', right, top)
      // this.drawResizeBtn(rect, 'right', right, top + hfHgt)
      this.drawResizeBtn(rect, 'rgtBtm', right, bottom)
      // this.drawResizeBtn(rect, 'bottom', right - hfWid, bottom)
      this.drawResizeBtn(rect, 'lftBtm', left, bottom)
      // this.drawResizeBtn(rect, 'left', left, bottom - hfHgt)
    },
    drawResizeBtn (rect, rszKey, cx, cy) {
      if (rect.btnResizes[rszKey].down) {
        this.cvsInfo.context.fillStyle = utils.clrMap[rect.mode]
      } else {
        this.cvsInfo.context.fillStyle = '#cdcdcd'
      }
      rect.btnResizes[rszKey].l = cx - 5
      rect.btnResizes[rszKey].t = cy - 5
      rect.btnResizes[rszKey].r = cx + 5
      rect.btnResizes[rszKey].b = cy + 5
      this.cvsInfo.context.fillRect(cx - 5, cy - 5, 10, 10)
    },
    async onCtrlBtnClicked (dir) {
      switch (dir) {
      case 'up':
        this.cvsInfo.imgTop += this.cvsInfo.mvSpd
        break
      case 'down':
        this.cvsInfo.imgTop -= this.cvsInfo.mvSpd
        break
      case 'left':
        this.cvsInfo.imgLft += this.cvsInfo.mvSpd
        break
      case 'right':
        this.cvsInfo.imgLft -= this.cvsInfo.mvSpd
        break
      case 'zoomIn':
        this.cvsInfo.imgWid += 5
        this.cvsInfo.mvSpd += 2
        await this.updCanvasWH()
        this.refreshScreen()
        break
      case 'zoomOut':
        this.cvsInfo.imgWid -= 5
        this.cvsInfo.mvSpd += 2
        await this.updCanvasWH()
        this.refreshScreen()
        break
      case 'zoomReset':
        this.cvsInfo.imgWid = 100
        this.cvsInfo.mvSpd = 10
        await this.updCanvasWH()
        this.refreshScreen()
        break
      }
    },
    async updCanvasWH () {
      const $tmpImg = await utils.waitFor('#tempImage', $img => $img.height())
      this.cvsInfo.width = $tmpImg.width()
      this.cvsInfo.height = $tmpImg.height()
      this.cvsInfo.rcpWid = 1 / this.cvsInfo.width
      this.cvsInfo.rcpHgt = 1 / this.cvsInfo.height
    },
    buildRect (ltPoi, rbPoi) {
      return {
        left: Math.min(ltPoi.x, rbPoi.x) * this.cvsInfo.rcpWid,
        top: Math.min(ltPoi.y, rbPoi.y) * this.cvsInfo.rcpHgt,
        width: Math.abs(rbPoi.x - ltPoi.x) * this.cvsInfo.rcpWid,
        height: Math.abs(rbPoi.y - ltPoi.y)  * this.cvsInfo.rcpHgt
      }
    },
    wdsToCvs (x, y) {
      const bbox = this.cvsInfo.canvas.getBoundingClientRect()
      return {
        x: x - bbox.left * (this.cvsInfo.width / bbox.width),
        y: y - bbox.top * (this.cvsInfo.height / bbox.height)
      }
    },
    insideBox (box, pos) {
      return pos.x >= box.l && pos.x <= box.r
        && pos.y >= box.t && pos.y <= box.b
    },
    onEdtDscDlgConfirmed () {
      this.operRect.desc = this.editDescDlg.descWords
      this.editDescDlg.descWords = ''
      this.editDescDlg.visible = false
      this.operRect = null
      this.refreshScreen()
    },
    clrScreen () {
      if (!this.history.length) {
        return
      }
      this.history = [this.history[0]]
      this.cvsInfo.context.putImageData(this.history[0], 0, 0)
    },
    clrLastHis () {
      this.cvsInfo.context.putImageData(
        this.history[this.history.length - 1], 0, 0
      )
    },
    addHistory () {
      this.history.push(this.cvsInfo.context.getImageData(
        0, 0, this.cvsInfo.width, this.cvsInfo.height
      ))
    },
    resetRect (rect, mode, force = false) {
      const rctBtn = () => ({
        l: 0, r: 0, t: 0, b: 0,
        in: false, down: false
      })
      rect.mode = mode
      rect.left = force ? 0 : (rect.left || 0)
      rect.top = force ? 0 : (rect.top || 0)
      rect.width = force ? 0 : (rect.width || 0)
      rect.height = force ? 0 : (rect.height || 0)
      rect.rect = rctBtn()
      rect.btnResizes = {
        lftTop: rctBtn(),
        top: rctBtn(),
        rgtTop: rctBtn(),
        left: rctBtn(),
        right: rctBtn(),
        lftBtm: rctBtn(),
        bottom: rctBtn(),
        rgtBtm: rctBtn(),
      }
      rect.btnClose = rctBtn()
      rect.btnMove = Object.assign({
        dx: 0, dy: 0
      }, rctBtn())
      if (rect.mode === 'edit') {
        rect.btnDesc = rctBtn()
        rect.data = []
      }
      return rect
    },
    async initHdWtCvs () {
      const $dlgBody = await utils.waitFor('.ant-modal-body', $ele => $ele.width())
      this.hdWtCvs.width = $dlgBody.width()
      this.hdWtCvs.height = this.hdWtCvs.width
      this.hdWtCvs.canvas = document.getElementById('hdWtCanvas')
      this.hdWtCvs.context = this.hdWtCvs.canvas.getContext('2d')
      this.hdWtCvs.writeBoard = this.hdWtCvs.context.getImageData(
        0, 0, this.hdWtCvs.width, this.hdWtCvs.height
      )
      const hdWtVwCvs = document.getElementById('hdWtVwCvs')
      this.hdWtCvs.vwContext = hdWtVwCvs.getContext('2d')
      this.hdWtCvs.viewBoard = this.hdWtCvs.vwContext.getImageData(
        0, 0, this.hdWtCvs.width, 32
      )
      this.refreshHdWtBoard()

      const self = this
      this.hdWtCvs.canvas.addEventListener('touchstart', function (e) {
        e.preventDefault()
        self.hdWtCvs.writing = true
      }, false)
      this.hdWtCvs.canvas.addEventListener('touchmove', function (e) {
        e.preventDefault()
        if (!self.hdWtCvs.writing || !self.hdWtCvs.context) {
          return
        }
        const mosPos = self.pnlToCvs(
          e.touches[0].clientX,
          e.touches[0].clientY
        )
        const context = self.hdWtCvs.context
        if (self.hdWtCvs.lastStk.length) {
          const lstPos = self.hdWtCvs.lastStk[
            self.hdWtCvs.lastStk.length - 1
          ]
          context.beginPath()
          context.moveTo(lstPos.x, lstPos.y)
          context.lineTo(mosPos.x, mosPos.y)
          context.stroke()
        }
        self.hdWtCvs.lastStk.push(mosPos)
      }, false)
      this.hdWtCvs.canvas.addEventListener('touchend', function (e) {
        e.preventDefault()
        self.hdWtCvs.writing = false
        self.hdWtCvs.strokes.push(
          self.hdWtCvs.lastStk
        )
        self.hdWtCvs.lastStk = []
      }, false)
    },
    pnlToCvs (x, y) {
      const bbox = this.hdWtCvs.canvas.getBoundingClientRect()
      return {
        x: x - bbox.left * (this.hdWtCvs.width / bbox.width),
        y: y - bbox.top * (this.hdWtCvs.height / bbox.height)
      }
    },
    onHdWtFinish () {
      this.hdWtCvs.strokes = []
      this.hdWtCvs.lastStk = []
      this.operRect.data = this.hdWtCvs.words
      this.hdWtCvs.words = []
      this.operRect = null
      this.hdWrteDlg.visible = false
      this.refreshScreen()
    },
    onHdWtNext () {
      this.hdWtCvs.words.push(this.hdWtCvs.strokes)
      this.hdWtCvs.strokes = []
      this.hdWtCvs.lastStk = []
      this.normLastWord()
      this.refreshHdWtBoard()
    },
    normLastWord () {
      const rcpWid = 1 / this.hdWtCvs.width
      const rcpHgt = 1 / this.hdWtCvs.height
      const lastIdx = this.hdWtCvs.words.length - 1
      for (let j = 0; j < this.hdWtCvs.words[lastIdx].length; ++j) {
        for (let t = 0; t < this.hdWtCvs.words[lastIdx][j].length; ++t) {
          const point = this.hdWtCvs.words[lastIdx][j][t]
          this.hdWtCvs.words[lastIdx][j][t].x = point.x * rcpWid
          this.hdWtCvs.words[lastIdx][j][t].y = point.y * rcpHgt
        }
      }
    },
    refreshHdWtBoard () {
      if (!this.hdWtCvs.vwContext) {
        return
      }
      this.hdWtCvs.context.putImageData(
        this.hdWtCvs.writeBoard, 0, 0
      )
      const context = this.hdWtCvs.vwContext
      context.putImageData(this.hdWtCvs.viewBoard, 0, 0)
      context.beginPath()
      this.drawHdWtWds(context, this.hdWtCvs.words, 32, 32)
    },
    drawHdWtWds (context, hdWtWds, bdWid, bdHgt, bdLft = 0, bdTop = 0) {
      for (let i = 0; i < hdWtWds.length; ++i) {
        for (const strokes of hdWtWds[i]) {
          for (let t = 0; t < strokes.length; ++t) {
            const point = strokes[t]
            const x = bdLft + (point.x + i) * bdWid
            const y = bdTop + point.y * bdHgt
            context[t === 0 ? 'moveTo' : 'lineTo'](x, y)
          }
        }
        context.stroke()
      }
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
