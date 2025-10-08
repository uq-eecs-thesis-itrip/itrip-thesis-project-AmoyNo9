import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, CardContent, Typography, TextField, Button, 
  List, ListItem, Paper, Box, CircularProgress,
  Divider, Chip, Alert 
} from '@mui/material';
import { SendOutlined, InfoOutlined, ArrowUpwardOutlined, 
         LandscapeOutlined, RestaurantOutlined, TheaterComedyOutlined, 
         ChatOutlined} from '@mui/icons-material';
import theme from '../theme'; // MUI theme for consistent styling

// suggestion lists for quick input
const CHAT_SUGGESTIONS = [
  "推荐鼓浪屿附近的闽南美食店",
  "查询南普陀寺当前游客流量",
  "介绍厦门哪里能体验南音表演",
  "环岛路最佳看日出的时间和地点",
  "八市海鲜市场的开放时间和必吃小吃"
];

const INITIAL_MESSAGES = [
  {
    msgId: 1,
    role: "assistant",
    content: "Hello! I am the AI assistant for tourism in Xiamen. I provide services by integrating the local knowledge base and the large model. How can I assist you today?",
    timestamp: new Date().toLocaleTimeString()
  }
];

const ChatPage = () => {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // new message scroll into view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // new message send logic
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const userMsg = {
      msgId: messages.length + 1,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    setTimeout(() => {
      let assistantContent = "";
      const userQuery = inputValue.toLowerCase();
      if (userQuery.includes("流量") || userQuery.includes("人多")) {
        assistantContent = "景区实时流量数据暂未接入，后续将通过厦门市文旅局接口更新";
      } else if (userQuery.includes("美食") || userQuery.includes("吃")) {
        assistantContent = "基于厦门本地美食知识库：1. 八市海鲜；2. 月华沙茶面；3. 曾厝垵小吃街。";
      } else if (userQuery.includes("文化") || userQuery.includes("南音") || userQuery.includes("古厝")) {
        assistantContent = "厦门闽南文化体验：1. 南音阁；2. 闽南古厝群；3. 厦门博物馆。";
      } else if (userQuery.includes("风景") || userQuery.includes("玩")) {
        assistantContent = "厦门核心风景：1. 鼓浪屿；2. 环岛路；3. 南普陀寺。";
      } else {
        assistantContent = `已收到您的需求："${inputValue.trim()}"，后续为您回答。`;
      }

      const assistantMsg = {
        msgId: messages.length + 2,
        role: "assistant",
        content: assistantContent,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSuggestionClick = (text) => {
    setInputValue(text);
  };

  return (
    <div className="flex h-full w-full gap-4 p-4">
      {/* AI Chat Window */}
      <Card className="flex-1 min-w-[300px] max-w-[70%] h-[calc(100vh-80px)] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <ChatOutlined color="primary" />
            <Typography variant="h6" color="primary" fontWeight={600}>
              AI Chatbot for Xiamen Tourism
            </Typography>
          </div>

          <div className="flex-1 overflow-y-auto p-4 gap-4 flex flex-col bg-neutral/50 w-full">
            {messages.map((msg) => (
              <ListItem 
                key={msg.msgId} 
                sx={{ width: '100%', padding: 0, marginBottom: 1 }}
                disableGutters
              >
                <Box 
                  className="flex w-full"
                  sx={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
                >
                  <Paper
                    elevation={2}
                    className={`p-3 max-w-[80%] rounded-lg`}
                    sx={{
                      ...(msg.role === "user" && {
                        backgroundColor: theme.palette.primary.main,
                        color: "white",
                        textAlign: "left"
                      }),
                      ...(msg.role === "assistant" && {
                        backgroundColor: "white",
                        color: theme.palette.text.primary,
                        textAlign: "left"
                      })
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <Typography variant="body2" fontWeight={500}>
                        {msg.role === "user" ? "Me" : "AI Assistant"}
                      </Typography>
                      <Typography variant="caption" opacity={0.8}>
                        {msg.timestamp}
                      </Typography>
                    </div>
                    <Typography variant="body1">
                      {msg.content}
                    </Typography>
                  </Paper>
                </Box>
              </ListItem>
            ))}

            {isLoading && (
              <Box className="flex w-full justify-start">
                <div className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                  <CircularProgress size={20} color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    AI is searching... 
                  </Typography>
                </div>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2 mb-3">
              <Chip icon={<LandscapeOutlined size={14} />} label="Scenic Spots" size="small" color="success" variant="outlined" />
              <Chip icon={<RestaurantOutlined size={14} />} label="Culinary Spots" size="small" color="warning" variant="outlined" />
              <Chip icon={<TheaterComedyOutlined size={14} />} label="Cultural Spots" size="small" color="error" variant="outlined" />
            </div>
            <Typography variant="body2" color="text.secondary" className="mb-2">suggested questions (click to insert):</Typography>
            <div className="flex flex-wrap gap-2 mb-3 mt-2">
              {CHAT_SUGGESTIONS.map((suggestion, idx) => (
                <Button key={idx} variant="outlined" size="small" className="text-xs h-7" onClick={() => handleSuggestionClick(suggestion)} sx={{ borderRadius: "16px" }}>
                  {suggestion}
                </Button>
              ))}
            </div>
            <Box className="flex gap-2">
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Please type your request..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
              />
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                sx={{ minWidth: "48px", p: 0, borderRadius: "8px" }}
              >
                <SendOutlined />
              </Button>
            </Box>
          </div>
        </CardContent>
      </Card>

      {/* Right: Real-time traffic monitoring of scenic spots  */}
      <Card className="w-[30%] min-w-[280px] h-[calc(100vh-80px)] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 flex flex-col gap-2">
            <Typography variant="h6" color="primary" fontWeight={600}>
              Real-time traffic monitoring of scenic spots in Xiamen
            </Typography>
            <Alert severity="info" size="small" sx={{ borderRadius: "4px", p: 1, width: "fit-content" }}>
              Waiting for API
            </Alert>
          </div>
          {/* empty space */}
          <div className="flex-1 bg-neutral/50"></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatPage;