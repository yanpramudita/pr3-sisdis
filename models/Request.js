const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RequestSchema = new Schema({
	content: String,
	count: Number
});

module.exports = mongoose.model('Request', RequestSchema);
