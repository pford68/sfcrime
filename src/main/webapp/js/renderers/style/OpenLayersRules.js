
define([
    'OpenLayers'
], function(ol){

    var style = new ol.style.Style({rules: [
        new ol.style.Rule({
            filter: 'type == "Burglary"',
            symbolizers: [
                new ol.style.Shape({
                    size: 10,
                    fill: new ol.style.Fill({
                        color: '#0000FF',
                        opacity: 0.4
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#ffcc00',
                        opacity: 0.2
                    })
                })
            ]
        }),
        new ol.style.Rule({
            filter: 'type == "Robbery"',
            symbolizers: [
                new ol.style.Shape({
                    size: 10,
                    fill: new ol.style.Fill({
                        color: '#00FF00',
                        opacity: 0.4
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#ffcc00',
                        opacity: 0.2
                    })
                })
            ]
        }),
        new ol.style.Rule({
            filter: 'type == "Theft"',
            symbolizers: [
                new ol.style.Shape({
                    size: 10,
                    fill: new ol.style.Fill({
                        color: '#FF0000',
                        opacity: 0.4
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#ffcc00',
                        opacity: 0.2
                    })
                })
            ]
        }),
        new ol.style.Rule({
            symbolizers: [
                new ol.style.Shape({
                    size: 10,
                    fill: new ol.style.Fill({
                        color: '#ff9900',
                        opacity: 0.4
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#ffcc00',
                        opacity: 0.2
                    })
                })
            ]
        }),
    ]});


    return {
        get: function(){
            return style;
        }
    }
});
