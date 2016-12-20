var User = require('../model/user').User;
var UserFilter = require('../model/user').UserFilter;
var UsersList = require('../model/user').UsersList;
var Pager = require('../lib/pager');
var RestController = require('../lib/controller');

class UserController extends RestController {
	/**
	 * Adds a new user
	 * @param User user
	 * @return User
	 */
	add(user) {
		return user.add();
	}

	/**
	 * Updates existing user
	 * @param int id user id to update
	 * @param User user
	 * @return User
	 */
	update(id, user) {
		return new Promise((resolve, reject) => {
			User.get(id)
    			.then((existingUser) => {
    				resolve(existingUser.update(user));
    			}, (err) => {
    				reject(err);
    			});
		});
	}

	/**
	 * Deletes existing user
	 * @param int id user id to delete
	 */
	delete(id) {
		return User.delete(id);
	}

	/**
	 * Fetches user
	 * @param int id user id to get
	 * @return User
	 */
	get(id) {
		return User.get(id);
	}

	/**
	 * Lists users according to filter
	 * @param UserFilter filter
	 * @param Pager pager
	 * @return UsersList
	 */
	search(filter = null, pager = null) {
		if(filter === null) {
			filter = new UserFilter();
		}

		if(pager === null) {
			pager = new Pager();
		}
			
		return filter.search(pager);
	}
}

UserController.User = User;
UserController.UserFilter = UserFilter;
UserController.UsersList = UsersList;
UserController.Pager = Pager;

module.exports = UserController;