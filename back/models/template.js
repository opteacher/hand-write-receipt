const db = require('../databases/mongo')

module.exports = db.defineModel({
  __modelName: 'template',
  name: db.Types.String,
  imgURL: db.Types.String,
  editRects: db.Types.Array,
  selectRects: db.Types.Array,
  storeRect: {
    left: db.Types.Number,
    top: db.Types.Number,
    width: db.Types.Number,
    height: db.Types.Number,
  }
}, {
  router: {
    methods: ['GET', 'ALL', 'POST', 'DELETE', 'PUT']
  }
})
