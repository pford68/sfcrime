define([
    'jquery',
    'OpenLayers',
    'renderers/style/OpenLayersRules',
    'toGeoJSON',
    'Configuration',
    'Util'
], function ($, ol, StyleRules, toGeoJSON, Configuration, Util) {

    var parser = new ol.parser.GeoJSON(),
        raster = new ol.layer.Tile({
            source: new ol.source.MapQuestOpenAerial()
        });


    return {
        init: function (kml) {
            var map = new ol.Map({
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

            var crimes = {};
            $.get(kml, function (kmlString) {
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
                for (var i in crimes) {
                    map.addLayer(new ol.layer.Vector({
                        source: new ol.source.Vector({
                            data: crimes[i],
                            parser: parser
                        }),
                        style: StyleRules.get()
                    }));
                }
                Util.log("[layers]", map.getLayerGroup().getLayers())
            });

        }
    }


})
