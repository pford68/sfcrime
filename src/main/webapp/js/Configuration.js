
define([
    'json!config/app.json'
], function(settings){

    return {
        isDebug: function(){ return settings.debug; },
        getDataSource: function(){ return settings.source; }
    }
})
