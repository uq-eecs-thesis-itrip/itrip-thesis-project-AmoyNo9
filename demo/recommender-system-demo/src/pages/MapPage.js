import React, { useState } from 'react';
import { 
  Card, CardContent, Typography, TextField, Button, 
  Box, Paper, Divider, Alert, CircularProgress 
} from '@mui/material';
import { MapOutlined, DirectionsOutlined, InfoOutlined } from '@mui/icons-material';

const MapPage = () => {
  const [startAddress, setStartAddress] = useState(''); // starting address
  const [endAddress, setEndAddress] = useState('');   // ending address
  const [isPlanning, setIsPlanning] = useState(false); // route planning status

  // route planning handler 
  const handlePlanRoute = () => {
    if (!startAddress.trim() || !endAddress.trim()) {
      alert('Please enter the starting and ending addresses.');
      return;
    }
    setIsPlanning(true);
    // Simulate API request 
    setTimeout(() => {
      setIsPlanning(false);
      alert(`Route planning triggered: from "${startAddress}" to "${endAddress}" waiting for API`);
    }, 1500);
  };

  return (
    <div className="w-full p-4">
      <Card className="h-[calc(100vh-80px)] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Map page title and description */}
          <div className="p-4 border-b border-gray-200">
            <Typography variant="h6" color="primary" className="flex items-center gap-2">
              <MapOutlined /> Map Route Planning for Xiamen
            </Typography>
            
          </div>

          {/* address input form */}
          <div className="p-4 border-b border-gray-200 mb-4">
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the starting point and destination, and plan the local route in Xiamen.
            </Typography>
            <Box className="flex flex-col sm:flex-row gap-3">
              {/* starting address input */}
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Starting address"
                placeholder="e.g.：厦门站、鼓浪屿码头"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                sx={{ flex: 1 }}
              />
              {/* ending address input */}
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Ending address"
                placeholder="e.g.：南普陀寺、曾厝垵"
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                sx={{ flex: 1 }}
              />
              {/* planning button */}
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handlePlanRoute}
                disabled={isPlanning}
                sx={{ minWidth: '120px', height: '40px' }}
                className="self-end sm:self-auto"
              >
                {isPlanning ? (
                  <CircularProgress size={20} className="mr-2" />
                ) : (
                  <DirectionsOutlined className="mr-1"/>
                )}
                {isPlanning ? 'planning...' : 'Start Planning'}
              </Button>
            </Box>
          </div>

          {/* Map container (waiting for API integration) */}
          <div className="flex-1 p-4">
            <Paper 
              elevation={2}
              className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300"
            >
              <MapOutlined size={60} color="action" className="mb-3" />
              <Typography variant="h6" color="text.secondary">
                Waiting for map API
              </Typography>
            
            </Paper>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapPage;