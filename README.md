This project is an AI-powered travel route recommendation system for Xiamen. It combines a local JSON knowledge base, DeepSeek-based route generation, and a custom STCF filtering algorithm to produce scenario-aware and more reliable travel plans.

The system supports different travel intentions, including food, culture, scenery, night travel, and relaxed citywalk-style trips. It also provides a map page for route search and a chat page for AI travel planning.

## Features

* AI travel planning for Xiamen
* DeepSeek-based initial route generation
* Local RAG retrieval from JSON knowledge files
* STCF filtering algorithm for POI selection and optimization
* Scenario-aware POI ranking
* Support for food, culture, scenery, night, and relaxed travel requests
* Chat interface with process display
* Map route planning with AMap
* Local storage for chat and map page state
* Experiment scripts for route generation evaluation

## Project Structure

```text
RECOMMENDER-SYSTEM-DEMO/
├── public/
├── server/
│   ├── algorithm/
│   ├── experiment_outputs/
│   ├── knowledge/
│   ├── map/
│   ├── rag/
│   ├── utils/
│   ├── .env
│   ├── experiment_queries.json
│   ├── experiment.js
│   ├── index.js
│   ├── plot.py
│   └── stcfAlgorithm.js
├── src/
│   ├── components/
│   ├── pages/
│   │   ├── ChatPage.js
│   │   └── MapPage.js
│   ├── App.css
│   ├── App.js
│   ├── App.test.js
│   ├── index.css
│   ├── index.js
│   ├── logo.svg
│   ├── reportWebVitals.js
│   ├── setupTests.js
│   └── theme.js
├── .gitignore
├── package-lock.json
├── package.json
├── postcss.config.js
├── README.md
└── tailwind.config.js
```

## Technology Stack

### Frontend

* React
* Material UI
* Tailwind CSS
* React Markdown
* AMap JavaScript API

### Backend

* Node.js
* Express
* Axios
* CORS
* Dotenv
* DeepSeek API
* Local JSON-based RAG
* Custom STCF filtering algorithm

## Core Workflow

The travel planning workflow is:

1. The user enters a travel request in the chat interface.
2. The backend sends the request to DeepSeek to generate an initial route draft.
3. The system extracts possible POI names from the draft.
4. Local RAG retrieves relevant JSON knowledge files from `server/knowledge/`.
5. The STCF algorithm extracts, filters, ranks, and validates POIs.
6. The backend sends the final optimized travel plan back to the frontend.
7. The frontend displays the final route, retrieved POIs, removed POIs, and process logs.

## STCF Filtering Algorithm

The STCF algorithm is used to improve the reliability of AI-generated travel routes.

It includes:

* POI extraction from local JSON knowledge files
* Intent parsing
* Semantic matching
* Temporal filtering
* Constraint filtering
* Route role matching
* POI de-duplication
* Hierarchy conflict removal
* Scenario quota control
* POI ranking
* Final route optimization

## Environment Variables

Create a `.env` file before running the project.

Example:

```env
PORT=5000
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_TIMEOUT_MS=300000
DEEPSEEK_MAX_TOKENS=2200
LOCAL_KNOWLEDGE_DIR=./server/knowledge
RAG_TOP_K=18

REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_AMAP_KEY=your_amap_key_here
REACT_APP_AMAP_SECURITY_CODE=your_amap_security_code_here
```

## Installation

Install project dependencies:

```bash
npm install
```

## Run the Project

This project needs both the backend and frontend to run.

### Step 1: Start the backend

Open a terminal in the project root folder and run:

```bash
node server/index.js
```

The backend usually runs on:

```text
http://localhost:5000
```

### Step 2: Start the frontend

Open another terminal in the project root folder and run:

```bash
npm start
```

The frontend usually runs on:

```text
http://localhost:3000
```

### Step 3: Open the system

Open the browser and visit:

```text
http://localhost:3000
```

Then use the Chat Page to generate Xiamen travel plans, or use the Map Page to search routes inside Xiamen.

## How to Use

After starting both the frontend and backend, open:

```text
http://localhost:3000
```

The system mainly provides two pages:

1. Chat Page
2. Map Page

## 1. Use the Chat Page

The Chat Page is used to generate AI travel routes for Xiamen.

### Steps

1. Open the Chat Page.
2. Enter a travel request in the input box.
3. Click the send button.
4. Wait for the system to generate the travel plan.
5. The final route will be displayed in the chat window.
6. The process panel will show the DeepSeek draft, local RAG retrieval process, selected POIs, removed POIs, and filtering results.

### Example Prompts

```text
One-day Xiamen food and culture route
```

```text
Plan a relaxed two-day Xiamen citywalk route
```

```text
I want a one-day scenic route in Xiamen with beaches and sea views
```

```text
Plan a Xiamen night travel route with food and views
```

The system first uses DeepSeek to generate an initial draft, then retrieves relevant POI information from the local JSON knowledge base, and finally applies the STCF filtering algorithm to remove unsuitable POIs and optimize the final route.

## 2. Use the Map Page

The Map Page is used for route search and navigation-style planning inside Xiamen.

### Steps

1. Open the Map Page.
2. Enter a start address.
3. Enter an end address.
4. Select the route type:

   * Driving
   * Transit
5. Click the route planning button.
6. The system will display the route on the map.
7. The route history will be saved locally in the browser.

### Example Addresses

```text
Xiamen Railway Station
```

```text
Gulangyu Ferry Terminal
```

```text
Zhongshan Road Pedestrian Street
```

```text
Xiamen University
```

The map search is limited to Xiamen. If the address is outside Xiamen or cannot be resolved, the system will show an error message.

## 3. View the Filtering Process

After submitting a travel request in the Chat Page, the system displays several process sections.

### DeepSeek Draft Process

This section shows the initial route generated by DeepSeek.

### Local RAG Process

This section shows how local knowledge files are retrieved from the JSON knowledge base.

### Filtering Process

This section shows how the STCF algorithm filters and optimizes POIs.

### POIs Kept After Filtering

This section shows the final selected POIs used in the optimized route.

### POIs Removed by Filtering

This section shows removed POIs and their removal reasons.

### Rejected Claims

This section shows unsupported or unreliable route claims removed from the final answer.

These process sections help users understand why some POIs are selected and why others are removed.

## 4. Modify the Local Knowledge Base

The local knowledge base is stored in:

```text
server/knowledge/
```

To add a new POI:

1. Create a new `.json` file inside `server/knowledge/`.
2. Follow the same POI JSON structure as the existing files.
3. Restart the backend server.
4. Submit a new travel request in the Chat Page.

The backend currently reads JSON files only. Markdown files are not required.

## POI JSON Structure

Each POI file can include fields such as:

```json
{
  "id": "XM001",
  "name": "鼓浪屿",
  "english_name": "Gulangyu Island",
  "pinyin": "Gulangyu",
  "city": "厦门",
  "district": "思明区",
  "address": "厦门市思明区鼓浪屿",
  "location": {
    "lat": 24.447,
    "lng": 118.067
  },
  "time": {
    "open_time": "08:00",
    "close_time": "18:00",
    "recommended_duration_min": 180,
    "best_visit_time": "morning",
    "night_available": true,
    "closed_day": null
  },
  "semantic": {
    "main_category": "scenery",
    "secondary_categories": ["culture", "heritage"],
    "tags": ["island", "architecture", "sea view"],
    "scenarios": ["scenery", "culture", "relaxed"],
    "style": "classic"
  },
  "EIRE": {
    "entity": ["鼓浪屿", "Gulangyu"],
    "intent": ["sightseeing", "culture"],
    "relation": ["near ferry terminal"],
    "environment": ["island", "seaside"]
  },
  "route_role": {
    "primary_for": ["scenery", "culture"],
    "secondary_for": ["relaxed"],
    "avoid_for": [],
    "recommended_time_slots": ["morning", "afternoon"],
    "not_recommended_time_slots": []
  },
  "route_constraints": {
    "can_be_standalone_stop": true,
    "can_be_combined_with": ["ferry terminal", "museum"],
    "should_not_split_area_across_days": true,
    "max_same_area_pois_per_day": 3,
    "min_visit_gap_min": 0
  },
  "score": {
    "popularity": 0.95,
    "niche": 0.3,
    "rating": 4.8,
    "scenery_score": 0.95,
    "culture_score": 0.85,
    "food_score": 0.2,
    "relaxed_score": 0.75
  }
}
```

## API Endpoint

### Travel Plan API

```http
POST /api/travel-plan
```

Request body:

```json
{
  "message": "One-day Xiamen food and culture route"
}
```

Response includes:

* final answer
* detected intent
* selected POIs
* removed POIs
* rejected claims
* process logs
* draft answer
* optimized draft
* debug information

## Run Experiments

The project includes experiment files for evaluating route generation methods.

To run the experiment script:

```bash
node server/experiment.js
```

Experiment queries are stored in:

```text
server/experiment_queries.json
```

Experiment outputs are stored in:

```text
server/experiment_outputs/
```

If you need to visualize experiment results, use:

```bash
python server/plot.py
```

## Main Files

### `server/index.js`

The backend entry file. It sets up the Express server, loads environment variables, calls DeepSeek, reads local knowledge files, performs local RAG retrieval, and returns the travel plan result to the frontend.

### `server/stcfAlgorithm.js`

The main filtering algorithm file. It handles POI extraction, intent parsing, semantic filtering, temporal filtering, constraint filtering, ranking, and route optimization.

### `src/pages/ChatPage.js`

The main AI travel planning interface. It sends user requests to the backend, displays the generated answer, and shows the reasoning process sections such as DeepSeek draft, local RAG process, filtering process, kept POIs, and removed POIs.

### `src/pages/MapPage.js`

The route search and map interface. It uses AMap to provide driving and transit route planning inside Xiamen.

## Example Use Case

User input:

```text
One-day Xiamen food and culture route
```

The system may generate a route containing food and cultural POIs such as:

```text
Morning: 中山路步行街 (Zhongshan Road Pedestrian Street)
Noon: 八市 (Bashi Market)
Afternoon: 沙坡尾 (Shapowei)
Evening: Local food and night walk area
```

The final output depends on the local knowledge base, the DeepSeek draft, and the STCF filtering result.

## Notes

* The backend requires a valid DeepSeek API key.
* The map page requires a valid AMap API key and security code.
* The local knowledge base should use JSON files.
* The frontend communicates with the backend through `REACT_APP_API_BASE_URL`.
* If the backend is not running, the Chat Page will show a request failure message.
* If the map API key is invalid, the Map Page may fail to load.
* If the local knowledge base path is incorrect, the RAG process may return no relevant POIs.

## License

This project is for academic and demonstration purposes.
