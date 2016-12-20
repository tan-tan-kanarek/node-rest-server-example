var sqlite3 = require('sqlite3').verbose();

class RestDatabase {
	
	static init() {
		if(!this.db) {
			this.db = new sqlite3.Database('./data/database.db');
		}
	}
	
	static getError() {
		return {
			code: 'INTERNAL_DB_ERROR',
			message: 'Internal database error'
		};
	}
	
	static toDbString(str) {
		return '"' + str + '"';
	}

	static insert(table, values)
	{
		let This = this;
		This.init();

		return new Promise((resolve, reject) => {
			let columns = Object.keys(values).join(', ');
			values = Object.keys(values).map(function(key) {
			    return values[key];
			}).join(', ');
			
			This.db.run('INSERT INTO ' + table + ' (' + columns + ') VALUES (' + values + ')', function(err) {
				if(err) {
					console.error(err);
					reject(RestDatabase.getError());
					return;
				}

				let lastID = this.lastID;
				This.db.get('SELECT * FROM ' + table + ' WHERE id = ' + lastID, (err, row) => {
					if(err) {
						console.error(err);
						reject(RestDatabase.getError());
					}
					else {
						resolve(row);
					}
				});
			});
		});
	}
	
	static update(table, id, values)
	{
		let This = this;
		This.init();

		return new Promise((resolve, reject) => {
    		let sets = [];
    		for(let column in values) {
    			sets.push(column + ' = ' + values[column]);
    		}
    				
    		let setClause = sets.join(', ');
    
    		This.db.exec('UPDATE ' + table + ' SET ' + setClause + ' WHERE id = ' + id, (err) => {
				if(err) {
					console.error(err);
					reject(RestDatabase.getError());
					return;
				}

				This.db.get('SELECT * FROM ' + table + ' WHERE id = ' + id, (err, row) => {
					if(err) {
						console.error(err);
						reject(RestDatabase.getError());
					}
					else {
						resolve(row);
					}
				});
			});
		});
	}
	
	static select(table, where = null, columns = null)
	{
		let This = this;
		This.init();

		return new Promise((resolve, reject) => {
			let columnsClause = columns === null ? '*' : columns.join(', ');
			let whereClause = '';
			
			if(where !== null)
			{
				let wheres = [];
				for(let column in where) {
					wheres.push(column + ' = ' + where[column]);
				}
				
				whereClause = ' WHERE ' + wheres.join(' AND ');
			}
			
			This.db.all('SELECT ' + columnsClause + ' FROM ' + table + whereClause, (err, rows) => {
				if(err) {
					console.error(err);
					reject(RestDatabase.getError());
				}
				else {
					resolve(rows);
				}
			});
		});
	}
	
	static search(table, where, pageSize, pageIndex, columns = null)
	{
		let This = this;
		This.init();

		return new Promise((resolve, reject) => {
			let offset = (pageIndex - 1) * pageSize;
			let columnsClause = columns === null ? '*' : columns.join(', ');
			let whereClause = ' WHERE ' + where.join(' AND ');
			let limitClause = ' LIMIT ' + pageSize;
			if(offset) {
				limitClause += ', ' + offset;
			}
			
			let sql = 'SELECT ' + columnsClause + ' FROM ' + table + whereClause + limitClause;
			
			This.db.all(sql, (err, rows) => {
				if(err) {
					console.error(err);
					reject(RestDatabase.getError());
				}
				else {
					resolve(rows);
				}
			});
		});
	}
	
	static count(table, where)
	{
		let This = this;
		This.init();

		return new Promise((resolve, reject) => {
			let whereClause = 'WHERE ' + where.join(' AND ');
    
			This.db.get('SELECT count(id) as cnt FROM ' + table + ' ' + whereClause, (err, row) => {
				if(err) {
					console.error(err);
					reject(RestDatabase.getError());
				}
				else {
					resolve(row.cnt);
				}
			});
		});
	}
	
	static delete(table, where)
	{
		let This = this;
		This.init();

		return new Promise((resolve, reject) => {
			let wheres = [];
			for(let column in where) {
				wheres.push(column + ' = ' + where[column]);
			}

			let whereClause = ' WHERE ' + wheres.join(' AND ');
			
			This.db.exec('DELETE FROM ' + table + ' ' + whereClause, (err) => {
				if(err) {
					console.error(err);
					reject(RestDatabase.getError());
					return;
				}

				resolve();
			});
		});
	}
}

module.exports = RestDatabase;