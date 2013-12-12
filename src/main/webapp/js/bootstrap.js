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
            }
        },
        paths: {
            jquery: '../lib/jquery/jquery-1.9.0',
            OpenLayers: '../lib/OpenLayers-v3.0.0-beta.1/build/ol-whitespace',
            toGeoJSON: '../lib/togeojson',
            text: '../lib/requirejs/text',
            json: '../lib/requirejs/json'
        }
    });

    require([
        'jquery',
        'renderers/OpenLayersRenderer',
        'Configuration'
    ], function($, Renderer, Configuration){
        Renderer.init(Configuration.getDataSource());
    })

})()

