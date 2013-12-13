/**
 * Utility functions.
 */
define([
    'model/Configuration'
], function(Configuration){

    return {
        /**
         * Sends a log message to the console if and only if Configuration.isDebugEnabled() is true.
         * @param msg
         * @param varargs
         */
        log: function(msg, varargs){
            if (Configuration.isDebugEnabled()){
                !varargs ? console.log(msg) : console.log.apply(console, arguments);
            }
        }
    }
});
