define([
    'backbone',
    'model/Layer'
], function(Backbone, Layer){

    return Backbone.Collection.extend({
        model: Layer,
        initialize: function(){
            this.on("change:name", function(model){
                console.log("[LayerCollection] name");
            });
            this.on("change:visible", function(model){
                console.log("[LayerCollection] visible");
            });
            this.bind("add", function(layer){
                console.log("[LayerCollection] added", layer.get("name"));
            });
        }
    });
});

