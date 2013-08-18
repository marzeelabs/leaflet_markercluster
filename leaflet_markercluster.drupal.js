/*
 * We are overriding a large part of the JS defined in leaflet (leaflet.drupal.js).
 * Not nice, but we can't do otherwise without refactoring code in Leaflet.
 */

(function ($) {

  var LEAFLET_MARKERCLUSTER_EXCLUDE_FROM_CLUSTER = 0x01;

  Drupal.behaviors.leaflet = { // overrides same behavior in leaflet/leaflet.drupal.js
    attach: function(context, settings) {

      $(settings.leaflet).each(function () {

       for (var m in this) {

        // bail if the map already exists
        var container = L.DomUtil.get(this[m].mapId);
        if (container._leaflet) {
          return false;
        }
        var thismap = this[m].map;

        // load a settings object with all of our map and markercluster settings
        var settings = {};
        for (var setting in thismap.settings) {
          settings[setting] = thismap.settings[setting];
        }

        // instantiate our new map
        var lMap = new L.Map(this[m].mapId, settings);

        // add map layers
        var layers = {}, overlays = {};
        var i = 0;
        for (var key in thismap.layers) {
          var layer = thismap.layers[key];
          var map_layer = Drupal.leaflet.create_layer(layer, key);

          layers[key] = map_layer;

          // add the layer to the map
          if (i >= 0) {
            lMap.addLayer(map_layer);
          }
          i++;
        }

        // @RdB create a marker cluster layer if leaflet.markercluster.js is included
        var cluster_layer = null;
        if (typeof L.MarkerClusterGroup != 'undefined') {

          // If we specified a custom cluster icon, use that.
          if (thismap.markercluster_icon) {
            var icon_settings = thismap.markercluster_icon;

            settings['iconCreateFunction'] = function(cluster) {
              var icon = new L.Icon({iconUrl: icon_settings.iconUrl});

              // override applicable marker defaults
              if (icon_settings.iconSize) {
                icon.options.iconSize = new L.Point(parseInt(icon_settings.iconSize.x), parseInt(icon_settings.iconSize.y));
              }
              if (icon_settings.iconAnchor) {
                icon.options.iconAnchor = new L.Point(parseFloat(icon_settings.iconAnchor.x), parseFloat(icon_settings.iconAnchor.y));
              }
              if (icon_settings.popupAnchor) {
                icon.options.popupAnchor = new L.Point(parseFloat(icon_settings.popupAnchor.x), parseFloat(icon_settings.popupAnchor.y));
              }
              if (icon_settings.shadowUrl !== undefined) {
                icon.options.shadowUrl = icon_settings.shadowUrl;
              }
              if (icon_settings.shadowSize) {
                icon.options.shadowSize = new L.Point(parseInt(icon_settings.shadowSize.x), parseInt(icon_settings.shadowSize.y));
              }
              if (icon_settings.shadowAnchor) {
                icon.options.shadowAnchor = new L.Point(parseInt(icon_settings.shadowAnchor.x), parseInt(icon_settings.shadowAnchor.y));
              }

              return icon;
            }
          }

          // Note: only applicable settings will be used, remainder are ignored
          cluster_layer = new L.MarkerClusterGroup(settings);
          lMap.addLayer(cluster_layer);
        }

        // add features
        for (i = 0; i < this[m].features.length; i++) {
          var feature = this[m].features[i];
          var cluster = (feature.type == 'point') && (!feature.flags || !(feature.flags & LEAFLET_MARKERCLUSTER_EXCLUDE_FROM_CLUSTER));
          var lFeature;

          // dealing with a layer group
          if (feature.group) {
            var lGroup = new L.LayerGroup();
            for (var groupKey in feature.features) {
              var groupFeature = feature.features[groupKey];
              lFeature = leaflet_create_feature(groupFeature);
              if (groupFeature.popup) {
                lFeature.bindPopup(groupFeature.popup);
              }
              lGroup.addLayer(lFeature);
            }

            // add the group to the layer switcher
            overlays[feature.label] = lGroup;

            if (cluster_layer && cluster)  {
              cluster_layer.addLayer(lGroup);
            } else {
              lMap.addLayer(lGroup);
            }
          }
          else {
            lFeature = leaflet_create_feature(feature);
            // @RdB add to cluster layer if one is defined, else to map
            if (cluster_layer && cluster) {
              cluster_layer.addLayer(lFeature);
            }
            else {
              lMap.addLayer(lFeature);
            }
            if (feature.popup) {
              lFeature.bindPopup(feature.popup, {autoPanPadding: L.point(25,25)});
            }
          }

          // Allow others to do something with the feature that was just added to the map
          $(document).trigger('leaflet.feature', [lFeature, feature]);
        }

        // add layer switcher
        if (thismap.settings.layerControl) {
          lMap.addControl(new L.Control.Layers(layers, overlays));
        }

        // center the map
        if (thismap.center) {
          lMap.setView(new L.LatLng(thismap.center.lat, thismap.center.lon), thismap.settings.zoom);
        }
        // if we have provided a zoom level, then use it after fitting bounds
        else if (thismap.settings.zoom) {
          Drupal.leaflet.fitbounds(lMap);
          lMap.setZoom(thismap.settings.zoom);
        }
        // fit to bounds
        else {
          Drupal.leaflet.fitbounds(lMap);
        }

        // add attribution
        if (thismap.settings.attributionControl && thismap.attribution) {
          lMap.attributionControl.setPrefix(thismap.attribution.prefix);
          lMap.attributionControl.addAttribution(thismap.attribution.text);
        }

        // add the leaflet map to our settings object to make it accessible
        this[m].lMap = lMap;

        // allow other modules to get access to the map object using jQuery's trigger method
        $(document).trigger('leaflet.map', [thismap, lMap]);

        // Destroy features so that an AJAX reload does not get parts of the old set.
        // Required when the View has "Use AJAX" set to Yes.
        this[m].features = null;
       }
      });

      function leaflet_create_feature(feature) {
        var lFeature;
        switch (feature.type) {
          case 'point':
            lFeature = Drupal.leaflet.create_point(feature);
            break;
          case 'linestring':
            lFeature = Drupal.leaflet.create_linestring(feature);
            break;
          case 'polygon':
            lFeature = Drupal.leaflet.create_polygon(feature);
            break;
          case 'multipolygon':
          case 'multipolyline':
            lFeature = Drupal.leaflet.create_multipoly(feature);
            break;
          case 'json':
            lFeature = Drupal.leaflet.create_json(feature.json)
            break;
        }

        // assign our given unique ID, useful for associating nodes
        if (feature.leaflet_id) {
          lFeature._leaflet_id = feature.leaflet_id;
        }

        var options = {};
        if (feature.options) {
          for (var option in feature.options) {
            options[option] = feature.options[option];
          }
          lFeature.setStyle(options);
        }
        return lFeature;
      }

    }
  }

})(jQuery);
