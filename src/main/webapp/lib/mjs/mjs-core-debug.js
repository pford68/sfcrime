/**
 * <p>The basic mjs library.  This is the uncompressed version for debugging and for development.
 * It plays nice with other libraries and is meant to augment them with my own code.</p>
 *
 * @author Philip Ford
 */

var mjs = mjs || {};

(function($){

    if (Object.isSealed){
        [Object, String, Function, Array, Array.prototype, String.prototype, Function.prototype].forEach(function(item){
            if (Object.isSealed(item)) throw new Error(item.name || item.toString() + " is sealed.");
        });
    }

    /*

    Note that I cannot disallow any properties other than "config" in $ because
    I want this framework to be to plug in to other frameworks.  I had considered removing
    all properties other than "config" form $.

    This file has one dependency (breaking my own rule):  mjs/core/strings.

    Conventions:
    (1) An Object parameter is referred to as "that."
    (2) A String parameter is referred to as "value."
    */

    // ================================================================== Private
    var $lm = {},
        $pending = {},                                          // Modules currently requested, prevents "too much recursion" caused by circular dependencies.
        $config = $.config || {},
        scripts = document.getElementsByTagName("script"),      // All script elements on the page.  Below we find the one containing this script.
        lib = null,                                             // The main JavaScript directory
        //images = "",                                          // The image directory
        regex = {
            motModule: /^\.\.\/+/,
            letter: /[a-z]/i
        },
        modulePrefixes = {},                                    // This is largely obsolete:  I no longer support mapping paths to modules, as Dojo does/did.  It is unnecessary
        regex_module = /\.|\//,                                 // Regular expression for modules paths
        $public,                                                // Public members
        debugEnabled = false;                                   // Whether the app is in debug mode (i.e., sends log messages to the console, etc.)


    function readAttributes(tag){
        var debugAttr, errorAttr, $bool = $public.toBoolean;
        debugAttr = tag.getAttribute("data-debugEnabled") || false;
        debugEnabled = $bool(debugAttr);
        $config.locale = tag.getAttribute("data-locale") || "en";
    }

    function configure(){
        /*
         Finding the script root based on the location of the mjs*.js file.
         This works best if mjs*.js is at the root of the script directory.
         TODO:  consider relying on configuration properties (passed in $) to point to the JS src directory.
         NOTE: (2012/07/19) I am considering a "data-jsdir" attribute for script tags that would point me to the js root.
         */
        $.config = $.config || {};

        lib = $.config.baseUrl;
        debugEnabled = $.config.debug || false;

        if (!lib){
            for (var i = 0, len = scripts.length; i < len; i++) {
                var script = scripts[i];
                if (lib = script.getAttribute("data-jspath")){
                    modulePrefixes['mjs'] = lib;
                }/* else if (script.src.search(/mjs.*\.js/) != -1) {
                    var context, src = script.getAttribute("src");
                    context = src.replace(/js.*\.js$/, "");
                    modulePrefixes['mjs'] = lib = context + "js";
                } */
                if (modulePrefixes['mjs']) {
                    readAttributes(script);
                    break;
                }
            }
        }

        if (!lib && !$.config.amd) {
            var fatal = [
                "The script root could not be determined:  ",
                "either the mjs script must have a name in the format /mjs\.*.js/, or ",
                "at least one script tag containing a custom data-context attribute ",
                "which points to the js root directory."
            ];
            throw new Error(fatal.join(""));
        }

        Object.defineProperty($, "config", {
            configurable: false,
            writable: true,
            enumerable: true
        });
    }

    function startsWith(str, c){
        return (c === str.substr(0, c.length));
    }


    function endsWith(str, c){
        var start = str.length - c.length;
        return (c === str.substr(start, c.length));
    }

    // Every path sent to the resource loader by require() is relative to the script root.
    // Module prefixes is currently obsolete (2012/07/31).
    function parsePath(path) {
        var m = path.split("/")[0], p = modulePrefixes[m];
        if (!endsWith(path, ".js")) path += ".js";
        return (p || lib) + "/" + path;
    }

    function isObjectEmpty(that){
        for (var i in that){
            if (that.hasOwnProperty(i)) return false;
        }
        return false;
    }




    // Begin AJAX setup
    /*
     * <p>Accessing XMLHttpRequest directly in some cases because (1) Ext.Ajax.request does not allow synchronous requests,
     * and (2) jQuery's $.ajax inhibits the debugger statement.</p>
     *
     * @private
     */
    var $http = {
        __request__: null,   // The XMLHTTPRequest object
        queue: [],

        init: function() {
            if (window.XMLHttpRequest) {
                $http.__request__ = new XMLHttpRequest();
            } else if (window.ActiveXObject) {
                try {
                    $http.__request__ = new ActiveXObject("Msxml2.XMLHTTP");
                } catch (e) {
                    try {
                        $http.__request__ = new ActiveXObject("Microsoft.XMLHTTP");
                    } catch (e) {
                    }
                }
            }

            if (!$http.__request__) {
                $public.error('mjs.js', 'Cannot create an XMLHTTP instance');
                return false;
            }
        },

        request: function(args) {
            var requestHandler, req = $http.__request__, async = (args.async != null ? args.async : true);

            requestHandler = function() {
                if (req.readyState == 4) {
                    if ((req.status == 200 || (req.status == 302 && req.allowRedirects !== false)) && args.success) args.success(req);
                    else if (!args.suppress && args.failure) args.failure(req);
                }
            };

            req.onreadystatechange = requestHandler;
            req.open(args.method, args.url, async);
            req.send(args.params);
            if (!async) requestHandler();
        }
    };

    function fetchResource(resource, module, options) {
        options = options || {};
        $http.request({
            method: "GET",
            async: false,
            url: resource,
            suppress: options.suppress || false,
            success: function(response) {
                if ($lm[module]) return;      // PF (2011/06/02):  Preventing duplicate evals.  Why they occur is unknown.
                $lm[module] = resource;       // PF (2012/07/24):  Between these first two lines is an opportunity for a module to be executed twice.

                /*
                Wrapping the returned script within a module enables some cool features:
                (1) I can create the namespace specified by the module path automatically,
                    ensuring automatically that the namespace matches the module path.
                (2) I can give the downloaded module access to its name, from the module path, which
                    helps with logging, among other things.
                */
                (function loader($){
                    var mjs = $, result;
                    if (!startsWith(module, "../")) {
                        $.module(module);
                    }

                    result = eval(response.responseText);
                    if ($public.isFunction(options.onload)){
                        options.onload(result);
                    }
                })(mjs);
                //eval(response.responseText);
            },
            failure: function(response) {
                $public.error("mjs.js", module + " not found");
            }
        });
    }

    $http.init();
    // End AJAX setup



    //===================================================================================== Public
    $public = {

        /**
         * An object holding configuration properties for mjs.  Created automatically if not
         * created by a config file.  mjs.config properties can be added, deleted, and changed,
         * but mjs.config not deleted: writable is true; configurable is false.
         */
        config: $.config || {}, // Made permanent in configure() above

        isDebugEnabled: function(){
            return debugEnabled;
        },

        setDebugEnabled: function(enabled){
            debugEnabled = enabled;
        },

        log: function(msg, varargs){
            if (debugEnabled && typeof console !== 'undefined'){
                !varargs ? console.log(msg) : console.log.apply(console, arguments);
            }
            return this;
        },

        error: function(src, msg) {
            if (!debugEnabled) return;
            throw new Error(['[', src, '] ', msg].join(''));
        },


        /**
         * Exactly like jQuery's version.  Copies properties from the second object to the first.  This is a
         * memory-efficient way to create new objects because, when we copy the properties, we are copying
         * references to the same values or functions.  Thus, only one copy of each function or object will exist.
         * This does mean, however, that extend() makes a shallow copy, and if you are expecting a clone, and
         * expecting to make changes in one object that do not effect the other, you will be disappointed.
         */
        extend: function(that, props) {
            function _extend(obj1, obj2){
                for (var i in obj2){
                    if (obj2.hasOwnProperty(i)){
                        obj1[i] = obj2[i];
                    }
                }
                return obj1;
            }

            var args = $public.from(arguments);
            if (!props){
                props = that;
                that = $;
                _extend(that, props);
            } else {
                for (var i = 1, len = args.length; i < len; i++){
                    _extend(args[0], args[i]);
                }
            }
            return that;   // For chaining
        },


        /**
         * Returns a deep copy of the specified object
         *
         * @param {Object} that The object to clone
         * @return {Object} The clone
         */
        clone: function(that){
            var clone = {}, prop, i;
            for (i in that){
                if (that.hasOwnProperty(i)){
                    prop = that[i];
                    // If I add clone() to Object.prototype, which I'm considering,
                    // calling Object.clone() within mjs.clone() breaks mj.clone().
                    if ($public.isObject(prop, true)){
                        clone[i] = $public.clone(that[i]);
                    }
                    else if ($public.isArray(prop)) {
                        var c = [];
                        for (var j = 0, len = prop.length; j < len; ++j){
                            c = $public.clone(prop[j]);
                        }
                        clone[i] = c;
                    }
                    else {
                        clone[i] = prop;
                    }
                }
            }
            return clone;
        },


        /**
         * Copies properties from the second object to the first object (that) iff the property
         * does not exist in the first or is null.
         */
        augment: function(that, props) {
            if (!props){
                props = that;
                that = $;
            }

            var i;
            for (i in props) {
                if (props.hasOwnProperty(i))
                    if (that[i] == null) that[i] = props[i];
            }
            return that;
        },


        /**
         * Copies properties from the second object to the first iff the property <strong>exists</strong>
         * in the first.
         */
        override: function(that, props) {
            if (!props){
                props = that;
                that = $;
            }
            for (var i in props) {
                if (props.hasOwnProperty(i))
                    if (i in that) that[i] = props[i];
            }
            return that;
        },


        /**
         * <p>Loads a required resource, such as another script file.  Paths are relative to the configured script root.
         * Doesn't reload scripts that are already loaded.  The specified module is registered once loaded,
         * thus not reloaded.</p>
         *
         * <p>While jQuery.getScript also imports files through XMLHttpRequest, it does not do so
         * synchronously, which is what we need during development.  (Given that mjs.require() is
         * synchronous, and calls eval(), it should be used only during development, not in production.)
         * In addition, jQuery.getScript() does not have a mechanism to prevent a script from being downloaded,
         * through AJAX again once it has already been downloaded.</p>
         *
         * <p>Supports wildcard syntax:  i.e., common/ux/*.</p>
         *
         * @param n The path, relative to the script root, of the file to load.
         * @param options
         */
        require: function(n, options) {
            n = n.replace(/\*$/, "__package__"); // 2010-07-21
            if (!$lm[n]) {
                var resource = parsePath(n);
                fetchResource(resource, n, options);
            }
        },


        /**
         * Calls $.require() if only test is true.
         * @param n
         * @param test
         * @param options
         */
        requireIf: function(n, test, options) {
            if (test) $.require(n, options);
        },


        /**
         * <p>Similar to a package declaration, declaring the file to belong to the specified namespace or module,
         * and creating that namespace if it does not exist. The entire namespace produced is added to the window
         * object.  Thus, for example, if you want to add a namespace "logging" to jQuery, you would
         * call $.module("jQuery/logging").  The parts of the namespace can be separated either
         * with forward slashes, as in a path, or with periods, as in a package.</p>
         *
         * <p>This function relates to creating namespaces only.  It does not register a module
         * to prevent it from being imported by $.require() and has no bearing on $.require().
         * The relationship between a file and module, though this library often uses the terms
         * interchangeably, is tenuous.  Multiple files can be parts of the same module.  A module
         * is really analogous to a package, not to a file, which is more analogous to a class.</p>
         *
         * @param ns [String] The namespace to create if it does not already exist.
         */
        module: function(ns) {
            var parts = ns.split(regex_module), base = window, len = parts.length, i;
            for (i = 0; i < len; ++i){
                base[parts[i]] = base[parts[i]] || {};
                base = base[parts[i]];
            }
            return base;
        },


        /**
         * Adds a key to the internal map of loaded modules, preventing $.require() from re-fetching the module.
         * @param module
         */
        registerModule: function(module) {
            $lm[module] = parsePath(module);
        },


        isFunction: function(value){
            return typeof value !== "undefined" && value != null && (typeof value === 'function' || value.constructor == Function);
        },


        isInteger: function(value) {
            var n = parseInt(value);
            return !isNaN(n) && ( value === parseInt(value));
        },


        isString: function(value) {
            return (typeof value !== "undefined" && value !== null && (typeof value === "string" || value.constructor == String));
        },

        isLetter: function(value){
            return $public.isString(value) && value.length === 1 && value.match(regex.letter);
        },


        isNumber: function(value) {
            return typeof value === 'number';
        },

        /**
         * Tests whether the specified value is an array.
         * @param {*} value
         * @return {Boolean}
         */
        isArray: function(value) {
            // The last condition (...|| value.constructor + '' == Array + '') is needed to test arrays from other frames/windows accurately.
            return (typeof value !== 'undefined' && value !== null
                && (value.constructor + '' === Array + '' || Object.prototype.toString.apply(value) === '[object Array]'));
        },



        /**
         * <p>Returns true/false for whether the specified value is an Object, and works for Objects created in other
         * frames as well.  If the "pure" flag is "true" then isObject() should return true only if the value belongs
         * exclusively to the Object type, not to any sub-type.</p>
         *
         * @param {*} value
         * @param {boolean} [pure] Whether to restrict the objects to the Object type.
         */
        isObject: function(value, pure) {
            // The last condition, which uses String.match to find "function Object ()" is needed to test objects from other frames/windows accurately.
            if (value == null) return false;
            if (pure) return ( value.constructor && value.constructor.name === 'Object');
            return (typeof value === 'object' || value.constructor === Object);
        },


        isBoolean: function(value) {
            return value === true || value === false;
        },

        /**
         * Converts the word "true" to true.  Anything else is converted to false. That last point may be surprising,
         * but if the function is going to a return a Boolean, as the name implies, it has to be that way.
         *
         * @param value
         * @return {Boolean}
         */
        toBoolean: function(value) {
            return (value != null && ((typeof value == 'string' && value.toLowerCase().trim() == "true") || value === true));
        },


        isUndefined: function(value) {
            return typeof value === 'undefined';
        },


        /**
         * Returns true/false for whether the specified object is a Node.
         * @param that
         * @return {Boolean}
         */
        isNode: function(that){
            return (
                typeof Node === "object" ? that instanceof Node :
                    that && typeof that === "object" && typeof that.nodeType === "number" && typeof that.nodeName==="string"
                );
        },


        /**
         * Returns true/false for whether the specified object is an HTMLElement.
         * @param that
         * @return {Boolean}
         */
        isElement: function(that){
            // typeof HTMLElement === 'object' is false in Chrome, and the condition for evaluating "that"
            // in that case cannot distinguish XML nodes from elements.
            return (
                HTMLElement ? that instanceof HTMLElement : //DOM2
                    that && typeof that === "object" && that.nodeType === 1 && typeof that.nodeName==="string"
                );
        },


        /**
         * Same as global parseInt except that it automatically supplies a radix of 10, thus parses numbers beginning
         * with zeros correctly (e.g., $.parseInt("015") == 15) and returns zero for non-numeric values, instead of NaN.
         * @param {String} str A numeric string
         */
        parseInt: function(str) {
            if (!str) str = "";
            var value = parseInt(str, 10);
            return (isNaN(value) ? 0 : value);
        },


        /**
         * Same as global parseFloat except non-numeric strings return 0.0, instead of NaN.
         * @param {String} str A numeric string
         */
        parseFloat: function(str) {
            if (!str) str = "";
            var value = parseFloat(str);
            return (isNaN(value) ? 0.0 : value);
        },


        /**
         * Returns true if value is null, undefined, "", {}, or zero.
         * @param value
         */
        isEmpty: function(value) {
            return (value === 0 ||
                value === null ||
                typeof value === "undefined" ||
                ($public.isObject(value, true) && isObjectEmpty(value)) ||
                ($public.isString(value) && value.isEmpty()));
        },


        /**
         * Returns false if value is null, undefined, "", or zero.
         * @param value
         */
        notEmpty: function(value) {
            return !$public.isEmpty(value);
        },


        /**
         * <p>
         * Converts an Object, not merely a NodeList, to an Array--as one might expect jQuery.makeArray() to do.
         * The values of properties <strong>declared in the object, not inherited,</strong> become elements of the array.
         * Indented for use with "pure" objects, key/value pairs, and may or may not work with subclasses of Object.
         * </p>
         *
         * @param {Object} that A set of key/value pairs
         */
        toArray: function(that) {
            if ($public.isEmpty(that)) return [];  // Return nulls as empty arrays
            if ($public.isArray(that)) return that;   // Return arrays as is.

            var result = [], length = (that.length || 0);
            // Handling the arguments object as well as strings
            if (that.length > 0) {
                return Array.prototype.slice.call(that);
            }

            // Handling all other objects
            if (that != null) {
                for (var i in that) {
                    if (that.hasOwnProperty(i)) result[result.length] = that[i];
                }
            }
            return result;
        },


        /**
         * Returns a standalone function that will be executed in the proper scope, giving "this" the correct
         * meaning within the function.  This was added to JQuery 1.4--i.e. after our current version.
         *
         * @param {Object} that  The object to bind the method to.
         * @param {String | Function} method  The method to be bound.
         */
        proxy: function(that, method) {
            var fcn = $public.isString(method) ? that[method] : method,
                defaults;
            if (!fcn){
                $public.error("$.proxy","fcn is null for method = " + method);     // TODO:  consider externalizing error messages.
            }
            if (arguments.length > 2){
                defaults = $public.toArray(arguments).slice(2);
            }
            return function() {
                return fcn.apply(that, defaults ? defaults.concat($public.from(arguments)) : arguments);
            }
        },


        /**
         * Like Python's range(), returns an array of numbers from the start up to, but not including,
         * the end.  The values are incremented by the specified step:  e.g., $.range(1,5) returns [1,2,3,4].
         * Again, like Python's range(), if you pass only one parameter, you'll get a range from 0 up to, but not
         * including that parameter.  Again, like Python's version, it does not work for floats.
         *
         * @param {Integer} start
         * @param {Integer} end
         * @param {Integer} step
         * @return {Array} An array of integers
         */
        range: function(start, end, step){
            var result = [];
            if (end == null){
                end = start;
                start = 0;
            }
            if ($.isInteger(start) && $.isInteger(end)){
                step = step || 1;
                while(start < end){
                    $.log("range").log(start + ":" + end + ":" + step);
                    result.push(start);
                    start += step;
                }
            }
            return result;
        },


        /**
         * Converts the arguments object to an array.  If a transformer function is provided,
         * it performs the transformer function for each item in the arguments object.
         *
         * @param {Arguments} $arguments The arguments object to convert to an array
         * @param {Function} [transformer] A function for transforming the argument values
         * @return {Array} An array of arguments object's values
         */
        from: function($arguments, transformer){
            var $_ = Array.prototype.slice.call($arguments);
            if ($public.isFunction(transformer)){
                return $_.map(transformer);
            }
            return $_;
        },


        /**
         * Creates a constant by the name specified by k in the specific object scope, or in mjs
         * if no scope is specified.  The constant is immutable and cannot be deleted from its scope.
         *
         * @param {String} k The name of the new constant
         * @param {String | Number | boolean} v The value of the new constant
         * @param {Object} [scope] The object to which the constant belongs.
         */
        constant: function(k, v, scope){
            if ($public.isObject(v)) {
                throw new Error("A constant must be a String or a primitive:  {0}:{1}".replaceArgs(k, v));
            }
            scope = scope || $;
            k = k.toUpperCase();
            Object.defineProperty(scope, k, {
                value: v,
                writable: false,
                enumerable: true,
                configurable: false
            });
        },


        /**
         * Cross-browser function for returning an object's prototype.
         *
         * @param {Object} that The object from which to retrieve the prototype
         * @return {Object} The specified object's prototype
         */
        getPrototype: function(that){
            return that.__proto__ || Object.getPrototypeOf(that);
        }
    };


    //================================================= Activating the framework

    // Add the core functions to the namespace, if they are not already present.
    $public.augment($, $public);

    // Start class loader and set configuration values
    configure();


    //================================================== Imports
    /*
     I think importing "polyfills," and using certain functions that should be present (or even that aren't standard
      but are added to native prototypes) is not unjustified, but minimize this file's dependencies from now on.
      */
    if (!$.config.amd){
        $public.require("mjs/core/shim");
        $public.require("mjs/core/strings");
        $public.require("mjs/i18n/" + $config.locale);
    }
    // TODO:  Prevent core modules from depending on modules in other packages.

})(mjs);
mjs.registerModule('js/mjs.js');




mjs.registerModule('js/mjsConfig.js');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/strings");
	/**
 *
 * @author Philip Ford
 */
(function($) {

    var methods = {
        /**
         *
         * @param c
         */
		endsWith: function(c){
			var start = this.length - c.length;
			return (c === this.substr(start, c.length));
		},

        /**
         *
         * @param c
         */
		startsWith: function(c){
			return (c === this.substr(0, c.length));
		},

        /**
         *
         */
        capitalize: function(){
            var str = this.toLowerCase();
            return str.charAt(0).toUpperCase() + str.substring(1);
        },

        /**
         *
         */
        uncapitalize: function(){
            return this.charAt(0).toUpperCase() + this.substring(1);
        },

        /**
         *
         */
        trim: function(){ return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); },
        trimLeft: function(){ return this.replace(/^\s+/g, ""); },
        trimRight: function() { return this.replace(/\s+$/g, ""); },

        /**
         *
         * @param {Arguments}
         */
		replaceArgs: function(){
			if (arguments.length == 0) return;
			var str = this + "", re, i, len;

			for (i = 0, len = arguments.length; i < len; i++){
				re = new RegExp("\\{" + i + "\\}", "gi");
				str = str.replace(re, arguments[i]);
			}

			return str;
		},

        /**
         *
         * @param args
         */
        applyTemplate: function(args) {
            if (args == null) return;
            var str = this + "", re, i;
            for (i in args) {
                // (2012/08/17) Added the $? to the pattern to prepare for supporting Java/Groovy-style
                // placeholders without breaking existing code.
                re = new RegExp("\\$?\\{" + i + "\\}", "gi");
                if (args.hasOwnProperty(i)){
                    str = str.replace(re, args[i]);
                }
            }
            return str;
        },

        /**
         * Requires spaces between intended syllables
         */
        toCamelCase: function(){
            var i, len, s, result = [], instance = this, syllables = instance.split(/\s+/);
            for (i = 0, len = syllables.length; i < len; ++i){
                if (i > 0) s = syllables[i].capitalize();
                else s = syllables[i].toLowerCase();
                result.push(s);
            }
            return result.join("");
        },

        /**
         * Returns true/false for whether the specified string exists within the current string.
         *
         * @param str
         */
        contains: function(str) {
            return this.indexOf(str) != -1;
        },


        /**
         * Returns true if the Strings have equal content, regardless of case.
         *
         * @param value
         * @return {Boolean}
         */
        equalsIgnoreCase: function(value){
            if (!$.isString(value)) return false;
            return this.toLowerCase() == value.toLowerCase();
        },

        /**
         * Converts the string to a boolean <strong>if and only if</strong> the string is eother "true" or "false."
         * Anything else is return as-is.
         *
         * @return {Boolean | String}
         */
        toBoolean: function(){
            if (this.trim() === "true") return true;
            else if (this.trim() === "false") return false;
            else return this;
        },


        /**
         * Returns true if the String has no content, contains only whitespace.
         *
         * @return {Boolean}
         */
        isEmpty: function(){
            return this.trim() === "";
        },

        /**
         * Returns true if the String contains any content other than whitespace.
         * @return {Boolean}
         */
        notEmpty: function(){
            return !this.isEmpty();
        },


        /**
         * Returns true/false for whether the String is all uppercase.
         * @return {Boolean}
         */
        isUpperCase: function(){
            return this.toUpperCase() == this;
        },


        /**
         * Adds padding before the string
         *
         * @param {Integer} len The number of spaces to add before the string
         * @return {String} The padded string.
         */
        justify: function(len){
            var str = [];
            len = parseInt(len);
            while(len-- > 0){
                str.push(" ");
            }
            str.push(this);
            return str.join("");
        },


        /**
         * Adds padding after the string
         *
         * @param {Integer} len The number of spaces to add before the string
         * @return {String} The padded string.
         */
        rightJustify: function(len){
            var str = [this];
            len = parseInt(len);
            while(len-- > 0){
                str.push(" ");
            }
            return str.join("");
        }
        
    };

    $.augment(String.prototype, methods);
    String.prototype.namespace = "String.prototype";
})(mjs);
})(mjs);
mjs.registerModule('mjs/core/strings');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/arrays");
	(function($)
{
    /**
     * Custom array functions as well as native array functions that may or may not be supported
     * by the current browser.
     *
     * Many of these are copied from MDC Array functions: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/
     * The exceptions are copy and contains.
     * 
     * @author Philip Ford
     */

    // TODO:  Is this method of adding missing functions truly more efficient than usual methods?

    function validate(list){
        if (!$.isArray(list)) throw new Error("The argument must be an array.");
    }

    var m = {
        /**
         * Copies the contents of the associated array to the specified array.
         * @param {Object[]} a The array to which to copy indices
         * @param {Integer} [start] The index at which to start copying indices
         * @param {Integer} [count] The number of elements to copy, including the one at index "start"
         * @scope Array.prototype
         */
        copy: function(a, start, count)
        {
            if (arguments.length == 0) return this.concat([]);

            var i, j = 0,
                    _start = (start != null ? start : 0),
                    _count = (count != null ? _start + count - 1 : this.length - 1);
            $.log(_start + ":" + _count);
            for (i = _start; i <= _count; ++i)
            {
                a[j] = this[i];
                ++j;
            }
        },


        /**
         * Inserts new elements and/or removes old elements.  For use in browsers that don't support the native function.
         * @param {Integer} startIndex The index at which to start the replacement/deletion/assertion.
         * @param {Integer} number  The number of items to delete/replace, starting with and including the element at startIndex, in the array.
         * @scope Array.prototype
         * @return {Object[]} The elements that were removed
         */
        splice: function(startIndex, number, varargs)
        {
            $.log("[Array.prototype.splice] Using custom splice");
            if (number > this.length || startIndex + number > this.length){
                number = this.length - startIndex;
            }

            var i, len, before = [], after = [], splice = [];
            // Creating 3 segments:  the part before the splice, the part after the splice, and the splice.
            if (number > 0) {
                this.copy(before, 0, startIndex);
                this.copy(after, number + 1, this.length);
                this.copy(splice, startIndex, number);
            }
            // Adding new elements to the first segment
            for (i = 2, len = arguments.length; i < len; ++i){
                before.push(arguments[i]);
            }

            // Copying the result to this
            var result = before.concat(after);
            for (i = 0, len = result.length; i < len; ++i){
                this[i] = result[i];
            }

            // Reset the length
            this.length  = result.length;

            // Return the removed elements
            return splice;
        },



        /**
         * @param item
         * @param startIndex
         */
        indexOf: function(item, startIndex)
        {
             var len = this.length >>> 0, from = startIndex || 0;

             from = (from < 0) ? Math.ceil(from) : Math.floor(from);
             if (from < 0)
               from += len;

             for (; from < len; from++)
             {
               if (from in this && this[from] === item)
                 return from;
             }
             return -1;
        },



        /**
         * 
         * @param item
         * @param startIndex
         */
        lastIndexOf: function(item, startIndex)
        {
            var len = this.length;
            if (isNaN(startIndex)) {
                startIndex = len - 1;
            } else {
                startIndex = (startIndex < 0) ? Math.ceil(startIndex) : Math.floor(startIndex);
                if (startIndex < 0) startIndex += len;
                else if (startIndex >= len) startIndex = len - 1;
            }

            for (; startIndex > -1; startIndex--) {
                if (startIndex in this && this[startIndex] === item)
                return startIndex;
            }
            return -1;
        },


        /**
         * @param {Function} callback
         * @param {Object} [thisVal] Object scope for the function.
         */
        forEach: function(callback, thisVal)
        {
            var i, len = this.length;
            for (i = 0; i < len; i++)
                callback.call(thisVal, this[i], i, this);
        },


        /**
         * Creates a new array by performing a transformation function on each item in the original array.
         * @param {Function} callback
         * @param {Object} [thisVal] Object scope for the function.
         */
        map: function(callback, thisVal)
        {
            var i, len = this.length, result = [len];
            for (i = 0; i < len; i++)
                result[i] = callback.call(thisVal, this[i], i, this);
            return result;
        },

        /**
         * @param {Function} callback
         * @param {Object} [thisVal] Object scope for the function.
         */
        filter: function(callback, thisVal)
        {
            var i, val, len = this.length, result = [];
            for (i = 0; i < len; i++)
            {
                val = this[i];
                if (callback.call(thisVal, val, i, this))
                    result[result.length] = val;
            }
            return result;
        },

        /**
         * @param {Function} callback
         * @param {Object} [thisVal] Object scope for the function.
         */
        every: function(callback, thisVal)
        {
            var i, len = this.length;
            for (i = 0; i < len; i++)
                if (!callback.call(thisVal, this[i], i, this))
                    return false;
            return true;
        },

        /**
         * @param {Function} callback
         * @param {Object} [thisVal] Object scope for the function.
         */
        some: function(callback, thisVal)
        {
            var i, len = this.length;
            for (i = 0; i < len; i++)
                if (callback.call(thisVal, this[i], i, this))
                    return true;
            return false;
        },


        /**
         * Returns true/false for whether the specified value is present in the array.
         *
         * @param {*} value
         * @return {Boolean}
         */
        contains: function(value)
        {
            var hasEquals = value && $.isFunction(value.equals);
            for (var i = 0, len = this.length; i < len; ++i)
            {
                if ((this[i] === value) || (hasEquals && value.equals(this[i]))) return true;
            }
            return false;
        },


        /**
         * The accumulator requires the following parameters:
         * previousValue, currentValue, index, array
         *
         * @param {Function} accumulator
         * @param {*} [init]
         * @return {*}
         */
        reduce: function(accumulator, init){
            var i = 0, len = this.size(), current;

            if (!$.isFunction(accumulator)){
                throw new TypeError("[Array.prototype.reduce] The first argument must be a function.");
            }

            if(!init) {
                if (len === 0) throw new TypeError("[Array.prototype.reduce] Array length is 0 and no second argument");
                current = this[0];
                i = 1; // start accumulating at the second element
            } else {
                current = init;
            }

            while (i < len) {
                if(i in this) {
                    current = accumulator.call(undefined, current, this[i], i, this);
                }
                ++i;
            }

            return current;
        },


        /**
         *
         * @param {Function} accumulator
         * @param {*} [init]
         * @return {*}
         */
        reduceRight: function(accumulator, init){
            var len = this.size(), i = len, current;

            if (!$.isFunction(accumulator)){
                throw new TypeError("[Array.prototype.reduceRight] The first argument must be a function.");
            }

            if(!init) {
                if (len === 0) throw new TypeError("[Array.prototype.reduceRight] Array length is 0 and no second argument");
                current = this[len - 1];
                i = len - 2; // start accumulating at the second element
            } else {
                current = init;
            }

            do {
                if(i in this) {
                    current = accumulator.call(undefined, current, this[i], i, this);
                }
                --i;
            } while (i > 0);

            return current;
        },


        /**
         * This function exists largely so that clients can use arrays without having to know whether
         * they are dealing with arrays.  Clients could test whether the array implements an interface
         * that requires size(), instead of whether the object involved is an array.  This permits the
         * clients to use array-like structures in addition to arrays.
         */
        size: function(){
            return this.length >> 0;
        },


        difference: function(list){
            validate(list);

            var instance = this, result;

            // Get the items in this that are not in list.
            result = this.filter(function(item){
                return !list.contains(item);
            });
            // Get the items in list that are not in this, then concatenate them to the result.
            return result.concat(list.filter(function(item){
                return !instance.contains(item);
            }));
        },


        intersection: function(list){
            validate(list);
            return this.filter(function(item){
                return list.contains(item);
            });
        },


        /**
         * Returns a new array containing all of the unique items in both the arrays.  The items in
         * the new array are unique.  When duplicates are found, the first of the duplicates in the
         * one that is retained in the new array.
         *
         * @param varargs
         * @return {*}
         */
        union: function(varargs){
            var list = [];
            for (var i = 0, len = arguments.length; i < len; i++){
                list = list.concat(arguments[i]);
            }
            var result = this.unique();
            return result.concat(list).unique();
        },


        /**
         * Returns a new array with a duplicates removed.  When duplicates are found, the first of the duplicates in the
         * one that is retained in the new array.  Thus, [1,2,4,5,5,4,6].unique() will be [1,2,4,5,6].
         *
         * @return {Array}
         */
        unique: function(){
            var result = [];
            for (var i = 0, len = this.length; i < len; ++i){
                if (!result.contains(this[i])) {
                    result.push(this[i]);
                }
            }
            return result;
        },


        flatten: function(){
            var result = [];
            for (var i = 0, len = this.length; i < len; ++i){
                if ($.isArray(this[i])){
                    result = result.concat(this[i].flatten());
                } else {
                    result[i] = this[i];
                }
            }
            return result;
        },


        /**
         * Inserts an element at the specified index.  Unlike splice(), it does not remove elements.
         *
         * @return this
         */
        insert: function(args){
            var a = [], b = [], result, i, len,
                index = args.index,
                items = args.items;
            if (!$.isArray(items)) items = [items];
            this.copy(a, 0, index);  // The index where we want to insert item is the count for the first segment.
            this.copy(b, index);

            result = a.concat(items).concat(b);
            for (i = 0, len = result.length; i < len; ++i){
                this[i] = result[i];
            }
            this.length = result.length;
            return this;
        },


        /**
         *  Copies array elements to an object, behaving a little like PERL's each(), except this function can't
         *  copy to new variables.   The "that" parameter is an object.  With "destructuring assignments" coming (or
         *  here), assigning results to arrays of variables in not needed,
         */
        toEach: function(that){
            var i, index = 0;
            for (i in that) {
                if (that.hasOwnProperty(i)){
                    that[i] = this[index];
                    ++index;
                }
            }
            return that;
        },


        clone: function(){
            return this.slice(0);
        },


        remove: function(index){
            var result = this[index];
            this.splice(index, 1);
            return result;
        },


        /**
         * Returns the last item in the array without removing it.
         *
         * @return {*}
         */
        last: function(){
            return this[this.length - 1];
        },


        /**
         * <p>Converts an array of Strings to an object for fast lookup.  Each item in the array becomes
         * both the key and the value for the corresponding item in the resulting object.  Intended for
         * use with String arrays.</p>
         *
         * <p>This is probably only needed if you have to lookup items several times on the same array.  If you
         * only have to do one lookup, just use indexOf(), using the returned index to get the list item.</p>
         *
         * @return {Object} The "set" of Strings, each of which is both a key and a value.
         */
        toSet: function(){
            var that = {};
            this.forEach(function(item){
                var hash = item.hash ? item.hash() : item.valueOf();
                that[hash] = item;
            });
            return that;
        }

    };

    $.augment(Array.prototype, m);
})(mjs);
})(mjs);
mjs.registerModule('mjs/core/arrays');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/StringBuilder");
	// TODO (2010/04/13):  In light of new information regarding String performance in modern browsers, re-test StringBuilder's
// performance vis-a-vis string concatenation.
// PF (2010/07/15):  common/oop.js now requires StringBuilder, so this file cannot require or use oop.js.

(function ($)
{
    $.requireIf("mjs/core/arrays", !Array.prototype.splice);

    /**
     * @namespace
     * @description Emulates Java's StringBuilder, concatenating strings more efficiently than the "+" operator.
     * @param {String} [s] An initial base string inserted in the buffer
     * @returns {Object} The StringBuilder object.
     * @author Philip Ford
     */
    function StringBuilder(s)
    {
        this.buffer = [];
        if (s != null) return this.append(s);
        return this;
    }

    $.extend(StringBuilder.prototype, {

        /**
         * <p>Adds the specified string to the buffer.</p>
         * @name append
         * @param {String} s The string to add to the buffer
         * @memberOf $.StringBuilder
         * @function
         */

        append: function(s)
        {
            var items = this.buffer;
            if (s != null) items[items.length] = s;
            return this;
        },

        /**
         * <p>Inserts a string in the buffer at the specified index (zero-based).</p>
         * @name insert
         * @param {Number} index The index in the buffer at which to insert the specified string.
         * @param {String} s The string to insert
         * @memberOf $.StringBuilder
         * @function
         */
        insert: function(index, s)
        {
            this.buffer.splice(index, 0, s);
        },

        /**
         * <p>Deletes the item in the buffer at the specified index</p>
         * @name deleteAt
         * @param {Number} index The index of the value to be replaced in the buffer.
         * @memberOf $.StringBuilder
         * @function
         */
        deleteAt: function(index)
        {
            this.buffer.splice(index, 1);
        },

        /**
         * <p>Replaces the string in the buffer at the specified index with another string.</p>
         * @name replaceAt
         * @param {Number} index The index of the value to be replaced in the buffer.
         * @param {String} s The replacement
         * @memberOf $.StringBuilder
         * @function
         */
        replaceAt: function(index, s)
        {
            this.buffer.splice(index, 1, s);
        },

        /**
         * <p>Returns the value at the specified index in the buffer</p>
         * @name get
         * @param {Number} index The index of the value to be retrieved from the buffer.
         * @memberOf $.StringBuilder
         * @function
         */
        get: function(index)
        {
            return this.buffer[index];
        },

        /**
         * <p>Builds the finished string and returns it.</p>
         * @name toString
         * @memberOf $.StringBuilder
         * @function
         */
        toString: function()
        {
            return this.buffer.join("");
        },
        

        /**
         * <p>Deletes the contents of the buffer.</p>
         * @name clear
         * @memberOf $.StringBuilder
         * @function
         */
        clear: function()
        {
            this.buffer = [];
        },


        /**
         * <p>Returns the number of items in the buffer.</p>
         * @name length
         * @memberOf $.StringBuilder
         * @function
         */
        length: function()
        {
            return this.buffer.length;
        }
    });

    $.extend({ StringBuilder: StringBuilder });

})(mjs);

})(mjs);
mjs.registerModule('mjs/core/StringBuilder');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/utils");
	/**
 * Less-commonly used functions.
 *
 * @author Philip Ford
 */
(function ($) {
    $.require("mjs/core/arrays");

    var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''); // chars to use.

    function S4() {
        return { quad: (((1+Math.random())*0x10000)|0).toString(16).substring(1) };
    }




    var utils = {
        /**
         * Generates a close facsimile of a GUID.
         *
         * @see http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
         * @return {*}
         */
        GUID: function(){
            return "{quad}{quad}-{quad}-{quad}-{quad}-{quad}{quad}{quad}".applyTemplate(S4());
        },


        /**
         *
         * @see http://www.broofa.com/Tools/Math.uuid.js
         *
         * @return {String}
         */
        UUID: function(){
            var uuid = new Array(36), rnd=0, r;
            for (var i = 0; i < 36; i++) {
                if (i==8 || i==13 ||  i==18 || i==23) {
                    uuid[i] = '-';
                } else if (i==14) {
                    uuid[i] = '4';
                } else {
                    if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
                    r = rnd & 0xf;
                    rnd = rnd >> 4;
                    uuid[i] = CHARS[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
            return uuid.join('');
        },


        getAlphabet: function(){
            return CHARS.slice(-26);
        },



        getCaller: function(f, args){
            return f.caller || (arguments.callee ? arguments.callee.caller : { name: 'anonymous caller' } );
        },


        /**
         * Prepends zeros to the specified number until the resulting string matches the specified length, or 2
         * if no length is specified:  e.g.,  $.util.pad(3) produces "03".
         *
         * @param {Number} num The number to pad
         * @param {Number} [len] Minimum length of the result, defaults to 2.
         * @return {String} The padded numeric string
         */
        pad: function(num, len){
            len = len || 2;
            num = num + "";
            var count = 0, z = [];
            len = len - num.length;
            while(count++ < len){
                z.push("0");
            }
            z.push(num);
            return z.join("");
        }
    };

    $.extend(utils);

})(mjs);
})(mjs);
mjs.registerModule('mjs/core/utils');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/oop");
	(function($)
{
    $.require("mjs/core/strings");
    $.require("mjs/core/StringBuilder");
    $.require("mjs/core/utils");

    //============================================================ Private

    Object.defineProperty(Function.prototype, "methodName", {
        enumerable: false,
        configurable: true,
        writable: true
    });


    /* The following mixins are meant to be superseded by (i.e., overridden by)
     corresponding properties in a class definition. */
    var ClassMixin = {
        /**
         * Defines how to compare instances of this class.  <strong>Does not require hash().</strong>
         *
         * @param that
         * @return {Boolean}
         */
        equals: function(that){
            return this === that;
        },
        /**
         * Created to support hashtables, though ironically mjs.util.Hashtable class does not use it.
         * HashMap does, however.
         *
         * @return {Object}
         */
        hash: function(){
            return $.UUID();  // No, JSON.stringify() is not a solution here:  can't guarantee the order
        }
    };


    /*
    A private object for passing between constructors.
     */
    function inherit(){}


    /*
    Used to determine whether an object implements an interface, without throwing an error if it doesn't,
    as _implement, hence Object.implement, would do.
    */
    function $implements(that, $interface)
    {
        if (!that._interfaces || !($interface instanceof Interface)) return false;
        if (!$.isArray(that._interfaces))
        {
            $.error("$implements", "The interfaces property should be an Array:  " + that._interfaces);
        }

        var i, len = that._interfaces.length;
        for (i = 0; i < len; i++)
        {
            if (that._interfaces[i] === $interface) return true;
        }
        return false;
    }

    /*
    Checks whether the object contains all of the specified functions and throws an error if it doesn't.
    Used by Object.implement.
     */
    function _implement(that, $$interface, caller)
    {
        if (!that._interfaces) {
            Object.defineProperty(that, "_interfaces", {
                value: [],
                writable: false,
                configurable: false,
                enumerable: false
            })
        }
        var $methods = $$interface.methods, errors = [], i;
        for (i in $methods)
        {
            if ($methods.hasOwnProperty(i)){
                if ($.isUndefined(that[i]) || !$.isFunction(that[i])) {
                    errors.push(i);
                }
            }
        }
        if (errors.length > 0) {
            throw new $.AbstractMethodError(errors.join(", ") + "in " + caller);
        }
        that._interfaces[that._interfaces.length] = $$interface; // Adding an array property "interfaces" to obj to store the interfaces implemented.
    }


    /*
    Checks whether "value" is present in "that."  For now I don't use hasOwnProperty on that:
    I think I may want to see inherited properties.
     */
    function contains(that, value){
        for (var i in that){
            if (that[i] == value) return true; // Leaving out hasOwnProperty() purposely for now.
        }
        return false;
    }


    /*
    Creates a private property named k in that.
     */
    function encapsulate(that, k, v, className){
        var _p = v,
            errorMsg = "{0} is accessible only inside the class {1}";
        delete that[k];


        Object.defineProperty(that, k, {
            get: function _getPrivateProperty(){
                var caller = $.getCaller(_getPrivateProperty, arguments);
                if (caller == contains || contains(that, caller)){  // Added "caller == contains" for Chrome/Safari
                    return _p;
                }
                throw new Error(errorMsg.replaceArgs(k, className || ""));
            },
            set: function _setPrivateProperty(value){
                var caller = $.getCaller(_setPrivateProperty, arguments);
                if (caller == contains || contains(that, caller)){ // Added "caller == contains" for Chrome/Safari
                    _p = value;
                } else {
                    throw new Error(errorMsg.replaceArgs(k, className || ""));
                }
            },
            configurable: false,
            enumerable: false
        });

    }



    //----------------------------Interfaces
    function Interface(a, caller)
    {
        this.methods = {};

        var methods = this.methods, methodName, i, len;
        for (i = 0, len = a.length; i < len; i++)
        {
            methodName = a[i];
            if (!$.isString(methodName)){
                $.error(caller, "index " + i + " is not a String in $.Interface");
            }
            methods[methodName] = methodName;
        }
        Object.freeze(this.methods);
    }
    Interface.prototype = {
        extend: function(){
            var args = [];
            for (var i = 0; i < arguments.length; i++){
                args[i] = arguments[i];
            }
            for (var j in this.methods){
                if (this.methods.hasOwnProperty(j)) {
                    args.push(this.methods[j]);
                }
            }
            return new Interface(args);
        }
    };






    //============================================================= Public

    $.Interface = function _Interface()
    {
        var caller = $.getCaller(_Interface, arguments).name;


        // A consequence of returning a new Interface here is that no public "Interface" type will exist.
        // This is intentional.
        return Object.freeze(new Interface($.toArray(arguments), caller));
    };


    /**
     *   <p>Creates a new "class."  Like Java, it ensures that the parameter-less <strong>initializer</strong>
     *   (the term "constructor" would not be quite correct here) of the parent class is called
     *   when the subclass initializer is called.   Unlike Java, no error occurs if the parent
     *   has no parameter-less initializer; however, the parent initializer also will not be invoked.
     *   To call the parent initializer in such cases, insert this.$super(args) in the subclass initializer.
     *   Also note that nothing forces you to make the $super() call the first line of the subclass initializer:
     *   rightly or wrongly, it could be at the end of the subclass initializer or anywhere else within the
     *   subclass initializer.</p>
     *
     *   <p>Class body:
     *   <ul>
     *       <li>Constants:  If a property name is all upper case, it will be turned into a constant. </li>
     *       <li>Private visibility:  If a property name begins with an underscore, it will become private.
     *           <ul>
     *               <li>It will not be accessible outside of methods of the class.
     *                   Any attempt by other classes to access the property will throw an error. </li>
     *               <li>It will not be inherited by subclasses:  e.g., overriding methods will not be able
     *                   to access it.</li>
     *               <li>It will still be accessible in inherited methods. </li>
     *           </ul>
     *       </li>
     *   </ul>
     *   </p>
     *
     *   <p>Multiple inheritance is supported, by using an array of super classes/objects in the first parameter.
     *   Be aware that the instanceof operator will no longer behave as expected if multiple inheritance is used.
     *   Again that array can contain objects, Classes, or functions (latter case cause the class to inherit
     *   methods from the functions' prototypes).
     *   </p>
     *
     *
     *   @param {Function|Object|Array} [superClass] The parent(s) class, if any.
     *   @param {Object} definition The body of the new class
     */
    $.Class = function(superClass, definition)
    {
        /*
         DESIGN:
         var myClass = function(){};
         if (parent) myClass.prototype = new Parent();
         mixin(myClass.prototype, classBody);
         */
        var __class__ = null,       // The new "class," which is also a function.
            init = null;            // The specified initializer or an empty function.

        if (!definition){
            definition = superClass;
            superClass = null;
        }

        // Multiple inheritance
        if (Array.isArray(superClass)){
            var parents = superClass;
            superClass = function Multiple(){};

            /* We need to mix all of the parents into Multiple.prototype.
               Thus, for any parents that are functions, we need the prototype. */
            parents = parents.map(function(item){
                return $.isFunction(item) ? item.prototype: item;
            });

            // Mixing the parents into the new super class constructor's prototype.
            $.proxy($, "extend", superClass.prototype).apply(null, parents);
        }


        // 2012/08/02:  Transitioning to using constructor instead of initialize.
        if (definition.hasOwnProperty("constructor")){
            definition.initialize = definition.constructor;
        }
        if (definition && definition.initialize){
            init = definition.initialize;
        } else  {
            if (!definition) definition = {};
            init = definition.initialize = function(){}
        }

        // New class
        __class__ = function(){
            var $sinit /* Super constructor */;
            /*
             Calling the super class constructor first (if parameter-less), like Java does.
             */
            if (superClass && superClass.prototype.initialize){
                $sinit = superClass.prototype.initialize;
                if ($sinit.length === 0){
                    $sinit.apply(this, arguments);
                }
            }

            /*
            Call initialize(), the class constructor

            Do not call it, however, if the constructor was invoked from within $.Class,
            meaning we are assigning it to a subclass' prototype.  If we allowed that to happen,
            that would violate my own mandate never to invoke a constructor that has parameters
            automatically.

            The strategy of using a totally private object (the inherit method) only worked when inherit
            was declared outside $.Class, though it still has to be within this file's closure to be private.

            It should be impossible for the private inherit() function to be passed to this constructor
            except within $.Class, which happens below as I assign a new instance of the super class, if any,
            to the prototype of the new class.
            */
            if (arguments.length == 0 || arguments[0] !== inherit) {
                init.apply(this, arguments);
            }


            // Abstract classes cannot be instantiated.
            if (this._interfaces.length > 0) {
                $Object.implement.apply($Object, [this].concat(this._interfaces));
            }

        };



        // Extend the parent class, if any, ensuring that instanceof works as expected for subclasses.
        if (typeof superClass === 'function') {
            __class__.prototype = new superClass(inherit);
        }

        // For declaring that the class implements interfaces
        __class__.implement = function(){
            __class__.prototype._interfaces = $.toArray(arguments);
            return __class__;
        };

        // Process the properties stripping out constants and private members.
        var arg,                              // The current property in the loop below
            my = {},                          // Private members in the definition
            constants = {},                   // Constants found in definition
            args = $.extend({}, definition);  // For iterating while deleting from definition.
        for (var i in args){
            if (args.hasOwnProperty(i)){
                arg = args[i];
                // Handle private properties
                if (i.startsWith("_")){
                    my[i] = arg;
                    delete definition[i];
                }
                // Tell each method its own name
                else if ($.isFunction(arg)){
                    arg.methodName = i;
                }
                // Handle constants
                else if (i.isUpperCase()){
                    $.constant(i, arg, __class__);
                    constants[i] = arg;
                    delete definition[i];
                }
            }
        }

        // Mixing in default implementations of some methods that all classes should have.
        $.augment(definition, ClassMixin);

        // Mixing in the new "class body"
        $.extend(__class__.prototype, definition, {
            _interfaces: [],
            constructor: __class__,
            inherited: function(){
                var args = $.from(arguments),
                    prop = args.shift(),
                    p = superClass.prototype[prop];
                return $.isFunction(p) ? p.apply(this, args) : p[prop];
            },
            $super: function(){
                superClass.prototype.initialize.apply(this, arguments);
            },
            toString: function(){
                return $Object.toString(this);
            },
            getClassName: function(){
                return this._className || "";
            }
        });



        /* TODO:  consider adding code to execute a "static initializer" here for customizing the class as a whole:
           e.g., for calling Object.defineProperties(). */

        /* Adding private accessor properties to the prototype.  They have to be added after the
           public methods are mixed in:  the accessors for the property need to determine whether the function
           the attempts to access the property is in the prototype. */
        for (i in my){
            if (my.hasOwnProperty(i)){
                // TODO:  Strip private properties from the prototype here before re-adding them as accessor properties.
                encapsulate(__class__.prototype, i, my[i], my._className);
            }
        }

        /*
        TODO: Do we want to freeze the prototype?  How about the instance?
        Note:  Freezing the prototype breaks unit tests.
        The answer to the second question is probably no.
        */

        return __class__;
    };






    //---------------------------------------------- Object namespace extensions
    var $Object = {
        
        isa: function(obj, args)
        {
            // Don't allow an Interface to be the right operand of instanceof:  it will throw an error.
            if (args instanceof Interface) return $implements(obj, args);
            return (obj instanceof args);
        },


        /**
         * Checks whether the specified object (yes, object) implements the methods required by the specified interface
         * <strong>Throws an error if the object does not implement the required methods.</strong>
         * 
         * @param obj
         * @param $interface
         */
        implement: function _implements(obj, $interface /* ,... */)
        {
            var caller = $.getCaller(_implements, arguments).name;
            for (var i = 1, len = arguments.length; i < len; i++)
            {
                _implement(obj, arguments[i], caller);
            }

            return obj;
        },


        toString: function(obj){ 
            var i, str, buffer = new $.StringBuilder();
            for (i in obj){
                if (obj.hasOwnProperty(i)){
                    if (!$.isFunction(obj[i])) {
                            buffer.append(i).append(":  ").append(obj[i]).append(", ");
                    }
                }
            }
            str = buffer.toString().replace(/,\s+$/, "");
            return str;
        },

        hash: function(that){
            return $.isFunction(that.hash) ? that.hash() : ($.isString(that) ? that : that + "");
        },

        /**
         * Makes the specified property private.
         *
         * @param {String} prop  The name of the property to make private.
         * @param {Object} that  The object that the property belongs to.
         * @param {Object} options  Whether to create public getter/setter methods, defaults to false.
         */
        encapsulate: function(prop, that, options){
            options = options || {};
            var value = that[prop] || options.value,
                pName = prop.capitalize(),
                className = that._className || options.className || "anonymous";
            delete that[prop];
            if (options.addSetter === true){
                that["set" + pName.replace(/$_/,"")] = function(value){ that[prop] = value; };
            }
            if (options.addGetter === true){
                that["get" + pName.replace(/$_/,"")] = function(){ return that[prop] };
            }
            encapsulate(that, prop, value, className)
        },


        /**
         *
         * @param props
         * @param that
         * @param options
         */
        encapsulateAll: function(props, that, options){
            for (var i in props){
                if (props.hasOwnProperty(i)){
                    $Object.encapsulate(props[i], that, options)
                }
            }
        }
    };


    /*
     Note that I don't add these methods to Object.prototype below
     because that could have undesirable consequences:  objects that are meant to be empty (e.g., {})
     would not be because they would inherit the methods from the prototype.  This would come up
     when looping through object properties as well.  Instead, I make them "static" methods of Object.
    */
    $.extend(Object, $Object);





    //----------------------------------Aliases
    Object.finalizes = Object.implement;
    Object.fulfills = Object.implement;





    //---------------------------------Exceptions
    $.AbstractMethodError = (function(){
        function AbstractMethodError(msg){
            this.message += msg;
        }
        AbstractMethodError.prototype = new Error();
        $.extend(AbstractMethodError.prototype, {
            message: "Not all required methods were implemented:  ",
            name: "AbstractMethodError"
        });
        return AbstractMethodError;
    })();

})(mjs);

})(mjs);
mjs.registerModule('mjs/core/oop');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/publish");
	/**
 * Pub/sub frameworks.
 *
 * @author: Philip Ford
 */

(function($) {
    $.require("mjs/core/arrays");
    $.require("mjs/core/oop");


    Function.prototype.subscribe = function(publisher) {
        publisher.add(this);
        return this; // for chaining
    };


    Function.prototype.unsubscribe = function(publisher) {
        publisher.remove(this);
        return this;  // for chaining
    };

    var Publisher = $.Class({
        initialize: function(){
            this.clear();
        },
        publish: function() {
            var args = arguments;
            //$.log("publish").log(args);
            this._subscribers.forEach(function(fn) {
                fn.apply(null, args);
            });
            return this; // for chaining
        },
        getSubscribers: function(){
            return this._subscribers;
        },
        clear: function(){
            this._subscribers = [];
            return this;
        },
        add: function(subscriber){
            if (!this._subscribers.contains(subscriber)){
                this._subscribers.push(subscriber);
            }
        },
        remove: function(subscriber){
            this._subscribers = this._subscribers.filter(function(fn) {
                if (fn !== subscriber) {
                    return fn;
                }
            });
        }
    });




    //========================================= For subscribing/publishing through topics.
    var map = {};

    var topicObject = {
        get: function(key){
            return map[key];
        },
        subscribe: function(topicName, func) {
            if (arguments.length > 2) {
                func = $.proxy(arguments[1], arguments[2]);
            }
            if (!map[topicName]) map[topicName] = [];

            var exists = map[topicName].some(function(fn) {
                return (fn === func);
            });
            if (!exists) {
                map[topicName].push(func);
            }
            return this;  //For chaining
        },
        unsubscribe: function(topicName, func) {
            if (arguments.length > 2) {
                func = $.proxy(arguments[1], arguments[2]);
            }
            if (map[topicName]) {   // MFM to prevent error when undefined
                map[topicName] = map[topicName].filter(function(fn) {
                    if (fn !== func) {
                        return fn;
                    }
                });
            }
            return this;  // For chaining
        },
        unsubscribeAll: function(topicName) {
            map[topicName] = [];
        },
        publish: function(topicName, args) {
            if (map[topicName]) {   // MFM to prevent error when undefined
                if ($.isArray(map[topicName])) {
                    map[topicName].forEach(function(fn) {
                        fn(args);
                    })
                }
            }
            return this; //For chaining
        }
    };



    $.extend($, { Publisher: Publisher, topics: topicObject });

})(mjs);
})(mjs);
mjs.registerModule('mjs/core/publish');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/ObjectDecorator");
	/**
 *
 * @author Philip Ford
 */
(function($) {

    //================================================================ Private

    function Specification(spec){
        this.spec = spec;
    }
    $.extend(Specification.prototype,{
        /**
         * Returns true/false for whether the specified object has all of the properties in the component.
         * and whether the types of the corresponding properties match.
         *
         * @param that
         * @return {Boolean}
         */
        like: function(that){
            var spec = this.spec;
            $.log("like start").log(that);
            for (var i in spec){
                if (spec.hasOwnProperty(i) && spec[i] !== null){
                    if (that[i] !== null && (typeof spec[i] !== typeof that[i])) {
                        $.log("like").log(i);
                        return false;
                    }
                }
            }
            return true;
        },
        /**
         * Returns true/false for whether the specs of the component and the specified object match exactly,
         * sharing all of the same properties, and whether the types of the corresponding properties match.
         *
         * @param that
         * @return {Boolean}
         */
        equals: function(that){
            var spec = this.spec;
            for (var i in that){
                if (that.hasOwnProperty(i) && that[i] !== null){
                    if (spec[i] !== null && (typeof spec[i] !== typeof that[i])) {
                        $.log("equals").log(i);
                        return false;
                    }
                }
            }
            return this.like(that);
        }
    });


    //============================================================================ Public
    var ObjectDecorator = function(that){
        this.component = that;
    };


    Object.defineProperties(ObjectDecorator.prototype, {
        component: {
            enumerable: false,
            configurable: false,
            writable: true         // Writable defaults to false in Firefox, preventing me from writing to it later.
        }
    });



    $.extend(ObjectDecorator.prototype, {

        /**
         * Mixes the properties of the arguments into the component.
         *
         * @param varargs
         * @return {*}
         */
        extend: function(varargs){
            function _extend(a, b){
                for (var i in b){
                    if (b.hasOwnProperty(i)){
                        a[i] = b[i];
                    }
                }
                return a;
            }

            var args = $.from(arguments);
            for (var i = 0, len = args.length; i < len; i++){
                _extend(this.component, args[i]);
            }
            return this;   // For chaining
        },

        /**
         * Mixes the properties of the specified object into the component, but only properties that do not already
         * exist in the component.  In other words, existing properties are not overridden in the component.
         *
         * @param that
         * @return {*}
         */
        augment: function(that){
            var i, cmp = this.component;
            for (i in that) {
                if (that.hasOwnProperty(i))
                    if (cmp[i] == null) cmp[i] = that[i];
            }
            return this;   // For chaining
        },


        /**
         * Adds the properties of the specified object to the component if and only if the component already
         * has properties of the same name.
         *
         * @param that
         * @return {*}
         */
        override: function(that){
            var cmp = this.component;
            for (var i in that) {
                if (that.hasOwnProperty(i))
                    if (i in cmp) cmp[i] = that[i];
            }
            return this;  // For chaining
        },


        /**
         * Checks whether all of the arguments are properties of the component.
         */
        has: function(varargs){
            var cmp = this.component, args = $.from(arguments);
            for (var i = 1, len = args.length; i < len; ++i){
                if (!cmp[args[i]]) return false;
            }
            return true;
        },


        /**
         * Performs an operation for each item in the specified object.
         *
         * @param callback
         */
        forEach: function(callback){
            var cmp = this.component;
            for (var i in cmp){
                if (cmp.hasOwnProperty(i)){
                    callback(cmp[i], i, cmp);
                }
            }
            return this;
        },


        /**
         * Creates a new object by performing a transformation on each value in the specified object.
         * @param callback
         */
        map: function(callback){
            var result = {};
            this.forEach(function(item, i, cmp){
                result[i] = callback(item, i, cmp);
            });
            return result;
        },


        /**
         * Returns an object of component key/value pairs that passed the filter.  The filter requires a callback
         * function that takes the following parameters:  (1) the value of the current property, the name of the
         * current property, and the component.  That function must return true/false.
         *
         * @param {Function} callback
         */
        filter: function(callback){
            var result = {};
            this.forEach(function(item, i, cmp){
                if (callback(item, i, cmp) === true){
                    result[i] = item;
                }
            });
            return result;
        },


        /**
         * Returns the number of key/value pairs in the object.
         *
         * @return {Number}
         */
        size: function(){
            return Object.keys(this.component).length;
        },


        /**
         * Returns an object containing the differences between the component and the specified object--differences
         * being different properties, or properties with the same name but different values.
         *
         * @param that
         * @return {Object}
         */
        difference: function(that){
            var i, result = {};
            $.extend(result, this.component);
            for (i in that) {
                if (that.hasOwnProperty(i)){
                    if (result[i] && result[i] === that[i]) delete result[i];
                    else result[i] = that[i];
                }
            }
            return result;
        },


        /**
         * Returns an object containing the properties that match (same name and value) between the component and
         * the specified object.
         *
         * @param that
         * @return {*}
         */
        intersection: function(that){
            return this.filter(function(item, i, o){
                return that[i] == o[i];
            });
        },


        /**
         * Returns an array of the values in the component.
         *
         * @return {Array}
         */
        values: function(){
            var result = [];
            if (this.component){
                this.forEach(function(item){
                    result.push(item);
                });
            }
            return result;
        },


        /**
         * Converts the component to JSON.  Little more than syntactic sugar since it
         * merely calls JSON.stringify().
         *
         * @return {*}
         */
        serialize: function(){
            return JSON.stringify(this.component);
        },


        /**
         * Returns "[object ObjectDecorator]," identifying the class.
         *
         * @return {String}
         */
        toString: function(){
            return "[object ObjectDecorator]";
        },


        /**
         * Returns a "Specification" object that can be used to compare the spec for the component to
         * the spec for another object.  Used for duck-typing.
         */
        getSpec: function(){
            var spec = this.component;
            return new Specification(spec);
        },



        /**
         * Returns true/false for whether the specified value is contained in the object.
         *
         * @param that
         * @return {Boolean}
         */
        contains: function(that){
            function compare(a, b){
                if (a && $.isFunction(a.equals)){
                    return a.equals(b)
                }
                return false;
            }

            var cmp = this.component;

            // Intentionally not using hasOwnProperty:
            // I might want to know about inherited properties.
            for (var i in cmp){
                if (cmp[i] == that || (compare(cmp[i], that))) {
                    return true;
                }
            }
            return false;
        },


        add: function(key, value){
            this.component[key] = value;
            return this;
        },

        remove: function(key){
            var result = this.component[key];
            delete this.component[key];
            return result;
        }
    });


    mjs.decorate = function(that){
        return new ObjectDecorator(that);
    }

})(mjs);
})(mjs);
mjs.registerModule('mjs/core/ObjectDecorator');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/ObjectFactory");
	/**
 *
 * @author Philip Ford
 */
(function($) {

    $.require("mjs/core/strings");
    $.require("mjs/core/ObjectDecorator");
    $.require("mjs/core/oop");

    //================================================================= Private



    //================================================================ Public

    /**
     * Implemented by factories that assume the role of classes:  using blueprints
     * to construct new objects.
     *
     * @type {*}
     */
    $.ObjectFactory = $.Interface("build", "extend", "$super");



    /**
     * <p>Returns a factory for creating objects according to the specified blueprint and configuration.
     * Once a blueprint is set for a Factory, changes to that blueprint will have no impact on
     * subsequent objects based on that blueprint.</p>
     *
     * <p>Regarding the blueprint, property names that begin with underscores will be made
     * private.  That means that they will be inaccessible outside of methods declared in
     * the blueprint. Since we are not dealing with classes, objects created by extensions of a factory
     * will still have access to the private properties declared in the parent factory's blueprint.
     * </p>
     *
     * <p>The config parameter must follow the same form as the config expected by Object.defineProperties().
     * If the configuration for a property declares both either a get() or a set() on the one hand, and sets
     * "writable" as well, then "writable" will be deleted from the configuration for that property:  get/set
     * and writable are incompatible and using both in a property configuration will cause Object.defineProperties()
     * to throw an error.</p>
     *
     *
     * @param {Object} blueprint The object properties
     * @param {Object} [config] A set of property definitions like those used in Object.defineProperties().
     * @return {mjs.ObjectFactory} A Factory instance containing build(), extend() and $super methods
     */
    $.getFactory = function(blueprint, config){
        config = config || { };

        var $super = blueprint.$super,
            $blueprint = $.decorate(blueprint),
            _private = $blueprint.filter(function(value, key){ return key.startsWith("_"); });
        delete blueprint.$super;


        blueprint = $.clone(blueprint);  /* Once the blueprint is set, I don't want people to change it.
                                           Tests show that I have to clone (or to freeze) the blueprint at
                                           this point in the code to prevent changes.

                                           Note:  tests showed unexpected behavior when I froze the blueprint.
                                           In prototypical inheritance tests with build(), I found that I could not
                                           override the original method:  it was called instead of the new method.
                                           This was solved by copying to a shallow clone in extend(), but was
                                           disturbing enough that I reverted back to $.clone() at this point.
                                           */

        // Handling the faulty configurations
        if (config.writable != null && (config.set || config.get)){
            delete config.writable;
            $.log("getFactory", "The property descriptors writable and get/set are incompatible; getFactory() " +
                "deleted writable from the configuration.");
        }

        /*
        The configuration parameter slows object creation by ~70% in performance tests,
        so I try to perform it only once per factory, calling Object.create() on the
        blueprint to apply the configuration.  Doing so, removes the properties from
        the resulting blueprint object and puts them in that blueprint's prototype.
        TODO: examine the implications of that last fact.  One of them appears in Factory.prototype.extend().
         */
        blueprint = config ? Object.create(blueprint, config) : Object.create(blueprint);
        //$.log("getFactory", "blueprint before encapsulate:").log(blueprint);

        // Properties that begin with underscores are private to each object created by the factory.
        var proto = $.getPrototype(blueprint);
        $.decorate(_private).forEach(function(value, key){
            Object.encapsulate(key, blueprint, { value: value });
        });
        $.log("getFactory", "blueprint:").log(blueprint);



        /**
         * Creates a new object created according to the <strong>initial</strong> blueprint and configuration.
         *
         */
        function Factory(){}

        $.extend(Factory.prototype, {

            /**
             * Returns a new object created according to the <strong>initial</strong> blueprint and configuration.
             *
             * @param {Object} [args] Properties to mix into the returned object.
             * @return {Object} An object
             */
            build: function(args){
                //return args ? Object.create($.extend({}, blueprint, args)) : Object.create(blueprint);  // Throws private access error in Chrome
                /*
                Note: Prototypical inheritance tests failed in Firefox (i.e., the original inherited method was called
                instead of the new method) until I added {} as the first parameter for $.extend() to copy the
                properties to a shallow clone and return the clone.  This is probably because I froze the blueprint
                above.

                Update: I have since reverted to cloning the blueprint above, instead of freezing it.

                Q: Why not use $.extend() below instead of Object.create()?  Is it because Object.create() is faster?
                 */
                return args ? $.extend(Object.create(blueprint), args) : Object.create(blueprint);
            },



            /**
             * Extends the blueprint of another Factory, and returns a new Factory that will make
             * objects according to the new extended blueprint.
             *
             * @param {Object} args
             * @param {Object} [config] Property configurations like those used by Object.defineProperties().
             * @return {mjs.ObjectFactory} A new Factory containing the extended blueprint.
             */
            extend: function(args, config){
                $.log("blueprint in extend").log(blueprint);
                args.$super = blueprint;
                var $blueprint = $.extend({}, proto, args);  //The properties are all in blueprint's prototype.
                return $.getFactory($blueprint, config);
            },



            /**
             * In short, returns the specified property from the parent factory's blueprint.  However,
             * the actual returned value will vary depending in the data type of the parent blueprint
             * property:
             *
             * <ul>
             * <li>If the parent blueprint property is an object, $super returns a clone of that object.</li>
             * <li>If the parent blueprint property is a function, $super returns function when the scope fixed to
             *     the specified scope</li>
             * <li>If the parent blueprint property is a String or a primitive, that value is returned.
             * </ul>
             *
             * @param {String} name  The method/property name
             * @param {Object} [scope] The scope of the request function, required if the "name" refers to a function.
             * @return {*}
             */
            $super: function(name, scope){
                $.log("blueprint in $super").log($super);
                var p = $super[name];
                if ($.isFunction(p)) {
                    if (!scope) $.error("getFactory.$super", "A scope is required when the $super property is a function.");
                    return p.bind(scope);
                }
                if ($.isObject(p, true)) return $.extend({}, p);
                return p;
            }

        });

        return Object.freeze(
            Object.implement(new Factory(), $.ObjectFactory)
        );
    };


})(mjs);
})(mjs);
mjs.registerModule('mjs/core/ObjectFactory');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/aop");
	/**
 *
 * @author Philip Ford
 */
(function($) {
    $.require("mjs/core/ObjectFactory");

    // TODO:  i18n messages

	function weave(type, advised, advisedFunc, aopProxy){
		var f,$execute, standalone = false,
            transfer = aopProxy.transfer,
            adviser = aopProxy.adviser;

		if (!advisedFunc) {
			standalone = true;
			$execute = arguments[1];
		} else {
			$execute = $.proxy(advised, advisedFunc);
		}
        aopProxy.advised = $execute;
		
		if (type == 'before') {
			f = function(){
				var result = adviser.apply(advised, arguments);		    // Invoke the advice.
                result = result && !transfer ? [result] : null;
				return $execute.apply(advised, result || arguments);	// Call the original function.
			}
		} else if (type == 'after') {
			f = function(){
				var result = $execute.apply(advised, arguments);	// Call the original function and store the result.
                result = result && !transfer ? [result] : null;
                return adviser.apply(advised, result || arguments);				// Invoke the advice.
			};
		} else if (type == 'around') {
			var invocation = { 
				proceed: function() {
					return this.method.apply(this, this.args);
				}
			};
			f = function() {
				invocation.args = arguments;
				invocation.method = $execute;
				invocation.name = advisedFunc;
				return adviser(invocation);
			}
		} else {
			$.error("AOP Error", "Unsupported advice type:  " + type);
		}
		
		if (standalone) {
			return advised = f;
		} else {
			return advised[advisedFunc] = f;	
		}
		
	}

    

    //======================================================================== Public methods

    /**
     * To access these methods, you must call $.addAdvice() to return a correct Advice object.
     *
     * @type {Object}
     */
	var blueprint = {

        //transfer: true,     // Whether to pass the function arguments along to the other wrapped function.

        /**
         * <p>Causes the adviser to be executed before every call to advised[advisedFunc].</p>
         * <p>If the adviser returns a result, and you want that result, instead of the parameters,
         * to be passed to the wrapped function, set the transfer parameter is set to "false" when
         * calling addAdvice().  That parameter defaults to true.</p>
         *
         * @param {Object | Function} advised The function to be advised or the object containing method to be advised
         * @param {String} [advisedFunc] The name of the function that represents the pointcut
         */
		before: function(advised, advisedFunc) {
			return weave("before", advised, advisedFunc, this);
		},

        /**
         * <p>Causes adviser to be executed after every call to advised[advisedFunc].</p>
         * <p>If the original function returns a result, and you want that result, instead of the parameters,
         * to be passed to the advising function, set the transfer parameter is set to "false" when
         * calling addAdvice().  That parameter defaults to true.</p>
         *
         * @param {Object | Function} advised The function to be advised or the object containing method to be advised
         * @param {String} [advisedFunc] The name of the function that represents the pointcut
         */
		after: function(advised, advisedFunc) {
			return weave("after", advised, advisedFunc, this);
		},

        /**
         * <p>Wraps advised[advisedFunc] within adviser.  In order to work the advising function
         * (adviser) must have a parameter representing an "invocation" and must call invocation.proceed()
         * where the original function should be called.</p>
         *
         * <p>The transfer parameter has no effect on this method.</p>
         *
         * @param {Object | Function} advised  The function to be advised or the object containing method to be advised
         * @param {String} [advisedFunc] The name of the function that represents the pointcut
         */
		around: function(advised, advisedFunc){
			return weave("around", advised, advisedFunc, this);
		}
	};

    var Advice = $.getFactory(blueprint);


    /**
     * Creates an Advice object with methods for adding advice to another function or object method.
     *
     * @param {Object | Function} adviser The function that will add advice, or the object whose method will do so
     * @param {String | Function} [method] The method, or the name of the method, that will add advice
     * @param {boolean} [transfer] Whether to pass the function arguments, defaults to true.
     */
    $.addAdvice = function(adviser, method, transfer){
        adviser = method ? $.proxy(adviser, method) : adviser;
        if (!$.isFunction(adviser)) {
            throw new TypeError("An adviser function is required in mjs.addAdvice", "mjs/core/aop.js");
        }
        return Object.seal(Advice.build({
            adviser: adviser,
            transfer: transfer != null ? transfer : true
        }));
    }

})(mjs);
})(mjs);
mjs.registerModule('mjs/core/aop');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("mjs/core/__package__");
	(function($){
    $.require("mjs/core/strings");
    $.require("mjs/core/arrays");
    $.require("mjs/core/oop");
    $.require("mjs/core/StringBuilder");
    $.require("mjs/core/publish");
    $.require("mjs/core/aop");
    $.require("mjs/core/utils");
})(mjs);
})(mjs);
mjs.registerModule('mjs/core/__package__');



(function($){ 
	var mjs, $this;
	$this = { name: "{0}" }; 
	mjs = $;
	$.module("profiles/mjs-core.js");
	/**
 *  Includes only the most basic collection of files, in my humble opinion from monterey-js--excluding
 *  common/ajax.js among others.
 *
 *  @author Philip Ford
 */
(function($){
    $.require("mjs/core/*");
})(mjs);
})(mjs);
mjs.registerModule('profiles/mjs-core.js');



//end merge