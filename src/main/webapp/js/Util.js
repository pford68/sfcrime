define([
    'model/Configuration'
], function(Configuration){

    return {
        log: function(msg, varargs){
            if (Configuration.isDebugEnabled()){
                !varargs ? console.log(msg) : console.log.apply(console, arguments);
            }
        }
    }
});
