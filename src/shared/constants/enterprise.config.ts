// 企业定制配置 - 默认大模型
// 社区版默认关闭，企业版构建时通过 apply.sh 覆盖此文件

import type { DefaultModeConfig } from '../types/model-config.types';

export const ENTERPRISE_DEFAULT_MODE: DefaultModeConfig = {
  enabled: false,
};
