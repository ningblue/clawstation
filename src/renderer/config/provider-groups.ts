/**
 * 供应商分组配置 - 仅国内模型服务商
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
// 国内模型服务商配置
// ───────────────────────────────────────────────────────

const DOMESTIC_PROVIDER_GROUPS: ProviderGroupDef[] = [
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
  // {
  //   groupId: "volcengine",
  //   groupName: "Volcano Engine",
  //   icon: "VC",
  //   hint: "API key",
  //   members: [
  //     {
  //       label: "Volcano Engine API key",
  //       providerIds: ["volcengine", "volcengine-plan"],
  //     },
  //   ],
  // },
  // {
  //   groupId: "byteplus",
  //   groupName: "BytePlus",
  //   icon: "BP",
  //   hint: "API key",
  //   members: [
  //     {
  //       label: "BytePlus API key",
  //       providerIds: ["byteplus", "byteplus-plan"],
  //     },
  //   ],
  // },
  // {
  //   groupId: "qwen",
  //   groupName: "Qwen",
  //   icon: "QW",
  //   hint: "OAuth",
  //   members: [{ label: "Qwen OAuth", providerIds: ["qwen-portal", "qwen"] }],
  // },
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
    groupId: "bailian",
    groupName: "Bailian (阿里云)",
    icon: "BL",
    hint: "Coding Plan / API Key",
    members: [
      {
        label: "Coding Plan (推荐)",
        hint: "阿里云 Coding Plan 套餐 (coding.dashscope.aliyuncs.com)",
        providerIds: ["bailian"],
      },
      {
        label: "Bailian API Key",
        hint: "百炼平台 API Key (dashscope.aliyuncs.com)",
        providerIds: ["bailian-api"],
      },
    ],
  },
];

/** 全部分组定义（仅国内模型服务商） */
export const PROVIDER_GROUP_DEFINITIONS: ProviderGroupDef[] =
  DOMESTIC_PROVIDER_GROUPS;

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
