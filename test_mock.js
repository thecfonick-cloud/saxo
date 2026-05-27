
const MOCK_DB = {
    users: [{ _id: '1', fullName: 'John', email: 'j@j.com' }],
    depositProofs: [{ _id: '10', userId: '1', amount: 50 }]
};

const result = [{ _id: '10', userId: '1', amount: 50 }];
const field = 'userId';
const doPopulate = (item) => {
    if (!item) return;
    let refId = null;
    if (item[field] && typeof item[field] === 'object' && item[field]._id) {
        refId = item[field]._id.toString();
    } else if (item[field]) {
        refId = item[field].toString();
    }
    if (refId) {
        let collection = 'users';
        if (field === 'depositProofId') collection = 'depositProofs';
        const found = MOCK_DB[collection]?.find(u => u._id?.toString() === refId);
        if (found) {
            item[field] = { ...found };
        }
    }
};

result.forEach(doPopulate);
console.log(result);
