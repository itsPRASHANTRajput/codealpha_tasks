const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const modelSelect = document.getElementById("modelSelect");
const apiKeyInput = document.getElementById("apiKeyInput");
const newChatBtn = document.getElementById("newChatBtn");
const clearMessagesBtn = document.getElementById("clearMessagesBtn");

const STORAGE_KEY = "ai-chatbot-history";
const SETTINGS_KEY = "ai-chatbot-settings";

const state = {
  messages: [],
  isLoading: false,
};

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    if (parsed.apiKey) apiKeyInput.value = parsed.apiKey;
    if (parsed.model) modelSelect.value = parsed.model;
  } catch (error) {
    console.warn("Settings could not be parsed:", error);
  }
}

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
    }),
  );
}

function loadMessages() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.messages = [
      {
        role: "assistant",
        content:
          "Hello! I am your AI assistant. Ask me anything, and I will help you out.",
      },
    ];
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.messages =
      Array.isArray(parsed) && parsed.length
        ? parsed
        : [
            {
              role: "assistant",
              content:
                "Hello! I am your AI assistant. Ask me anything, and I will help you out.",
            },
          ];
  } catch (error) {
    console.warn("Chat history could not be parsed:", error);
    state.messages = [
      {
        role: "assistant",
        content:
          "Hello! I am your AI assistant. Ask me anything, and I will help you out.",
      },
    ];
  }
}

function persistMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
}

function createMessageElement(message) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${message.role}`;
  wrapper.textContent = message.content;
  return wrapper;
}

function renderMessages() {
  chatMessages.innerHTML = "";

  state.messages.forEach((message) => {
    chatMessages.appendChild(createMessageElement(message));
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showSystemMessage(text) {
  const systemMessage = {
    role: "system",
    content: text,
  };

  state.messages.push(systemMessage);
  renderMessages();
  persistMessages();

  setTimeout(() => {
    const last = state.messages[state.messages.length - 1];
    if (last && last.role === "system") {
      state.messages.pop();
      renderMessages();
      persistMessages();
    }
  }, 2600);
}

function cleanForDisplay(text) {
  return text.trim();
}

function createFallbackReply(userMessage) {
  const lowered = userMessage.toLowerCase();

  if (lowered.includes("hello") || lowered.includes("hi")) {
    return "Hello! I am ready to help. What would you like to do today?";
  }

  if (lowered.includes("code") || lowered.includes("program")) {
    return "I can help with coding ideas, debugging, refactoring, and project structure. Share the issue or task, and I will guide you.";
  }

  if (
    lowered.includes("write") ||
    lowered.includes("email") ||
    lowered.includes("message")
  ) {
    return "I can draft a polished message or email. Tell me the goal, tone, and audience, and I will write it for you.";
  }

  if (lowered.includes("research") || lowered.includes("explain")) {
    return "Here is a simple answer: break the topic down into key concepts, explain the context, and give a practical example. If you want, I can expand this into a more detailed explanation.";
  }

  return "I am in demo mode right now, so this is a local example reply. Add your OpenAI API key to unlock real AI responses from the model you selected.";
}

async function sendToOpenAI(userPrompt, model) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    return createFallbackReply(userPrompt);
  }

  const messages = state.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("No response returned by the API.");
  }

  return reply;
}

async function handleChatSubmit(event) {
  event.preventDefault();

  const userMessage = cleanForDisplay(messageInput.value);
  if (!userMessage || state.isLoading) return;

  state.isLoading = true;
  saveSettings();

  state.messages.push({ role: "user", content: userMessage });
  renderMessages();
  persistMessages();

  messageInput.value = "";
  messageInput.style.height = "auto";

  const assistantPlaceholder = {
    role: "assistant",
    content: "Thinking...",
  };
  state.messages.push(assistantPlaceholder);
  renderMessages();

  try {
    const selectedModel = modelSelect.value;
    const reply = await sendToOpenAI(userMessage, selectedModel);

    state.messages.pop();
    state.messages.push({ role: "assistant", content: reply });
    renderMessages();
    persistMessages();
  } catch (error) {
    state.messages.pop();
    state.messages.push({
      role: "assistant",
      content: `Something went wrong. ${error.message}. Try again or switch to demo mode by removing the API key.`,
    });
    renderMessages();
    persistMessages();
    console.error(error);
  } finally {
    state.isLoading = false;
  }
}

function resetChat() {
  state.messages = [
    {
      role: "assistant",
      content: "New conversation started. How can I help you?",
    },
  ];
  persistMessages();
  renderMessages();
}

function clearChat() {
  state.messages = [
    {
      role: "assistant",
      content: "Conversation cleared. Ask me anything.",
    },
  ];
  persistMessages();
  renderMessages();
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
}

modelSelect.addEventListener("change", saveSettings);
apiKeyInput.addEventListener("input", saveSettings);
newChatBtn.addEventListener("click", resetChat);
clearMessagesBtn.addEventListener("click", clearChat);
messageInput.addEventListener("input", autoResizeTextarea);
chatForm.addEventListener("submit", handleChatSubmit);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

loadSettings();
loadMessages();
renderMessages();
