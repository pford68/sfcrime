/**
 * Lists the available layers, other than the base layer(s) and allows their visibility to be toggle.  The layers
 * are also color-coded.
 */
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/LayerViewer.html',
    'MapRenderer',
    'model/Configuration',
    "Util"
], function($, _, Backbone, html, MapRenderer, Configuration, Util){

    var config = Configuration.toJSON(),
        targets = [];

    return Backbone.View.extend({
        model: MapRenderer.getLayerInfo(),
        events:{
            "click th input[type=checkbox]": "selectAll"
        },
        initialize: function(){
            $('body').append(this.$el);
            this.model.bind("add remove change", this.dataChanged, this);
        },
        /**
         * Displays the LayerViewer
         */
        render: function(){
            this.$el.html(_.template(html, {
                layers: this.model.toJSON(),
                config: config ? config.layerViewer : { header: "Layer Viewer", defaultMsg: "No layers found."},
                colors: Object.keys(config.colors)
            }));
        },
        /**
         * Fired when the model is updated.
         */
        dataChanged: function(){
            var layers = MapRenderer.getLayers(),
                model = this.model;
            targets.forEach(function(target){
                MapRenderer.unbindLayerVisibility(target);
            });
            targets = [];
            this.render();
            $(".layer-bound", this.$el).each(function(index, node){
                var layerIndex = model.at(index).get("index");
                Util.log("index", layerIndex);
                targets.push(MapRenderer.bindLayerVisibility(node, "checked", layers[layerIndex]));
            })
        },
        /**
         * Selects/deselects all items in the layer viewer based whether that.target.checked is true or false.
         * @param {Object} that
         */
        selectAll: function(that){
            var target = that.target;
            if (!target) return;
            $("tbody input[type=checkbox]", this.$el).each(function(index, node){
                if ((target.checked && !node.checked) || (!target.checked && node.checked)){
                    node.click();
                }
            });
        }
    });

})
