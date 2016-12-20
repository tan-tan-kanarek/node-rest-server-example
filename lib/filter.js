var RestObject = require('./object');

class Filter extends RestObject {
	search(pager) {
		throw new TypeError('Filter.search() is abstract');
	}
}

module.exports = Filter;