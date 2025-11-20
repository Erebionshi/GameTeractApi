// src/config/gridfs.js
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const { GridFsStorage } = require('multer-gridfs-storage');

let gfs, gridfsBucket;
const conn = mongoose.connection;

conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
  console.log('GridFS initialized');
});

const storage = new GridFsStorage({
  db: conn,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = {
        filename: `${Date.now()}_${file.originalname}`,
        bucketName: 'uploads'
      };
      resolve(filename);
    });
  }
});

module.exports = { gfs, gridfsBucket, storage };