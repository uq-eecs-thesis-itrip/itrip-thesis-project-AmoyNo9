import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  ListItem,
  Paper,
  Box,
  CircularProgress,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from "@mui/material";
import {
  SendOutlined,
  LandscapeOutlined,
  RestaurantOutlined,
  TheaterComedyOutlined,
  ChatOutlined,
  PsychologyOutlined,
  ExpandMoreOutlined,
  CheckCircleOutlineOutlined,
  RouteOutlined,
  AutoAwesomeOutlined,
  FilterAltOutlined,
  SourceOutlined,
  InfoOutlined,
  ErrorOutlineOutlined,
  FactCheckOutlined
} from "@mui/icons-material";
import theme from "../theme";
import ReactMarkdown from "react-markdown";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const CHAT_SUGGESTIONS = [
 "One-day Xiamen food and culture route"
];

const createMsgId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getCurrentTime = () => new Date().toLocaleTimeString();
const CHAT_PAGE_STORAGE_KEY = "xiamen-ai-travel-planner-chat-state";

const createInitialMessages = () => [
  {
    msgId: createMsgId(),
    role: "assistant",
    content:
      "Hello! I am your Xiamen AI travel assistant. The system first retrieves local RAG sources, then uses DeepSeek to generate a draft, and finally applies the filtering algorithm to remove unreasonable content.",
    timestamp: getCurrentTime()
  }
];

const loadChatPageState = () => {
  if (typeof window === "undefined") {
    return {
      messages: createInitialMessages(),
      inputValue: "",
      thinkingData: null
    };
  }

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(CHAT_PAGE_STORAGE_KEY) || "{}"
    );

    return {
      messages:
        Array.isArray(saved.messages) && saved.messages.length
          ? saved.messages
          : createInitialMessages(),
      inputValue: typeof saved.inputValue === "string" ? saved.inputValue : "",
      thinkingData: saved.thinkingData || null
    };
  } catch {
    return {
      messages: createInitialMessages(),
      inputValue: "",
      thinkingData: null
    };
  }
};

const saveChatPageState = ({ messages, inputValue, thinkingData }) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    CHAT_PAGE_STORAGE_KEY,
    JSON.stringify({ messages, inputValue, thinkingData })
  );
};



const ChatPage = () => {
  const [initialChatState] = useState(loadChatPageState);
  const [messages, setMessages] = useState(initialChatState.messages);
  const [inputValue, setInputValue] = useState(initialChatState.inputValue);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingData, setThinkingData] = useState(initialChatState.thinkingData);
  

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    saveChatPageState({ messages, inputValue, thinkingData });
  }, [messages, inputValue, thinkingData]);

  const addAssistantMessage = (content) => {
    const msg = {
      msgId: createMsgId(),
      role: "assistant",
      content,
      timestamp: getCurrentTime()
    };

    setMessages((prev) => [...prev, msg]);
    return msg.msgId;
  };

  const replaceMessageContent = (msgId, content) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.msgId === msgId ? { ...msg, content } : msg))
    );
  };

  const clearFrontendChatOnly = () => {
    if (isLoading) return;

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CHAT_PAGE_STORAGE_KEY);
    }

    setMessages(createInitialMessages());
    setThinkingData(null);
    setInputValue("");
  };  

  const sendMessageToBackend = async (userMessageText) => {
    const assistantMsgId = addAssistantMessage("AI is thinking...");

    try {
      setIsLoading(true);

      setThinkingData({
        status: "processing",
        thinking: {
          deepseekProcess: ["Waiting for DeepSeek draft generation..."],
          ragProcess: ["Starting local RAG retrieval..."],
          filterProcess: ["Waiting for filtering algorithm..."]
        },
        pois: [],
        removedPOIs: [],
        rejectedClaims: [],
        dayPlan: [],
        draftAnswer: "",
        optimizedDraft: ""
      });

      const response = await fetch(`${API_BASE_URL}/api/travel-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessageText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.answer || data.error || "Backend request failed.");
      }

      replaceMessageContent(assistantMsgId, data.answer || "No result was generated.");

      setThinkingData({
        status: "done",
        intent: data.intent,
        pois: data.pois || [],
        removedPOIs: data.removedPOIs || [],
        rejectedClaims: data.rejectedClaims || [],
        dayPlan: data.dayPlan || [],
        debug: data.debug,
        processLog: data.processLog || [],
        draftAnswer: data.draftAnswer || "",
        optimizedDraft: data.optimizedDraft || "",
        thinking: data.thinking || {
          deepseekProcess: [],
          ragProcess: data.processLog || [],
          filterProcess: []
        }
      });
    } catch (error) {
      console.error("Request failed:", error);

      replaceMessageContent(
        assistantMsgId,
        `⚠️  Request failed:${error.message || "Unable to connect to the backend service. Please check whether the server is running."}`
      );

      setThinkingData({
        status: "error",
        thinking: {
          deepseekProcess: ["DeepSeek or backend request failed."],
          ragProcess: [],
          filterProcess: [error.message || "Please check whether server is running."]
        },
        pois: [],
        removedPOIs: [],
        rejectedClaims: [],
        dayPlan: [],
        draftAnswer: "",
        optimizedDraft: ""
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (isLoading || !inputValue.trim()) return;

    const text = inputValue.trim();

    const userMsg = {
      msgId: createMsgId(),
      role: "user",
      content: text,
      timestamp: getCurrentTime()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    sendMessageToBackend(text);
  };

  const handleSuggestionClick = (text) => {
    if (isLoading) return;
    setInputValue(text);
  };

  const renderMarkdown = (content) => (
    <ReactMarkdown>{String(content || "")}</ReactMarkdown>
  );

  const renderStepList = (logs = []) => {
    if (!logs.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          No process log yet.
        </Typography>
      );
    }

    return logs.map((log, index) => (
      <Box key={`${log}-${index}`} className="flex gap-2 mb-2">
        <CheckCircleOutlineOutlined fontSize="small" color="success" />
        <Typography variant="body2">{log}</Typography>
      </Box>
    ));
  };

  const renderIntent = () => {
    if (!thinkingData?.intent) return null;

    const intent = thinkingData.intent;

    return (
      <Paper className="p-3 rounded-xl mb-3" elevation={1}>
        <Typography fontWeight={700} className="mb-2">
          Detected Intent
        </Typography>

        <Box className="flex flex-wrap gap-1">
          <Chip size="small" label={`${intent.tripDays || 1} day(s)`} />
          {intent.wantsFood && <Chip size="small" color="primary" label="Food" />}
          {intent.wantsCulture && (
            <Chip size="small" color="secondary" label="Culture" />
          )}
          {intent.wantsScenery && (
            <Chip size="small" color="success" label="Scenery" />
          )}
          {intent.wantsNight && <Chip size="small" label="Night" />}
          {intent.wantsRelaxed && <Chip size="small" label="Relaxed" />}
          {intent.mentionsMonday && <Chip size="small" label="Monday" />}
        </Box>
      </Paper>
    );
  };

  const renderDeepSeekProcess = () => {
    const thinking = thinkingData?.thinking || {};
    const logs = thinking.deepseekProcess || [];
    const draftAnswer = thinkingData?.draftAnswer || "";

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <AutoAwesomeOutlined fontSize="small" />
            <Typography fontWeight={700}>DeepSeek Draft Process</Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {renderStepList(logs)}

          <Divider className="my-3" />

          <Typography variant="body2" fontWeight={700} className="mb-1">
            DeepSeek Initial Draft
          </Typography>

          {draftAnswer ? (
            <Paper
              className="p-2 rounded-lg bg-gray-50 max-h-[260px] overflow-y-auto"
              variant="outlined"
            >
              <div className="text-sm break-words">
                {renderMarkdown(draftAnswer)}
              </div>
            </Paper>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Waiting for DeepSeek draft.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderLocalRagProcess = () => {
    const thinking = thinkingData?.thinking || {};
    const logs = thinking.ragProcess || [];

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <SourceOutlined fontSize="small" />
            <Typography fontWeight={700}>Local RAG Process</Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>{renderStepList(logs)}</AccordionDetails>
      </Accordion>
    );
  };

  const renderFilterProcess = () => {
    const thinking = thinkingData?.thinking || {};
    const logs = thinking.filterProcess || thinkingData?.processLog || [];
    const optimizedDraft = thinkingData?.optimizedDraft || "";

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <FilterAltOutlined fontSize="small" />
            <Typography fontWeight={700}>Filtering Process</Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {renderStepList(logs)}

          {optimizedDraft && (
            <>
              <Divider className="my-3" />

              <Typography variant="body2" fontWeight={700} className="mb-1">
                Filtering Algorithm Output
              </Typography>

              <Paper
                className="p-2 rounded-lg bg-gray-50 max-h-[240px] overflow-y-auto"
                variant="outlined"
              >
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {optimizedDraft}
                </pre>
              </Paper>
            </>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderPOICard = (poi, index, options = {}) => {
    const {
      showRemovedReason = false,
      typeLabel = "",
      typeColor = "text.secondary"
    } = options;

    return (
      <Paper
        key={`${poi.name || poi.source_title || index}`}
        className="p-2 mb-2 rounded-lg"
        variant="outlined"
      >
        <Typography variant="body2" fontWeight={700}>
          {poi.name || poi.source_title || "Unknown POI"}
        </Typography>

        {typeLabel && (
          <Typography variant="caption" color={typeColor} display="block">
            Type: {typeLabel}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" display="block">
          Category: {poi.semantic?.main_category || poi.category || "unknown"}
        </Typography>

        {poi.source_title && (
          <Typography variant="caption" color="text.secondary" display="block">
            Source: {poi.source_title}
          </Typography>
        )}

        {poi.address && (
          <Typography variant="caption" color="text.secondary" display="block">
            Address: {poi.address}
          </Typography>
        )}

        {poi.time && (
          <Typography variant="caption" color="text.secondary" display="block">
            Time: {poi.time.open_time || "unknown"} -{" "}
            {poi.time.close_time || "unknown"}
          </Typography>
        )}

        {poi.filter_warning && (
          <Typography variant="caption" color="warning.main" display="block">
            Warning: {poi.filter_warning}
          </Typography>
        )}

        {showRemovedReason && poi.removed_reason && (
          <Typography variant="caption" color="warning.main" display="block">
            Removed reason: {poi.removed_reason}
          </Typography>
        )}
      </Paper>
    );
  };

  const renderFinalPOIs = () => {
    const pois = thinkingData?.pois || [];

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <FactCheckOutlined fontSize="small" />
            <Typography fontWeight={700}>
              POIs Kept After Filtering ({pois.length})
            </Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {pois.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No POI was kept after filtering.
            </Typography>
          ) : (
            pois.map((poi, index) =>
              renderPOICard(poi, index, {
                typeLabel: "kept by filtering algorithm",
                typeColor: "success.main"
              })
            )
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderRemovedPOIs = () => {
    const removed = thinkingData?.removedPOIs || [];

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <ErrorOutlineOutlined fontSize="small" color="warning" />
            <Typography fontWeight={700}>
              POIs Removed by Filtering ({removed.length})
            </Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {removed.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No POI was removed by the filtering algorithm.
            </Typography>
          ) : (
            removed.map((poi, index) =>
              renderPOICard(poi, index, {
                showRemovedReason: true,
                typeLabel: "removed by filtering algorithm",
                typeColor: "warning.main"
              })
            )
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderRejectedClaims = () => {
    const rejected = thinkingData?.rejectedClaims || [];

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <ErrorOutlineOutlined fontSize="small" color="warning" />
            <Typography fontWeight={700}>
              Draft Lines Removed by Filtering ({rejected.length})
            </Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {rejected.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No unsupported draft line was removed.
            </Typography>
          ) : (
            rejected.map((item, index) => (
              <Paper
                key={`${item.sentence || index}`}
                className="p-2 mb-2 rounded-lg"
                variant="outlined"
              >
                <Typography variant="body2" className="mb-1">
                  {item.sentence}
                </Typography>

                <Typography variant="caption" color="warning.main" display="block">
                  Removed reason: {item.reason}
                </Typography>
              </Paper>
            ))
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderRoutePlan = () => {
    const dayPlan = thinkingData?.dayPlan || [];

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box className="flex items-center gap-1">
            <RouteOutlined fontSize="small" />
            <Typography fontWeight={700}>
              Route Assignment ({dayPlan.length} day)
            </Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {dayPlan.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No route plan generated yet.
            </Typography>
          ) : (
            dayPlan.map((day) => (
              <Paper key={day.day} className="p-2 mb-2 rounded-lg" variant="outlined">
                <Typography variant="body2" fontWeight={700}>
                  Day {day.day}: {day.theme}
                </Typography>

                {(day.pois || []).map((poi, index) => (
                  <Typography key={`${day.day}-${poi.name}-${index}`} variant="body2">
                    {index + 1}. {poi.name}
                  </Typography>
                ))}

                {day.route_distance && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Route distance: {day.route_distance.totalKm} km · Known legs:{" "}
                    {day.route_distance.knownLegs}
                  </Typography>
                )}

                {!!day.rejected_by_distance?.length && (
                  <Box className="mt-1">
                    <Typography variant="caption" color="warning.main">
                      Removed by route-distance rule:
                    </Typography>
                    {day.rejected_by_distance.map((item, index) => (
                      <Typography
                        key={`${item.name}-${index}`}
                        variant="caption"
                        display="block"
                        color="text.secondary"
                      >
                        - {item.name}: {item.reason}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Paper>
            ))
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <div className="flex h-full w-full gap-4 p-4">
      <Card className="flex-1 min-w-[300px] max-w-[68%] h-[calc(100vh-80px)] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-2">
            <Box className="flex items-center gap-2">
              <ChatOutlined color="primary" />
              <Box>
                <Typography variant="h6" color="primary" fontWeight={600}>
                  Xiamen AI Travel Planner
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Local RAG + DeepSeek + Filtering Algorithm
                </Typography>
              </Box>
            </Box>

            <Button
              size="small"
              variant="outlined"
              onClick={clearFrontendChatOnly}
              disabled={isLoading}
            >
              Clear Message
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 gap-3 flex flex-col bg-neutral/50">
            {messages.map((msg) => (
              <ListItem key={msg.msgId} sx={{ width: "100%", padding: 0, mb: 1 }}>
                <Box
                  className="flex w-full"
                  sx={{
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                  }}
                >
                  <Paper
                    elevation={2}
                    className="p-3 max-w-[85%] rounded-xl"
                    sx={{
                      backgroundColor:
                        msg.role === "user" ? theme.palette.primary.main : "#fff",
                      color: msg.role === "user" ? "#fff" : "#000"
                    }}
                  >
                    <Typography variant="caption" fontWeight={600}>
                      {msg.role === "user" ? "Me" : "AI"}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        ml: 1,
                        opacity: 0.7
                      }}
                    >
                      {msg.timestamp}
                    </Typography>

                    <div className="mt-1 text-[15px] break-words">
                      {renderMarkdown(msg.content)}
                    </div>
                  </Paper>
                </Box>
              </ListItem>
            ))}

            {isLoading && (
              <Box className="flex justify-start">
                <Paper className="flex items-center gap-2 px-3 py-2 rounded-xl">
                  <CircularProgress size={16} />
                  <Typography variant="body2">AI thinking...</Typography>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2 mb-2">
              <Chip icon={<LandscapeOutlined />} label="Scenic" size="small" />
              <Chip icon={<RestaurantOutlined />} label="Food" size="small" />
              <Chip icon={<TheaterComedyOutlined />} label="Culture" size="small" />
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {CHAT_SUGGESTIONS.map((s, i) => (
                <Button
                  key={i}
                  size="small"
                  onClick={() => handleSuggestionClick(s)}
                  disabled={isLoading}
                >
                  {s}
                </Button>
              ))}
            </div>

            <Box className="flex gap-2">
              <TextField
                fullWidth
                size="small"
                placeholder="Enter your question..."
                value={inputValue}
                disabled={isLoading}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent?.isComposing) return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
              >
                <SendOutlined />
              </Button>
            </Box>
          </div>
        </CardContent>
      </Card>

      <Card className="w-[32%] min-w-[320px] h-[calc(100vh-80px)] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <PsychologyOutlined color="primary" />
            <Box>
              <Typography variant="h6" color="primary" fontWeight={600}>
                Thinking Trace
              </Typography>
              <Typography variant="caption" color="text.secondary">
                
              </Typography>
            </Box>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {!thinkingData ? (
              <Paper className="p-4 rounded-xl text-center" elevation={0}>
                <Typography variant="body2" color="text.secondary">
                  Ask a question to see local RAG retrieval, DeepSeek initial draft,
                  filtering process, kept POIs, removed POIs, removed draft lines, and
                  route assignment.
                </Typography>
              </Paper>
            ) : (
              <>
                {thinkingData.status === "processing" && (
                  <Paper className="p-3 rounded-xl mb-3" elevation={1}>
                    <Box className="flex items-center gap-2 mb-2">
                      <CircularProgress size={16} />
                      <Typography fontWeight={700}>Processing...</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      The system is retrieving local RAG sources, generating a
                      DeepSeek draft, and filtering unreasonable content.
                    </Typography>
                  </Paper>
                )}

                {thinkingData.status === "error" && (
                  <Paper className="p-3 rounded-xl mb-3" elevation={1}>
                    <Box className="flex items-center gap-2 mb-2">
                      <ErrorOutlineOutlined color="error" fontSize="small" />
                      <Typography fontWeight={700}>Error</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Request failed. Check backend terminal logs.
                    </Typography>
                  </Paper>
                )}

                {renderIntent()}

                <Divider className="my-3" />

                {renderDeepSeekProcess()}
                {renderLocalRagProcess()}
               
                {renderFilterProcess()}
                {renderFinalPOIs()}
                {renderRemovedPOIs()}
                {renderRejectedClaims()}
                {renderRoutePlan()}

                {thinkingData.debug && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                      <Typography fontWeight={700}>Debug Data</Typography>
                    </AccordionSummary>

                    <AccordionDetails>
                      <pre className="text-xs whitespace-pre-wrap break-words">
                        {JSON.stringify(thinkingData.debug, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatPage;