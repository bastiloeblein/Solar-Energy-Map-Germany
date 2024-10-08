import os
import orjson
import time
from flask import Flask
from flask import request, jsonify
import json
from flask_cors import CORS, cross_origin
import logging
from flask import g
from flask import Flask
from flask_caching import Cache
import tempfile

# Initialize the logger with timestamps
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# App Factory
def create_app(test_config=None):
    # Create and configure the Flask app
    app = Flask(__name__, instance_relative_config=True)
    app.logger.setLevel(logging.DEBUG)
    app.config["MONGO_URI"] = "mongodb://localhost:27017/"
    CORS(app, support_credentials=True)
    """
    mongo = PyMongo(app)

    uri = "mongodb://localhost:27017/"
    # Create a new client and connect to the server
    client = MongoClient(uri)

    #client['__my_database__']
    #db = client.get_database
    # Send a ping to confirm a successful connection
    try:
        client.admin.command('ping')
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(e)

    db = Database(client=client, name='db')

    #db = client[client.database.name]
    #db.user.count_documents({'name': 'NickoK'})

    #result = db.user.insert_one({'name': 'NickoK'})
    #result.inserted_id

    #print(db.user.find_one({'name': 'NickoK'}))

    #app.config.from_mapping(
    #    SECRET_KEY='dev',
    #    DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    #)
    """

    # Flask configuration
    app.config['CACHE_TYPE'] = 'FileSystemCache'
    app.config['CACHE_DIR'] = 'flaskr/flask_cache'  # Cache directory
    app.config['CACHE_DEFAULT_TIMEOUT'] = 3600  # Cache timeout set to 1 hour

    cache = Cache(app)

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    app.config["CORS_HEADERS"] = "Content-Type"


    def custom_cache_key(*args, **kwargs):
        """
        Custom cache key generation based on the paths and orgaeinheit.
        """
        # Assuming args[0] contains the 'paths' list
        paths = args[0]
        # Check if orgaeinheit is passed via kwargs (if passed explicitly)
        orgaeinheit = kwargs.get('orgaeinheit', '')

        # Return a unique key combining orgaeinheit and paths
        return f"{orgaeinheit}_{'_'.join(paths)}"

       # Load the geojson data with caching
    @cache.cached(timeout=3600, key_prefix='geojson_data', make_cache_key=custom_cache_key)
    def load_geojson_data(paths: list, orgaeinheit: str):
        """
        Load the GeoJSON data from the provided paths. If the data is already cached, 
        it is retrieved from the cache. Otherwise, it's loaded from the file system 
        and cached for future use.
        """
        start_time = time.time()
        geojson_data_list = []

        for path in paths:
            logging.info(f"Start loading {path}")

            # Determine the cache key based on the file path
            if "features_landkreis_agg.geojson" in path:
                logging.info("Landkreise")
                # cache_key = 'data_landkreise'
            if "data.geojson" in path:
                logging.info("geojson")
                # cache_key = 'data_geojson'
            if "features_bund_agg.geojson" in path:
                logging.info("Bundesland")
                # cache_key = 'data_bundeslaender'

            # Load from file
            with open(path, "rb") as f:
                geojson_data = orjson.loads(f.read())

            load_time = time.time() - start_time
            logging.info(f"Finished loading {path} in {load_time:.2f} seconds")
            geojson_data_list.append(geojson_data)

        # Return data (tuple if 2 datasets)
        if len(geojson_data_list) == 1:
            return geojson_data_list[0]
        elif len(geojson_data_list) == 2:
            return tuple(geojson_data_list)
        else:
            raise ValueError("Expected 1 or 2 paths, but received more.")

     # Calculate various aggregations by Landkreis
    @app.route("/landkreis_Aggregation", methods=["GET"])
    def landkreis_Features():
        """
        Aggregates data by 'Landkreis' from the 'data.geojson' file and returns the
        aggregated data as a GeoJSON FeatureCollection.
        """
        with open("flaskr/static/data.geojson") as f:
            data = json.load(f)

        aggregated_data = {}
        for feature in data["features"]:
            properties = feature["properties"]
            if properties["Betriebs-Status"] == "In Betrieb":
                landkreis = properties["Landkreis"]
                if landkreis not in aggregated_data:
                    aggregated_data[landkreis] = {
                        "Bruttoleistung der Einheit": 0,
                        "Nettonennleistung der Einheit": 0,
                        "Anzahl der Solar-Module": 0,
                        "Anzahl der Einheiten": 0,
                        "Koordinaten": [],
                    }
                aggregated_data[landkreis]["Bruttoleistung der Einheit"] += properties[
                    "Bruttoleistung der Einheit"
                ]
                aggregated_data[landkreis][
                    "Nettonennleistung der Einheit"
                ] += properties["Nettonennleistung der Einheit"]
                if properties["Anzahl der Solar-Module"] is not None:
                    aggregated_data[landkreis]["Anzahl der Solar-Module"] += properties[
                        "Anzahl der Solar-Module"
                    ]
                aggregated_data[landkreis]["Anzahl der Einheiten"] += 1
                aggregated_data[landkreis]["Koordinaten"].append(
                    feature["geometry"]["coordinates"]
                )

        # Calculate average coordinates for each Landkreis
        for landkreis in aggregated_data:
            landkreis_average_coordinates = [
                sum(coord) / len(coord)
                for coord in zip(*aggregated_data[landkreis]["Koordinaten"])
            ]
            aggregated_data[landkreis]["geometry"] = {
                "type": "Point",
                "coordinates": landkreis_average_coordinates,
            }

        # Build GeoJSON FeatureCollection
        features = []
        for landkreis in aggregated_data:
            feature = {
                "type": "Feature",
                "properties": {
                    "Landkreis": landkreis,
                    "Bruttoleistung aller Einheiten (ges.)": aggregated_data[landkreis][
                        "Bruttoleistung der Einheit"
                    ],
                    "Nettonennleistung aller Einheiten (ges.)": aggregated_data[landkreis][
                        "Nettonennleistung der Einheit"
                    ],
                    "Anzahl aller Solar-Module (ges.)": aggregated_data[landkreis][
                        "Anzahl der Solar-Module"
                    ],
                    "Anzahl aller Einheiten (ges.)": aggregated_data[landkreis][
                        "Anzahl der Einheiten"
                    ],
                },
                "geometry": aggregated_data[landkreis]["geometry"],
            }
            features.append(feature)

        # Return aggregated data as GeoJSON
        aggregated_geojson = {"type": "FeatureCollection", "features": features}
        return jsonify(aggregated_geojson)

    # Send Computed Landkreis Aggregation
    @app.route("/send_Computed_LandkreisAggregation", methods=["GET"])
    def send_Computed_LandkreisAggregation():
        """
        Sends pre-computed aggregation data for Landkreise from 'features_landkreis_agg.geojson'.
        """
        with open("flaskr/static/features_landkreis_agg.geojson") as f:
            data = json.load(f)

        features = []
        for feature in data["features"]:
            properties = feature["properties"]
            geometry = feature["geometry"]

            # Modify the keys and their order
            new_properties = {
                "Landkreis": properties["Landkreis"],
                "Anzahl aller Einheiten (ges.)": properties["Anzahl der Einheiten"],
                "Anzahl aller Solar-Module (ges.)": properties["Anzahl der Solar-Module"],
                "Bruttoleistung aller Einheiten (ges.)": properties["Bruttoleistung der Einheit"],
                "Nettonennleistung aller Einheiten (ges.)": properties["Nettonennleistung der Einheit"],
            }

            # Construct the new feature with updated properties
            newFeature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": new_properties,
            }
            features.append(newFeature)

        # Return the final GeoJSON structure
        solar_geojson = {"type": "FeatureCollection", "features": features}
        return jsonify(solar_geojson)

    # Send Computed Landkreise Aggregation for selected regions
    @app.route("/send_Computed_LandkreisAggregation_selected", methods=["POST"])
    @cross_origin(supports_credentials=True)
    def send_Computed_LandkreisAggregation_selected():
        """
        Sends aggregation data for the selected Landkreise from 'features_landkreis_agg.geojson'.
        """
        with open("flaskr/static/features_landkreis_agg.geojson") as f:
            data = json.load(f)

        landkreis_bundesland = request.get_json()
        features = []
        for feature in data["features"]:
            properties = feature["properties"]
            geometry = feature["geometry"]
            if properties["Landkreis"] in landkreis_bundesland:
                newFeature = {
                    "type": "Feature",
                    "properties": properties,
                    "geometry": geometry,
                }
                features.append(newFeature)

        # Return filtered GeoJSON
        solar_geojson = {"type": "FeatureCollection", "features": features}
        return jsonify(solar_geojson)

    # Aggregation for Bundesland
    @app.route("/bundeslandAggregation", methods=["GET"])
    def bundeslandAggregation():
        """
        Aggregates data by 'Bundesland' from 'data.geojson' and returns the
        aggregated data as a GeoJSON FeatureCollection.
        """
        with open("flaskr/static/data.geojson") as f:
            data = json.load(f)

        aggregated_data = {}
        for feature in data["features"]:
            properties = feature["properties"]
            if properties["Betriebs-Status"] == "In Betrieb":
                bundesland = properties["Bundesland"]
                if bundesland not in aggregated_data:
                    aggregated_data[bundesland] = {
                        "Bruttoleistung der Einheit": 0,
                        "Nettonennleistung der Einheit": 0,
                        "Anzahl der Solar-Module": 0,
                        "Anzahl der Einheiten": 0,
                        "Koordinaten": [],
                    }
                aggregated_data[bundesland]["Bruttoleistung der Einheit"] += properties[
                    "Bruttoleistung der Einheit"
                ]
                aggregated_data[bundesland][
                    "Nettonennleistung der Einheit"
                ] += properties["Nettonennleistung der Einheit"]
                if properties["Anzahl der Solar-Module"] is not None:
                    aggregated_data[bundesland]["Anzahl der Solar-Module"] += properties[
                        "Anzahl der Solar-Module"
                    ]
                aggregated_data[bundesland]["Anzahl der Einheiten"] += 1
                aggregated_data[bundesland]["Koordinaten"].append(
                    feature["geometry"]["coordinates"]
                )

        for bundesland in aggregated_data:
            bundesland_average_coordinates = [
                sum(coord) / len(coord)
                for coord in zip(*aggregated_data[bundesland]["Koordinaten"])
            ]
            aggregated_data[bundesland]["geometry"] = {
                "type": "Point",
                "coordinates": bundesland_average_coordinates,
            }

        features = []
        for bundesland in aggregated_data:
            feature = {
                "type": "Feature",
                "properties": {
                    "Bundesland": bundesland,
                    "Bruttoleistung aller Einheiten (ges.)": aggregated_data[bundesland][
                        "Bruttoleistung der Einheit"
                    ],
                    "Nettonennleistung aller Einheiten (ges.)": aggregated_data[bundesland][
                        "Nettonennleistung der Einheit"
                    ],
                    "Anzahl aller Solar-Module (ges.)": aggregated_data[bundesland][
                        "Anzahl der Solar-Module"
                    ],
                    "Anzahl aller Einheiten (ges.)": aggregated_data[bundesland][
                        "Anzahl der Einheiten"
                    ],
                },
                # "geometry": aggregated_data[bundesland]["geometry"],  # Uncomment if needed
            }
            features.append(feature)

        # Return aggregated data as GeoJSON
        aggregated_geojson = {"type": "FeatureCollection", "features": features}
        return jsonify(aggregated_geojson)

    @app.route("/send_Computed_bundeslandAggregation", methods=["GET"])
    def send_Computed_bundeslandAggregation():
        with open(
            "flaskr/static/features_bund_agg.geojson"
        ) as f:
            data = json.load(f)

        print(data)
    
        features = []
        for feature in data["features"]:
            properties = feature["properties"]
            geometry = feature["geometry"]

            # Modify the keys and their order here
            new_properties = {
                "Bundesland": properties["Bundesland"],  # Keep the key as "Bundesland"
                "Anzahl aller Einheiten (ges.)": properties["Anzahl der Einheiten"],  # Renamed and reordered key
                "Anzahl aller Solar-Module (ges.)": properties["Anzahl der Solar-Module"],  # Renamed and reordered key
                "Bruttoleistung aller Einheiten (ges.)": properties["Bruttoleistung der Einheit"],  # Renamed and reordered key
                "Nettonennleistung aller Einheiten (ges.)": properties["Nettonennleistung der Einheit"],  # Renamed and reordered key
            }

            # Construct the new feature with updated properties
            newFeature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": new_properties,
            }
            features.append(newFeature)

        # Create the final GeoJSON structure
        solar_geojson = {"type": "FeatureCollection", "features": features}

        # Print the final structure for debugging
        print(solar_geojson)

        return jsonify(solar_geojson)
    
    ## Works
    @app.route("/load_Solarmodules_for_selected_regions", methods=["POST"])
    @cross_origin(supports_credentials=True)
    def load_Solarmodules_for_selected_regions():
        """
        Loads selected Solar Modules for Landkreise/Bundesländer from the appropriate files 
        based on the 'orgaeinheit' (either 'Landkreis' or 'Bundesland').
        """
        logging.info("Handling request for index page")

        # Get orgaeinheit and list of selected Bundesland/Landkreis from the request JSON body
        request_data = request.get_json()
        landkreise_Bundesländer = request_data.get("landkreise_Bundesländer")
        orgaeinheit = request_data.get("orgaeinheit")
        logging.info(f"Ausgewählte Organisationseinheit: {orgaeinheit}")
        logging.info(f"Einheit {landkreise_Bundesländer}")

        # Validate orgaeinheit
        if not orgaeinheit:
            return app.response_class(
                response="Missing orgaeinheit in request",
                status=400,
                mimetype="application/json"
            )
        
        # Initialize paths with data.geojson as always required
        paths = ["flaskr/static/data.geojson"]

        # Conditionally load Landkreis or Bundesland aggregation file
        if orgaeinheit == "Landkreis":
            paths.append("flaskr/static/features_landkreis_agg.geojson")
        elif orgaeinheit == "Bundesland":
            paths.append("flaskr/static/features_bund_agg.geojson")
            landkreise_Bundesländer =  [item.split(" ")[-1] for item in landkreise_Bundesländer] # In order to make matching work 

        # Convert the list to a tuple, so it's hashable
        paths_tuple = tuple(paths)
        logging.info(paths_tuple)

        # Load the data from the files
        data_geojson, data_orgaeinheit = load_geojson_data(paths_tuple, orgaeinheit)  
        logging.info(f"Data {type(data_orgaeinheit)}")

        # Filter the combined features based on the selected Landkreise/Bundesländer
        start_time = time.time()
        features = []
        logging.info("Start Filtering for selected Organisationseinheiten")

        for feature in data_orgaeinheit["features"]:
            properties = feature["properties"]
            geometry = feature["geometry"]
            if properties[orgaeinheit] in landkreise_Bundesländer:
                newFeature = {
                    "type": "Feature",
                    "properties": properties,
                    "geometry": geometry,
                }
                features.append(newFeature)

        for feature in data_geojson["features"]:
            properties = feature["properties"]
            geometry = feature["geometry"]
            if properties[orgaeinheit] in landkreise_Bundesländer:
                newFeature = {
                    "type": "Feature",
                    "properties": properties,
                    "geometry": geometry,
                }
                features.append(newFeature)

        app.logger.debug(f"Features added {len(features)}")

        load_time = time.time() - start_time
        logging.info(f"Finished filtering data in {load_time:.2f} seconds")

        # Prüfen, ob die Liste `features` leer ist
        if not features:
            return app.response_class(
                response=orjson.dumps({
                    "message": "Für den gesuchten Bereich haben wir leider keine Anlagen gefunden",
                    "features": []  # Leere Feature-Liste
                }),
                mimetype="application/json"
            )

        # Create the final GeoJSON output
        solar_geojson = {"type": "FeatureCollection", "features": features}

        # Return the JSON response using orjson for faster serialization
        return app.response_class(
            response=orjson.dumps(solar_geojson),
            mimetype="application/json"
        )


    ## Works
    # @app.route("/load_Solarmodules_for_selected_regions", methods=["POST"])
    # @cross_origin(supports_credentials=True)
    # def load_Solarmodules_for_selected_regions():
    #     """
    #     Loads selected Solar Modules for Landkreise/Bundesländer from the appropriate files 
    #     based on the 'orgaeinheit' (either 'Landkreis' or 'Bundesland').
    #     """
    #     logging.info("Handling request for index page")

    #     # Get orgaeinheit and list of selected Bundesland/Landkreis from the request JSON body
    #     request_data = request.get_json()
    #     landkreise_Bundesländer = request_data.get("landkreise_Bundesländer")
    #     orgaeinheit = request_data.get("orgaeinheit")
    #     logging.info(f"Ausgewählte Organisationseinheit: {orgaeinheit}")

    #     # Validate orgaeinheit
    #     if not orgaeinheit:
    #         return app.response_class(
    #             response="Missing orgaeinheit in request",
    #             status=400,
    #             mimetype="application/json"
    #         )
        
    #     paths = []

    #     if orgaeinheit == "Landkreis":
    #         paths = ["flaskr/static/data.geojson", "flaskr/static/features_landkreis_agg.geojson"]
    #     if orgaeinheit == "Bundesland":
    #         paths = ["flaskr/static/data.geojson", "flaskr/static/features_bund_agg.geojson"]

    #     # Convert the list to a tuple, so it's hashable
    #     paths_tuple = tuple(paths)
    #     logging.info(f"Paths: {paths_tuple}")

    #     # Load the data from the files
    #     data_geojson, data_orgaeinheit = load_geojson_data(paths_tuple)  
    #     logging.info(f"Data {type(data_orgaeinheit)}")

    #     # Filter the combined features based on the selected Landkreise/Bundesländer
    #     start_time = time.time()
    #     features = []
    #     logging.info("Start Filtering for selected Organisationseinheiten")

    #     # logging.info(f"Keys f{data_orgaeinheit["features"].keys()}")
    #     logging.info(f"First feature {data_orgaeinheit["features"][0]}")
    #     for feature in data_orgaeinheit["features"]:
    #         # logging.info(f"Feature f{feature}")
    #         properties = feature["properties"]
    #         # logging.info(f"properties f{properties}")
    #         geometry = feature["geometry"]
    #         if properties[orgaeinheit] in landkreise_Bundesländer:
    #         # if orgaeinheit in properties and properties[orgaeinheit] in landkreise_Bundesländer:

    #             newFeature = {
    #                 "type": "Feature",
    #                 "properties": properties,
    #                 "geometry": geometry,
    #             }
    #             features.append(newFeature)

    #     # logging.info(f"Keys f{data_geojson["features"].keys()}")
    #     logging.info(f"First feature {data_orgaeinheit["features"][0]}")
    #     for feature in data_geojson["features"]:
    #         properties = feature["properties"]
    #         geometry = feature["geometry"]
    #         if properties[orgaeinheit] in landkreise_Bundesländer:
    #         # if orgaeinheit in properties and properties[orgaeinheit] in landkreise_Bundesländer:
    #             newFeature = {
    #                 "type": "Feature",
    #                 "properties": properties,
    #                 "geometry": geometry,
    #             }
    #             features.append(newFeature)

    #     app.logger.debug(f"Features added {len(features)}")

    #     load_time = time.time() - start_time
    #     logging.info(f"Finished filtering data in {load_time:.2f} seconds")

    #     # Create the final GeoJSON output
    #     solar_geojson = {"type": "FeatureCollection", "features": features}

    #     # Return the JSON response using orjson for faster serialization
    #     return app.response_class(
    #         response=orjson.dumps(solar_geojson),
    #         mimetype="application/json"
    #     )

    # Berechnung von Solarpotenzialanalyse, wobei von folgender m^2-Werten ausgegangen wird: Pro Modul 2 m^2
    @app.route("/solarPotenzial", methods=["POST"])
    def solarPotenzial():

        with open(
            "flaskr/static/data.geojson"
        ) as f:
            geojson = json.load(f)

        data = request.get_json()
        print(data)

        for feature in geojson["features"]:
            print(type(feature["properties"]["Postleitzahl"]))
            break
        # Filter Features nach der Eigenschaft "AGS"
        result = [
            feature
            for feature in geojson["features"]
            if (feature["properties"]["Postleitzahl"]) == "35463"
        ]

        # print(result)
        # for feature in result:
        #    feature['properties']['NettoStrom'] = feature['properties']['BEV_Netto'] + feature['properties']['PV_Netto'] + feature['properties']['Wind_Netto']

        return jsonify(result)

    return app

# Create and run the Flask app
app = create_app()
if __name__ == "__main__":
    app.run()
