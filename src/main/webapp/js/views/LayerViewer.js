
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/LayerViewer.html',
    'MapRenderer',
    'model/Configuration',
], function($, _, Backbone, html, MapRenderer, Configuration){

    var config = Configuration.toJSON();
    return Backbone.View.extend({
        model: MapRenderer.getLayerInfo(),
        initialize: function(){
            $('body').append(this.$el);
            this.render();
            this.model.bind("change", this.dataChanged, this);
            this.model.bind("add", this.dataChanged, this);
        },
        render: function(){
            //console.log("[LayerViewer render", _.template(html, { layers: this.model.toJSON() } ));
            this.$el.html(_.template(html, {
                layers: this.model.toJSON(),
                config: config ? config.layerViewer : { header: "Layer Viewer", defaultMsg: "No layers found."}
            }));
        },
        events:{
        },
        dataChanged: function(){
            this.render();
        }
    });

})
