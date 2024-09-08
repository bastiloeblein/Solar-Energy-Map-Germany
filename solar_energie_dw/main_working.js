import GeoJSON from "ol/format/GeoJSON.js";
import { Map as olMap } from "ol";
import View from "ol/View";
import Tile from "ol/layer/Tile";
import OSM from "ol/source/OSM.js";
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";
import Fill from "ol/style/Fill.js";
import Icon from "ol/style/Icon.js";
import { fromLonLat } from "ol/proj";
import Vector from "ol/source/Vector.js";
import GeoTIFF from "ol/source/GeoTIFF.js";
import VectorLayer from "ol/layer/Vector.js";
import Overlay from "ol/Overlay.js";
import TileLayer from "ol/layer/WebGLTile.js";

// Initialisierung des Kartenquellens und Layers
const source = new Vector({ wrapX: false });

// VectorLayer für Bundesländer
const vector = new VectorLayer({
  source: source,
});

// Erstellung der OpenLayers-Karte mit OSM als Basiskarte
const map = new olMap({
  target: "map",
  layers: [
    new Tile({
      source: new OSM(),
    }),
  ],
  view: new View({
    center: fromLonLat([10.4515, 51.1657]),
    zoom: 6,
    projection: "EPSG:3857",
  }),
});

map.addLayer(vector);

// Event-Handlers und globale Variablen
const output = document.getElementById("output");
let coordinate_click = null;
const coordinateOutput = document.getElementById("coordinateOutput");
let selected = new Set();
let landkreise_Bundesländer = [];

let currentLayer = null; // Global variable to track the currently active layer
let popupElement = null;

var geoJsonSource = null;
var geoJsonSource_agg = null;
let geotiff = null;
let geotiff_gray = null;
let geotiffLayer = null;
let geotiff_gray_layer = null;

let vectorLayer_landkreis = null;
let vectorLayer = null;
let vectorLayer_Solar = null;
let vectorLayer_Solar_agg = null;

let activeIconPopover = null;  

map.on("click", function (event) {
  coordinate_click = event.coordinate;
  const pixel = event.pixel;

  let roundedCoordinates = coordinate_click.map((coord) => Math.round(coord));

  if (geotiff_gray_layer != null) {
    try {
      const value = geotiff_gray_layer.getData(pixel);

      // Log the pixel value to the console
      coordinateOutput.innerText = `EPSG-3857-Koordinaten: ${roundedCoordinates.join(", ")}`;
      coordinateOutput.innerText +=
        ",  Monatssummen der direkten Strahlung in kWh/m²: " + value[0];
    } catch {
      coordinateOutput.innerText = `EPSG-3857-Coordinates: ${roundedCoordinates.join(", ")}`;
      coordinateOutput.innerText +=
        ",  Monatssummen der direkten Strahlung in kWh/m²: n.A.";
    }
  } else {
    coordinateOutput.innerText = `EPSG-3857-Koordinaten: ${roundedCoordinates.join(", ")}`;
  }
});

// ############  Buttons zum Anzeigen und Hiden von Layers #############################

// Funktion zum Entfernen von Popups und Zurücksetzen der Selektionen
function clearSelectionsAndPopups() {
  // Remove the popup overlay from the map
  if (popup) {
    map.removeOverlay(popup);
    popup = null;
  }

  // Clear the selected features set
  selected.clear();

  // Optionally clear any feature content map (if you're tracking feature info for display)
  featureContentMap.clear();

  // Dispose of any existing popovers
//   if (popover) {
//     popover.dispose();
//     popover = null;
//   }
// Ensure the popover exists and can be disposed
    if (popover && popover._element && popover._element.closest) {
        console.log("Disposing of existing popover before creating new one");
        popover.dispose();
        popover = null;
    }


  // Update the UI to reflect that no features are selected
  features_Count.innerHTML = "&nbsp;0 ausgewählte Einheiten"; // Reset the selected features count display
  features.innerHTML = ""; // Clear the features display area
}

function ensurePopupElement() {
  // If the popup element does not exist, create it
  if (!popupElement) {
    console.log("Popup element not found in the DOM. Creating a new one.");

    // Create the new div element
    popupElement = document.createElement("div");
    popupElement.id = "popup";
    popupElement.className = "ol-popup"; // Add any required classes

    // Optionally, you can add content to the popup element
    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";
    popupElement.appendChild(popupContent);

    // Append the popup element to the body or a specific container
    document.body.appendChild(popupElement);
  }

  return popupElement;
}

// Beispiel: Hinzufügen eines Layers und Aktualisieren von currentLayer
document
  .getElementById("toggleLandkreise")
  .addEventListener("click", function () {
    count = 1;
    clearSelectionsAndPopups();

    // Initialize the popup again
    const popupElement = ensurePopupElement();
    popup = new Overlay({
      element: popupElement,
    });
    if (popup) {
      map.addOverlay(popup);
      console.log("Popup overlay reinitialized and added to map.");
    }

    if (vectorLayer_landkreis != null) {
      map.removeLayer(vectorLayer_landkreis);
      vectorLayer_landkreis = null;
    }

    const geoJsonSource = new Vector({
      url: "data/geojsons/landkreise_simplify0.geojson",
      format: new GeoJSON(),
    });

    vectorLayer_landkreis = new VectorLayer({
      source: geoJsonSource,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(0, 0, 255, 0.25)",
          width: 1,
        }),
        fill: new Fill({
          color: "rgba(0, 0, 255, 0.005)",
        }),
      }),
    });

    map.addLayer(vectorLayer_landkreis);

    // Entferne den Bundesländer-Layer, falls dieser aktiv ist
    if (vectorLayer != null) {
      map.removeLayer(vectorLayer);
      vectorLayer = null;
    }

    // Zoom zur GeoJSON-Ausdehnung, sobald die Quelle bereit ist
    geoJsonSource.once("change", function () {
      if (geoJsonSource.getState() === "ready") {
        map
          .getView()
          .fit(geoJsonSource.getExtent(), { padding: [20, 20, 20, 20] });
      }
    });
  });

// Laden von GeoJSON Daten für Bundesländer
document
  .getElementById("toggleBundeslaender")
  .addEventListener("click", function () {
    count = 2;
    clearSelectionsAndPopups();
    const popupElement = ensurePopupElement();

    // Entferne den bestehenden Bundesländer-Layer, falls vorhanden
    if (vectorLayer != null) {
      map.removeLayer(vectorLayer);
      vectorLayer = null;
    }

    // Lege eine neue Quelle für die Bundesländer fest
    const geoJsonSource = new Vector({
      url: "data/geojsons/bundeslaender_simplify0.geojson",
      format: new GeoJSON(),
    });

    // Erstelle den Bundesländer-Layer
    vectorLayer = new VectorLayer({
      source: geoJsonSource,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(0, 0, 255, 0.25)",
          width: 1,
        }),
        fill: new Fill({
          color: "rgba(0, 0, 255, 0.005)",
        }),
      }),
    });

    // Füge den Layer zur Karte hinzu
    map.addLayer(vectorLayer);

    // Entferne den Landkreis-Layer, falls dieser aktiv ist
    if (vectorLayer_landkreis != null) {
      map.removeLayer(vectorLayer_landkreis);
      vectorLayer_landkreis = null;
    }

    // Zoom zur GeoJSON-Ausdehnung, sobald die Quelle bereit ist
    geoJsonSource.once("change", function () {
      if (geoJsonSource.getState() === "ready") {
        map
          .getView()
          .fit(geoJsonSource.getExtent(), { padding: [20, 20, 20, 20] });
      }
    });
  });

// Event Listener für das Ausblenden der Bundesländer
document
  .getElementById("hideBundesland")
  .addEventListener("click", function () {
    if (vectorLayer) {
      clearSelectionsAndPopups();

      vectorLayer
        .getSource()
        .getFeatures()
        .forEach((feature) => {
          if (selected.has(feature)) {
            selected.delete(feature);
          }
        });
      map.removeLayer(vectorLayer);
      vectorLayer = null;

      // Dispose of any existing popovers
    //   if (popover) {
    //     popover.dispose();
    //   }
    // Ensure the popover exists and can be disposed
if (popover && popover._element && popover._element.closest) {
    console.log("Disposing of existing popover before creating new one");
    popover.dispose();
    popover = null;
}

      popup = null;
    }
  });

// Event Listener für das Ausblenden der Landkreise
document.getElementById("hideLandkreis").addEventListener("click", function () {
  if (vectorLayer_landkreis) {
    clearSelectionsAndPopups();

    vectorLayer_landkreis
      .getSource()
      .getFeatures()
      .forEach((feature) => {
        if (selected.has(feature)) {
          selected.delete(feature);
        }
      });
    map.removeLayer(vectorLayer_landkreis);
    vectorLayer_landkreis = null;
    // Dispose of any existing popovers
    // if (popover) {
    //   popover.dispose();
    // }
    // Ensure the popover exists and can be disposed
if (popover && popover._element && popover._element.closest) {
    console.log("Disposing of existing popover before creating new one");
    popover.dispose();
    popover = null;
}

    popup = null;
  }
});

function addGeoJsonToMapWithBuffering(map, geojsonData) {
    // Show the loading spinner
    document.getElementById("loadingSpinner").style.display = "block";
  
    // Remove existing layers if any
    if (geoJsonSource != null) geoJsonSource = null;
    if (geoJsonSource_agg != null) geoJsonSource_agg = null;
    if (vectorLayer_Solar != null) {
      map.removeLayer(vectorLayer_Solar);
      vectorLayer_Solar = null;
    }
    if (vectorLayer_Solar_agg != null) {
      map.removeLayer(vectorLayer_Solar_agg);
      vectorLayer_Solar_agg = null;
    }
  
    // Create and add new layers based on the provided GeoJSON data
    const iconUrl = "/data/sun.jpeg"; // URL for the icon
  
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: iconUrl,
        scale: 0.2,
        opacity: 1,
      }),
    });
  
    const geoJsonFormat = new GeoJSON();
  
    geoJsonSource = new Vector({
      features: geoJsonFormat.readFeatures(geojsonData, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      }),
    });
  
    vectorLayer_Solar = new VectorLayer({
      className: "Solar",
      source: geoJsonSource,
      style: iconStyle,
    });
  
    vectorLayer_Solar.setZIndex(100);
    map.addLayer(vectorLayer_Solar);
  
    // Fit the map view to the extent of the loaded data
    const extent = geoJsonSource.getExtent();
    map.getView().fit(extent, { padding: [20, 20, 20, 20], duration: 1000 });
  
    // Hide the loading spinner
    document.getElementById("loadingSpinner").style.display = "none";
  
    return extent;
  }
  

// Funktion zum Hinzufügen von GeoJSON-Daten zur Karte
function addGeoJsonToMap(map, geojsonData, selected_orNotSelected) {
  console.log(geojsonData.features.length);

  if (geoJsonSource != null) geoJsonSource = null;
  if (geoJsonSource_agg != null) geoJsonSource_agg = null;
  if (vectorLayer_Solar != null) {
    map.removeLayer(vectorLayer_Solar);
    vectorLayer_Solar = null;
  }
  if (vectorLayer_Solar_agg != null) {
    map.removeLayer(vectorLayer_Solar_agg);
    vectorLayer_Solar_agg = null;
  }

  if (selected_orNotSelected == 1) {
    //console.log(geojsonData.features);
    let aggregations = geojsonData.features.slice(
      0,
      landkreise_Bundesländer.length,
    );
    //console.log(aggregations);
    let non_aggregations = geojsonData.features.slice(
      landkreise_Bundesländer.length,
    );
    aggregations = JSON.stringify(aggregations);
    non_aggregations = JSON.stringify(non_aggregations);
    let collection_agg = JSON.stringify({
      features: JSON.parse(aggregations),
      type: "FeatureCollection",
    });
    let collection_NONagg = JSON.stringify({
      features: JSON.parse(non_aggregations),
      type: "FeatureCollection",
    });

    // Bild als Symbol laden
    const iconUrl = "/data/sun.jpeg";

    //In die Info-Box reinschreiben und nicht console.log, also noch ändern
    //geojsonData.features.forEach(feature => {
    //console.log("Feature ID:", feature.id);

    // Iteriere über jede Eigenschaft und gib sie aus
    // for (const property in feature.properties) {
    //    console.log(`${property}: ${feature.properties[property]}`);
    //}

    // console.log("----------------");});
    // Stil für die Features im Vektor-Layer definieren
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: iconUrl,
        scale: 0.2, // Hier kannst du die Größe des Icons anpassen
        opacity: 1,
      }),
    });

    // GeoJSON-Format erstellen
    const geoJsonFormat = new GeoJSON();

    // Datenquelle erstellen
    geoJsonSource = new Vector({
      features: geoJsonFormat.readFeatures(collection_NONagg, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      }),
    });

    geoJsonSource_agg = new Vector({
      features: geoJsonFormat.readFeatures(collection_agg, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      }),
    });

    // Vektor-Layer erstellen und Stil setzen
    vectorLayer_Solar = new VectorLayer({
      className: "Solar",
      source: geoJsonSource,
      style: iconStyle, // Hier wird der definierte Stil für die Features im Layer gesetzt
      minZoom: 11,
    });

    vectorLayer_Solar_agg = new VectorLayer({
      className: "Solar",
      source: geoJsonSource_agg,
      style: iconStyle, // Hier wird der definierte Stil für die Features im Layer gesetzt
      maxZoom: 11,
    });

    vectorLayer_Solar.setZIndex(100);
    vectorLayer_Solar_agg.setZIndex(100);

    /*
    // Layer zur vorhandenen Karte hinzufügen
    if(vectorLayer_landkreis!=null){

      map.removeLayer(vectorLayer_landkreis);
      map.addLayer(vectorLayer_landkreis)
    }
    if(vectorLayer!=null){

      map.removeLayer(vectorLayer);
      map.addLayer(vectorLayer)
    }
    */
    map.addLayer(vectorLayer_Solar);
    map.addLayer(vectorLayer_Solar_agg);

    //vectorLayer.setZIndex(1);
    //vectorLayer_landkreis.setZIndex(10);

    // Optional: Automatisches Anpassen der Kartenansicht auf die neuen Daten
    //map.getView().fit(geoJsonSource.getExtent(), { padding: [0, 0, 0, 0], duration: 100 });
  } else {
    //console.log(geojsonData)
    //geojsonData = geojsonData[0];
    //console.log(geojsonData);
    // Bild als Symbol laden
    if (geoJsonSource != null) geoJsonSource = null;

    const iconUrl = "/data/sun.jpeg";

    //In die Info-Box reinschreiben und nicht console.log, also noch ändern
    //geojsonData.features.forEach(feature => {
    //console.log("Feature ID:", feature.id);

    // Iteriere über jede Eigenschaft und gib sie aus
    // for (const property in feature.properties) {
    //    console.log(`${property}: ${feature.properties[property]}`);
    //}

    // console.log("----------------");});
    // Stil für die Features im Vektor-Layer definieren
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        src: iconUrl,
        scale: 0.2, // Hier kannst du die Größe des Icons anpassen
        opacity: 1,
      }),
    });

    // GeoJSON-Format erstellen
    const geoJsonFormat = new GeoJSON();

    // Datenquelle erstellen
    geoJsonSource = new Vector({
      features: geoJsonFormat.readFeatures(geojsonData, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      }),
    });

    if (vectorLayer_Solar != null) {
      map.removeLayer(vectorLayer_Solar);
      vectorLayer = null;
    }

    // Vektor-Layer erstellen und Stil setzen
    vectorLayer_Solar = new VectorLayer({
      className: "Solar",
      source: geoJsonSource,
      style: iconStyle, // Hier wird der definierte Stil für die Features im Layer gesetzt
    });

    vectorLayer_Solar.setZIndex(100);
    // Layer zur vorhandenen Karte hinzufügen
    /*
    if(vectorLayer_landkreis!=null){

      map.removeLayer(vectorLayer_landkreis);
      map.addLayer(vectorLayer_landkreis)
    }
    if(vectorLayer!=null){

      map.removeLayer(vectorLayer);
      map.addLayer(vectorLayer)
    }
    */
    map.addLayer(vectorLayer_Solar);
  }
}

function loadAggregatedGeoJson(map) {
  // AJAX-Anfrage mit fetch API
  fetch("http://127.0.0.1:5000/send_Computed_bundeslandAggregation", {
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // JSON aus der Antwort extrahieren
    })
    .then((data) => {
      //console.log
      // Daten erfolgreich geladen, jetzt zur Karte hinzufügen
      console.log(`Fetched data ${data}`)

      addGeoJsonToMap(map, data, 0);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });

}

document
  .getElementById("Bundesländer_Aggregation")
  .addEventListener("click", function () {
    // Initialize the popup again
    const popupElement = ensurePopupElement();
    popup = new Overlay({
      element: popupElement,
    });
    if (popup) {
      map.addOverlay(popup);
      console.log("Popup overlay reinitialized and added to map.");
    }

    loadAggregatedGeoJson(map); // 'map' ist hier deine vorhandene OpenLayers Karte
  });

function loadAggregatedGeoJson_Landkreis_Agg(map) {
  // AJAX-Anfrage mit fetch API
  fetch("http://127.0.0.1:5000/send_Computed_LandkreisAggregation", {
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // JSON aus der Antwort extrahieren
    })
    .then((data) => {
      //console.log
      // Daten erfolgreich geladen, jetzt zur Karte hinzufügen
      addGeoJsonToMap(map, data, 0);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

document
  .getElementById("Landkreis_Aggregation")
  .addEventListener("click", function () {
    // Initialize the popup again
    const popupElement = ensurePopupElement();
    popup = new Overlay({
      element: popupElement,
    });
    if (popup) {
      map.addOverlay(popup);
      console.log("Popup overlay reinitialized and added to map.");
    }

    loadAggregatedGeoJson_Landkreis_Agg(map); // 'map' ist hier deine vorhandene OpenLayers Karte
  });

//Für ausgewählte Landkreise:

function load_Solarmodules_for_selected_regions(map, landkreise_Bundesländer, orgaeinheit) {
  // Create an object with both landkreise_Bundesländer and orgaeinheit
  const requestData = {
    landkreise_Bundesländer: landkreise_Bundesländer,
    orgaeinheit: orgaeinheit
  };

  // AJAX-Anfrage mit fetch API
  return fetch("http://127.0.0.1:5000/load_Solarmodules_for_selected_regions", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestData),
    // method: `POST`,
    credentials: `include`,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // JSON aus der Antwort extrahieren
    })
    .then((data) => {
        // Daten erfolgreich geladen, jetzt zur Karte hinzufügen
        const extent = addGeoJsonToMapWithBuffering(map, data, 1);
        return extent; // Return the extent to zoom the map
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        throw error; // Re-throw the error to be handled later
      });
  }
document
  .getElementById("Selektierte_Aggregation")
  .addEventListener("click", function () {

    // Show the loading spinner
    document.getElementById("loadingSpinner").style.display = "block";

    // Initialize the popup again
    const popupElement = ensurePopupElement();
    popup = new Overlay({
      element: popupElement,
    });
    if (popup) {
      map.addOverlay(popup);
      console.log("Popup overlay reinitialized and added to map.");
    }

    //console.log(selected);
    //console.log(selected.entries());
    for (const object of selected) {
      //landkreise_Bundesländer.push(Object.values(object));
      if (
        landkreise_Bundesländer.includes(
          object["values_"]["BEZ"] + " " + object["values_"]["GEN"],
        ) == false
      )
        landkreise_Bundesländer.push(
          object["values_"]["BEZ"] + " " + object["values_"]["GEN"],
        );
    }
    //landkreise_Bundesländer.forEach((x, i) => console.log(x));
    //console.log('landkreise und bundesländer');
    //console.log(landkreise_Bundesländer);

    // Determine the orgaeinheit based on a condition
    let orgaeinheit = count === 1 ? "Landkreis" : "Bundesland";


    load_Solarmodules_for_selected_regions(map, landkreise_Bundesländer, orgaeinheit) // 'map' ist hier deine vorhandene OpenLayers Karte
    .then((extent) => {
        // Zoom the map to the loaded region
        map.getView().fit(extent, { duration: 1000, maxZoom: 10 });

        // Hide the loading spinner
        document.getElementById("loadingSpinner").style.display = "none";
      })
      .catch((error) => {
        console.error("Error loading regions:", error);
        // Hide the loading spinner if there's an error
        document.getElementById("loadingSpinner").style.display = "none";
      });
  });

// Geladene Panels von Karte löschen
// Hinzufügen, dass ausgewählte Einheiten gecleared werden und alle popups schließen und selection wegsind
document.getElementById("delete_panels").addEventListener("click", function () {
  if (vectorLayer_Solar != null) {
    map.removeLayer(vectorLayer_Solar);
    vectorLayer_Solar = null;
    geoJsonSource = null;
  }
  if (vectorLayer_Solar_agg != null) {
    map.removeLayer(vectorLayer_Solar_agg);
    vectorLayer_Solar_agg = null;
    geoJsonSource_agg = null;
  }
});

//Download Geojsons
// const download = document.getElementById('download');
// document.getElementById('makeDownload').addEventListener('click', function() {

//   var format = new GeoJSON();
//   const json = format.writeFeatures(vectorLayer_Solar.getSource().getFeatures());
//   download.href =
//     'data:application/json;charset=utf-8,' + encodeURIComponent(json);
// });

//Nur den Layer für Bundesländer anzeigen, wenn relativ nah rangezoomt ist, um Performance zu verbessern
var currZoom = map.getView().getZoom();
output.innerHTML = "Zoom Level: " + currZoom.toFixed(2);
map.on("moveend", function (e) {
  var newZoom = map.getView().getZoom();
  if (currZoom != newZoom) {
    //console.log('zoom end, new zoom: ' + newZoom);
    currZoom = newZoom;
    output.innerHTML = "Zoom Level: " + newZoom.toFixed(2);
  }
});
//-------------------------------------------------------
// Auswählen der Features und Anzeigen

//json für features, um feature : content zu erstellen, da die features gefiltert werden, da nicht immer alle Infos interessant sind
let featureContentMap = new Map();
let count = 0;
let popup = null;
let popover = null;


// Define the highlight style
const highlightStyle = new Style({
  stroke: new Stroke({
    color: "rgba(255, 255, 0, 0.8)", // Yellow border with some transparency
    width: 2,
  }),
  fill: new Fill({
    color: "rgba(255, 255, 0, 0.3)", // Yellow fill with some transparency
  }),
});

let features = document.getElementById("features");
let features_Count = document.getElementById("features_Count");

//Manager for html view for features, so that the features are distributed over html info box

let currentPage = 0;
let pages = [];

const currentPage_Decreaser = document.getElementById("previous");
currentPage_Decreaser.addEventListener("click", function () {
    console.log(`currentPage ${currentPage}`)
  if (currentPage > 0) {
    currentPage -= 1;
  showPage(currentPage);
  }
});

const currentPage_Increaser = document.getElementById("next");
currentPage_Increaser.addEventListener("click", function () {
    if (currentPage < pages.length - 1) {
        currentPage += 1; // Move to the next page
        showPage(currentPage); // Show the new current page
    }
});

function showPage(pageIndex) {
    if (pageIndex >= 0 && pageIndex < pages.length) {
        features.innerHTML = pages[pageIndex].join(""); // Display the content of the current page
        updateNavigationButtons(); // Ensure navigation buttons are updated
    }
}
function updateNavigationButtons() {
    currentPage_Decreaser.disabled = currentPage === 0;
    currentPage_Increaser.disabled = currentPage === pages.length - 1;
}

function createPagedContent(contentArray) {
    // pages = []; // Reset pages array
    const itemsPerPage = 1; // Define how many items per page

    for (let i = 0; i < contentArray.length; i += itemsPerPage) {
        pages.push(contentArray.slice(i, i + itemsPerPage));
    }

    currentPage = pages.length - 1; // Set to the latest page
    showPage(currentPage); // Display the most recent page
}


//Später für einen Button -> selektieren on/off
let make_Selections = 0;

function generateUniqueId() {
  // Hier können Sie eine Funktion zur Generierung eindeutiger IDs implementieren
  // Beispiel:
  return "feature_" + Math.random(10000000).toString();
}

// Change cursor when hovering over icons
map.on("pointermove", function (event) {
  let isFeatureHovered = false;
  map.forEachFeatureAtPixel(event.pixel, function (feature) {
    if (feature.getGeometry().getType() === "Point") {
      isFeatureHovered = true;
    }
  });

  map.getTargetElement().style.cursor = isFeatureHovered ? "pointer" : "";
});

// hier alte version
// map.on('click', function(event) {

//   map.forEachFeatureAtPixel(event.pixel, function(feature) {

//     if(feature.getId() == null){
//         console.log('Generating unique ID for feature');
//       feature.setId(generateUniqueId());
//     }

//     const properties = feature.getProperties();
//     const geometryType = feature.getGeometry().getType();

//     console.log(`Feature geometry type: ${geometryType}`);

//     let content = '<div>';

//     if(geometryType == 'Point' && count==0){

//       console.log('Handling point geometry for solar panel')
//       //Pop-Up für als Container für das popover
//       popup = new Overlay({
//         element: popupElement,

//       });

//       map.addOverlay(popup);

//       let coordinates = feature.getGeometry().getCoordinates();
//       popup.setPosition(coordinates);
//       //coordinates = (ol.proj.toLonLat(coordinates));

//       popover = bootstrap.Popover.getInstance(popup.getElement());
//       if (popover) {
//         console.log('Disposing of existing popover before creating new one');
//         popover.dispose();
//       }

//       delete properties['geometry'];

//      // Add properties to the content with better formatting
//      for (const property in properties) {
//         if (properties.hasOwnProperty(property)) {
//             // Add each property with strong tags and new line
//             content += `<strong>${property}:</strong> ${properties[property].toLocaleString()}<br>`;
//         }
//     }
//     // Add coordinates with rounding
//     content += `<strong>Koordinaten:</strong> ${coordinates.map(coord => Math.round(coord)).join(', ')}<br>`;
//     content += '</div>'; // Close the div container

//       popover = new bootstrap.Popover(popup.getElement(), {
//         animation: false,
//         container: popup.getElement(),
//         content: content,
//         html: true,
//         placement: 'top',
//         title: 'Solar-Panel-Info (Leistung in KW)',
//       });

//       popover.show();
//       handleFeatureSelection(feature, content)

// Handle icon clicks to show solar panel information
map.on("click", function (event) {
  let pointClicked = false;
  let popup;

  map.forEachFeatureAtPixel(event.pixel, function (feature) {

    const geometryType = feature.getGeometry().getType();
    console.log(`geometryType: ${geometryType}`);

    if (geometryType === "Point") {
      // Check if the clicked feature is a solar panel icon
      console.log("Handling point geometry for solar panel");
      pointClicked = true;

    //   if (popover) {
    //     console.log("Disposing of existing popover before creating new one");
    //     popover.dispose();
    //   }
    // Ensure the popover exists and can be disposed
    if (popover && popover._element && popover._element.closest) {
        console.log("Disposing of existing popover before creating new one");
        popover.dispose();
        popover = null;
}

      const properties = feature.getProperties();

      // Create and show the popover
      popup = new Overlay({
        element: ensurePopupElement(),
      });

      map.addOverlay(popup);
      let coordinates = feature.getGeometry().getCoordinates();
      popup.setPosition(coordinates);

      let content = "<div>";

      // Add properties to the content with better formatting
      for (const property in properties) {
        if (properties.hasOwnProperty(property)) {
          if (property === "year") {
            // Add the year property without toLocaleString()
            content += `<strong>${property}:</strong> ${properties[property]}<br>`;
          } else {
            // Add other properties with toLocaleString()
            content += `<strong>${property}:</strong> ${properties[property].toLocaleString()}<br>`;
          }
        }
      }
      // Add coordinates with rounding
      content += `<strong>Koordinaten:</strong> ${coordinates.map((coord) => Math.round(coord)).join(", ")}<br>`;
      content += "</div>"; // Close the div container

      console.log(`content: ${content}`);

      popover = new bootstrap.Popover(popup.getElement(), {
        animation: false,
        container: popup.getElement(),
        content: content,
        html: true,
        placement: "top",
        title: "Information zum Standort/Einheit \n (Leistung in KW)",
      });

      console.log(`popover filled ${popover}`);

      popover.show();

      handleIconSelection(feature, content);

  // If a point was clicked, skip polygon handling
    } else if (!pointClicked && geometryType !== "Point") {
    // map.forEachFeatureAtPixel(event.pixel, function (feature) {

        const properties = feature.getProperties();

        // if (popover) {
        //     console.log("Disposing of existing popover before creating new one");
        //     popover.dispose();
        //   }
        // Ensure the popover exists and can be disposed
        if (popover && popover._element && popover._element.closest) {
            console.log("Disposing of existing popover before creating new one");
            popover.dispose();
            popover = null;
        }
          //Pop-Up für als Container für das popover
          popup = new Overlay({
            element: popupElement,

          });
          console.log(`Popup created: ${popup.getElement()}`)

        map.addOverlay(popup);
        let coordinates = properties["geometry"];
        if (coordinates) {
          coordinates = coordinates.getCoordinates();
          popup.setPosition(coordinate_click);
        } else {
          console.error("Coordinates for feature are undefined");
        }

        popover = bootstrap.Popover.getInstance(popup.getElement());
        console.log(`popover created ${popover}`);

        let content = "<div>"; // Verwende ein div, um den gesamten Inhalt zusammenzuhalten
        if (count === 2) {
          console.log("Creating popover for Bundesland");
          // Popup für Bundesländer
          content += `
                <strong>Bundesland:</strong> ${properties["GEN"]}<br>
                <strong>Bezeichnung:</strong> ${properties["BEZ"]}<br>
                <strong>Gesamtbevölkerung:</strong> ${properties["destatis"]["population"].toLocaleString()}<br>
                <strong>Männliche Bevölkerung:</strong> ${properties["destatis"]["population_m"].toLocaleString()}<br>
                <strong>Weibliche Bevölkerung:</strong> ${properties["destatis"]["population_w"].toLocaleString()}<br>
                <strong>Koordinaten (X, Y):</strong> ${coordinate_click.map((coord) => Math.round(coord)).join(", ")}
            `;
        } else if (count === 1) {
          console.log("Creating popover for Landkreis");
          // Popup für Landkreise
          content += `
                <strong>Landkreis:</strong> ${properties["GEN"]}<br>
                <strong>Bezeichnung:</strong> ${properties["BEZ"]}<br>
                <strong>Gesamtbevölkerung:</strong> ${properties["destatis"]["population"].toLocaleString()}<br>
                <strong>Männliche Bevölkerung:</strong> ${properties["destatis"]["population_m"].toLocaleString()}<br>
                <strong>Weibliche Bevölkerung:</strong> ${properties["destatis"]["population_w"].toLocaleString()}<br>
                <strong>Koordinaten (X, Y):</strong> ${coordinate_click.map((coord) => Math.round(coord)).join(", ")}
            `;
        }
        content += "</div>";

        console.log(`Content ${content}`);

        let title = count === 2 ? "Bundesland-Info" : "Landkreis-Info";
        console.log("Creating new popover for Landkreis or Bundesland");
        console.log(`Popup infos ${popup.getElement()}`);

        popover = new bootstrap.Popover(popup.getElement(), {
          animation: false,
          container: popup.getElement(),
          content: content,
          html: true,
          placement: "top",
          title: title,
          trigger: "manual",
        });
        console.log(`popover filled ${popover}`);

        popover.show();

        // Add double-click event listener to close the popover
        popup.getElement().addEventListener("dblclick", function () {
          // Ensure the popover exists and can be disposed
            if (popover && popover._element && popover._element.closest) {
                console.log("Disposing of existing popover before creating new one");
                popover.dispose(); // Close the popover
            popover = null; // Reset the popover variable
            map.removeOverlay(popup); // Remove the overlay from the map
            popup = null; // Reset the popup variable
          }
        //   if (popover) {
        //     popover.dispose(); // Close the popover
        //     popover = null; // Reset the popover variable
        //     map.removeOverlay(popup); // Remove the overlay from the map
        //     popup = null; // Reset the popup variable
        //   }
        });

        console.log("After creation of popover");

        handleFeatureSelection(feature, content);
      }
    });
});

function handleIconSelection(feature, content) {
  // Prevent icon from disappearing by ensuring style is maintained
  if (!selected.has(feature)) {
    selected.add(feature);
    featureContentMap.set(feature.getId(), content);
  }
  updateFeatureDisplay();
}

function handleFeatureSelection(feature, content) {
  if (make_Selections == 0) {
    if (selected.has(feature)) {
      selected.delete(feature);
      console.log("Deleted selected");
      feature.setStyle(null); // Reset to the default style
      featureContentMap.delete(feature.getId());
    } else {
      selected.add(feature);
      feature.setStyle(highlightStyle); // Apply the highlight style
      featureContentMap.set(feature.getId(), content);
    }
  }
  updateFeatureDisplay(); // Ensure the display is updated after each selection
}

function updateFeatureDisplay() {
    if (selected.size == 0) {
        features_Count.innerHTML = "&nbsp;" + selected.size + " ausgewählte Einheiten";
        features.innerHTML = "";
    } else {
        let contentArray = [];
        for (let [key, value] of featureContentMap.entries()) {
            contentArray.unshift(value); // Add new content to the beginning of the array
        }
        features_Count.innerHTML = "&nbsp;" + selected.size + " ausgewählte Einheiten";
        createPagedContent(contentArray); // Create and show the new page
    }
}


document.getElementById("delete").addEventListener("click", function () {

pages = []
  // Clear all feature selections
  selected.forEach((feature) => {
    // Remove the highlight style by resetting to null
    feature.setStyle(null);
  });

  // Clear the popover and remove it from the map
//   if (popover) {
//     popover.dispose();
//     popover = null;
//   }
// Ensure the popover exists and can be disposed
if (popover && popover._element && popover._element.closest) {
    console.log("Disposing of existing popover before creating new one");
    popover.dispose();
    popover = null;
}

  if (popup) {
    map.removeOverlay(popup);
    popup = null;
  }

  // Clear the feature content map and selected set
  featureContentMap.clear();
  selected.clear();

  // Reset the current page and UI elements
  currentPage = 0;
  landkreise_Bundesländer = [];
  features_Count.innerHTML =
    "&nbsp;" + selected.size + " ausgewählte Einheiten";
  features.innerHTML = "";
});

// Funktion zum Laden der GeoJSON-Daten und Hinzufügen zur vorhandenen Karte in OpenLayers
function loadGeoJson(map) {
  // URL zum GeoJSON-Datensatz
  const url = "/static/data.geojson";

  // AJAX-Anfrage mit fetch API
  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // JSON aus der Antwort extrahieren
    })
    .then((data) => {
      // Daten erfolgreich geladen, jetzt zur Karte hinzufügen
      addGeoJsonToMap(map, data);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

//Geotiffs hinzufügen und entfernen

const slider = document.getElementById("dwdSlider");
slider.addEventListener("input", function () {
  if (geotiffLayer != null) geotiffLayer.setOpacity(Number(slider.value));
});

const dwd_Nodata_Meldung = document.getElementById("dwd_Nodata_Meldung");

document.getElementById("dwd").addEventListener("click", function (event) {
  event.preventDefault();
  if (geotiff != null) {
    geotiff == null;
    map.removeLayer(geotiffLayer);
  }
  if (geotiff_gray != null) {
    geotiff_gray == null;
    map.removeLayer(geotiff_gray_layer);
  }
  const year = document.getElementById("year").value;
  const month = document.getElementById("month").value;
  if (
    year == "2024" &&
    (month == "07" ||
      month == "08" ||
      month == "09" ||
      month == "10" ||
      month == "11" ||
      month == "12")
  )
    dwd_Nodata_Meldung.innerText = "Noch nicht verfügbar";
  geotiff = new GeoTIFF({
    sources: [
      {
        url: "data/geotiffs/" + year + month + "_rgb.tif",
      },
    ],
  });

  geotiff_gray = new GeoTIFF({
    sources: [
      {
        url:
          "data/geotiffs/grids_germany_monthly_radiation_direct_" +
          year +
          month +
          "_3857.tif",
      },
    ],
  });

  geotiffLayer = new TileLayer({
    source: geotiff,
  });

  geotiff_gray_layer = new TileLayer({
    source: geotiff_gray,
  });

  geotiff_gray_layer.setOpacity(0);
  map.addLayer(geotiffLayer);
  map.addLayer(geotiff_gray_layer);
});

document.getElementById("hideDWD").addEventListener("click", function (event) {
  event.preventDefault();

  if (geotiffLayer != null) {
    map.removeLayer(geotiffLayer);
    geotiff = null;
    geotiffLayer = null;
    map.removeLayer(geotiff_gray_layer);
    geotiff_gray = null;
    geotiff_gray_layer = null;
  }
});

//3D-Anbindung
//Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4NWFkMThkYy0wZWY5LTQwNTctYmYzYy00NDAxNmJlMjdmZTkiLCJpZCI6MjE2ODE1LCJpYXQiOjE3MTYzMTAzODR9.q4XdtW3XT4ldPzBYoCHcMt-rYEj-raqXOR7oEBgyctk';

const closeButton = document.getElementById("closeButton");

dropdownToggle.addEventListener("click", function () {
  dataWarehouseOperations.style.display = "flex";
  dropdownToggle.style.display = "none"; // Toggle-Leiste verschwindet
});

closeButton.addEventListener("click", function () {
  dataWarehouseOperations.style.display = "none"; // Schließt das Data Warehouse Operations-Fenster
  dropdownToggle.style.display = "flex"; // Zeigt die Dropdown-Toggle-Leiste wieder an
});

// document.querySelectorAll(".toolbar button").forEach((button) => {
//   button.addEventListener("click", function () {
//     document
//       .querySelectorAll(".toolbar button")
//       .forEach((btn) => btn.classList.remove("active"));
//     this.classList.add("active");
//   });
// });