
class RestController {

	static getAction(actionId) {
		return this.getActions()[actionId];
	}
		
	static getActions() {
		
		if(this.actions) {
			return this.actions;
		}
		
		let serviceId = this.name;
		this.actions = {};

		let map = function(arg) {
	        // Ensure no inline comments are parsed and trim the whitespace.
	        return arg.replace(/\/\*.*\*\//, '').trim();
	    };
	    
	    let filter = function(arg) {
	        // Ensure no undefined values are added.
	        return arg;
	    };
	    
		// find actions with comments
		let actionStrings = this.toString().match(/\/\*\*([^\/]+)\*\/\s*([^(]+)\s*\(([^)]*)\)/g);
		
		for(let i in actionStrings) {
			// parse the comment
			let matches = actionStrings[i].match(/\/\*\*([^\/]+)\*\/\s*([^(]+)\s*\(([^)]*)\)/);
			let comment = matches[1];
			let actionId = matches[2];
			let argNames = matches[3].split(',').map(map).filter(filter);
			
			let action = {
				id: actionId,
				args: {}
			};
			
		    for(let j in argNames) {
		    	let argName = argNames[j];
		    	let defaultValue = null;
		    	
		    	if(argName.indexOf('=') > 0) {
		    		[argName, defaultValue] = argName.split(/\s*=\s*/);
		    	}
		    		
		    	// find @param annotation
		    	let regex = '\\*\\s+@param\\s+([^\\s]+)\\s+' + argName + '([ \\t]+[^\\r\\n]+)?[\\r\\n]';
		    	let matches = comment.match(new RegExp(regex));
		    	if(!matches) {
		    		throw new Error('Action [' + serviceId + '.' + actionId + '] argument [' + argName + '] type not found');
		    	}
		    	let arg = {
		    		name: argName,
		    		type: matches[1],
		    	};
		    	if(defaultValue) {
		    		arg.defaultValue = eval(defaultValue);
		    	}
		    	if(matches[2]) {
		    		arg.description = matches[2].trim();
		    	}

		    	if(		arg.type !== 'int' && 
		    			arg.type !== 'long' &&
		    			arg.type !== 'float' &&
		    			arg.type !== 'boolean' &&
		    			arg.type !== 'string') {

    		    	if(!this[arg.type]) {
    					throw new Error('Type [' + arg.type + '] must be defined statically on service [' + serviceId + ']');
    				}
		    	
    		    	arg.class = this[arg.type];
    		    	
    		    	if(typeof(arg.class) === 'object') {
    		    		arg.enumType = arg.type;
    		    		arg.type = 'int';
    		    	}
		    	}
		    	
		    	action.args[argName] = arg;
		    }
		    
		    // parse action description
		    let commentLines = comment.replace(/\r/, '').split('\n');
		    action.description = '';
		    for(let j = 1; j < commentLines.length; j++) {
		    	if(commentLines[j].match(/^\s*\*\s*@/)) {
		    		break;
		    	}
		    	if(action.description.length) {
		    		action.description += '\n';
		    	}
		    	action.description += commentLines[j].trim().replace(/^\*\s*/, '');
		    }

		    matches = comment.match(/\*\s*@return\s+([^\s]+)/);
		    if(matches) {
		    	let returnType = matches[1];

		    	action.returnType = {
		    		type: returnType
		    	};
		    	
		    	if(		returnType !== 'int' && 
		    			returnType !== 'long' &&
		    			returnType !== 'float' &&
		    			returnType !== 'boolean' &&
		    			returnType !== 'string') {

    		    	if(!this[returnType]) {
    					throw new Error('Type [' + returnType + '] must be defined statically on service [' + serviceId + ']');
    				}
		    	
    		    	action.returnType.class = this[returnType];
    		    	
    		    	if(typeof(this[returnType]) === 'object') {
    		    		action.returnType.enumType = action.returnType.type;
    			    	action.returnType.type = 'int';
    		    	}
		    	}
		    }
		    
		    this.actions[actionId] = action;
		}
		
		return this.actions;
	}
	
	dispatch(actionId, params) {
		let action = this.constructor.getAction(actionId);
		let args = [];
		
		for(let argName in action.args) {
			let arg = action.args[argName];
			if(argName in params) {
				let value = params[argName];
				if(arg.class && !arg.enumType) {
					value = new arg.class(value);
				}
				args.push(value); 
			}
			else if('defaultValue' in arg) {
				break;
			}
			else {
				throw {
					code : 'MISSING_PARAMETER',
					message : 'Parameter [' + argName + '] is required',
					parameters: {
						parameter: argName
					}
				};
			}
		}

		console.dir(params);
		console.dir(args);
		
		return this[actionId].apply(this, args);
	}
}

module.exports = RestController;