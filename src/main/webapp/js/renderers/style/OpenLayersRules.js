define([
    'OpenLayers',
    "model/Configuration",
    "ObjectDecorator"
], function (ol, Configuration, decorate) {

    var colors = Configuration.get("colors"),
        rules = [],
        style;

    function OpenLayersRules(filters) {
        if (style) return;

        var count = 0;
        decorate(colors).forEach(function (stroke, fill) {
            rules.push(
                new ol.style.Rule({
                    filter: 'type == "' + filters[count] + '"',
                    symbolizers: [
                        new ol.style.Shape({
                            size: 10,
                            fill: new ol.style.Fill({
                                color: fill,
                                opacity: 0.4
                            }),
                            stroke: new ol.style.Stroke({
                                color: stroke,
                                opacity: 0.2
                            })
                        })
                    ]
                })
            );
            ++count;
        });
        style = new ol.style.Style({rules: rules });
    }
    OpenLayersRules.prototype.get = function(){
        return style;
    };

    return OpenLayersRules;
});
