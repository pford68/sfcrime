/**
 * Represents a subset of available map layer information
 */
define([
 'backbone'
], function(Backbone){

    return Backbone.Model.extend({
        defaults: {
            name: "",
            visible: true,
            featureCount: 0
        },
        initialize: function(){
            this.on("change:name", this.onNameChange);
            this.on("change:visible", this.onVisibilityChange);
            this.on("change:featureCount", this.onFeatureCountChanged);
        },
        onNameChange: function(instance){
            // TODO
        },
        onVisibilityChange: function(instance){
            // TODO
        },
        onFeatureCountChanged: function(instance){
            // TODO
        }
    });
})
