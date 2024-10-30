# Solar Energy Map Germany

A web application that visualizes solar panel installations and solar radiation data across Germany, providing insights into solar energy potential and existing infrastructure.

## Table of Contents

- [Introduction](#introduction)
- [Folder Structure](#folder-structure)
  - [Why This Structure?](#why-this-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Initialization Guide](#initialization-guide)
    - [1. CSH-Server](#1-csh-server)
    - [2. solar_energie_dw](#2-solar_energie_dw)
    - [3. preprocessing](#3-preprocessing)
- [Data Availability](#data-availability)
- [Contact](#contact)

## Introduction

The **Solar Energy Map Germany** project is a comprehensive tool designed to analyze and visualize solar energy data across Germany. It combines geospatial data of solar panel installations with solar radiation information to help researchers, policymakers, and the public understand the distribution and potential of solar energy in the region.

## Folder Structure

The repository is organized into three main folders:

1. **CSH-Server**
   - Contains the Flask server.
   - Includes data on solar panels and their coordinates (GeoJSON files).
   - Houses grids for solar radiation data.

2. **solar_energie_dw**
   - Contains the frontend of the application.
   - Includes HTML, JavaScript, and frontend-specific data.

3. **preprocessing**
   - Contains notebooks used for data preprocessing.
   - Geotiff_Notebook for automatic webscrape and preprocessing
   - Prepares the data utilized in the application.

### Why This Structure?

Splitting the server and data warehouse (frontend and backend) is a common practice. This separation enhances:

- **Modularity**: Each component can be developed, tested, and maintained independently.
- **Scalability**: Backend and frontend can be scaled separately based on demand.
- **Maintainability**: Easier to manage codebases that are organized by functionality.
- **Collaboration**: Teams can work simultaneously on different parts without conflicts.

## Getting Started

To run the application locally, follow the instructions below.

### Prerequisites

- **Python 3.x** installed on your machine.
- **Node.js** and **npm** for the frontend.
- A virtual environment tool like `venv` for Python.

### Initialization Guide

#### 1. CSH-Server

This folder contains the Flask server and associated data.

**Steps:**

1. **Navigate to the Directory:**

   ```bash
   cd CSH-Server
   ```

2. **Create Virtual Environment:**

   Create an virtual environment:

   ```bash
   python -m venv C:/path/to/new/virtual/environment
   ```

3. **Activate Virtual Environment:**

    Activate the envicronment
    
    ```bash
    C:/path/to/new/virtual/environment/Scripts/activate
    ```


4. **Install Dependencies:**

   If you haven't already, install the required Python packages:

   ```bash
   pip install -r requirements.txt
   ```

5. **Run the Flask Server:**

   ```bash
   flask --app flaskr run --debug
   ```

   The server will start, typically accessible at `http://localhost:5000`.

#### 2. solar_energie_dw

This folder contains the frontend application.

**Steps:**

1. **Install Node.js and npm:**

   If you don't have Node.js installed, you can install it via terminal:

   ```bash
   # For Debian/Ubuntu
   sudo apt-get install nodejs npm

   # For macOS using Homebrew
   brew install node
   ```

   Alternatively, download the installer from the [official Node.js website](https://nodejs.org/).

2. **Navigate to the Directory:**

   ```bash
   cd solar_energie_dw
   ```

3. **Install Dependencies:**

   ```bash
   npm install
   ```

4. **Start the Frontend Server:**

   ```bash
   npm start
   ```

   The application should now be accessible at the link provided in the terminal. Clicking the link should start the website.

#### 3. preprocessing

This folder contains data preprocessing notebooks.

- **Note:** Running these notebooks is not required to use the application. They are provided for transparency and for those interested in the data preparation process.

---

**Important:** For the application to function fully with all features, **both the backend (CSH-Server) and the frontend (solar_energie_dw)** need to be running simultaneously. It is recommended to use 2 terminals to initialize both.

## Data Availability

The necessary data files are too large to be hosted on GitHub due to storage limitations. These files include detailed geospatial data and solar radiation grids.

- **Data Request:** The data will be provided upon request. Please contact us to obtain the necessary files.
- **Data Placement:** After receiving the data, place it in the following folder structure:

         Solar-Energy-Map-Germany/
      ├── CSH-Server/
      │   └── flaskr/
      │       └── static/                 # Place the 'static' folder here
      ├── Preprocessing/
      │   └── Marktstammdatenregister/
      │       └── data_raw/               # Place the 'data_raw' folder here
      ├── solar_energie_dw/
         ├── data/                       # Place the 'data' folder here
         └── node_modules/               # Place the 'node_modules' folder here


## Contact

For questions or to request data access, please contact:

- **Email:** basti.loeblein@gmx.de

---

Thank you for your interest in the Solar Energy Map Germany project!
