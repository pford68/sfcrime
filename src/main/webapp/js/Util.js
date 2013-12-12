define([
    'Configuration'
], function(Configuration){

    return {
        log: function(msg, varargs){
            if (Configuration.isDebug()){
                !varargs ? console.log(msg) : console.log.apply(console, arguments);
            }
        }
    }
});
