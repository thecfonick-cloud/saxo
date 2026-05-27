require('dotenv').config();
const mongoose = require('mongoose');

async function clear() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.db.dropDatabase();
    console.log('Database successfully cleared.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

clear();
