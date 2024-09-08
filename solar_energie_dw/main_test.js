import GeoJSON from "ol/format/GeoJSON.js";
import { Map as olMap } from "ol";
import Select from "ol/interaction/Select.js";
import { click } from "ol/events/condition.js";
import View from "ol/View";
import Tile from "ol/layer/Tile";
import OSM from "ol/source/OSM.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import { fromLonLat } from "ol/proj";
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";
import Fill from "ol/style/Fill.js";
import Overlay from "ol/Overlay.js"; // Import für Overlay

// Create an OpenLayers map with OSM as the base layer
const map = new olMap({
  target: "map", // The HTML element ID where the map will be rendered
  layers: [
    new Tile({
      source: new OSM(), // OpenStreetMap as the base map layer
    }),
  ],
  view: new View({
    center: fromLonLat([10.4515, 51.1657]), // Center the map on Germany
    zoom: 6,
    projection: "EPSG:3857", // Use Web Mercator projection
  }),
});

// Declare variables to hold the Landkreise and Bundesländer layers
let landkreiseLayer = null;
let bundeslaenderLayer = null;
let features = document.getElementById("features"); // Element für die Anzeige der Features
let features_Count = document.getElementById("features_Count"); // Element für die Anzeige der Anzahl der ausgewählten Features

let select = null;
let selected = new Set();

let pingOverlay = new Overlay({
  element: document.createElement("div"),
  positioning: "center-center",
  stopEvent: false,
  offset: [0, -10],
});

map.addOverlay(pingOverlay);

function generateUniqueId() {
  return "feature_" + Math.random(10000000).toString();
}

// Function to create a vector layer from a GeoJSON file
function createVectorLayer(url) {
  return new VectorLayer({
    source: new VectorSource({
      url: url, // URL to the GeoJSON file
      format: new GeoJSON(), // Specify the format as GeoJSON
    }),
    style: new Style({
      stroke: new Stroke({
        color: "rgba(0, 0, 255, 0.25)", // Stroke color and transparency
        width: 1, // Stroke width
      }),
      fill: new Fill({
        color: "rgba(0, 0, 255, 0.005)", // Fill color and transparency
      }),
    }),
  });
}

const highlightStyle = new Style({
  fill: new Fill({
    color: "rgba(0, 0, 255, 0.3)", // Transparenter blauer Füllstil für ausgewählte Features
  }),
  stroke: new Stroke({
    color: "rgba(0, 0, 255, 0.7)", // Dunklerer blauer Rand
    width: 2,
  }),
});

// Define the style for selected features
const selectedStyle = new Style({
  fill: new Fill({
    color: "rgba(0, 0, 255, 0.5)", // Transparenter blauer Füllstil
  }),
  stroke: new Stroke({
    color: "rgba(0, 0, 255, 0.7)", // Dunklerer blauer Rand
    width: 2,
  }),
});

// Funktion zur Initialisierung der Select-Interaktion
function initializeSelectInteraction() {
  const select = new Select({
    condition: click, // Auswahlbedingung: bei Klick
    style: selectedStyle, // Stil für die Auswahl
  });

  // Füge die Select-Interaktion zur Karte hinzu
  map.addInteraction(select);

  // Zeige an, welche Features ausgewählt wurden
  select.on("select", function (e) {
    const selectedFeatures = e.target.getFeatures();
    console.log(selectedFeatures.getArray());
  });
}

// Überprüfen, ob ein Layer aktiv ist und Select-Interaktion initialisieren
function enableSelectionOnActiveLayer() {
  if (landkreiseLayer || bundeslaenderLayer) {
    initializeSelectInteraction();
  }
}

// Toggle the Landkreise layer on and off when the corresponding button is clicked
document
  .getElementById("toggleLandkreise")
  .addEventListener("click", function () {
    // Remove the Bundesländer layer if it is currently active
    if (bundeslaenderLayer) {
      map.removeLayer(bundeslaenderLayer);
      bundeslaenderLayer = null;
    }

    if (!landkreiseLayer) {
      landkreiseLayer = createVectorLayer(
        "data/geojsons/landkreise_simplify0.geojson",
      );
      map.addLayer(landkreiseLayer);

      // Zoom to the extent of the Landkreise GeoJSON
      const source = landkreiseLayer.getSource();
      source.once("change", function () {
        if (source.getState() === "ready") {
          map.getView().fit(source.getExtent(), { padding: [20, 20, 20, 20] });
        }
      });
    }

    updateLayerDisplay(); // Update the display of active layers
    enableSelectionOnActiveLayer();
  });

// Toggle the Bundesländer layer on and off when the corresponding button is clicked
document
  .getElementById("toggleBundeslaender")
  .addEventListener("click", function () {
    // Remove the Landkreise layer if it is currently active
    if (landkreiseLayer) {
      map.removeLayer(landkreiseLayer);
      landkreiseLayer = null;
    }

    if (!bundeslaenderLayer) {
      bundeslaenderLayer = createVectorLayer(
        "data/geojsons/bundeslaender_simplify0.geojson",
      );
      map.addLayer(bundeslaenderLayer);

      // Zoom to the extent of the Bundesländer GeoJSON
      const source = bundeslaenderLayer.getSource();
      source.once("change", function () {
        if (source.getState() === "ready") {
          map.getView().fit(source.getExtent(), { padding: [20, 20, 20, 20] });
        }
      });
    }

    updateLayerDisplay(); // Update the display of active layers
    enableSelectionOnActiveLayer();
  });

// Update the display to show which layers are currently active
function updateLayerDisplay() {
  let displayText = "Active Layers: ";
  if (landkreiseLayer) displayText += "Landkreise ";
  if (bundeslaenderLayer) displayText += "Bundesländer ";
  if (!landkreiseLayer && !bundeslaenderLayer) displayText += "None";
  document.getElementById("layerDisplay").innerText = displayText; // Display the active layers
}

// Event listener to hide the Bundesländer layer when the "hideBundesland" button is clicked
document
  .getElementById("hideBundesland")
  .addEventListener("click", function () {
    if (bundeslaenderLayer) {
      map.removeLayer(bundeslaenderLayer);
      bundeslaenderLayer = null;

      updateLayerDisplay(); // Update the display of active layers
    }
  });

// Event listener to hide the Landkreise layer when the "hideLandkreis" button is clicked
document.getElementById("hideLandkreis").addEventListener("click", function () {
  if (landkreiseLayer) {
    map.removeLayer(landkreiseLayer);
    landkreiseLayer = null;

    updateLayerDisplay(); // Update the display of active layers
  }
});

map.on("click", function (event) {
  const coordinate_click = event.coordinate;

  map.forEachFeatureAtPixel(event.pixel, function (feature, layer) {
    if (feature.getId() == null) {
      feature.setId(generateUniqueId());
    }

    const properties = feature.getProperties();
    const geometryType = feature.getGeometry().getType();

    if (geometryType !== "Point" && (landkreiseLayer || bundeslaenderLayer)) {
      // Entfernen Sie diese Zeilen, wenn kein Popup benötigt wird, und fügen Sie die Feature-Informationen stattdessen direkt zur Anzeige hinzu
      let content = "<p>";
      if (count === 2) {
        // Popup für Bundesländer
        content = `
                <p><strong>Bundesland:</strong> ${properties["GEN"]}</p>
                <p><strong>Bezeichnung:</strong> ${properties["BEZ"]}</p>
                <p><strong>Gesamtbevölkerung:</strong> ${properties["destatis"]["population"]}</p>
                <p><strong>Männliche Bevölkerung:</strong> ${properties["destatis"]["population_m"]}</p>
                <p><strong>Weibliche Bevölkerung:</strong> ${properties["destatis"]["population_w"]}</p>
                <p><strong>Koordinaten (X, Y):</strong> ${coordinate_click.map((c) => c.toFixed(2)).join(", ")}</p>
            `;
      } else if (count === 1) {
        // Popup für Landkreise
        content = `
                <p><strong>Landkreis:</strong> ${properties["GEN"]}</p>
                <p><strong>Bezeichnung:</strong> ${properties["BEZ"]}</p>
                <p><strong>Gesamtbevölkerung:</strong> ${properties["destatis"]["population"]}</p>
                <p><strong>Männliche Bevölkerung:</strong> ${properties["destatis"]["population_m"]}</p>
                <p><strong>Weibliche Bevölkerung:</strong> ${properties["destatis"]["population_w"]}</p>
                <p><strong>Koordinaten (X, Y):</strong> ${coordinate_click.map((c) => c.toFixed(2)).join(", ")}</p>
            `;
      }

      if (selected.has(feature)) {
        selected.delete(feature);
        featureContentMap.delete(feature.getId());
        feature.setStyle(null); // Entferne den Highlight-Style
      } else {
        selected.add(feature);
        featureContentMap.set(feature.getId(), content);
        feature.setStyle(highlightStyle);
      }

      // Anzeigen der ausgewählten Features und ihrer Informationen
      if (selected.size == 0) {
        features_Count.innerHTML =
          "&nbsp;" + selected.size + " ausgewählte Features";
        features.innerHTML = "";
      } else {
        let contentString = "";
        for (let [key, value] of featureContentMap.entries()) {
          contentString += value; // Fügen Sie die Inhalte zu einem String zusammen
        }
        features_Count.innerHTML =
          "&nbsp;" + selected.size + " ausgewählte Features";
        createPagedContent(contentString, 2); // Optional: Inhalt paginieren
        showPage(currentPage); // Zeige die aktuelle Seite an
      }
    }
  });

  // Überprüfen, ob keine Layer aktiv sind
  if (!landkreiseLayer && !bundeslaenderLayer) {
    // Setzen der Position des Pings
    pingOverlay.setPosition(coordinate_click);

    // Anzeigen der Koordinaten
    const roundedCoordinates = coordinate_click.map((coord) =>
      coord.toFixed(2),
    );
    document.getElementById("coordinateOutput").innerText =
      `Koordinaten: ${roundedCoordinates.join(", ")}`;
  }
});
