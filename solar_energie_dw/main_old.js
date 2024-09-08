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
import Interaction from "ol/interaction/Interaction.js";
import Draw from "ol/interaction/Draw";
import Overlay from "ol/Overlay.js";
import TileLayer from "ol/layer/WebGLTile.js";
import WebGLPointsLayer from "ol/layer/WebGLPoints.js";

const source = new Vector({ wrapX: false });
//Für Bundesländer
const vector = new VectorLayer({
  source: source,
});

const map = new olMap({
  target: "map",
  layers: [
    new Tile({
      source: new OSM(),
    }),
  ],
  view: new View({
    center: fromLonLat([0, 0]),
    zoom: 2,
    projection: "EPSG:3857",
  }),
});

map.addLayer(vector);

//Event-Handlers for layers, Clicks, Buttons

const output = document.getElementById("output");
let coordinate_click = null;
const coordinateOutput = document.getElementById("coordinateOutput");

//Frühere globale Initialiesierung, um die Strukturen global zu benutzen

let selected = new Set();

var geoJsonSource = null;

var geoJsonSource_agg = null;

let geotiff = null;
let geotiff_gray = null;
let geotiffLayer = null;
let geotiff_gray_layer = null;

map.on("click", function (event) {
  coordinate_click = event.coordinate;
  const pixel = event.pixel;

  if (geotiff_gray_layer != null) {
    try {
      const value = geotiff_gray_layer.getData(pixel);

      // Log the pixel value to the console
      //console.log(value[0]);
      coordinateOutput.innerText = `3857-CRS-Coordinates: ${event.coordinate.join(", ")}`;
      coordinateOutput.innerText +=
        ",  Monatssummen der direkten Strahlung in kWh/m²: " + value[0];
    } catch {
      coordinateOutput.innerText = `3857-CRS-Coordinates: ${event.coordinate.join(", ")}`;
      coordinateOutput.innerText +=
        ",  Monatssummen der direkten Strahlung in kWh/m²: n.A.";
    }
  } else {
    coordinateOutput.innerText = `3857-CRS-Coordinates: ${event.coordinate.join(", ")}`;
  }
});

//Die ausgewählten landkreise und Bundesländer
let landkreise_Bundesländer = [];

let vectorLayer_landkreis = null;
let vectorLayer = null;
let vectorLayer_Solar = null;
let vectorLayer_Solar_agg = null;

document.getElementById("toggleGeoJSON").addEventListener("click", function () {
  if (vectorLayer_landkreis != null) {
    map.removeLayer(vectorLayer_landkreis);
    vectorLayer_landkreis = null;
  }
  const geoJsonSource = new Vector({
    url: "data/geojsons/landkreise_simplify0.geojson", // Pfad zur GeoJSON-Datei relativ zum Webserver
    format: new GeoJSON(),
  });

  vectorLayer_landkreis = new VectorLayer({
    source: geoJsonSource,
    style: new Style({
      stroke: new Stroke({
        color: "rgba(0, 0, 255, 0.25)", // Ändere hier die Transparenz
        width: 1,
      }),
      fill: new Fill({
        color: "rgba(0, 0, 255, 0.005)",
      }),
    }),
  });

  map.addLayer(vectorLayer_landkreis);
  if (vectorLayer != null) {
    map.removeLayer(vectorLayer);
    vectorLayer = null;
  }

  // Zoom zur GeoJSON-Ausdehnung
  geoJsonSource.once("change", function () {
    if (geoJsonSource.getState() === "ready") {
      map
        .getView()
        .fit(geoJsonSource.getExtent(), { padding: [20, 20, 20, 20] });
    }
  });
});

document.getElementById("loadGeoJSON").addEventListener("click", function () {
  if (vectorLayer != null) {
    map.removeLayer(vectorLayer);
    vectorLayer = null;
  }

  const geoJsonSource = new Vector({
    url: "data/geojsons/bundeslaender_simplify0.geojson", // Pfad zur GeoJSON-Datei relativ zum Webserver
    format: new GeoJSON(),
  });

  vectorLayer = new VectorLayer({
    source: geoJsonSource,
    style: new Style({
      stroke: new Stroke({
        color: "rgba(0, 0, 255, 0.25)", // Ändere hier die Transparenz
        width: 1,
      }),
      fill: new Fill({
        color: "rgba(0, 0, 255, 0.005)",
      }),
    }),
  });

  map.addLayer(vectorLayer);
  if (vectorLayer_landkreis != null) {
    map.removeLayer(vectorLayer_landkreis);
  }

  // Zoom zur GeoJSON-Ausdehnung
  geoJsonSource.once("change", function () {
    if (geoJsonSource.getState() === "ready") {
      map
        .getView()
        .fit(geoJsonSource.getExtent(), { padding: [20, 20, 20, 20] });
    }
  });
});

document
  .getElementById("hideBundesland")
  .addEventListener("click", function () {
    if (vectorLayer) {
      vectorLayer
        .getSource()
        .getFeatures()
        .forEach((feature) => {
          if (selected.has(feature)) {
            selected.delete(feature);
          }
        });
      features.innerHTML = "&nbsp;" + selected.size + " ausgewählte Features";
      map.removeLayer(vectorLayer);
      vectorLayer = null;
    }
  });

document.getElementById("hideLandkreis").addEventListener("click", function () {
  if (vectorLayer_landkreis) {
    vectorLayer_landkreis
      .getSource()
      .getFeatures()
      .forEach((feature) => {
        if (selected.has(feature)) {
          selected.delete(feature);
        }
      });
    features.innerHTML = "&nbsp;" + selected.size + " ausgewählte Features";
    map.removeLayer(vectorLayer_landkreis);
    vectorLayer_landkreis = null;
  }
});

// Loading and processing data

// Funktion zum Hinzufügen von GeoJSON-Daten zur Karte in OpenLayers
//1 für selected und 0 für nicht selected

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
    //console.log(collection_agg);
    //console.log(collection_NONagg);

    //console.log(geojsonData)
    //geojsonData = geojsonData[0];
    //console.log(geojsonData);
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

      addGeoJsonToMap(map, data, 0);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

document
  .getElementById("Bundesländer_Aggregation")
  .addEventListener("click", function () {
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
    loadAggregatedGeoJson_Landkreis_Agg(map); // 'map' ist hier deine vorhandene OpenLayers Karte
  });

//Für ausgewählte Landkreise:

function load_Solarmodules_for_selected_regions(map, landkreise_Bundesländer) {
  // AJAX-Anfrage mit fetch API
  fetch("http://127.0.0.1:5000/load_Solarmodules_for_selected_regions", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(landkreise_Bundesländer),
    method: `POST`,
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
      addGeoJsonToMap(map, data, 1);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

document
  .getElementById("Selektierte_Aggregation")
  .addEventListener("click", function () {
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

    load_Solarmodules_for_selected_regions(map, landkreise_Bundesländer); // 'map' ist hier deine vorhandene OpenLayers Karte
  });

//Für ausgewählte Bundesländer
function load_Solarmodules_for_selected_regions2(map, landkreise_Bundesländer) {
  // AJAX-Anfrage mit fetch API
  fetch("http://127.0.0.1:5000/load_Solarmodules_for_selected_regions2", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(landkreise_Bundesländer),
    method: `POST`,
    credentials: `include`,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      console.log(response);
      return response.json(); // JSON aus der Antwort extrahieren
    })
    .then((data) => {
      // Daten erfolgreich geladen, jetzt zur Karte hinzufügen
      if (data == undefined) console.log("Too much data");
      console.log(data.length);
      addGeoJsonToMap(map, data, 1);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

document
  .getElementById("Selektierte_Aggregation_Bundesland")
  .addEventListener("click", function () {
    //console.log(selected);
    //console.log(selected.entries());
    for (const object of selected) {
      if (landkreise_Bundesländer.includes(object["values_"]["GEN"]) == false)
        landkreise_Bundesländer.push(object["values_"]["GEN"]);
    }
    //landkreise_Bundesländer.forEach((x, i) => console.log(x));
    //console.log('landkreise und bundesländer');
    //console.log(landkreise_Bundesländer);

    load_Solarmodules_for_selected_regions2(map, landkreise_Bundesländer); // 'map' ist hier deine vorhandene OpenLayers Karte
  });

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
const download = document.getElementById("download");
document.getElementById("makeDownload").addEventListener("click", function () {
  var format = new GeoJSON();
  const json = format.writeFeatures(
    vectorLayer_Solar.getSource().getFeatures(),
  );
  download.href =
    "data:application/json;charset=utf-8," + encodeURIComponent(json);
});

//Nur den Layer für Bundesländer anzeigen, wenn relativ nah rangezoomt ist, um Performance zzu u
var currZoom = map.getView().getZoom();
output.innerHTML = "Zoom Level: " + currZoom;
map.on("moveend", function (e) {
  var newZoom = map.getView().getZoom();
  if (currZoom != newZoom) {
    //console.log('zoom end, new zoom: ' + newZoom);
    currZoom = newZoom;
    output.innerHTML = "Zoom Level: " + newZoom;
  }
});
//-------------------------------------------------------
// Auswählen der Features und Anzeigen

//json für features, um feature : content zu erstellen, da die features gefiltert werden, da nicht immer alle Infos interessant sind
let featureContentMap = new Map();
let count = 0;
let popup = null;
let popover = null;

document
  .getElementById("Solarpanels_clickable")
  .addEventListener("click", function () {
    count = 0;
  });

document
  .getElementById("landkreis_bundesland_lickable")
  .addEventListener("click", function () {
    count = 1;
  });
document
  .getElementById("raster_clickable")
  .addEventListener("click", function () {
    count = 2;
  });

const highlightStyle = new Style({
  fill: new Fill({
    color: "#eeeeee",
  }),
  stroke: new Stroke({
    color: "rgba(255, 255, 255, 0.7)",
    width: 2,
  }),
});

let features = document.getElementById("features");
let features_Count = document.getElementById("features_Count");

//Manager for html view for features, so that the faeatures are distributed over html info box

let currentPage = 0;
let pages = [];

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

function showPage(pageIndex) {
  if (pageIndex > 1) currentPage;
  //console.log('pages[currentPage]');
  //console.log(currentPage);
  //console.log(pages[currentPage]);
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

  // Füge den Inhalt jedes <p> in den Array
  paragraphs.forEach((paragraph) => {
    //console.log('Paragraph');
    //console.log('<p>' + paragraph.innerHTML + '</p>');
    contentArray.push("<p>" + paragraph.innerHTML + "</p>");
  });

  //console.log('contentArray');
  //console.log(contentArray);
  pages = [];
  // Teile den Array in Seiten auf

  for (let i = 0; i < contentArray.length; i += paragraphsPerPage) {
    pages.push(contentArray.slice(i, i + paragraphsPerPage));
    //console.log('pages');
    //console.log(pages);
  }
}

//Später für einen Button -> selektieren on/off
let make_Selections = 0;

function generateUniqueId() {
  // Hier können Sie eine Funktion zur Generierung eindeutiger IDs implementieren
  // Beispiel:
  return "feature_" + Math.random(10000000).toString();
}

map.on("click", function (event) {
  map.forEachFeatureAtPixel(event.pixel, function (feature) {
    if (feature.getId() == null) {
      feature.setId(generateUniqueId());
      //console.log('UniqueID:')
      //console.log(feature.getId());
    }
    //console.log(feature);
    const properties = feature.getProperties();
    const geometryType = feature.getGeometry().getType();
    //console.log(properties);
    //console.log(geometryType);
    //console.log(count);

    if (geometryType == "Point" && count == 0) {
      //Pop-Up für als Container für das popover
      popup = new Overlay({
        element: document.getElementById("popup"),
      });

      map.addOverlay(popup);

      let coordinates = feature.getGeometry().getCoordinates();
      popup.setPosition(coordinates);
      //coordinates = (ol.proj.toLonLat(coordinates));

      popover = bootstrap.Popover.getInstance(popup.getElement());
      if (popover) {
        popover.dispose();
      }

      delete properties["geometry"];

      let content = "<p>";

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
        title: "Solar-Panel-Info (Leistung in Kw)",
      });

      popover.show();

      if (make_Selections == 0) {
        if (selected.has(feature)) {
          //console.log('hasFeature');
          // Feature bereits ausgewählt, entfernen
          selected.delete(feature);
          featureContentMap.delete(feature.getId());
          //if(feature.getGeometry().getType()!='Point') feature.setStyle(null); // Entferne den Highlight-Style
        } else {
          // Feature noch nicht ausgewählt, hinzufügen
          selected.add(feature);
          featureContentMap.set(feature.getId(), content);
          //if(feature.getGeometry().getType()!='Point') feature.setStyle(highlightStyle);
        }
      }
      if (selected.size == 0) {
        features_Count.innerHTML =
          "&nbsp;" + selected.size + "ausgewählte Features";
        features.innerHTML = "";
      } else {
        //console.log(featureContentMap.entries());
        let contentString = "";
        for (let [key, value] of featureContentMap.entries()) {
          //console.log(key);
          contentString += value; // Concatenate values
          //console.log('contentString');
          //console.log(contentString);
        }
        features_Count.innerHTML =
          "&nbsp;" + selected.size + " ausgewählte Features";

        createPagedContent(contentString, 2);
        showPage(currentPage);
        //features.innerHTML = contentString;
        //console.log(featureContentMap);
      }
    }
    if (geometryType != "Point" && count == 1) {
      //Pop-Up für als Container für das popover
      popup = new Overlay({
        element: document.getElementById("popup"),
      });

      map.addOverlay(popup);

      //console.log(properties);
      //console.log(properties['GEN']);
      let coordinates = properties["geometry"];
      coordinates = coordinates.getCoordinates();
      //console.log(coordinates);

      //Positionieren des Pop ups
      popup.setPosition(coordinate_click);
      //midpointArray = (ol.proj.toLonLat(midpointArray));

      popover = bootstrap.Popover.getInstance(popup.getElement());
      if (popover) {
        popover.dispose();
      }

      let content = "<p>";

      for (const property in properties) {
        //console.log(property)
        if (
          properties.hasOwnProperty(property) &&
          (property == "BEZ" || property == "GEN" || property == "destatis")
        ) {
          if (property == "destatis") {
            content += `<strong>destatis_population:</strong> ${properties[property]["population"]}<br>`;
            content += `<strong>destatis_population_m:</strong> ${properties[property]["population_m"]}<br>`;
            content += `<strong>destatis_population_w:</strong> ${properties[property]["population_w"]}<br>`;
          } else
            content += `<strong>${property}:</strong> ${properties[property]}<br>`;
        }
      }
      content += `<strong>Koordinaten:</strong> ${coordinate_click}<br>`;
      content += "</p>";

      popover = new bootstrap.Popover(popup.getElement(), {
        animation: false,
        container: popup.getElement(),
        content: content,
        html: true,
        placement: "top",
        title: "Landkreis- oder Bundesland-Info",
      });

      popover.show();

      if (make_Selections == 0) {
        if (selected.has(feature)) {
          // console.log(feature);
          // Feature bereits ausgewählt, entfernen
          selected.delete(feature);
          featureContentMap.delete(feature.getId());

          //if(feature.getGeometry().getType()!='Point') feature.setStyle(null); // Entferne den Highlight-Style
        } else {
          // Feature noch nicht ausgewählt, hinzufügen
          selected.add(feature);
          //console.log(feature);
          //console.log(content);
          //console.log(feature.getId());
          featureContentMap.set(feature.getId(), content);

          //if(feature.getGeometry().getType()!='Point') feature.setStyle(highlightStyle);
        }
      }
      if (selected.size == 0) {
        features_Count.innerHTML =
          "&nbsp;" + selected.size + " ausgewählte Features";
        features.innerHTML = "";
      } else {
        //console.log(featureContentMap.entries());
        let contentString = "";
        for (let [key, value] of featureContentMap.entries()) {
          //console.log(key);
          contentString += value; // Concatenate values
          //console.log('contentString');
          //console.log(contentString);
        }
        features_Count.innerHTML =
          "&nbsp;" + selected.size + " ausgewählte Features";
        createPagedContent(contentString, 2);
        showPage(currentPage);
        //features.innerHTML = contentString;
        //console.log(featureContentMap);
      }
    }
  });
});

document.getElementById("delete").addEventListener("click", function () {
  featureContentMap.clear();
  selected.clear();
  currentPage = 0;
  landkreise_Bundesländer = [];
  features_Count.innerHTML = "&nbsp;" + selected.size + " ausgewählte Features";
  features.innerHTML = "";
});

// Funktion zum Laden der GeoJSON-Daten und Hinzufügen zur vorhandenen Karte in OpenLayers
function loadGeoJson(map) {
  // URL zum GeoJSON-Datensatz
  const url = "/static/data(1).geojson";

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
