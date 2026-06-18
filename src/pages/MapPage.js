import React, { useState, useEffect, useRef, useCallback } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";

import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  Alert,
  CircularProgress,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from "@mui/material";

import {
  MapOutlined,
  DirectionsOutlined,
  DirectionsCarOutlined,
  DirectionsBusOutlined,
} from "@mui/icons-material";

const MAP_PAGE_STORAGE_KEY = "xiamen-map-page-state";
const MAP_PAGE_UPDATED_EVENT = "xiamen-map-page-state-updated";
const ROUTE_HISTORY_SELECTED_EVENT = "xiamen-route-history-selected";

const DEFAULT_STATE = {
  startAddress: "Xiamen Railway Station",
  endAddress: "Gulangyu Ferry Terminal",
  routeType: "drive",
  routeHistory: [],
};

const loadMapPageState = () => {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(MAP_PAGE_STORAGE_KEY) || "{}"
    );

    return {
      startAddress: saved.startAddress || DEFAULT_STATE.startAddress,
      endAddress: saved.endAddress || DEFAULT_STATE.endAddress,
      routeType: saved.routeType || DEFAULT_STATE.routeType,
      routeHistory: Array.isArray(saved.routeHistory)
        ? saved.routeHistory
        : DEFAULT_STATE.routeHistory,
    };
  } catch {
    return DEFAULT_STATE;
  }
};

const createRouteId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatTime = () => {
  return new Date().toLocaleString("en-AU", {
    hour12: false,
  });
};

const MapPage = () => {
  const [initialState] = useState(loadMapPageState);

  const [startAddress, setStartAddress] = useState(initialState.startAddress);
  const [endAddress, setEndAddress] = useState(initialState.endAddress);
  const [routeType, setRouteType] = useState(initialState.routeType);
  const [routeHistory, setRouteHistory] = useState(initialState.routeHistory);

  const [startOptions, setStartOptions] = useState([]);
  const [endOptions, setEndOptions] = useState([]);

  const [isPlanning, setIsPlanning] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const [alertInfo, setAlertInfo] = useState({
    open: false,
    msg: "",
    type: "info",
  });

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const drivingRef = useRef(null);
  const busRef = useRef(null);
  const geocoderRef = useRef(null);
  const autoCompleteRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const state = {
      startAddress,
      endAddress,
      routeType,
      routeHistory,
    };

    window.localStorage.setItem(MAP_PAGE_STORAGE_KEY, JSON.stringify(state));

    window.dispatchEvent(
      new CustomEvent(MAP_PAGE_UPDATED_EVENT, {
        detail: state,
      })
    );
  }, [startAddress, endAddress, routeType, routeHistory]);

  useEffect(() => {
    const handleSelectedHistory = (event) => {
      const item = event.detail;
      if (!item) return;

      if (item.startAddress) setStartAddress(item.startAddress);
      if (item.endAddress) setEndAddress(item.endAddress);
      if (item.routeType) setRouteType(item.routeType);
    };

    window.addEventListener(
      ROUTE_HISTORY_SELECTED_EVENT,
      handleSelectedHistory
    );

    return () => {
      window.removeEventListener(
        ROUTE_HISTORY_SELECTED_EVENT,
        handleSelectedHistory
      );
    };
  }, []);

  const showAlert = (msg, type) => {
    setAlertInfo({ open: true, msg, type });
  };

  const closeAlert = () => {
    setAlertInfo((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    if (mapRef.current) return;

    window._AMapSecurityConfig = {
      securityJsCode: process.env.REACT_APP_AMAP_SECURITY_CODE,
    };

    AMapLoader.load({
      key: process.env.REACT_APP_AMAP_KEY,
      version: "2.0",
      plugins: [
        "AMap.Scale",
        "AMap.ToolBar",
        "AMap.Driving",
        "AMap.Transfer",
        "AMap.Geocoder",
        "AMap.AutoComplete",
      ],
    })
      .then((AMap) => {
        setTimeout(() => {
          if (!mapContainerRef.current) return;

          mapRef.current = new AMap.Map(mapContainerRef.current, {
            viewMode: "3D",
            lang: "en",
            zoom: 12,
            center: [118.089468, 24.490403],
          });

          mapRef.current.addControl(new AMap.Scale());
          mapRef.current.addControl(new AMap.ToolBar());

          drivingRef.current = new AMap.Driving({
            map: mapRef.current,
            autoFitView: true,
          });

          busRef.current = new AMap.Transfer({
            map: mapRef.current,
            city: "厦门",
            policy: AMap.TransferPolicy.LEAST_TIME,
            autoFitView: true,
          });

          geocoderRef.current = new AMap.Geocoder({
            city: "厦门",
          });

          autoCompleteRef.current = new AMap.AutoComplete({
            city: "厦门",
            citylimit: true,
          });

          setMapLoading(false);
          showAlert(
            "✅ Map loaded successfully. City is limited to Xiamen.",
            "success"
          );
        }, 0);
      })
      .catch((e) => {
        console.error(e);
        setMapError(e.message);
        setMapLoading(false);
        showAlert("❌ Failed to load the map.", "error");
      });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  const isLocationInXiamen = (location) => {
    const lng = Number(location?.lng);
    const lat = Number(location?.lat);

    return (
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      lng >= 117.8 &&
      lng <= 118.5 &&
      lat >= 24.2 &&
      lat <= 24.95
    );
  };

  const getNumberValue = (...values) => {
    for (const value of values) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }

    return 0;
  };

  const formatDurationText = (minutes) => {
    const num = Number(minutes);

    if (!Number.isFinite(num) || num <= 0) {
      return "time unavailable";
    }

    return `${num} min`;
  };

  const formatDistanceText = (km) => {
    const num = Number(km);

    if (!Number.isFinite(num) || num <= 0) {
      return "distance unavailable";
    }

    return `${num.toFixed(1)} km`;
  };

  const searchAMapTips = useCallback((keyword, setOptions) => {
    const text = String(keyword || "").trim();

    if (!text || !autoCompleteRef.current) {
      setOptions([]);
      return;
    }

    autoCompleteRef.current.search(text, (status, result) => {
      if (status === "complete" && Array.isArray(result.tips)) {
        const tips = result.tips
          .filter((tip) => tip && tip.name)
          .map((tip) => {
            const name = tip.name || "";
            const district = tip.district || "";
            const address = tip.address || "";

            return {
              label: `${name}${district ? ` · ${district}` : ""}${
                address ? ` · ${address}` : ""
              }`,
              value: name,
              name,
              district,
              address,
              location: tip.location || null,
            };
          });

        setOptions(tips);
      } else {
        setOptions([]);
      }
    });
  }, []);

  const geocodeAddress = (address) => {
    return new Promise((resolve, reject) => {
      if (!geocoderRef.current) {
        reject("The map geocoder has not loaded.");
        return;
      }

      geocoderRef.current.getLocation(address, (status, result) => {
        if (status === "complete" && result.geocodes?.length) {
          const geo = result.geocodes[0];

          if (!isLocationInXiamen(geo.location)) {
            reject("The address is outside Xiamen.");
            return;
          }

          resolve(geo.location);
        } else {
          reject("The address could not be resolved.");
        }
      });
    });
  };

  const clearRoutes = () => {
    if (drivingRef.current) {
      drivingRef.current.clear();
    }

    if (busRef.current) {
      busRef.current.clear();
    }
  };

  const addRouteHistory = (record) => {
    setRouteHistory((prev) => {
      const normalizedKey = `${record.routeType}-${record.startAddress}-${record.endAddress}`;

      const withoutDuplicate = prev.filter(
        (item) =>
          `${item.routeType}-${item.startAddress}-${item.endAddress}` !==
          normalizedKey
      );

      return [record, ...withoutDuplicate].slice(0, 20);
    });
  };

  const handlePlanRoute = async () => {
    const startText = startAddress.trim();
    const endText = endAddress.trim();

    if (!startText || !endText) {
      showAlert("❌ Please enter both addresses.", "error");
      return;
    }

    if (!geocoderRef.current) {
      showAlert("❌ The map has not finished loading yet.", "warning");
      return;
    }

    setIsPlanning(true);
    clearRoutes();

    try {
      const startLocation = await geocodeAddress(startText);
      const endLocation = await geocodeAddress(endText);

      if (routeType === "drive") {
        if (!drivingRef.current) {
          throw new Error("The driving route planner has not loaded.");
        }

        drivingRef.current.search(startLocation, endLocation, (status, result) => {
          setIsPlanning(false);

          if (status === "complete" && result.routes?.length) {
            const route = result.routes[0];

            const distanceMeter = getNumberValue(route.distance);
            const durationSecond = getNumberValue(route.duration, route.time);

            const distanceKm = distanceMeter / 1000;
            const durationMin = Math.round(durationSecond / 60);

            const distanceText = formatDistanceText(distanceKm);
            const durationText = formatDurationText(durationMin);

            const summary = `Driving · ${distanceText} · ${durationText}`;

            addRouteHistory({
              id: createRouteId(),
              startAddress: startText,
              endAddress: endText,
              routeType: "drive",
              summary,
              time: formatTime(),
            });

            showAlert(
              `✅ Driving route planned successfully. Distance: ${distanceText}. Estimated time: ${durationText}.`,
              "success"
            );
          } else {
            clearRoutes();
            showAlert("❌ No available driving route was found.", "error");
          }
        });
      } else {
        if (!busRef.current) {
          throw new Error("The transit route planner has not loaded.");
        }

        busRef.current.search(startLocation, endLocation, (status, result) => {
          setIsPlanning(false);

          const transitRoutes = Array.isArray(result?.transits)
            ? result.transits
            : Array.isArray(result?.plans)
              ? result.plans
              : [];

          if (status === "complete" && transitRoutes.length > 0) {
            const firstRoute = transitRoutes[0];

            const durationSecond = getNumberValue(
              firstRoute.duration,
              firstRoute.time,
              firstRoute.cost?.duration
            );

            const walkMeter = getNumberValue(
              firstRoute.walk_distance,
              firstRoute.walking_distance,
              firstRoute.walkDistance,
              firstRoute.cost?.walking_distance
            );

            const durationMin = Math.round(durationSecond / 60);
            const walkKm = walkMeter / 1000;

            const durationText = formatDurationText(durationMin);
            const walkText = formatDistanceText(walkKm);

            const summary = `Transit · ${durationText} · Walk ${walkText}`;

            addRouteHistory({
              id: createRouteId(),
              startAddress: startText,
              endAddress: endText,
              routeType: "bus",
              summary,
              time: formatTime(),
            });

            showAlert(
              `✅ Transit route planned successfully. Estimated time: ${durationText}. Walking distance: ${walkText}.`,
              "success"
            );
          } else {
            clearRoutes();
            showAlert("❌ No available transit route was found.", "error");
          }
        });
      }
    } catch (err) {
      setIsPlanning(false);
      clearRoutes();
      showAlert(`❌ ${err.message || err}`, "error");
    }
  };

  const handleRouteTypeChange = (event, newType) => {
    if (newType !== null) {
      setRouteType(newType);
    }
  };

  const renderAddressAutocomplete = ({
    label,
    value,
    onChange,
    placeholder,
    options,
    setOptions,
  }) => {
    return (
      <Autocomplete
        freeSolo
        fullWidth
        size="small"
        options={options}
        value={value}
        inputValue={value}
        filterOptions={(x) => x}
        getOptionLabel={(option) => {
          if (typeof option === "string") return option;
          return option.label || option.name || "";
        }}
        isOptionEqualToValue={(option, selectedValue) => {
          const optionText =
            typeof option === "string" ? option : option.value || option.name;

          const selectedText =
            typeof selectedValue === "string"
              ? selectedValue
              : selectedValue?.value || selectedValue?.name;

          return optionText === selectedText;
        }}
        onInputChange={(event, newInputValue, reason) => {
          onChange(newInputValue || "");

          if (reason === "input") {
            searchAMapTips(newInputValue, setOptions);
          }
        }}
        onChange={(event, newValue) => {
          if (typeof newValue === "string") {
            onChange(newValue);
          } else if (newValue?.value) {
            onChange(newValue.value);
          } else {
            onChange("");
          }
        }}
        renderInput={(params) => (
          <TextField {...params} label={label} placeholder={placeholder} />
        )}
      />
    );
  };

  return (
    <div className="w-full h-full p-4">
      <Card className="h-[calc(100vh-80px)] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 border-b border-gray-200">
            <Typography
              variant="h6"
              color="primary"
              className="flex items-center gap-2"
            >
              <MapOutlined /> Xiamen Route Planning
            </Typography>

            <Typography variant="caption" color="text.secondary">
              
            </Typography>
          </div>

          <div className="p-4 border-b border-gray-200 mb-4">
            {mapError && (
              <Alert severity="error" className="mb-3">
                {mapError}
              </Alert>
            )}

            <Box className="flex flex-col lg:flex-row gap-3">
              {renderAddressAutocomplete({
                label: "Starting address",
                value: startAddress,
                onChange: setStartAddress,
                placeholder: "Type a starting address",
                options: startOptions,
                setOptions: setStartOptions,
              })}

              {renderAddressAutocomplete({
                label: "Ending address",
                value: endAddress,
                onChange: setEndAddress,
                placeholder: "Type a destination",
                options: endOptions,
                setOptions: setEndOptions,
              })}

              <ToggleButtonGroup
                value={routeType}
                exclusive
                onChange={handleRouteTypeChange}
                sx={{ height: 40 }}
              >
                <ToggleButton value="drive" aria-label="driving">
                  <DirectionsCarOutlined />
                </ToggleButton>

                <ToggleButton value="bus" aria-label="bus">
                  <DirectionsBusOutlined />
                </ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="contained"
                onClick={handlePlanRoute}
                disabled={isPlanning || mapLoading}
                sx={{ minWidth: 150, height: 40 }}
              >
                {isPlanning ? (
                  <CircularProgress size={20} />
                ) : (
                  <>
                    <DirectionsOutlined />
                    {routeType === "drive" ? " Driving" : " Transit"}
                  </>
                )}
              </Button>
            </Box>
          </div>

          <div className="flex-1 p-4 relative" style={{ minHeight: "400px" }}>
            <div
              ref={mapContainerRef}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 8,
              }}
            />

            {mapLoading && (
              <Paper
                elevation={2}
                className="absolute inset-0 flex items-center justify-center"
              >
                <CircularProgress size={40} />
              </Paper>
            )}
          </div>
        </CardContent>
      </Card>

      <Snackbar
        open={alertInfo.open}
        autoHideDuration={4000}
        onClose={closeAlert}
      >
        <Alert onClose={closeAlert} severity={alertInfo.type} variant="filled">
          {alertInfo.msg}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default MapPage;