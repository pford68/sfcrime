define([
    'jquery',
    'OpenLayers',
    'renderers/style/OpenLayersRules',
    'toGeoJSON',
    'model/Configuration',
    'Util',
    'ObjectDecorator',
    'model/LayerCollection'
], function ($, ol, StyleRules, toGeoJSON, Configuration, Util, decorate, LayerCollection) {

    var map, $public,
        crimeList = new LayerCollection(),
        crimes = {},
        parser = new ol.parser.GeoJSON(),
        baseLayers = [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }), new ol.layer.Tile({
                source: new ol.source.Stamen({
                    layer: 'terrain-labels'
                })
            })
        ];


    $public = {
        init: function (kml) {
            map = new ol.Map({
                target: 'map',
                layers: baseLayers,
                renderer: ol.RendererHint.CANVAS,
                view: new ol.View2D({
                    center: ol.proj.transform([-122.409037, 37.775137], 'EPSG:4326', 'EPSG:3857'),
                    zoom: 13
                })
            });

            /*
            Below I am doing a curious thing.  After pulling the KML file through AJAX, I am converting it to
            GeoJSON, then using an OL 3 GeoJSON parser to add the data to the map.  I have two reasons for
            converting the data to GeoJSON:

            (1) I need the KML data to be on separate layers in order to filter later on by toggling layers on/off,
                and to apply separate styles to the different data types easily. For that reason alone, I cannot simply
                use the KML file in an ol.source.Vector.  So I have to parse the data separately in order to distribute
                it to different layers.
            (2) I had to convert the KML to GeoJSON because I found that I was having trouble plotting ol.Features in
                OpenLayers 3 without using a parser in the ol.source.Vector.  If I simply created ol.Features from
                the KML data, then tried to add the features to a Vector layer, I found that the points all appeared at
                0,0.  This is my first foray into OL 3, and I might have been doing something wrong.  Since I could not
                find the answer within the time allowed, however, I proceeded with a workaround.
             */
            $.get(kml, function (kmlString){
                /*
                TODO:  note that while this function is supposed to be agnostic, I am currently assuming
                       the data to be KML.  If I have time, I will make this function truly agnostic about
                       the data source.
                 */
                var geoJSON = toGeoJSON.kml(kmlString);
                Util.log("[geojson]", geoJSON);
                geoJSON.features.forEach(function (feature) {
                    //console.log("[feature]", feature);
                    var type = feature.properties.type;
                    if (!type) return;
                    if (!crimes[type]) crimes[type] = { type: "FeatureCollection", features: []};
                    crimes[type].features.push(feature);
                });
                Util.log(crimes);

                var rules = new StyleRules(Object.keys(crimes));
                decorate(crimes).forEach(function(crime, name){
                    map.addLayer(new ol.layer.Vector({
                        source: new ol.source.Vector({
                            data: crime,
                            parser: parser
                        }),
                        style: rules.get()
                    }));
                    crimeList.add({
                        name: name,
                        featureCount: crime.features.length,
                        index: $public.getLayers().length - 1
                    });
                });
                Util.log("[layer names", crimeList.models);
                Util.log("[layers]", map.getLayerGroup().getLayers());
            });

        },
        /**
         * Returns the crime data as geojson.
         * @returns {*}
         */
        getGeoJSON: function(){
            return $.extend({}, crimes);  // Cloning in order to protect the data.
        },
        /**
         * Returns information about the map layers, including the name, visibility, and featureCount.
         * @returns {model.LayerCollection}
         */
        getLayerInfo: function(){
            return crimeList;
        },
        /**
         * Returns the map layers that display crime data.  Does not return the base layers.
         * @returns {Array}
         */
        getLayers: function(){
            var layers = [].concat(map.getLayers().getArray()); // Ensuring that I do not modify the map's layer set.
            return layers.slice(baseLayers.length); // Excluding the base layers.
        },
        /**
         * Binds the layer's visibility to the value of the specified property of the node.
         *
         * @param node The HTML node that controls the layer's visibility
         * @param property  The property of node to bind the layer's visibility to.
         * @param layer
         * @returns {ol.dom.Input}
         */
        bindLayerVisibility: function(node, property, layer){
            var input = new ol.dom.Input(node);
            input.bindTo(property, layer, 'visible');
            return input;
        },
        /**
         * Unbinds all OpenLayers events from the specified ol.dom.Input
         * @param {ol.dom.Input} input
         */
        unbindLayerVisibility: function(input){
            input.unbindAll();
            input = null;
        },
        /**
         * Adds a layer to the map
         *
         * @param name
         * @param data
         */
        addLayer: function(name, data){
            map.addLayer(new ol.layer.Vector({
                source: new ol.source.Vector({
                    data: data,
                    parser: parser
                }),
                style: StyleRules.get()
            }));
            crimeList.add({ name: name });
        }
    }

    return $public;
})
