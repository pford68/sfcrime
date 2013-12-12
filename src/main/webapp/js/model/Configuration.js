
define([
    'json!../config/app.json',
    'backbone'
], function(settings, Backbone){

    var Configuration = Backbone.Model.extend({
        isDebugEnabled: function(){
            return this.get("debug");
        },
        getDataSource: function(){
            return this.get("source");
        }
    });
    return new Configuration(settings);
})
