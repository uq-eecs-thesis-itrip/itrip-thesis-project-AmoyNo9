import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import { ChatOutlined, MapOutlined } from '@mui/icons-material';


const menuItems = [
  {
    text: 'AI Trip Assistant',
    icon: <ChatOutlined />,
    path: '/', // default route 
  },
  {
    text: 'Map Route Plan',
    icon: <MapOutlined />,
    path: '/map', // map page route
  },
];

const Sidebar = () => {
  const location = useLocation(); // get current route for highlighting

  return (
    <Drawer
      variant="permanent" // keep sidebar always visible
      sx={{
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': { 
          width: 240, 
          boxSizing: 'border-box',
          backgroundColor: '#FFFFFF',
          boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
        },
      }}
    >
      {/* Sidebar header  */}
      <div className="p-4 border-b border-gray-200">
        <Typography variant="h6" color="primary" fontWeight={600}>
          AI trip assistant for Xiamen tourism
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Local knowledge base plus large model
        </Typography>
      </div>

      {/* Menu list */}
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            component={Link}
            to={item.path}
            sx={{
              // Highlight the current page if the path matches
              backgroundColor: location.pathname === item.path ? '#E3F2FD' : 'transparent',
              color: location.pathname === item.path ? '#1E88E5' : 'inherit',
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Supported Scenarios */}
      <div className="p-3">
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Supported Scenarios:
        </Typography>
        <div className="flex flex-wrap gap-1">
          <span className="px-2 py-1 bg-scenery/10 text-scenery text-xs rounded">Scenery</span>
          <span className="px-2 py-1 bg-cuisine/10 text-cuisine text-xs rounded">Cuisine</span>
          <span className="px-2 py-1 bg-culture/10 text-culture text-xs rounded">Culture</span>
        </div>
      </div>
    </Drawer>
  );
};

export default Sidebar;