var Mega_toString = function(){
    
    this.print = print;
    /**
     * Creates string desciribing any object or literal and all nested properties.
     * ie. Recreate the browser javascript console output
     *  as a string that you can use for development, etc.
     * 
     * @param  {any} obj - the object or simple to be inspected
     * @param  {boolean} [includeProto] - set true if you want to show the __proto__ keys
     * @param  {number} [depth] - starting indent, used internally during recursion
     * @returns {string}
     * 
     * @example
     *      print(myObject);
     * 
     */
    function print(obj, includeProto, depth){
        var out = '';

        depth = depth || 0;
        
        if (typeof obj == 'string'){
            // Print string and length.
            out += `"${obj}"`;
        }
        else if(typeof obj == 'function'){
            // Print function header (native functions may not show parameters).
            var body = obj.toString();
            var header = body.substring(0, body.indexOf('{'))//.replace(/[^\w\s\(\)\,]/gi, '');
            out += `${header}{ ... }`;
        }
        else if (obj && typeof obj == 'object'){
            // Print object and any nested properties that we can get out grubby little hands on.
            // Keep track of depth so we can indent appropriately
            depth++;

            // Get object keys
            var keys = Object.keys(obj);

            // Also get property names if available
            var pNames = Object.getOwnPropertyNames(obj);
            for (var pName of pNames){
                if (!keys.includes(pName)){
                    keys.push(pName);
                }
            }

            if (includeProto && obj.__proto__){
                keys.push('__proto__');
            } 

            // If no keys and toString isnt just the type, print it instead
            if (!keys.length && obj.toString && !obj.toString().includes(obj.constructor.name + ']')){
                // Print type and toString
                return out + `[${obj.constructor.name}] ${obj.toString()},`;
            }

            // Print type and length
            out += `[${obj.constructor.name}](${keys.length}){`;
            // Prevent infinite recursion, depth limited
            if (keys.length > 0 && depth > 10){ 
                return out + `\n${getIndent(depth)}...`;
            }
            // Print each key and value
            for (var key of keys){
                // Print key name
                out += `\n${getIndent(depth)}${key}: `;
                
                try{
                    // If we arent directly recurring, run again for each key.
                    if (key == '__proto__' && obj[key].constructor.name == 'Object'){
                        out += `[Object] ...`;
                    }
                    else if (obj[key] !== obj){
                        out += `${print(obj[key], includeProto, depth)}`;
                    }
                    else{
                        // If we are directly recurring, stop and print <self> instead.
                        out += `<self>`;
                    }
                }catch(e){
                    out += `<illegal>`;
                }
            }
            // Print closing brace, if object empty, print on same line as opening brace
            if (keys.length > 0) out += `\n${getIndent(depth - 1)}`;
            out += `}`;
        }
        else{
            // Simple types, print cleaner
            if (['undefined', 'boolean', 'number'].includes(typeof obj) || obj === null){
                out += `${obj}`;
            }
            else{
                // Any other type we didnt capture already
                out += `[${typeof obj}] ${obj}`;
            }
            
        }

        return out + ', ';
    }
    //helper function to create tab indents to a given depth
    function getIndent(n){
        var out = '';
        var tab = '    ';
        for (var i = 0; i < n && i >= 0; i++){
            out += tab;
        }
        return out;
    }

}
export default Mega_toString;