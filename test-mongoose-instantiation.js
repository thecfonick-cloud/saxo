const mongoose = require('mongoose');

// Define a simple schema
const UserSchema = new mongoose.Schema({
    fullName: String,
    email: String
});

const User = mongoose.model('TestUser', UserSchema);

const obj = {
    _id: '507f1f0873e7900000000001',
    fullName: 'VirexonCapital Admin',
    email: 'admin@virexoncapital.com'
};

const instance = new User(obj);
console.log('Created instance:', instance._id, instance.fullName);

instance.save = async function() {
    console.log('Intercepted save!');
    return this;
};

(async () => {
    await instance.save();
})();
