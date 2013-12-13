({
    baseUrl: '../src/main/webapp/js',
    mainConfigFile: '../src/main/webapp/js/bootstrap.js',
    paths: {
        requireLib: '../lib/requirejs/require-min',
        jquery: '../lib/jquery/jquery-1.9.0',
        underscore: '../lib/backbone/underscore-min',
        backbone: '../lib/backbone/backbone-min',
        text: '../lib/requirejs/text',
        json: '../lib/requirejs/json',
        toGeoJSON: '../lib/togeojson',
        OpenLayers: '../lib/OpenLayers-v3.0.0-beta.1/build/ol-whitespace',
        templates: 'views/templates',
        MapRenderer: 'renderers/OpenLayersRenderer'
    },
    include: ['requireLib']
})
