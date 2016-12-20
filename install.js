var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('./data/database.db');

db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, created_at INTEGER, updated_at INTEGER, first_name TEXT, last_name TEXT, email TEXT, status INTEGER)');
db.close();