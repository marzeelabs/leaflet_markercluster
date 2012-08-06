(function ($) {

  // Overwrite the Leaflet behavior, very ugly but don't see another way to have
  // this control.
  Drupal.behaviors.leaflet = {
    attach:function (context, settings) {      
      $(settings.leaflet).each(function () {
        // bail if the map already exists
        var container = L.DomUtil.get(this.mapId);
        if (container._leaflet) {
          return false;
        }

        // load a settings object with all of our map settings
        var settings = {};
        for (var setting in this.map.settings) {
          settings[setting] = this.map.settings[setting];
        }

        // instantiate our new map
        var lMap = new L.Map(this.mapId, settings);
        
        // Create the marker cluster
        var markers = new L.MarkerClusterGroup({ maxClusterRadius: 20, spiderfyOnMaxZoom: true, showCoverageOnHover: false, zoomToBoundsOnClick: false });
        
        // add map layers
        var layers = {}, overlays = {};
        var i = 0;
        for (var key in this.map.layers) {
          var layer = this.map.layers[key];
          var map_layer = Drupal.leaflet.create_layer(layer, key);

          layers[key] = map_layer;

          // add the  layer to the map
          if (i == 0) {
            lMap.addLayer(map_layer);
          }
          i++;
        }

        // add features
        for (i = 0; i < this.features.length; i++) {
          var feature = this.features[i];
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

            lMap.addLayer(lGroup);
          }
          else {
            lFeature = leaflet_create_feature(feature);
            if (feature.popup) {
              lFeature.bindPopup(feature.popup, {autoPanPadding: L.point(25,25)});
            }
            
            markers.addLayer(lFeature);
          }
        }
        
        lMap.addLayer(markers);

        // add layer switcher
        if (this.map.settings.layerControl) {
          lMap.addControl(new L.Control.Layers(layers, overlays));
        }

        // either center the map or set to bounds
        if (this.map.center) {
          lMap.setView(new L.LatLng(this.map.center.lat, this.map.center.lon), this.map.settings.zoom);
        }
        else {
          Drupal.leaflet.fitbounds(lMap);
          // set zoom level - it might be forced from the settings          
          if (this.map.settings.zoom) {
            lMap.setZoom(this.map.settings.zoom);
          }
        }
        
        // add attribution
        if (this.map.settings.attributionControl && this.map.attribution) {
          lMap.attributionControl.setPrefix(this.map.attribution.prefix);
          lMap.attributionControl.addAttribution(this.map.attribution.text);
        }

        markers.on('clusterclick', function (a) {          
          // Zoom in batches, so the user understands the zoom
          var maxZoomPerClick = 4;
          var currentZoom = lMap.getZoom(), toZoom = lMap.getBoundsZoom(a.layer._bounds), zoom = toZoom;
          if (toZoom - currentZoom > maxZoomPerClick) {
            zoom = currentZoom + maxZoomPerClick;
          }
          lMap.setView(L.latLngBounds(a.layer._bounds).getCenter(), zoom);
        });
        
        markers.on('clustermouseover', function (a) {
          a.layer.spiderfy();          
        });

        // add the leaflet map to our settings object to make it accessible
        this.lMap = lMap;
      });

      function leaflet_create_feature(feature) {
        var lFeature;
        switch (feature.type) {
          case 'point':
            lFeature = Drupal.leaflet.create_point(feature);
            break;
          case 'linestring':
            lFeature = Drupal.leaflet.linestring(feature);
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

  // Change the appearance of the clusters
  L.MarkerClusterGroup.prototype._defaultIconCreateFunction = function (childCount) {
  	var c = ' marker-cluster-';
  	if (childCount <= 1) {
  		c += 'small';
  	} else if (childCount <= 3) {
  		c += 'medium';
  	} else {
  		c += 'large';
  	}

  	return new L.DivIcon({ html: '<div><span>' + childCount + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(40, 40) });
  }

})(jQuery);
