define([
 'backbone'
], function(Backbone){

    return Backbone.Model.extend({
        defaults: {
            name: "",
            visible: true
        },
        initialize: function(){
            this.on("change:name", this.onNameChange);
            this.on("change:visible", this.onVisibileChange);
        },
        onNameChange: function(instance){
            console.log("Name changed to '" + instance.get("name") + "'");
        },
        onVisibileChange: function(instance){
            console.log("Visibile changed to '" + instance.get("visible") + "'");
        }
    });
})
