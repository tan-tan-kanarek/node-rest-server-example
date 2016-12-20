var RestServer = require('./lib/server');
var UserService = require('./controllers/user');


let server = new RestServer(1800, {user: UserService});