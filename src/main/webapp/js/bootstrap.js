(function(){
    // Globals
    CLOSURE_NO_DEPS = true;

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
            toGeoJSON: '../lib/togeojson',
            text: '../lib/requirejs/text',
            json: '../lib/requirejs/json',
            backbone: '../lib/backbone/backbone-min',
            underscore: '../lib/backbone/underscore-min',
            templates: 'views/templates',
            MapRenderer: 'renderers/OpenLayersRenderer'
        }
    });

    require([
        'jquery',
        'MapRenderer',
        'model/Configuration',
        'views/LayerViewer'
    ], function($, MapRenderer, Configuration, LayerViewer){
        MapRenderer.init(Configuration.getDataSource());
        new LayerViewer().render();
    })

})()

