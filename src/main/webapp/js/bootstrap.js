(function(){
    // Globals
    CLOSURE_NO_DEPS = true;   // Prevents 404 errors on deps.js without this.

    requirejs.config({
        baseUrl: 'js',
        shim: {
            'OpenLayers': {
                exports: 'ol'
            },
            "toGeoJSON": {
                exports: 'toGeoJSON'
            },
            'underscore': {
                //Once loaded, use the global '_' as the module value.
                exports: "_"
            },
            'backbone': {
                deps: ['jquery', 'underscore'],
                exports: 'Backbone'
            }
        },
        paths: {
            jquery: '../lib/jquery/jquery-1.9.0',
            OpenLayers: '../lib/OpenLayers-v3.0.0-beta.1/build/ol-whitespace',
            toGeoJSON: '../lib/togeojson',                  // Converts KML to GeoJSON
            text: '../lib/requirejs/text',                  // For importing HTML templates with requirejs
            json: '../lib/requirejs/json',                  // For importing JSON files with requirejs
            backbone: '../lib/backbone/backbone-min',
            underscore: '../lib/backbone/underscore-min',
            templates: 'views/templates',                   // The location of the HTML template files
            MapRenderer: 'renderers/OpenLayersRenderer'     // The current map API's wrapper.  To use a different API, point to a different MapRenderer impl.
        }
    });

    require([
        'jquery',
        'MapRenderer',
        'model/Configuration',
        'views/LayerViewer'
    ], function($, MapRenderer, Configuration, LayerViewer){
        MapRenderer.getInstance(Configuration.getDataSource());
        new LayerViewer();
    })

})()

