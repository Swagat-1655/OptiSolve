const codingDescContainerClass = "py-4 px-3 coding_desc_container__gdB9M";
let lastVisitedPage = "";

function isPageChange() {
  const currentPath = window.location.pathname;
  if (lastVisitedPage === currentPath) return false;
  lastVisitedPage = currentPath;
  return true;
}

function isProblemRoute() {
  const pathname = window.location.pathname;
  return pathname.startsWith("/problems/") && pathname.length > "/problems/".length;
}

function getChatStorageKey() {
  return `chat_history_${window.location.pathname}`;
}

function safeLocalStorage(key, value = undefined) {
  try {
    if (value !== undefined) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      return JSON.parse(localStorage.getItem(key) || "[]");
    }
  } catch (e) {
    console.warn("Storage error", e);
    return value === undefined ? [] : null;
  }
}

function createChatUI() {
  if (!sessionStorage.getItem("GEMINI_API_KEY")) {
    const key = prompt("Enter your Gemini API Key:");
    if (key && key.startsWith("AIza")) {
      sessionStorage.setItem("GEMINI_API_KEY", key);
    } else {
      alert("Invalid or missing API key.");
      return;
    }
  }

  if (document.getElementById("ai-chatbox")) return;

  const chatbox = document.createElement("div");
  chatbox.id = "ai-chatbox";

  Object.assign(chatbox.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "400px",
    height: "420px",
    minWidth: "300px",
    minHeight: "200px",
    backgroundColor: "#f9f9f9",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    zIndex: "9999",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    overflow: "auto",
    resize: "both",
    fontFamily: "Segoe UI, sans-serif"
  });

  chatbox.innerHTML = `
    <style>
      .chat-msg {
        margin: 8px 0;
        line-height: 1.4;
        word-wrap: break-word;
      }
      .chat-msg.user {
        background: #daf1fc;
        align-self: flex-end;
        padding: 8px 12px;
        max-width: 75%;
        border-radius: 20px 20px 0 20px;
        color: #111;
      }
      .chat-msg.ai {
        background: #eaeaea;
        align-self: flex-start;
        padding: 8px 12px;
        max-width: 75%;
        border-radius: 20px 20px 20px 0;
        color: #222;
      }
      .chat-header {
        background: #2d3436;
        color: white;
        padding: 12px 16px;
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
        cursor: move;
      }
      .chat-footer {
        padding: 10px;
        display: flex;
        gap: 8px;
        border-top: 1px solid #ddd;
      }
      .chat-footer input {
        flex: 1;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid #ccc;
      }
      .chat-footer button {
        background: #0984e3;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: 0.2s ease;
      }
      .chat-footer button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      .chat-footer button:hover:not(:disabled) {
        background: #0879d0;
      }
      .clear-btn {
        background: #d63031;
        margin: 6px auto;
        width: 90%;
        padding: 6px;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
      }
    </style>
    <div id="chat-header" class="chat-header">
      <span>🤖 OptiSolve</span>
      <span id="close-chat" style="cursor:pointer;">❌</span>
    </div>
    <div id="chat-content" style="flex:1; padding:12px; overflow-y:auto;"></div>
    <div class="chat-footer">
      <input id="chat-input" type="text" placeholder="Ask me anything…" />
      <button id="chat-send" disabled>Send</button>
    </div>
    <button id="clear-history" class="clear-btn">Clear History</button>
  `;

  document.body.appendChild(chatbox);
  document.getElementById("ai-help-button")?.style.setProperty("display", "none");

  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const chatContent = document.getElementById("chat-content");
  const closeBtn = document.getElementById("close-chat");
  const clearBtn = document.getElementById("clear-history");
  const key = getChatStorageKey();
  const apiKey = sessionStorage.getItem("GEMINI_API_KEY");

  let history = safeLocalStorage(key);
  history.forEach(msg => appendMessage(msg));
  input.focus();

  const descEl = document.getElementsByClassName(codingDescContainerClass)[0];
  const problemText = descEl ? descEl.innerText.trim() : "";

  function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = "chat-msg " + (msg.startsWith("AI: ") ? "ai" : "user");
    if (msg.startsWith("AI: ")) {
      const markdown = msg.replace("AI: ", "");
      div.innerHTML = marked.parse(markdown);
    } else {
      div.textContent = msg.replace("You: ", "");
    }
    chatContent.appendChild(div);
    chatContent.scrollTop = chatContent.scrollHeight;
  }

  input.addEventListener("input", () => {
    sendBtn.disabled = input.value.trim() === "";
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !sendBtn.disabled) sendBtn.click();
  });

  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    sendPromptToGemini(text);
  });

  async function sendPromptToGemini(text) {
    appendMessage(`You: ${text}`);
    input.value = "";
    sendBtn.disabled = true;
    safeLocalStorage(key, [...safeLocalStorage(key), `You: ${text}`]);

    if (text.toLowerCase() === "hello") {
      const greeting = `Hello! I am OptiSolve, your mentor for this coding problem. Let's break it down together! 🚀`;
      appendMessage(`AI: ${greeting}`);
      safeLocalStorage(key, [...safeLocalStorage(key), `AI: ${greeting}`]);

      if (problemText) {
        appendMessage("AI: Thinking about the approach...");
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Give me an approach for the following problem:\n\n${problemText}` }] }]
            })
          });
          const data = await response.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "(No response)";
          appendMessage(`AI: ${aiText}`);
          safeLocalStorage(key, [...safeLocalStorage(key), `AI: ${aiText}`]);
        } catch (err) {
          console.error("Gemini error:", err);
          appendMessage("AI: Error occurred while fetching the approach.");
        }
      }
      return;
    }

    appendMessage("AI: Thinking...");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
      });
      const data = await response.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "(No response)";
      appendMessage(`AI: ${aiText}`);
      safeLocalStorage(key, [...safeLocalStorage(key), `AI: ${aiText}`]);
    } catch (err) {
      console.error("Gemini error:", err);
      appendMessage("AI: Error occurred while fetching response.");
    }
  }

  closeBtn.addEventListener("click", () => {
    chatbox.remove();
    document.getElementById("ai-help-button")?.style.removeProperty("display");
  });

  clearBtn.addEventListener("click", () => {
    chatContent.innerHTML = "";
    safeLocalStorage(key, []);
  });

  const header = document.getElementById("chat-header");
  header.onmousedown = function (e) {
    e.preventDefault();
    let offsetX = e.clientX - chatbox.offsetLeft;
    let offsetY = e.clientY - chatbox.offsetTop;
    document.onmousemove = function (e) {
      chatbox.style.left = `${e.clientX - offsetX}px`;
      chatbox.style.top = `${e.clientY - offsetY}px`;
      chatbox.style.bottom = "auto";
    };
    document.onmouseup = function () {
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
}

function addAIHelpButton() {
  if (document.getElementById("ai-help-button")) return;
  const container = document.getElementsByClassName(codingDescContainerClass)[0];
  if (container) {
    const btn = document.createElement("button");
    btn.id = "ai-help-button";
    btn.innerText = "AI Help";
    Object.assign(btn.style, {
      marginTop: "10px",
      padding: "8px 16px",
      backgroundColor: "#1abc9c",
      color: "white",
      border: "none",
      borderRadius: "5px",
      cursor: "pointer",
      fontSize: "14px",
      transition: "background 0.3s"
    });
    btn.onmouseover = () => btn.style.backgroundColor = "#16a085";
    btn.onmouseout = () => btn.style.backgroundColor = "#1abc9c";
    btn.addEventListener("click", () => createChatUI());
    const wrapper = document.createElement("div");
    wrapper.style.textAlign = "right";
    wrapper.appendChild(btn);
    container.insertAdjacentElement("beforeend", wrapper);
  }
}

function cleanupChat() {
  document.getElementById("ai-chatbox")?.remove();
  document.getElementById("ai-help-button")?.style.removeProperty("display");
}

function observePageChange() {
  if (!isPageChange()) return;
  cleanupChat();
  if (isProblemRoute()) {
    addAIHelpButton();
  }
}

setInterval(observePageChange, 500);
