<template>
  <div class="fix-scroll" :style="`top: ${top}px; bottom: ${bottom}px`">
    <canvas id="tagsCanvas"
      :style="[
        `left: ${cvsInfo.left}px`,
        `top: ${cvsInfo.top}px`,
        `width: ${cvsInfo.width}px`,
        `height: ${cvsInfo.height}px`
      ].join(';')"
    >你的浏览器不支持canvas，请升级浏览器</canvas>
    <a-modal title="手写文字" centered :visible="hdWrteDlg.visible" @cancel="hdWrteDlg.visible = false" :bodyStyle="{
      'padding-bottom': '10px'
    }">
      <template slot="footer">
        <div style="text-align: center">
          <canvas id="hdWtVwCvs" :width="hdWtCvs.width" :height="hdWtCvs.vwFtSz" style="background-color: #cccccc"/>
        </div>
        <div class="mt-5">
          <a-button @click="onHdWtCancel">撤销</a-button>
          <a-button type="primary" @click="onHdWtFinish">完成</a-button>
        </div>
      </template>
      <canvas id="hdWtCanvas"
        :width="hdWtCvs.width" :height="hdWtCvs.height"
        style="background-color: #cccccc"
      >
        你的浏览器不支持canvas，请升级浏览器
      </canvas>
    </a-modal>
    <div :style="`position: fixed; right: 0; bottom: ${bottom}px; padding: 1vh 1vw`">
      <ctrl-panel
        :onCtrlBtnClicked="onCtrlBtnClicked"
        :zoomPerc="cvsInfo.zoom"
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
        imgURLs: [],
        editRects: [],
        selectRects: [],
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
    },
    'editable': {
      type: Boolean,
      default: true
    }
  },
  components: {
    'ctrl-panel': ctrlPanel
  },
  data () {
    return {
      cvsInfo: {
        images: [],
        left: 0,
        top: 0,
        move: 10,
        zoom: 100,
        width: 0,
        height: 0,
        canvas: null,
        context: null,
        writing: false,
        stroke: [],
        rcpWid: 0,
        rcpHgt: 0
      },
      history: [],
      dragging: false,
      operRect: null,
      mousedown: {
        x: 0, y: 0
      },
      mouseup: {
        x: -1, y: -1
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
        vwContext: null,
        vwFtSz: 64,
        ctDwnHdl: null
      }
    }
  },
  async created () {
    await utils.until(() => this.tempInfo.imgURLs.length)
    this.resetRect(this.tempInfo.storeRect, 'store')
    this.fechEdtRect('edit', this.resetRect)
    this.fechEdtRect('select', this.resetRect)
    this.cvsInfo.canvas = document.getElementById('tagsCanvas')
    this.cvsInfo.context = this.cvsInfo.canvas.getContext('2d')
    await this.updateImages()
    
    this.cvsInfo.canvas.onmousedown = this.onMouseDown
    this.cvsInfo.canvas.onmousemove = this.onMouseMove
    this.cvsInfo.canvas.onmouseup = this.onMouseUp
    this.cvsInfo.canvas.addEventListener('touchstart', this.onMouseDown, false)
    this.cvsInfo.canvas.addEventListener('touchmove', this.onMouseMove, false)
    this.cvsInfo.canvas.addEventListener('touchend', this.onMouseUp, false)
  },
  updated () {
    this.refreshScreen()
  },
  methods: {
    fechEdtRect (mode, func) {
      for (const rect of this.tempInfo[`${mode}Rects`]) {
        func(rect, mode)
      }
    },
    posToCvs (cvs, e) {
      let x = 0, y = 0
      if (typeof e.clientX !== 'undefined') {
        x = e.clientX
        y = e.clientY
      } else if (e.touches && e.touches.length) {
        x = e.touches[0].clientX
        y = e.touches[0].clientY
      } else {
        return {x, y}
      }
      const bbox = cvs.canvas.getBoundingClientRect()
      return {
        x: x - bbox.left * (cvs.width / bbox.width),
        y: y - bbox.top * (cvs.height / bbox.height)
      }
    },
    onMouseDown (e) {
      if (!this.editable) {
        return
      }
      if (this.mode) {
        e.preventDefault()
      }
      this.mousedown = this.posToCvs(this.cvsInfo, e)
      this.fechEdtRect('edit', this.mosDownInRect)
      this.fechEdtRect('select', this.mosDownInRect)
      if (this.mode) {
        this.mosDownInRect(this.tempInfo.storeRect)
      }
      if (this.mode && this.mode !== 'view') {
        this.dragging = true
      }
      this.refreshScreen()
    },
    onMouseMove (e) {
      if (!this.editable) {
        return
      }
      if (this.mode) {
        e.preventDefault()
      }
      const mosPos = this.posToCvs(this.cvsInfo, e)
      if (this.dragging) {
        this.clrLastHis()
        this.updCreateRect(mosPos, this.mode === 'select')
      } else if (this.cvsInfo.writing) {
        e.preventDefault()
        this.updHdWtStroke(mosPos)
      } else {
        this.fechEdtRect('edit', rect => {this.mosMoveInRect(rect, mosPos)})
        this.fechEdtRect('select', rect => {this.mosMoveInRect(rect, mosPos)})
        if (this.mode) {
          this.mosMoveInRect(this.tempInfo.storeRect, mosPos)
        }
      }
    },
    onMouseUp (e) {
      if (!this.editable) {
        return
      }
      if (this.mode) {
        e.preventDefault()
      }
      this.fechEdtRect('edit', this.mosUpInRect)
      this.fechEdtRect('select', this.mosUpInRect)
      if (this.mode) {
        this.mosUpInRect(this.tempInfo.storeRect)
      }
      if (this.dragging) {
        this.finCreateRect(e)
      } else if (this.cvsInfo.writing) {
        this.finSelectOpn()
      }
      this.refreshScreen()
    },
    mosDownInRect (rect) {
      if (!this.mode && this.insideBox(rect.rect, this.mousedown)) {
        if (rect.mode === 'select') {
          rect.show = false
          this.cvsInfo.writing = true
          this.operRect = rect
        } else {
          rect.rect.down = true
        }
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
      if (!this.mode && rect.rect.down) {
        switch (rect.mode) {
        case 'edit':
          rect.rect.down = false
          this.hdWrteDlg.visible = true
          this.operRect = rect
          this.hdWtCvs.words = rect.data
          document.body.style.cursor = 'default'
          if (!this.hdWtCvs.viewBoard || !this.hdWtCvs.writeBoard) {
            this.initHdWtCvs()
          } else {
            this.refreshHdWtBoard()
          }
          break
        case 'select':
          rect.rect.down = false
          break
        }
      } else if (rect.btnClose.down) {
        if (rect.mode === 'edit' || rect.mode === 'select') {
          const rects = this.tempInfo[`${rect.mode}Rects`]
          for (let i = 0; i < rects.length; ++i) {
            if (rect === rects[i]) {
              rects.splice(i, 1)
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
    updCreateRect (tgtPoi, square) {
      let width = Math.abs(tgtPoi.x - this.mousedown.x)
      let height = Math.abs(tgtPoi.y - this.mousedown.y)
      if (square) {
        width = Math.min(width, height)
        height = width
        tgtPoi.x = this.mousedown.x + (tgtPoi.x < this.mousedown.x ? -width : width)
        tgtPoi.y = this.mousedown.y + (tgtPoi.y < this.mousedown.y ? -height : height)
        this.mouseup.x = tgtPoi.x
        this.mouseup.y = tgtPoi.y
      }
      const left = Math.min(tgtPoi.x, this.mousedown.x)
      const top = Math.min(tgtPoi.y, this.mousedown.y)

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
    finCreateRect (e) {
      this.dragging = false
      let mosPos = this.mouseup
      if (this.mouseup.x === -1 || this.mouseup.y === -1) {
        mosPos = this.posToCvs(this.cvsInfo, e)
      }
      const bdRect = this.buildRect(this.mousedown, mosPos)
      this.mouseup = {x: -1, y: -1}
      let rect = null
      if (this.mode == 'edit' || this.mode === 'select') {
        if (this.operRect) {
          rect = this.operRect
        } else {
          rect = this.resetRect({}, this.mode)
          this.tempInfo[`${this.mode}Rects`].push(rect)
        }
      } else {
        rect = this.tempInfo.storeRect
      }
      rect.left = bdRect.left
      rect.top = bdRect.top
      rect.width = bdRect.width
      rect.height = bdRect.height
      if (this.onSelRectCreated) {
        this.onSelRectCreated('view')
      }
    },
    finSelectOpn () {
      this.cvsInfo.writing = false
      if (this.cvsInfo.stroke.length) {
        let left = this.cvsInfo.stroke[0].x,
          top = this.cvsInfo.stroke[0].y,
          right = 0, bottom = 0
        for (const point of this.cvsInfo.stroke) {
          if (point.x > right) {
            right = point.x
          } else if (point.x < left) {
            left = point.x
          }
          if (point.y > bottom) {
            bottom = point.y
          } else if (point.y < top) {
            top = point.y
          }
        }
        this.normWord(this.cvsInfo.stroke,
          1 / (right - left), 1 / (bottom - top), left, top
        )
        this.operRect.data = [[this.cvsInfo.stroke]]
        this.cvsInfo.stroke = []
        this.operRect = null
      }
    },
    updHdWtStroke (mosPos) {
      const context = this.cvsInfo.context
      if (this.cvsInfo.stroke.length) {
        const lstPos = this.cvsInfo.stroke[
          this.cvsInfo.stroke.length - 1
        ]
        context.beginPath()
        context.moveTo(lstPos.x, lstPos.y)
        context.lineTo(mosPos.x, mosPos.y)
        context.stroke()
      }
      this.cvsInfo.stroke.push(mosPos)
    },
    async updateImages () {
      this.cvsInfo.images = []
      for (const imgURL of this.tempInfo.imgURLs) {
        const newImg = new Image()
        this.cvsInfo.images.push(newImg)
        newImg.src = imgURL
        newImg.setAttribute('crossOrigin', '')
        await new Promise(resolve => {
          newImg.onload = resolve
        })
      }
      this.updCanvasWH()
      this.history = []
      this.refreshScreen()
    },
    refreshScreen () {
      if (!this.cvsInfo.context) {
        return
      }
      this.clrScreen()
      const context = this.cvsInfo.context
      let lastHgt = 0
      for (const image of this.cvsInfo.images) {
        const imgHgt = this.cvsInfo.width * image.rcpHgt
        context.drawImage(image,
          0, lastHgt, this.cvsInfo.width, imgHgt
        )
        lastHgt += imgHgt
      }
      context.save()
      context.beginPath()
      if (this.mode
      && this.tempInfo.storeRect.width !== 1
      && this.tempInfo.storeRect.height !== 1) {
        this.drawRect(this.tempInfo.storeRect, 'store')
      }
      this.fechEdtRect('edit', this.drawRect)
      this.fechEdtRect('select', this.drawRect)
      context.restore()
      this.addHistory()
    },
    drawRect (rect, mode) {
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
        if (!this.mode && rect.data && rect.data.length) {
          if (rect.data.length * height < width) {
            this.drawHdWtWds(context, rect.data, height, height, left, top)
          } else {
            this.drawHdWtWds(context, rect.data, width / rect.data.length, height, left, top)
          }
          return
        }
        if (!rect.show) {
          return
        }
        context.fillStyle = `rgba(${utils.clrMap[`${mode}RGB`]}, ${!rect.rect.down ? '.3' : '1'})`
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
    onCtrlBtnClicked (dir) {
      switch (dir) {
      case 'up':
        this.cvsInfo.top += this.cvsInfo.move
        break
      case 'down':
        this.cvsInfo.top -= this.cvsInfo.move
        break
      case 'left':
        this.cvsInfo.left += this.cvsInfo.move
        break
      case 'right':
        this.cvsInfo.left -= this.cvsInfo.move
        break
      case 'zoomIn':
        this.cvsInfo.zoom += 5
        this.cvsInfo.move += 2
        this.updCanvasWH()
        this.refreshScreen()
        break
      case 'zoomOut':
        this.cvsInfo.zoom -= 5
        this.cvsInfo.move += 2
        this.updCanvasWH()
        this.refreshScreen()
        break
      case 'reset':
        this.cvsInfo.top = 0
        this.cvsInfo.left = 0
        this.cvsInfo.zoom = 100
        this.cvsInfo.move = 10
        this.updCanvasWH()
        this.refreshScreen()
        break
      case 'zoomReset':
        this.cvsInfo.zoom = 100
        this.cvsInfo.move = 10
        this.updCanvasWH()
        this.refreshScreen()
        break
      }
    },
    updCanvasWH () {
      this.cvsInfo.width= document.body.clientWidth * (this.cvsInfo.zoom / 100)
      this.cvsInfo.height = 0
      for (const image of this.cvsInfo.images) {
        image.rcpHgt = 1 / image.width * image.height
        this.cvsInfo.height += this.cvsInfo.width * image.rcpHgt
      }
      const scale = window.devicePixelRatio
      this.cvsInfo.canvas.width = Math.floor(this.cvsInfo.width * scale)
      this.cvsInfo.canvas.height = Math.floor(this.cvsInfo.height * scale)
      this.cvsInfo.context.scale(scale, scale)
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
        0, 0, this.cvsInfo.canvas.width, this.cvsInfo.canvas.height
      ))
    },
    resetRect (rect, mode, force = false) {
      const rctBtn = () => ({
        l: 0, r: 0, t: 0, b: 0,
        in: false, down: false
      })
      rect.mode = mode
      rect.show = true
      rect.left = force ? 0 : (rect.left || 0)
      rect.top = force ? 0 : (rect.top || 0)
      const dftWH = mode === 'store' ? 1 : 0
      rect.width = force ? dftWH : (rect.width || dftWH)
      rect.height = force ? dftWH : (rect.height || dftWH)
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
      }
      if (rect.mode !== 'store') {
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
        0, 0, this.hdWtCvs.width, this.hdWtCvs.vwFtSz
      )
      this.refreshHdWtBoard()

      this.hdWtCvs.canvas.addEventListener('touchstart', this.onTouchStart, false)
      this.hdWtCvs.canvas.addEventListener('touchmove', this.onTouchMove, false)
      this.hdWtCvs.canvas.addEventListener('touchend', this.onTouchEnd, false)
    },
    onTouchStart (e) {
      e.preventDefault()
      this.hdWtCvs.writing = true
      clearTimeout(this.hdWtCvs.ctDwnHdl)
    },
    onTouchMove (e) {
      e.preventDefault()
      if (!this.hdWtCvs.writing || !this.hdWtCvs.context) {
        return
      }
      const mosPos = this.posToCvs(this.hdWtCvs, e)
      const context = this.hdWtCvs.context
      if (this.hdWtCvs.lastStk.length) {
        const lstPos = this.hdWtCvs.lastStk[
          this.hdWtCvs.lastStk.length - 1
        ]
        context.beginPath()
        context.moveTo(lstPos.x, lstPos.y)
        context.lineTo(mosPos.x, mosPos.y)
        context.stroke()
      }
      this.hdWtCvs.lastStk.push(mosPos)
    },
    onTouchEnd (e) {
      e.preventDefault()
      this.hdWtCvs.writing = false
      this.hdWtCvs.strokes.push(
        this.hdWtCvs.lastStk
      )
      this.hdWtCvs.lastStk = []
      this.hdWtCvs.ctDwnHdl = setTimeout(this.onHdWtNext, 1000)
    },
    onHdWtCancel () {
      this.hdWtCvs.words.pop()
      this.refreshHdWtBoard()
    },
    onHdWtFinish () {
      this.hdWtCvs.strokes = []
      this.hdWtCvs.lastStk = []
      this.operRect.data = this.hdWtCvs.words
      this.hdWtCvs.words = []
      this.operRect = null
      this.hdWrteDlg.visible = false
      this.hdWtCvs.vwContext.putImageData(this.hdWtCvs.viewBoard, 0, 0)
      this.refreshScreen()
    },
    onHdWtNext () {
      this.hdWtCvs.words.push(this.hdWtCvs.strokes)
      this.hdWtCvs.strokes = []
      this.hdWtCvs.lastStk = []
      this.normLastWord()
      this.refreshHdWtBoard()
    },
    normWord (strokes, rcpWid, rcpHgt, left = 0, top = 0) {
      for (let i = 0; i < strokes.length; ++i) {
        strokes[i].x = (strokes[i].x - left) * rcpWid
        strokes[i].y = (strokes[i].y - top) * rcpHgt
      }
    },
    normLastWord () {
      const rcpWid = 1 / this.hdWtCvs.width
      const rcpHgt = 1 / this.hdWtCvs.height
      const lastIdx = this.hdWtCvs.words.length - 1
      for (let i = 0; i < this.hdWtCvs.words[lastIdx].length; ++i) {
        this.normWord(this.hdWtCvs.words[lastIdx][i], rcpWid, rcpHgt)
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
      if (this.hdWtCvs.words.length) {
        context.beginPath()
        const hdWtWdsLen = this.hdWtCvs.words.length
        if (hdWtWdsLen * this.hdWtCvs.vwFtSz < this.hdWtCvs.viewBoard.width) {
          this.drawHdWtWds(context, this.hdWtCvs.words,
            this.hdWtCvs.vwFtSz, this.hdWtCvs.vwFtSz
          )
        } else {
          this.drawHdWtWds(context, this.hdWtCvs.words,
            this.hdWtCvs.viewBoard.width / hdWtWdsLen, this.hdWtCvs.vwFtSz
          )
        }
      }
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
    },
    validReceipt () {
      if (this.tempInfo.editRects.find(rect => !rect.data.length)) {
        return false
      }
      if (this.tempInfo.selectRects.find(rect => !rect.data.length)) {
        return false
      }
      return true
    },
    cutReceipt (rcptName) {
      const left = this.tempInfo.storeRect.left * this.cvsInfo.canvas.width
      const top = this.tempInfo.storeRect.top * this.cvsInfo.canvas.height
      const width = this.tempInfo.storeRect.width * this.cvsInfo.canvas.width
      const height = this.tempInfo.storeRect.height * this.cvsInfo.canvas.height
      const rcptData =  this.cvsInfo.context.getImageData(left, top, width, height)
      let imgData = {}
      for (const [key, value] of Object.entries(rcptData.data)) {
        if (value <= 240) {
          imgData[key] = value
        }
      }
      const path = '/hand-write-receipt/api/v1/receipt/data/upload'
      return utils.reqBack(this, path, 'post', {
        fileName: rcptName,
        width: rcptData.width,
        height: rcptData.height,
        data: imgData
      })
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
