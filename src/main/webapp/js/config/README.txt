app.json
--------------------------------------------
Contains configuration values for the entire application.

Properties
-- source (required):  Can be the name of a KML file or a REST service URL.
-- colors:  A map associating one color with another.  OpenLayersRules.js uses the key as a fill color and the
            value as a stroke color, and produces an OpenLayers style rule object for each emtry in the color map.
            The purpose is to be able to adjust the colors and the number of rules without digging through the code.
            Furthermore, I want the code to be agnostic about the available colors.
-- layerViewer:  used to customize the text in the LayerViewer, if one is present, instead of hard-coding the text.
-- debug: controls whether log messages are sent to the console.