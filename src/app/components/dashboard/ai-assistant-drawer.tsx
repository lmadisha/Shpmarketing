import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Send, Sparkles, FileText } from "lucide-react";
import { Badge } from "../ui/badge";

interface AIAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantDrawer({
  open,
  onOpenChange,
}: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your Frostlink AI assistant. I can help explain tier changes, analyze performance trends, and answer questions about your fleet. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages([
      ...messages,
      { role: "user", content: input },
      {
        role: "assistant",
        content:
          "Based on the data from the last 30 days, your fleet has shown significant improvement. 12 units moved from Bronze to Silver tier due to increased door activity in the Gauteng region. This correlates with the new promotion campaign launched on February 10th.",
        citations: ["Unit MAC045", "Unit MAC067", "Gauteng Performance Report"],
      },
    ]);
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Assistant
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.role === "assistant" && message.citations && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">
                        Evidence & Citations:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {message.citations.map((citation, j) => (
                          <Badge
                            key={j}
                            variant="outline"
                            className="text-xs gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            {citation}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button onClick={handleSend} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
