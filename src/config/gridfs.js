// src/config/gridfs.js - SIMPLIFIED (DELETE OLD ONE)
const mongoose = require('mongoose');

let gridfsBucket;
const conn = mongoose.connection;

conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
  console.log('GridFS Bucket initialized');
});

const saveImageToGridFS = async (file) => {
  if (!file?.buffer) return null;

  const filename = `${Date.now()}_${file.originalname}`;
  const uploadStream = gridfsBucket.openUploadStream(filename, {
    contentType: file.mimetype,
  });

  return new Promise((resolve, reject) => {
    uploadStream.end(file.buffer);
    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id.toString(),
        filename: uploadStream.filename,
        contentType: file.mimetype,
      });
    });
    uploadStream.on('error', reject);
  });
};

module.exports = { gridfsBucket, saveImageToGridFS };