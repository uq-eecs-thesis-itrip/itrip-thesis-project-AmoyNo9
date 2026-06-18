import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
} from "@mui/material";

import {
  ChatOutlined,
  MapOutlined,
  HistoryOutlined,
  DeleteOutlineOutlined,
  DirectionsCarOutlined,
  DirectionsBusOutlined,
} from "@mui/icons-material";

const MAP_PAGE_STORAGE_KEY = "xiamen-map-page-state";
const MAP_PAGE_UPDATED_EVENT = "xiamen-map-page-state-updated";
const ROUTE_HISTORY_SELECTED_EVENT = "xiamen-route-history-selected";

const menuItems = [
  {
    text: "AI Trip Assistant",
    icon: <ChatOutlined />,
    path: "/",
  },
  {
    text: "Map Route Plan",
    icon: <MapOutlined />,
    path: "/map",
  },
];

const loadMapState = () => {
  if (typeof window === "undefined") {
    return {
      routeHistory: [],
    };
  }

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(MAP_PAGE_STORAGE_KEY) || "{}"
    );

    return {
      ...saved,
      routeHistory: Array.isArray(saved.routeHistory)
        ? saved.routeHistory
        : [],
    };
  } catch {
    return {
      routeHistory: [],
    };
  }
};

const saveMapState = (nextState) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(MAP_PAGE_STORAGE_KEY, JSON.stringify(nextState));

  window.dispatchEvent(
    new CustomEvent(MAP_PAGE_UPDATED_EVENT, {
      detail: nextState,
    })
  );
};

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [mapState, setMapState] = useState(loadMapState);

  const routeHistory = Array.isArray(mapState.routeHistory)
    ? mapState.routeHistory
    : [];

  useEffect(() => {
    const refreshFromStorage = () => {
      setMapState(loadMapState());
    };

    const handleMapPageUpdate = (event) => {
      if (event.detail) {
        setMapState(event.detail);
      } else {
        refreshFromStorage();
      }
    };

    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener(MAP_PAGE_UPDATED_EVENT, handleMapPageUpdate);

    return () => {
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener(MAP_PAGE_UPDATED_EVENT, handleMapPageUpdate);
    };
  }, []);

  const handleUseHistory = (item) => {
    const nextState = {
      ...loadMapState(),
      startAddress: item.startAddress,
      endAddress: item.endAddress,
      routeType: item.routeType,
    };

    saveMapState(nextState);

    window.dispatchEvent(
      new CustomEvent(ROUTE_HISTORY_SELECTED_EVENT, {
        detail: item,
      })
    );

    navigate("/map");
  };

  const handleDeleteHistoryItem = (id) => {
    const currentState = loadMapState();

    const nextState = {
      ...currentState,
      routeHistory: (currentState.routeHistory || []).filter(
        (item) => item.id !== id
      ),
    };

    saveMapState(nextState);
    setMapState(nextState);
  };

  const handleClearHistory = () => {
    const currentState = loadMapState();

    const nextState = {
      ...currentState,
      routeHistory: [],
    };

    saveMapState(nextState);
    setMapState(nextState);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 280,
          boxSizing: "border-box",
          backgroundColor: "#FFFFFF",
          boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
          overflowX: "hidden",
        },
      }}
    >
      <div className="p-4 border-b border-gray-200">
        <Typography variant="h6" color="primary" fontWeight={600}>
          AI Trip Assistant for Xiamen Tourism
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Local knowledge base plus large model
        </Typography>
      </div>

      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            component={Link}
            to={item.path}
            sx={{
              backgroundColor:
                location.pathname === item.path ? "#E3F2FD" : "transparent",
              color: location.pathname === item.path ? "#1E88E5" : "inherit",
            }}
          >
            <ListItemIcon
              sx={{
                color: location.pathname === item.path ? "#1E88E5" : "inherit",
              }}
            >
              {item.icon}
            </ListItemIcon>

            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>

      <Divider />

      <div className="p-3">
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Supported Scenarios:
        </Typography>

        <div className="flex flex-wrap gap-1">
          <span className="px-2 py-1 bg-scenery/10 text-scenery text-xs rounded">
            Scenery
          </span>
          <span className="px-2 py-1 bg-cuisine/10 text-cuisine text-xs rounded">
            Cuisine
          </span>
          <span className="px-2 py-1 bg-culture/10 text-culture text-xs rounded">
            Culture
          </span>
        </div>
      </div>

      <Divider />

      <Box className="p-3 flex-1 overflow-y-auto">
        <Box className="flex items-center justify-between gap-2 mb-2">
          <Box className="flex items-center gap-1">
            <HistoryOutlined fontSize="small" color="primary" />

            <Typography variant="body2" color="text.secondary" fontWeight={700}>
              Route History
            </Typography>
          </Box>

          <Button
            size="small"
            color="error"
            onClick={handleClearHistory}
            disabled={!routeHistory.length}
            sx={{ minWidth: 0, px: 1 }}
          >
            Clear
          </Button>
        </Box>

        {routeHistory.length === 0 ? (
          <Paper className="p-2 rounded-lg text-center" elevation={0}>
            <Typography variant="caption" color="text.secondary">
              No route search history yet.
            </Typography>
          </Paper>
        ) : (
          routeHistory.map((item) => (
            <Paper
              key={item.id}
              className="p-2 mb-2 rounded-lg cursor-pointer"
              variant="outlined"
              onClick={() => handleUseHistory(item)}
              sx={{
                "&:hover": {
                  backgroundColor: "#F5F5F5",
                },
              }}
            >
              <Box className="flex items-center justify-between gap-1 mb-1">
                <Chip
                  size="small"
                  label={item.routeType === "drive" ? "Driving" : "Transit"}
                  icon={
                    item.routeType === "drive" ? (
                      <DirectionsCarOutlined />
                    ) : (
                      <DirectionsBusOutlined />
                    )
                  }
                />

                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteHistoryItem(item.id);
                  }}
                  sx={{ minWidth: 0, fontSize: 11 }}
                >
                  Delete
                </Button>
              </Box>

              <Typography variant="caption" fontWeight={700} display="block">
                {item.startAddress}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block">
                to
              </Typography>

              <Typography variant="caption" fontWeight={700} display="block">
                {item.endAddress}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.5 }}
              >
                {item.summary}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block">
                {item.time}
              </Typography>
            </Paper>
          ))
        )}
      </Box>
    </Drawer>
  );
};

export default Sidebar;