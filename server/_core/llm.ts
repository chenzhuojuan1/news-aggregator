import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id, content } = message;

  if (typeof content === "string") {
    return { role, name, tool_call_id, content };
  }

  if (Array.isArray(content)) {
    const parts = content.map(part => {
      if (typeof part === "string") return { type: "text" as const, text: part };
      return part;
    });
    if (parts.length === 1 && parts[0].type === "text") {
      return { role, name, content: (parts[0] as TextContent).text };
    }
    return { role, name, content: parts };
  }

  if (content && typeof content === "object" && "type" in content) {
    if (content.type === "text") return { role, name, content: content.text };
    return { role, name, content: [content] };
  }

  return { role, name, content: "" };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Set it in environment variables.");
  }

  const { messages, tools, toolChoice, tool_choice, response_format, responseFormat } = params;

  const apiUrl = `${ENV.openaiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const payload: Record<string, unknown> = {
    model: ENV.openaiModel,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const tc = toolChoice || tool_choice;
  if (tc) {
    if (tc === "required" && tools && tools.length === 1) {
      payload.tool_choice = { type: "function", function: { name: tools[0].function.name } };
    } else if (typeof tc === "object" && "name" in tc) {
      payload.tool_choice = { type: "function", function: { name: tc.name } };
    } else {
      payload.tool_choice = tc;
    }
  }

  const rf = responseFormat || response_format;
  if (rf) {
    // DeepSeek doesn't support json_schema, convert to json_object
    if (rf.type === "json_schema") {
      payload.response_format = { type: "json_object" };
    } else {
      payload.response_format = rf;
    }
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
