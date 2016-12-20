var xml = require('xml');
var http = require('http');

if (typeof String.prototype.toFirstLowerCase !== 'function') {
	String.prototype.toFirstLowerCase = function() {
		return this.substr(0, 1).toLowerCase() + this.substr(1);
    };
}

class RestResponseSerializer {
	constructor() {
		if (new.target === RestResponseSerializer) {
			throw new TypeError('Cannot construct RestResponseSerializer instances directly');
		}
	}

	setResponse(response) {
		this.response = response;
	}

	setError(error) {
		this.error = error;
	}
	
	getContentType() {
		throw new TypeError('RestResponseSerializer.getContentType() is abstract');
	}
	
	serialize() {
		throw new TypeError('RestResponseSerializer.serialize() is abstract');
	}
}

class RestJsonResponseSerializer extends RestResponseSerializer {
	constructor() {
		super();
	}

	getContentType() {
		return 'application/json';
	}
	
	serialize() {
		let json = {};
		if(typeof(this.response) !== 'undefined') {
			json.result = this.response;
		}
		if(typeof(this.error) !== 'undefined') {
			json.error = this.error;
		}
		return JSON.stringify(json);
	}
}

class RestXmlResponseSerializer extends RestResponseSerializer {
	constructor() {
		super();
	}
	
	getContentType() {
		return 'application/xml';
	}
	
	toPropertiesMap(object) {
		let properties = [{objectType: 'map'}];

		for(let property in object) {
			let value = object[property];
			if(value === null) {
				continue;
			}
			
			if(value instanceof Object) {
				value = this.toPropertiesArray(value);
			}
			
			properties.push({
				item: [{
    				_attr : {
    					key : property
    				}},
    				value
				]
			});
		}
		
		return properties;
	}
	
	toPropertiesArray(object) {
		if(Array.isArray(object)) {
			let properties = [{objectType: 'array'}];
    		for(let index in object) {
    			let value = object[index];
    			if(value === null) {
    				continue;
    			}
    			
    			if(value instanceof Object) {
    				value = this.toPropertiesArray(value);
    			}

    			properties.push({
    				item: value
    			});
    		}
    		return properties;
		}
		
		if(object instanceof Object) {
			if(!('objectType' in object) && !('code' in object) && !('message' in object)) {
				return this.toPropertiesMap(object);
			}

			let properties = [];
    		for(let property in object) {
    			let propertyObject = {};
    			let value = object[property];
    			if(value === null) {
    				continue;
    			}
    			
    			if(value instanceof Object) {
    				value = this.toPropertiesArray(value);
    			}
    			
    			propertyObject[property] = value;
    			properties.push(propertyObject);
    		}
    		return properties;
		}
		
		return [];
	}
	
	serialize() {
		let xmlProperties = [];
		if(typeof(this.response) !== 'undefined' && this.response !== null) {
			xmlProperties.push({
				result: this.toPropertiesArray(this.response)
			});
		}
		if(typeof(this.error) !== 'undefined' && this.error !== null) {
			xmlProperties.push({
				error: this.toPropertiesArray(this.error)
			});
		}
		return xml({
			xml: xmlProperties
		});
	}
}

class RestSchemeResponseSerializer extends RestXmlResponseSerializer {
	serialize() {
		if(this.response.objectType) {
			return super.serialize(this.response);
		}
		
		return xml(this.response);
	}
}

class RestRequest {
	constructor() {
		if (new.target === RestRequest) {
			throw new TypeError('Cannot construct RestRequest instances directly');
		}
	}
	
	execute() {
		throw new TypeError('RestRequest.execute() is abstract');
	}
}

class RestControllerRequest extends RestRequest {
	constructor(serviceInstance, service, action, params) {
		super();

		this.serviceInstance = serviceInstance;
		this.service = service;
		this.action = action;
		this.params = params;
	}

	
	execute() {
		console.log('Executing [' + this.service + '.' + this.action + ']');

		let This = this;
		return new Promise((resolve, reject) => {
			try{
				let response = This.serviceInstance.dispatch(This.action, This.params);
				Promise.resolve(response).then((response) => {
					resolve(response);
				}, (err) => {
					reject(err);
				});
			}
			catch(e) {
				reject(e);
			}
		});
	}
}

class RestMultiRequest extends RestRequest {
	constructor(params) {
		super();

		this.params = params;
		this.requestIndexes = Object.keys(params);
		this.responses = [];
	}

	replaceToken(tokens, response) {
		if(!tokens.length) {
			return response;
		}
		
		let token = tokens.shift();
		if(response instanceof Object) {
			return this.replaceToken(tokens, response[token]);
		}

		if(Array.isArray(response)) {
			return this.replaceToken(tokens, response[parseInt(token, 10)]);
		}

		throw 'Wrong number of tokens';
	}

	replaceValueToken(value) {
		if(value === null) {
			return null;
		}
		
		if(Array.isArray(value)) {
			return this.replaceTokens(value);
		}
		
		if(value instanceof Object) {
			return this.replaceTokens(value);
		}
		
		let matches = value.match(/^\{results:(\d+):(.+)\}$/);
		if(matches) {
			let responseIndex = parseInt(matches[1], 10) - 1;
			if(this.responses.length <= responseIndex) {
				throw {
					code: 'INVALID_MULTIREQUEST_TOKEN', 
					message: 'Invalid multirequest token [' + value + ']',
					parameters: {
						token: value
					}
				};
			}
			
			let tokens = matches[2].split(':');
			try{
				return this.replaceToken(tokens, this.responses[responseIndex].result);
			}
			catch(e) {
				throw {
					code: 'INVALID_MULTIREQUEST_TOKEN', 
					message: 'Invalid multirequest token [' + value + ']',
					parameters: {
						token: value
					}
				};
			}
		}
		
		return value;
	}

	replaceTokens(params) {
		for(let key in params) {
			params[key] = this.replaceValueToken(params[key]);
		}
		
		return params;
	}

	executeNext() {
		let This = this;
		return new Promise((resolve, reject) => {
			if(!This.requestIndexes.length) {
				resolve();
			}
			else {
    			let nextRequestIndex = This.requestIndexes.shift();
    			let params = This.replaceTokens(This.params[nextRequestIndex]);
    			let request = new RestControllerRequest(params.serviceInstance, params.service, params.action, params);
    
        		request.execute()
        			.then((response) => {
        				This.responses.push({objectType: 'RestResponse', result: response});
        				This.executeNext().then(() => resolve());
        			}, (err) => {
        				This.responses.push({objectType: 'RestResponse', error: err});
        				This.executeNext().then(() => resolve());
        			});
			}
		});
	}
	
	execute() {
		console.log('Executing multi-request');
		
		let This = this;
		return new Promise((resolve, reject) => {
			This.executeNext().then(() => {
				resolve(This.responses);
			}, (err) => {
				reject(err);
			});
		});
	}
}


class RestSchemeRequest extends RestRequest {
	constructor(services) {
		super();

		this.services = services;
		this.enums = [];
		this.enumNames = {};
		this.classes = [];
		this.classNames = {};
	}

	addEnum(type, name) {
		
		let enumObject = [ {
			_attr : {
				name : name,
				type: 'int'
			}
		}];
		
		let constants = Object.keys(type);
		for(let i in constants) {
			let constant = constants[i];
			enumObject.push({
				const: [{
					_attr : {
						name : constant,
						value: constants[constant]
					}
				}]
			});
		}
		
		this.enums.push({ enum: enumObject }); 
	}

	addClass(type) {
		if(typeof(type) !== 'function') {
			return;
		}
		
		if(this.classNames[type.name]) {
			return;
		}
		
		this.classNames[type.name] = true;
		
		let clazz = [ {
			_attr : {
				name : type.name
			}
		} ];

		let properties = type.getProperties();

		for(let propertyName in properties) {
			let property = properties[propertyName];
		    
		    let propertyAttributes = {
				name : property.name,
				type: property.type
			};
		    
		    if(property.description) {
		    	propertyAttributes.description = property.description;
		    }

	    	if(property.class) {
    	    	if(property.enumType) {
    	    		propertyAttributes.enumType = property.enumType;
        	    	this.addEnum(property.class, property.enumType);
    	    	}
    	    	else {
    	    		this.addClass(property.class);
    	    	}
	    	}
		    
		    clazz.push({
		    	property: [{
					_attr : propertyAttributes
		    	}]
		    });
		}
		
		this.classes.push({
			class: clazz 
		});
	}

	loadServices() {
    	let services = [];
		
		for(let serviceId in this.services) {
			let service = [{
    			_attr : {
    				id : serviceId,
    				name : serviceId
    			}
    		}];
			
			let actions = this.services[serviceId].getActions();
			for(let actionId in actions) {
				let action = actions[actionId];
				let actionAttributes = {
    				name : actionId,
    				enableInMultiRequest: action.enableInMultiRequest
    			};
				
				if(action.description.length) {
					actionAttributes.description = action.description;
				}
				
				let actionElement = [{
        			_attr : actionAttributes
        		}];
				
				for(let argName in action.args) {
					let arg = action.args[argName];
					let argElement = {
						name: argName,
						type: arg.type
					};
					if(arg.description){
						argElement.description = arg.description;
					}
					if(arg.enumType){
						argElement.enumType = arg.enumType;
						this.addEnum(arg.class, arg.enumType);
					}
					else if(arg.class) {
						this.addClass(arg.class);
					}
					actionElement.push({param: [{
		    			_attr : argElement
		    		}]});
				}

				if(action.returnType) {
					let returnTypeElement = {
						type: action.returnType.type
					};
					if(action.returnType.enumType) {
						returnTypeElement.enumType = action.returnType.enumType;
						this.addEnum(action.returnType.class, action.returnType.enumType);
					}
					else if(action.returnType.class) {
						this.addClass(action.returnType.class);
					}
					actionElement.push({result: [{
						_attr : returnTypeElement
		    		}]});
				}
				
				service.push({action: actionElement});
			}
			services.push({service: service});
		}
		
		return services;
	}

	execute() {
		let This = this;
		
		return new Promise((resolve, reject) => {

			try{
				let services = This.loadServices();

    			var response = { 
    				xml: [ 
    					{ enums: this.enums }, 
    					{ classes: this.classes }, 
    					{ services : services } 
    				]
    			};
    			
    			resolve(response);
			}
			catch(e) {
				console.error(e);
				reject({
					code: 'REFLECTION_FAILED',
					message: e.message
				});
			}
		});
	}
}


class RestServer {
	constructor(port, services){
		this.services = services;
		
		let This = this;
		http.createServer((httpRequest, httpResponse) => This.handler(httpRequest, httpResponse)).listen(port);
		console.log('Web server running at port ' + port);
	}

	handler(httpRequest, httpResponse) {
		let This = this;
		
		this.parse(httpRequest)
		.then((request) => request.execute(),
		(exception) => { 
			This.respond(httpResponse, null, exception);
		})
		.then((response) => {
			console.log('Request [' + httpRequest.url + '], response: ');
			console.dir(response);
			This.respond(httpResponse, response);
		}, 
		(exception) => {
			console.error('Request [' + httpRequest.url + '], error: ');
			console.error(exception);

			This.respond(httpResponse, null, exception);
		})
		.catch((err) => {
			console.error('Request [' + httpRequest.url + '], catch: ');
			console.error(err);

			let error = This.getError('INTERNAL_SERVER_ERROR', 'Internal server error');
			This.respond(httpResponse, null, error, 500);
		});
	}
	
	respond(httpResponse, response, error, code = 200) {
		if(typeof(response) !== 'undefined') {
			this.responseSerializer.setResponse(response);
		}
		if(typeof(error) !== 'undefined') {
			this.responseSerializer.setError(error);
		}
		
		httpResponse.writeHead(200, {'Content-Type': this.responseSerializer.getContentType()});
		httpResponse.end(this.responseSerializer.serialize());
	}
	
	parse(httpRequest) {
		let This = this;
		
		return new Promise((resolve, reject) => {
			if(httpRequest.url === '/'){
				This.responseSerializer = new RestSchemeResponseSerializer();
				resolve(new RestSchemeRequest(This.services));
				return;
			}
			
			if(httpRequest.headers.accept.toLowerCase().indexOf('application/xml') === 0) {
				This.responseSerializer = new RestXmlResponseSerializer();
			}
			else {
				This.responseSerializer = new RestJsonResponseSerializer();
			}
			
			if(httpRequest.method.toUpperCase() === 'POST' && httpRequest.headers['content-type'].toLowerCase().indexOf('application/json') === 0) {
				let queryData = '';
				httpRequest.on('data', function(data) {
		            queryData += data;
		        });

				httpRequest.on('end', function() {
					let params = JSON.parse(queryData);
					try{
    					let request = This.parsePathParams(httpRequest.url, params);
    					resolve(request);
					}
					catch(e) {
						reject(e);
					}
		        });
			}
			else {
				try{
					let request = This.parsePathParams(httpRequest.url);
					resolve(request);
				}
				catch(e) {
					reject(e);
				}
			}
		});
	}
	
	pathToParams(paramsString, params = {}) {
		let paramsParts = paramsString.split('/');
		while(paramsParts.length > 1) {
			params[paramsParts.shift()] = paramsParts.shift();
		}
		
		return params;
	}
	
	parsePathParams(uri, params = {}) {

		let matches = uri.match(/\/service\/multirequest\/?(.*)$/i);
		if(matches !== null) {
			params = this.pathToParams(matches[1], params);
			
			for(let index in params) {
				if(isNaN(index) || typeof(params[index]) !== 'object') {
					continue;
				}
				let requestParams = params[index];
				
				if(!requestParams.service) {
					throw this.getError('SERVICE_NOT_DEFINED', 'Service not defined for request [' + index + ']', {
						request : index
					});
				}
				
				if(!requestParams.action) {
					throw this.getError('ACTION_NOT_DEFINED', 'Action not defined for request [' + index + ']', {
						request : index
					});
				}

				if(!this.services || !this.services[requestParams.service]) {
					throw this.getError('SERVICE_NOT_FOUND', 'Service [' + requestParams.service + '] not found', {
						service : requestParams.service
					});
				}
				
				if(!this.services[requestParams.service].prototype[requestParams.action]) {
					throw this.getError('ACTION_NOT_FOUND', 'Action [' + requestParams.service + '.' + requestParams.action + '] not found', {
						service : requestParams.service,
						action : requestParams.action
					});
				}

				params[index].serviceInstance = new this.services[requestParams.service]();
			}
			return new RestMultiRequest(params);
		}

		matches = uri.match(/\/service\/([^\/]+)\/action\/([^\/]+)\/?(.*)$/i);
		if(matches === null) {
			throw this.getError('INVALID_URL', 'Invalid URL');
		}

		let [, service, action, paramsString] = matches;
		params = this.pathToParams(paramsString, params);
		
		if(!this.services || !this.services[service]) {
			throw this.getError('SERVICE_NOT_FOUND', 'Service [' + service + '] not found', {
				service : service
			});
		}
		
		if(!this.services[service].prototype[action]) {
			throw this.getError('ACTION_NOT_FOUND', 'Action [' + service + '.' + action + '] not found', {
				service : service,
				action : action
			});
		}

		let serviceInstance = new this.services[service]();
		return new RestControllerRequest(serviceInstance, service, action, params);
	}
	
	getError(code, message, args) {
		return {
			code : code,
			message : message,
			parameters: args
		};
	}
}

module.exports = RestServer;