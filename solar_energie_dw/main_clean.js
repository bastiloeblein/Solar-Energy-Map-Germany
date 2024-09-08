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

// Initialize map and layers
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

// Global variables and state management
let selected = new Set();
let landkreise_Bundesländer = [];
let popupElement = null;
let popup = null;
let popover = null;
let currentLayer = null;
let geoJsonSource = null;
let geoJsonSource_agg = null;
let geotiffLayer = null;
let geotiff_gray_layer = null;
let vectorLayer_landkreis = null;
let vectorLayer = null;
let vectorLayer_Solar = null;
let vectorLayer_Solar_agg = null;
let featureContentMap = new Map();
let count = 0;
let currentPage = 0;
let pages = [];
let make_Selections = 0;
let coordinate_click = null;

// Elements in the UI
const output = document.getElementById("output");
const coordinateOutput = document.getElementById("coordinateOutput");
const features = document.getElementById("features");
const features_Count = document.getElementById("features_Count");

// Ensure the popup element exists
function ensurePopupElement() {
  if (!popupElement) {
    popupElement = document.createElement("div");
    popupElement.id = "popup";
    popupElement.className = "ol-popup";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";
    popupElement.appendChild(popupContent);
    document.body.appendChild(popupElement);
  }
  return popupElement;
}

// Clear selections and popups
function clearSelectionsAndPopups() {
  if (popup) {
    map.removeOverlay(popup);
    popup = null;
  }
  selected.clear();
  featureContentMap.clear();
  if (popover) {
    popover.dispose();
    popover = null;
  }
  features_Count.innerHTML = "&nbsp;0 ausgewählte Features";
  features.innerHTML = "";
}

// Add GeoJSON data to the map
function addGeoJsonToMap(map, geojsonData, selected_orNotSelected) {
  if (geoJsonSource) geoJsonSource = null;
  if (geoJsonSource_agg) geoJsonSource_agg = null;
  if (vectorLayer_Solar) {
    map.removeLayer(vectorLayer_Solar);
    vectorLayer_Solar = null;
  }
  if (vectorLayer_Solar_agg) {
    map.removeLayer(vectorLayer_Solar_agg);
    vectorLayer_Solar_agg = null;
  }

  const iconUrl = "/data/sun.jpeg";
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

  if (selected_orNotSelected === 1) {
    const aggregations = geojsonData.features.slice(
      0,
      landkreise_Bundesländer.length,
    );
    const non_aggregations = geojsonData.features.slice(
      landkreise_Bundesländer.length,
    );

    geoJsonSource = new Vector({
      features: geoJsonFormat.readFeatures(
        {
          features: JSON.parse(JSON.stringify(non_aggregations)),
          type: "FeatureCollection",
        },
        {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        },
      ),
    });

    geoJsonSource_agg = new Vector({
      features: geoJsonFormat.readFeatures(
        {
          features: JSON.parse(JSON.stringify(aggregations)),
          type: "FeatureCollection",
        },
        {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        },
      ),
    });

    vectorLayer_Solar = new VectorLayer({
      className: "Solar",
      source: geoJsonSource,
      style: iconStyle,
      minZoom: 11,
    });

    vectorLayer_Solar_agg = new VectorLayer({
      className: "Solar",
      source: geoJsonSource_agg,
      style: iconStyle,
      maxZoom: 11,
    });

    map.addLayer(vectorLayer_Solar);
    map.addLayer(vectorLayer_Solar_agg);
  } else {
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

    map.addLayer(vectorLayer_Solar);
  }
}

// Load and add aggregated GeoJSON data to the map
function loadAggregatedGeoJson(map) {
  fetch("http://127.0.0.1:5000/send_Computed_bundeslandAggregation", {
    headers: { Accept: "application/json" },
  })
    .then((response) => response.json())
    .then((data) => addGeoJsonToMap(map, data, 0))
    .catch((error) => console.error("Error fetching data:", error));
}

function loadAggregatedGeoJson_Landkreis_Agg(map) {
  fetch("http://127.0.0.1:5000/send_Computed_LandkreisAggregation", {
    headers: { Accept: "application/json" },
  })
    .then((response) => response.json())
    .then((data) => addGeoJsonToMap(map, data, 0))
    .catch((error) => console.error("Error fetching data:", error));
}

// Load solar modules for selected regions
function load_Solarmodules_for_selected_regions(map, landkreise_Bundesländer) {
  fetch("http://127.0.0.1:5000/load_Solarmodules_for_selected_regions", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(landkreise_Bundesländer),
    credentials: `include`,
  })
    .then((response) => response.json())
    .then((data) => addGeoJsonToMap(map, data, 1))
    .catch((error) => console.error("Error fetching data:", error));
}

function load_Solarmodules_for_selected_regions2(map, landkreise_Bundesländer) {
  fetch("http://127.0.0.1:5000/load_Solarmodules_for_selected_regions2", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(landkreise_Bundesländer),
    credentials: `include`,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data) addGeoJsonToMap(map, data, 1);
      else console.error("Too much data");
    })
    .catch((error) => console.error("Error fetching data:", error));
}

// Handle layer toggling and interaction
document
  .getElementById("toggleLandkreise")
  .addEventListener("click", function () {
    count = 1;
    clearSelectionsAndPopups();
    const popupElement = ensurePopupElement();
    popup = new Overlay({ element: popupElement });
    map.addOverlay(popup);

    if (vectorLayer_landkreis) {
      map.removeLayer(vectorLayer_landkreis);
      vectorLayer_landkreis = null;
    }

    geoJsonSource = new Vector({
      url: "data/geojsons/landkreise_simplify0.geojson",
      format: new GeoJSON(),
    });

    vectorLayer_landkreis = new VectorLayer({
      source: geoJsonSource,
      style: new Style({
        stroke: new Stroke({ color: "rgba(0, 0, 255, 0.25)", width: 1 }),
        fill: new Fill({ color: "rgba(0, 0, 255, 0.005)" }),
      }),
    });

    map.addLayer(vectorLayer_landkreis);

    if (vectorLayer) {
      map.removeLayer(vectorLayer);
      vectorLayer = null;
    }

    geoJsonSource.once("change", function () {
      if (geoJsonSource.getState() === "ready") {
        map
          .getView()
          .fit(geoJsonSource.getExtent(), { padding: [20, 20, 20, 20] });
      }
    });
  });

document
  .getElementById("toggleBundeslaender")
  .addEventListener("click", function () {
    count = 2;
    clearSelectionsAndPopups();
    const popupElement = ensurePopupElement();
    popup = new Overlay({ element: popupElement });
    map.addOverlay(popup);

    if (vectorLayer) {
      map.removeLayer(vectorLayer);
      vectorLayer = null;
    }

    geoJsonSource = new Vector({
      url: "data/geojsons/bundeslaender_simplify0.geojson",
      format: new GeoJSON(),
    });

    vectorLayer = new VectorLayer({
      source: geoJsonSource,
      style: new Style({
        stroke: new Stroke({ color: "rgba(0, 0, 255, 0.25)", width: 1 }),
        fill: new Fill({ color: "rgba(0, 0, 255, 0.005)" }),
      }),
    });

    map.addLayer(vectorLayer);

    if (vectorLayer_landkreis) {
      map.removeLayer(vectorLayer_landkreis);
      vectorLayer_landkreis = null;
    }

    geoJsonSource.once("change", function () {
      if (geoJsonSource.getState() === "ready") {
        map
          .getView()
          .fit(geoJsonSource.getExtent(), { padding: [20, 20, 20, 20] });
      }
    });
  });

// Event listeners for hiding layers
document
  .getElementById("hideBundesland")
  .addEventListener("click", function () {
    if (vectorLayer) {
      clearSelectionsAndPopups();
      vectorLayer
        .getSource()
        .getFeatures()
        .forEach((feature) => {
          if (selected.has(feature)) selected.delete(feature);
        });
      map.removeLayer(vectorLayer);
      vectorLayer = null;
      if (popover) popover.dispose();
      popup = null;
    }
  });

document.getElementById("hideLandkreis").addEventListener("click", function () {
  if (vectorLayer_landkreis) {
    clearSelectionsAndPopups();
    vectorLayer_landkreis
      .getSource()
      .getFeatures()
      .forEach((feature) => {
        if (selected.has(feature)) selected.delete(feature);
      });
    map.removeLayer(vectorLayer_landkreis);
    vectorLayer_landkreis = null;
    if (popover) popover.dispose();
    popup = null;
  }
});

// Map interaction and selection handling
map.on("click", function (event) {
  console.log("Map click event triggered");
  map.forEachFeatureAtPixel(event.pixel, function (feature) {
    console.log("forEachFeatureAtPixel callback triggered");
    if (popup) {
      popover = bootstrap.Popover.getInstance(popup.getElement());
      if (popover) popover.dispose();
    }

    if (feature.getId() == null) feature.setId(generateUniqueId());

    const properties = feature.getProperties();
    const geometryType = feature.getGeometry().getType();
    let content = "<p>";
    let title = "";

    if (geometryType == "Point" && count == 0) {
      handlePointGeometry(feature, properties, content);
    } else if (geometryType !== "Point" && (count === 1 || count === 2)) {
      handleNonPointGeometry(feature, properties, content);
    }
  });
});

function handlePointGeometry(feature, properties, content) {
  console.log("Handling point geometry for solar panel");
  popup = new Overlay({ element: ensurePopupElement() });
  map.addOverlay(popup);

  let coordinates = feature.getGeometry().getCoordinates();
  popup.setPosition(coordinates);

  for (const property in properties) {
    if (properties.hasOwnProperty(property)) {
      content += `<strong>${property}:</strong> ${properties[property]}<br>`;
    }
  }
  content += `<strong>Koordinaten:</strong> ${coordinates}<br>`;
  content += "</p>";

  popover = new bootstrap.Popover(popup.getElement(), {
    animation: false,
    container: popup.getElement(),
    content: content,
    html: true,
    placement: "top",
    title: "Solar-Panel-Info (Leistung in KW)",
  });

  popover.show();
  handleFeatureSelection(feature, content);
}

function handleNonPointGeometry(feature, properties, content) {
  console.log("Handling non-point geometry for Landkreis or Bundesland");
  popup = new Overlay({ element: ensurePopupElement() });
  console.log(`Popup created: ${popup.getElement()}`);
  map.addOverlay(popup);

  let coordinates = properties["geometry"];
  if (coordinates) {
    coordinates = coordinates.getCoordinates();
    popup.setPosition(coordinate_click);
  } else {
    console.error("Coordinates for feature are undefined");
  }

  if (count === 2) {
    content += `
            <p><strong>Bundesland:</strong> ${properties["GEN"]}</p>
            <p><strong>Bezeichnung:</strong> ${properties["BEZ"]}</p>
            <p><strong>Gesamtbevölkerung:</strong> ${properties["destatis"]["population"]}</p>
            <p><strong>Männliche Bevölkerung:</strong> ${properties["destatis"]["population_m"]}</p>
            <p><strong>Weibliche Bevölkerung:</strong> ${properties["destatis"]["population_w"]}</p>
            <p><strong>Koordinaten (X, Y):</strong> ${coordinate_click}</p>
        `;
  } else if (count === 1) {
    content += `
            <p><strong>Landkreis:</strong> ${properties["GEN"]}</p>
            <p><strong>Bezeichnung:</strong> ${properties["BEZ"]}</p>
            <p><strong>Gesamtbevölkerung:</strong> ${properties["destatis"]["population"]}</p>
            <p><strong>Männliche Bevölkerung:</strong> ${properties["destatis"]["population_m"]}</p>
            <p><strong>Weibliche Bevölkerung:</strong> ${properties["destatis"]["population_w"]}</p>
            <p><strong>Koordinaten (X, Y):</strong> ${coordinate_click}</p>
        `;
  }

  let title = count === 2 ? "Bundesland-Info" : "Landkreis-Info";
  popover = new bootstrap.Popover(popup.getElement(), {
    animation: false,
    container: popup.getElement(),
    content: content,
    html: true,
    placement: "top",
    title: title,
    trigger: "manual",
  });

  popover.show();
  handleFeatureSelection(feature, content);
}

function handleFeatureSelection(feature, content) {
  if (make_Selections == 0) {
    if (selected.has(feature)) {
      selected.delete(feature);
      featureContentMap.delete(feature.getId());
    } else {
      selected.add(feature);
      featureContentMap.set(feature.getId(), content);
    }
  }
  updateFeatureDisplay();
}

function updateFeatureDisplay() {
  if (selected.size == 0) {
    features_Count.innerHTML =
      "&nbsp;" + selected.size + " ausgewählte Features";
    features.innerHTML = "";
  } else {
    let contentString = "";
    for (let [key, value] of featureContentMap.entries()) {
      contentString += value;
    }
    features_Count.innerHTML =
      "&nbsp;" + selected.size + " ausgewählte Features";
    createPagedContent(contentString, 2);
    showPage(currentPage);
  }
}

// Utility functions for pagination
function showPage(pageIndex) {
  if (pageIndex > 1) currentPage;
  let resultString = "";
  var currentPage_List = pages[currentPage];
  for (var j = 0; j < currentPage_List.length; j++) {
    resultString += currentPage_List[j];
  }
  features.innerHTML = resultString;
}

function createPagedContent(contentString, paragraphsPerPage) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(contentString, "text/html");
  const paragraphs = doc.querySelectorAll("p");
  const contentArray = [];
  paragraphs.forEach((paragraph) => {
    contentArray.push("<p>" + paragraph.innerHTML + "</p>");
  });
  pages = [];
  for (let i = 0; i < contentArray.length; i += paragraphsPerPage) {
    pages.push(contentArray.slice(i, i + paragraphsPerPage));
  }
}

// Event listeners for pagination
const currentPage_Decreaser = document.getElementById("previous");
currentPage_Decreaser.addEventListener("click", function () {
  if (currentPage > 0) currentPage -= 1;
  showPage(currentPage);
});

const currentPage_Increaser = document.getElementById("next");
currentPage_Increaser.addEventListener("click", function () {
  if (pages.length - 1 > currentPage) currentPage += 1;
  showPage(currentPage);
});

// Handle GeoTIFF layers
document.getElementById("dwd").addEventListener("click", function (event) {
  event.preventDefault();
  clearGeotiffLayers();

  const year = document.getElementById("year").value;
  const month = document.getElementById("month").value;
  if (year === "2024" && ["07", "08", "09", "10", "11", "12"].includes(month)) {
    document.getElementById("dwd_Nodata_Meldung").innerText =
      "Noch nicht verfügbar";
    return;
  }

  geotiffLayer = new TileLayer({
    source: new GeoTIFF({
      sources: [{ url: `data/geotiffs/${year}${month}_rgb.tif` }],
    }),
  });

  geotiff_gray_layer = new TileLayer({
    source: new GeoTIFF({
      sources: [
        {
          url: `data/geotiffs/grids_germany_monthly_radiation_direct_${year}${month}_3857.tif`,
        },
      ],
    }),
  });

  geotiff_gray_layer.setOpacity(0);
  map.addLayer(geotiffLayer);
  map.addLayer(geotiff_gray_layer);
});

document.getElementById("hideDWD").addEventListener("click", function (event) {
  event.preventDefault();
  clearGeotiffLayers();
});

function clearGeotiffLayers() {
  if (geotiffLayer) {
    map.removeLayer(geotiffLayer);
    geotiffLayer = null;
  }
  if (geotiff_gray_layer) {
    map.removeLayer(geotiff_gray_layer);
    geotiff_gray_layer = null;
  }
}

// Toolbar and UI interactions
document.querySelectorAll(".toolbar button").forEach((button) => {
  button.addEventListener("click", function () {
    document
      .querySelectorAll(".toolbar button")
      .forEach((btn) => btn.classList.remove("active"));
    this.classList.add("active");
  });
});

const closeButton = document.getElementById("closeButton");
dropdownToggle.addEventListener("click", function () {
  dataWarehouseOperations.style.display = "flex";
  dropdownToggle.style.display = "none"; // Toggle-Leiste verschwindet
});

closeButton.addEventListener("click", function () {
  dataWarehouseOperations.style.display = "none"; // Schließt das Data Warehouse Operations-Fenster
  dropdownToggle.style.display = "flex"; // Zeigt die Dropdown-Toggle-Leiste wieder an
});

document.getElementById("delete").addEventListener("click", function () {
  featureContentMap.clear();
  selected.clear();
  currentPage = 0;
  landkreise_Bundesländer = [];
  features_Count.innerHTML = "&nbsp;" + selected.size + " ausgewählte Features";
  features.innerHTML = "";
});

const slider = document.getElementById("dwdSlider");
slider.addEventListener("input", function () {
  if (geotiffLayer) geotiffLayer.setOpacity(Number(slider.value));
});

// Track zoom level and update UI
var currZoom = map.getView().getZoom();
output.innerHTML = "Zoom Level: " + currZoom.toFixed(2);
map.on("moveend", function () {
  var newZoom = map.getView().getZoom();
  if (currZoom != newZoom) {
    currZoom = newZoom;
    output.innerHTML = "Zoom Level: " + newZoom.toFixed(2);
  }
});

// Utility to generate unique feature IDs
function generateUniqueId() {
  return "feature_" + Math.random(10000000).toString();
}
