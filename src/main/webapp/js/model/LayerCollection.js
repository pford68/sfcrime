/**
 * A collection of model/Layer objects, sorted by featureCount in descending order.  A GUI component that
 * lists the items in the collection will show the layer with the most features first, or at the top.
 */
define([
    'backbone',
    'model/Layer',
    'Util'
], function(Backbone, Layer, Util){

    return Backbone.Collection.extend({
        model: Layer,
        /**
         * Sorts by featureCount in descending order.
         * @param a
         * @param b
         * @returns {number}
         */
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

