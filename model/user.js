var RestDatabase = require('../lib/database');
var RestObject = require('../lib/object');
var Filter = require('../lib/filter');
var Pager = require('../lib/pager');
var ObjectsList = require('../lib/list');

var UserStatus = {
	ACTIVE: 0,
	DISABLED: 1
};

class User extends RestObject {
	constructor(data) {
		if(data.status) {
			delete data.status;
		}
		
		super(data);
	}
	
	getId() {
		return this.id;
	}

	/**
	 * @param int id
	 */
	setId(id) {
		this.id = id;
	}

	getCreatedAt() {
		return this.createdAt;
	}

	/**
	 * Date of first creation (unix timestamp)
	 * @param int createdAt
	 */
	setCreatedAt(createdAt) {
		this.createdAt = createdAt;
	}

	getUpdatedAt() {
		return this.updatedAt;
	}

	/**
	 * Date of last update (unix timestamp)
	 * @param int updatedAt
	 */
	setUpdatedAt(updatedAt) {
		this.updatedAt = updatedAt;
	}

	getFirstName() {
		return this.firstName;
	}

	/**
	 * @param string firstName
	 */
	setFirstName(firstName) {
		this.firstName = firstName;
	}

	getLastName() {
		return this.lastName;
	}

	/**
	 * @param string lastName
	 */
	setLastName(lastName) {
		this.lastName = lastName;
	}

	getStatus() {
		return this.status;
	}

	/**
	 * @param UserStatus status
	 */
	setStatus(status) {
		this.status = status;
	}
	

	static dbToObject(dbData)
	{
		return {
			id: dbData.id,
			createdAt: dbData.created_at,
			updatedAt: dbData.updated_at,
			firstName: dbData.first_name,
			lastName: dbData.last_name,
			status: dbData.status
		};
	}
	
	add() {
		let This = this;
		let now = Date.timestamp();
		let values = {
			created_at: now,
			updated_at: now,
			status: UserStatus.ACTIVE
		};

		if(this.firstName !== null) {
			values.first_name = RestDatabase.toDbString(this.firstName);
		}

		if(this.lastName !== null) {
			values.last_name = RestDatabase.toDbString(this.lastName);
		}

		if(this.status !== null) {
			values.status = this.status;
		}

		return new Promise((resolve, reject) => {
    		RestDatabase.insert(User.TABLE_NAME, values)
    			.then((row) => {
    				resolve(This.populate(This.constructor.dbToObject(row)));
    			}, (err) => {
    				reject(err);
    			});
		});
	}

	update(user) {
		let This = this;
		let values = {
			updated_at: Date.timestamp()
		};

		if(user.firstName !== null) {
			values.first_name = RestDatabase.toDbString(user.firstName);
		}

		if(user.lastName !== null) {
			values.last_name = RestDatabase.toDbString(user.lastName);
		}

		if(user.status !== null) {
			values.status = user.status;
		}

		return new Promise((resolve, reject) => {
    		RestDatabase.update(User.TABLE_NAME, this.id, values)
    			.then((row) => {
    				resolve(This.populate(This.constructor.dbToObject(row)));
    			}, (err) => {
    				reject(err);
    			});
		});
	}

	static delete(id) {
		return new Promise((resolve, reject) => {
    		RestDatabase.delete(User.TABLE_NAME, {id: id})
    			.then(() => {
    				resolve(null);
    			}, (err) => {
    				reject(err);
    			});
		});
	}

	static get(id) {
		return new Promise((resolve, reject) => {
    		RestDatabase.select(User.TABLE_NAME, {id: id})
    			.then((rows) => {
    				if(rows.length) {
    					resolve(new User(User.dbToObject(rows[0])));
    				}
    				else {
    					reject({
    						code: 'OBJECT_NOT_FOUND',
    						message: 'User id [' + id + '] not found',
    						parameters: {
    							type: 'User',
    							id: id
    						}
    					});
    				}
    			}, (err) => {
    				reject(err);
    			});
		});
	}
}

User.TABLE_NAME = 'users';
User.UserStatus = UserStatus;

class UserFilter extends Filter {

	constructor(data = null) {
		super(data);
	}
	
	getCreatedAtGreaterThanOrEqual() {
		return this.createdAtGreaterThanOrEqual;
	}

	/**
	 * @param int createdAtGreaterThanOrEqual
	 */
	setCreatedAtGreaterThanOrEqual(createdAtGreaterThanOrEqual) {
		this.createdAtGreaterThanOrEqual = createdAtGreaterThanOrEqual;
	}
	
	getCreatedAtLessThanOrEqual() {
		return this.createdAtLessThanOrEqual;
	}

	/**
	 * @param int createdAtLessThanOrEqual
	 */
	setCreatedAtLessThanOrEqual(createdAtLessThanOrEqual) {
		this.createdAtLessThanOrEqual = createdAtLessThanOrEqual;
	}
	
	getUpdatedAtGreaterThanOrEqual() {
		return this.updatedAtGreaterThanOrEqual;
	}

	/**
	 * @param int updatedAtGreaterThanOrEqual
	 */
	setUpdatedAtGreaterThanOrEqual(updatedAtGreaterThanOrEqual) {
		this.updatedAtGreaterThanOrEqual = updatedAtGreaterThanOrEqual;
	}
	
	getUpdatedAtLessThanOrEqual() {
		return this.updatedAtLessThanOrEqual;
	}

	/**
	 * @param int updatedAtLessThanOrEqual
	 */
	setUpdatedAtLessThanOrEqual(updatedAtLessThanOrEqual) {
		this.updatedAtLessThanOrEqual = updatedAtLessThanOrEqual;
	}
	
	search(pager)
	{
		let where = [];
		if(this.createdAtGreaterThanOrEqual !== null) {
			where.push('created_at >= ' + this.createdAtGreaterThanOrEqual);
		}

		if(this.createdAtLessThanOrEqual !== null) {
			where.push('created_at <= ' + this.createdAtLessThanOrEqual);
		}
		
		if(this.updatedAtGreaterThanOrEqual !== null) {
			where.push('updated_at >= ' + this.updatedAtGreaterThanOrEqual);
		}

		if(this.updatedAtLessThanOrEqual !== null) {
			where.push('updated_at <= ' + this.updatedAtLessThanOrEqual);
		}

		return new Promise((resolve, reject) => {
    		RestDatabase.search(User.TABLE_NAME, where, pager.pageSize, pager.pageIndex)
    			.then((rows) => {
    				let list = new UsersList();
    				list.objects = [];

    				for(let i in rows)
    				{	
    					let data = User.dbToObject(rows[i]);
    					list.objects.push(new User(data));
    				}
    				
    				list.totalCount = list.objects.length;
    				if(list.totalCount === pager.pageSize)
    				{
    					RestDatabase.count(User.TABLE_NAME, where)
			    			.then((count) => {
			    				list.totalCount = count;
			    				resolve(list);
			    			}, (err) => {
			    				reject(err);
			    			});
    				}
    				else {
    					resolve(list);
    				}
    			}, (err) => {
    				reject(err);
    			});
		});
	}
}

class UsersList extends ObjectsList {
	
}

module.exports = {
	User: User,	
	UserFilter: UserFilter,	
	UsersList: UsersList,
	UserStatus: UserStatus
};