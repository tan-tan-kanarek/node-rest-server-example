var RestObject = require('./object');

class Pager extends RestObject {
	constructor(data = null) {
		super(data);

		if(!('pageIndex' in this)) {
			this.setPageIndex(1);
		}

		if(!('pageSize' in this)) {
			this.setPageSize(500);
		}
	}
	
	getPageIndex() {
		return this.pageIndex;
	}

	/**
	 * @param int pageIndex
	 */
	setPageIndex(pageIndex) {
		this.pageIndex = pageIndex;
	}

	getPageSize() {
		return this.pageSize;
	}

	/**
	 * @param int pageSize
	 */
	setPageSize(pageSize) {
		this.pageSize = pageSize;
	}
}

module.exports = Pager;