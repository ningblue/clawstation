/**
 * 供应商分组配置
 *
 * 完全对齐 OpenClaw 的 AUTH_CHOICE_GROUP_DEFS
 * (lib/openclaw/src/commands/auth-choice-options.ts)
 *
 * 层级: AuthChoiceGroupId → AuthChoice[] → 模型列表
 * 每个 member 代表一个 auth method（认证方式），
 * providerIds 映射到 model catalog 中的实际 provider ID。
 */

export interface SubCategoryDef {
  /** 子分类显示名（对应 auth choice label） */
  label: string;
  /** 映射到此子分类的 OpenClaw model catalog provider ID 列表 */
  providerIds: string[];
  /** 如果此子分类与另一个 provider 共享认证，填写共享的 providerId */
  sharesAuthWith?: string;
  /** 提示文本 */
  hint?: string;
}

export interface ProviderGroupDef {
  /** 分组唯一标识（对应 AuthChoiceGroupId） */
  groupId: string;
  /** 分组显示名称 */
  groupName: string;
  /** 图标缩写 */
  icon: string;
  /** 提示文本 */
  hint?: string;
  /** 子分类列表（对应 auth choices）；单个 member 表示无子分类 */
  members: SubCategoryDef[];
}

// ───────────────────────────────────────────────────────
// 对齐 AUTH_CHOICE_GROUP_DEFS（按原始顺序）
// ───────────────────────────────────────────────────────

const AUTH_ALIGNED_GROUPS: ProviderGroupDef[] = [
  {
    groupId: "openai",
    groupName: "OpenAI",
    icon: "OA",
    hint: "Codex OAuth + API key",
    members: [
      {
        label: "OpenAI Codex (ChatGPT OAuth)",
        providerIds: ["openai"],
      },
      {
        label: "OpenAI API key",
        providerIds: ["openai"],
      },
    ],
  },
  {
    groupId: "anthropic",
    groupName: "Anthropic",
    icon: "A",
    hint: "setup-token + API key",
    members: [
      {
        label: "Anthropic token (setup-token)",
        providerIds: ["anthropic"],
      },
      {
        label: "Anthropic API key",
        providerIds: ["anthropic"],
      },
    ],
  },
  {
    groupId: "chutes",
    groupName: "Chutes",
    icon: "CH",
    hint: "OAuth",
    members: [{ label: "Chutes (OAuth)", providerIds: ["chutes"] }],
  },
  {
    groupId: "vllm",
    groupName: "vLLM",
    icon: "VL",
    hint: "Local/self-hosted",
    members: [{ label: "vLLM (custom URL + model)", providerIds: ["vllm"] }],
  },
  {
    groupId: "minimax",
    groupName: "MiniMax",
    icon: "MM",
    hint: "M2.5 (recommended)",
    members: [
      {
        label: "MiniMax OAuth",
        hint: "OAuth plugin for MiniMax",
        providerIds: ["minimax-portal"],
      },
      {
        label: "MiniMax M2.5",
        providerIds: ["minimax"],
      },
      {
        label: "MiniMax M2.5 (CN)",
        hint: "China endpoint (api.minimaxi.com)",
        providerIds: ["minimax-cn", "minimax"],
      },
      {
        label: "MiniMax M2.5 Highspeed",
        hint: "Official fast tier",
        providerIds: ["minimax"],
      },
    ],
  },
  {
    groupId: "moonshot",
    groupName: "Moonshot AI (Kimi K2.5)",
    icon: "Ki",
    hint: "Kimi K2.5 + Kimi Coding",
    members: [
      {
        label: "Kimi API key (.ai)",
        providerIds: ["moonshot"],
      },
      {
        label: "Kimi API key (.cn)",
        providerIds: ["moonshot"],
      },
      {
        label: "Kimi Coding API key",
        hint: "subscription",
        providerIds: ["kimi-coding"],
      },
    ],
  },
  {
    groupId: "google",
    groupName: "Google",
    icon: "G",
    hint: "Gemini API key + OAuth",
    members: [
      {
        label: "Google Gemini API key",
        providerIds: ["google", "google-generative-ai", "google-gemini"],
      },
      {
        label: "Google Gemini CLI OAuth",
        hint: "Unofficial flow",
        providerIds: ["google", "google-generative-ai", "google-gemini"],
      },
    ],
  },
  {
    groupId: "xai",
    groupName: "xAI (Grok)",
    icon: "X",
    hint: "API key",
    members: [{ label: "xAI API key", providerIds: ["xai"] }],
  },
  {
    groupId: "mistral",
    groupName: "Mistral AI",
    icon: "MI",
    hint: "API key",
    members: [{ label: "Mistral API key", providerIds: ["mistral"] }],
  },
  {
    groupId: "volcengine",
    groupName: "Volcano Engine",
    icon: "VC",
    hint: "API key",
    members: [
      {
        label: "Volcano Engine API key",
        providerIds: ["volcengine", "volcengine-plan"],
      },
    ],
  },
  {
    groupId: "byteplus",
    groupName: "BytePlus",
    icon: "BP",
    hint: "API key",
    members: [
      {
        label: "BytePlus API key",
        providerIds: ["byteplus", "byteplus-plan"],
      },
    ],
  },
  {
    groupId: "openrouter",
    groupName: "OpenRouter",
    icon: "OR",
    hint: "API key",
    members: [{ label: "OpenRouter API key", providerIds: ["openrouter"] }],
  },
  {
    groupId: "kilocode",
    groupName: "Kilo Gateway",
    icon: "KC",
    hint: "OpenRouter-compatible",
    members: [{ label: "Kilo Gateway API key", providerIds: ["kilocode"] }],
  },
  {
    groupId: "qwen",
    groupName: "Qwen",
    icon: "QW",
    hint: "OAuth",
    members: [{ label: "Qwen OAuth", providerIds: ["qwen-portal", "qwen"] }],
  },
  {
    groupId: "zai",
    groupName: "Z.AI",
    icon: "Z",
    hint: "GLM Coding Plan / Global / CN",
    members: [
      {
        label: "Coding-Plan-Global",
        hint: "GLM Coding Plan Global (api.z.ai)",
        providerIds: ["zai"],
      },
      {
        label: "Coding-Plan-CN",
        hint: "GLM Coding Plan CN (open.bigmodel.cn)",
        providerIds: ["zai"],
      },
      {
        label: "Global",
        hint: "Z.AI Global (api.z.ai)",
        providerIds: ["zai"],
      },
      {
        label: "CN",
        hint: "Z.AI CN (open.bigmodel.cn)",
        providerIds: ["zai"],
      },
    ],
  },
  {
    groupId: "qianfan",
    groupName: "Qianfan",
    icon: "QF",
    hint: "API key",
    members: [{ label: "Qianfan API key", providerIds: ["qianfan"] }],
  },
  {
    groupId: "copilot",
    groupName: "Copilot",
    icon: "GH",
    hint: "GitHub + local proxy",
    members: [
      {
        label: "GitHub Copilot (GitHub device login)",
        providerIds: ["github-copilot"],
      },
      {
        label: "Copilot Proxy (local)",
        hint: "Local proxy for VS Code Copilot models",
        providerIds: ["github-copilot"],
      },
    ],
  },
  {
    groupId: "ai-gateway",
    groupName: "Vercel AI Gateway",
    icon: "VG",
    hint: "API key",
    members: [
      {
        label: "Vercel AI Gateway API key",
        providerIds: ["vercel-ai-gateway"],
      },
    ],
  },
  {
    groupId: "opencode-zen",
    groupName: "OpenCode Zen",
    icon: "OZ",
    hint: "Multi-model proxy",
    members: [
      {
        label: "OpenCode Zen (multi-model proxy)",
        hint: "Claude, GPT, Gemini via opencode.ai/zen",
        providerIds: ["opencode-zen"],
      },
    ],
  },
  {
    groupId: "xiaomi",
    groupName: "Xiaomi",
    icon: "XM",
    hint: "API key",
    members: [{ label: "Xiaomi API key", providerIds: ["xiaomi"] }],
  },
  {
    groupId: "synthetic",
    groupName: "Synthetic",
    icon: "SY",
    hint: "Anthropic-compatible",
    members: [{ label: "Synthetic API key", providerIds: ["synthetic"] }],
  },
  {
    groupId: "together",
    groupName: "Together AI",
    icon: "TG",
    hint: "API key",
    members: [{ label: "Together AI API key", providerIds: ["together"] }],
  },
  {
    groupId: "huggingface",
    groupName: "Hugging Face",
    icon: "HF",
    hint: "Inference API",
    members: [
      {
        label: "Hugging Face API key (HF token)",
        providerIds: ["huggingface"],
      },
    ],
  },
  {
    groupId: "venice",
    groupName: "Venice AI",
    icon: "VN",
    hint: "Privacy-focused",
    members: [{ label: "Venice API key", providerIds: ["venice"] }],
  },
  {
    groupId: "litellm",
    groupName: "LiteLLM",
    icon: "LL",
    hint: "100+ providers",
    members: [
      {
        label: "LiteLLM API key",
        hint: "Unified LLM gateway",
        providerIds: ["litellm"],
      },
    ],
  },
  {
    groupId: "cloudflare-ai-gateway",
    groupName: "Cloudflare AI Gateway",
    icon: "CF",
    hint: "Account ID + Gateway ID + API key",
    members: [
      {
        label: "Cloudflare AI Gateway",
        providerIds: ["cloudflare-ai-gateway"],
      },
    ],
  },
  {
    groupId: "custom",
    groupName: "Custom Provider",
    icon: "CU",
    hint: "OpenAI/Anthropic compatible",
    members: [
      {
        label: "Custom Provider",
        hint: "Any OpenAI or Anthropic compatible endpoint",
        providerIds: ["custom"],
      },
    ],
  },
];

/** 全部分组定义（完全对齐 OpenClaw AUTH_CHOICE_GROUP_DEFS 顺序） */
export const PROVIDER_GROUP_DEFINITIONS: ProviderGroupDef[] =
  AUTH_ALIGNED_GROUPS;

/**
 * 建立 providerId → groupId 的快速查找表
 */
export function buildProviderToGroupIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const group of PROVIDER_GROUP_DEFINITIONS) {
    for (const member of group.members) {
      for (const pid of member.providerIds) {
        if (!index.has(pid)) {
          index.set(pid, group.groupId);
        }
      }
    }
  }
  return index;
}
