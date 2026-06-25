const mongoose = require('mongoose');

async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[database] connected successfully');
  } catch (err) {
    console.error('[database] connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDatabase };
