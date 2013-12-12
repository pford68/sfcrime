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

    var map,
        crimeList = new LayerCollection(),
        crimes = {},
        parser = new ol.parser.GeoJSON(),
        raster = new ol.layer.Tile({
            source: new ol.source.MapQuestOpenAerial()
        });


    return {
        init: function (kml) {
            map = new ol.Map({
                target: 'map',
                layers: [
                    raster
                ],
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
                use the KML file in an ol.source.Vector.  So I have to parse the data separately in order to distribute it.
            (2) I had to convert the KML to GeoJSON because I found that I was having trouble plotting ol.Features in
                OpenLayers 3 without using a parser in the ol.source.Vector.  If I simply created ol.Features from
                the KML data, then tried to add the features to a Vector layer, I found that the points all appeared at
                0,0.  This is my first foray into OL 3, and I might have been doing something wrong.  Since I could not
                find the answer within the time allowed, I proceeded with a workaround.
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
                decorate(crimes).forEach(function(crime){
                    map.addLayer(new ol.layer.Vector({
                        source: new ol.source.Vector({
                            data: crime,
                            parser: parser
                        }),
                        style: StyleRules.get()
                    }));
                });
                Object.keys(crimes).forEach(function(name){
                    crimeList.add({ name: name });
                });
                Util.log("[layer names", crimeList.models);
                Util.log("[layers]", map.getLayerGroup().getLayers())
            });

        },
        getGeoJSON: function(){
            return $.extend({}, crimes);  // Cloning in order to protect the data.
        },
        getLayerInfo: function(){
            return crimeList;
        }
    }


})
