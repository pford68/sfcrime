/**
 * Creates an OpenLayers 3 rule-based style object, using colors from the Configuration singleton.
 */
define([
    'OpenLayers',
    "model/Configuration",
    "ObjectDecorator"
], function (ol, Configuration, decorate) {

    var colors = Configuration.get("colors") || {},
        rules = [],
        style;

    /**
     * Filters is a list of the values of the "type" property in GeoJSON data (or just data).
     *
     * @param {Array} filters
     * @constructor
     */
    function OpenLayersRules(filters) {
        if (style) return;

        var count = 0;

        /*
        NOTES:
        Apparently no heatmap is available for OL 3 yet.  However, I can achieve a similar effect below by setting the
        opacity of the points to less than 1.0.  Then points that overlap or congregate create darker regions.
        Unfortunately the effect is lost as you zoom in.

        I am using points, instead of icons, to handle the case in which multiple data points are located at the
        same coordinates:  they blend in, instead of obscuring each other.

        Clustering was another possibility, but (1) I did not see on OL 3 strategy for clustering, and (2) I preferred
        the heatmao-like effect achieved by the semi-transparent separate points.
         */

        /*
        Creating a style rule for each filter.  I want the application to be agnostic about the information it's dealing with.
        If, for example, we hard-coded the crime types in the rules below, what would happen if those values are different
        in other sets of crime data?
         */
        decorate(colors).forEach(function (stroke, fill) {

            /*
             If the number of colors > the number of filters, we'll get an OutOFBounds error. If the number of
             filters exceeds the number of colors, however, we'll have missing points.
            */
            if (count <= (filters.length - 1)){
                rules.push(
                    new ol.style.Rule({
                        filter: 'type == "' + filters[count] + '"',
                        symbolizers: [
                            new ol.style.Shape({
                                size: 15,
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
            }
            ++count;
        });
        style = new ol.style.Style({rules: rules });
    }
    OpenLayersRules.prototype.get = function(){
        return style;
    };

    return OpenLayersRules;
});
