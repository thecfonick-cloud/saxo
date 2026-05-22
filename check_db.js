const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://thecfonick_dbUser:dqY52441A2AoOVcC@virexondb.tw5yfvx.mongodb.net/virexoncapital?retryWrites=true&w=majority')
.then(async () => {
    console.log('Connected!');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    for (const c of collections) {
        const docs = await db.collection(c.name).find({}).toArray();
        console.log(`--- ${c.name} (${docs.length}) ---`);
        console.log(docs);
    }
    process.exit(0);
})
.catch(err => { console.error('Error:', err.message); process.exit(1); });
