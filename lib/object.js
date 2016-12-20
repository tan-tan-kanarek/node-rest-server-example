

if (typeof String.prototype.toFirstUpperCase !== 'function') {
	String.prototype.toFirstUpperCase = function() {
		return this.substr(0, 1).toUpperCase() + this.substr(1);
    };
}

if (!Date.timestamp) {
    Date.timestamp = function() {
    	return Math.floor(new Date().getTime() / 1000);
    };
}

class RestObject {
	constructor(data = null) {
		if(data) {
			this.populate(data);
		}
		
		this.objectType = this.constructor.name;
	}
	
	populate(data) {
		let properties = this.constructor.getProperties();
		for(let key in properties) {
			let property = properties[key];
			if(key in data) {
    			let value = data[key];
    			if(value !== null && property.class && !property.enumType) {
    				value = new property.class(value);
    			}
    			
    			this[property.setter].apply(this, [value]);
			}
			else {
    			this[property.setter].apply(this, [null]);
			}
		}
		
		return this;
	}
	
	static getProperty(name) {
		return this.getProperties()[name];
	}
	
	static getProperties() {

		if(this.properties) {
			return this.properties;
		}
		
		this.properties = {};
		let className = this.name;
		
		// find setters with comments
		let settersStrings = this.toString().match(/\/\*\*([^\/]+)\*\/\s*set([^(]+)\s*\(([^)]*)\)/g);
		for(let i in settersStrings) {
			// parse the comment
			let matches = settersStrings[i].match(/\/\*\*([^\/]+)\*\/\s*(set([^(]+))\s*\(([^)]*)\)/);
			let comment = matches[1];
			let setter = matches[2];
			let property = matches[3].toFirstLowerCase();
			let argument = matches[4];
			
			if(this.prototype[setter].length !== 1) {
				continue;
			}
			
	    	// find @param annotation
	    	let regex = '\\*\\s+@param\\s+([^\\s]+)\\s+' + argument + '([ \\t]+[^\\r\\n]+)?[\\r\\n]';
	    	matches = comment.match(new RegExp(regex));
	    	if(!matches) {
	    		throw new Error('Type [' + className + '] setter [' + property + '] type not found');
	    	}
	    	let propertyType = matches[1];
	    	
		    // parse action description
		    let commentLines = comment.replace(/\r/, '').split('\n');
		    let description = '';
		    for(let j = 1; j < commentLines.length; j++) {
		    	if(commentLines[j].match(/^\s*\*\s*@/)) {
		    		break;
		    	}
		    	if(description.length) {
		    		description += '\n';
		    	}
	    		description += commentLines[j].trim().replace(/^\*\s*/, '');
		    }
		    
		    let propertyAttributes = {
				name : property,
				setter: setter,
				type: propertyType
			};
		    
		    if(description.length) {
		    	propertyAttributes.description = description;
		    }

	    	if(		propertyType !== 'int' && 
	    			propertyType !== 'long' &&
	    			propertyType !== 'float' &&
	    			propertyType !== 'boolean' &&
	    			propertyType !== 'string') {
    	    	if(!this[propertyType]) {
    				throw new Error('Type [' + propertyType + '] must be defined statically on class [' + className + ']');
    	    	}
    	    	
    	    	if(typeof(this[propertyType]) === 'object') {
    	    		propertyAttributes.enumType = propertyType;
    	    		propertyAttributes.type = 'int';
    	    	}
	    		propertyAttributes.class = this[propertyType];
	    	}
		    
	    	this.properties[property] = propertyAttributes;
		}
		
		return this.properties;
	}
}

module.exports = RestObject;