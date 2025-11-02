"use client";

import { useState, useEffect, useRef } from "react";
import { useAgent } from "./hooks/useAgent";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isThinking } = useAgent();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onSendMessage = async () => {
    if (!input.trim() || isThinking) return;
    const message = input;
    setInput("");
    await sendMessage(message);
  };

  return (
    <div className="flex flex-col flex-grow items-center justify-center w-full h-full px-2 sm:px-4">
      <div className="w-full max-w-2xl h-[70vh] min-h-[500px] gradient-card-purple-teal backdrop-blur-sm shadow-2xl shadow-purple-500/20 rounded-xl p-3 sm:p-4 md:p-6 flex flex-col">
        <div className="flex-grow overflow-y-auto space-y-3 p-2 sm:p-3 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <p className="text-center text-gray-300 italic pt-4">Start chatting with BlockchainHQ Agent...</p>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 sm:p-4 rounded-lg max-w-[85%] sm:max-w-[75%] ${
                  msg.sender === "user"
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white self-end ml-auto shadow-lg shadow-purple-500/30"
                    : "bg-gradient-to-br from-indigo-900/80 via-slate-800/80 to-slate-900/80 text-gray-100 self-start border border-indigo-500/30 shadow-lg shadow-indigo-500/20"
                }`}
              >
                <ReactMarkdown
                  components={{
                    a: props => (
                      <a
                        {...props}
                        className="text-cyan-400 underline hover:text-cyan-300 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            ))
          )}

          {isThinking && (
            <div className="text-right mr-2 text-gray-400 italic flex items-center justify-end gap-2">
              <span className="animate-pulse">🤖</span>
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
          <input
            type="text"
            className="flex-grow p-3 sm:p-4 rounded-lg border-2 border-indigo-500/50 bg-slate-800/50 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-sm"
            placeholder={"Type a message..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSendMessage()}
            disabled={isThinking}
          />
          <button
            onClick={onSendMessage}
            className={`px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-semibold transition-all duration-300 text-sm sm:text-base ${
              isThinking
                ? "bg-gray-700 cursor-not-allowed text-gray-500 border-2 border-gray-700"
                : "gradient-button-purple-green text-white border-0 hover:shadow-lg hover:shadow-green-500/50 active:scale-95"
            }`}
            disabled={isThinking}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
