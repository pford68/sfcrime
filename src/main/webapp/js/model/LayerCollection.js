/**
 * A collection of model/Layer objects.
 */
define([
    'backbone',
    'model/Layer',
    'Util'
], function(Backbone, Layer, Util){

    return Backbone.Collection.extend({
        model: Layer,
        comparator: function(a, b){
            var bCount = b.get("featureCount"),
                aCount = a.get("featureCount");
            return aCount > bCount ? -1 : ( aCount < bCount ? 1 : 0 );
        },
        /**
         * To be called when the collection is considered filled.
         */
        dataLoaded: function(){
            this.trigger('dataLoaded');
        }
    });
});

