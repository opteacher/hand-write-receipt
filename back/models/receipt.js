const db = require('../databases/mongo')

module.exports = db.defineModel({
  __modelName: 'receipt',
  name: db.Types.String,
  topic: db.Types.String,
  imgURL: db.Types.String,
  createdAt: db.Types.Date
}, {
  middle: {
    create: {
      before (doc) {
        if (!doc.createdAt) {
          doc.createdAt = Date.now()
        }
      }
    }
  },
  router: {
    methods: ['GET', 'ALL', 'POST', 'DELETE']
  }
})
