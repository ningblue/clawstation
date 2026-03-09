# ClawStation 架构规范指南

本文档定义 ClawStation 项目的架构标准和开发规范，确保代码质量和一致性。

## BMAD 架构分层

```
┌─────────────────────────────────────┐
│           Renderer (UI)             │
├─────────────────────────────────────┤
│      API Layer (IPC/Routes)         │
├─────────────────────────────────────┤
│    Backend Layer (Services)         │
├─────────────────────────────────────┤
│      Data Layer (Repositories)      │
├─────────────────────────────────────┤
│    Models Layer (Data Contracts)    │
└─────────────────────────────────────┘
```

## 目录结构规范

```
src/
├── api/                          # API 接口层
│   ├── types/                    # API 类型定义
│   │   └── response.types.ts     # 标准响应格式
│   ├── middleware/               # 中间件
│   │   └── error.middleware.ts   # 错误处理
│   ├── routes/                   # 路由定义
│   └── handlers/                 # 请求处理器
├── backend/                      # 后端业务层
│   ├── interfaces/               # 服务接口契约
│   │   └── service.interface.ts
│   └── services/                 # 业务服务实现
├── data/                         # 数据访问层
│   ├── database.ts               # 数据库连接
│   └── repositories/             # 数据仓库
├── models/                       # 数据模型层
│   ├── *.model.ts                # 模型定义
│   └── *.types.ts                # 相关类型
└── preload/                      # Electron 预加载脚本
    └── index.ts
```

## 接口标准

### 1. API 响应格式

所有 IPC 和 API 响应必须遵循标准格式：

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}
```

**成功响应示例：**
```typescript
{
  success: true,
  data: { id: 1, title: "对话标题" },
  meta: { timestamp: "2026-02-26T10:00:00.000Z" }
}
```

**错误响应示例：**
```typescript
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "标题不能为空",
    details: { field: "title" }
  },
  meta: { timestamp: "2026-02-26T10:00:00.000Z" }
}
```

### 2. 错误代码规范

| 错误代码 | 说明 |
|---------|------|
| `UNKNOWN_ERROR` | 未知错误 |
| `INVALID_INPUT` | 输入参数无效 |
| `NOT_FOUND` | 资源不存在 |
| `ALREADY_EXISTS` | 资源已存在 |
| `UNAUTHORIZED` | 未授权 |
| `FORBIDDEN` | 禁止访问 |
| `VALIDATION_ERROR` | 数据验证失败 |
| `INTERNAL_ERROR` | 内部服务器错误 |
| `OPENCLAW_NOT_RUNNING` | OpenClaw 服务未运行 |

### 3. IPC 通道命名规范

格式：`domain:action`

- `conversation:create` - 创建对话
- `conversation:get` - 获取对话
- `conversation:list` - 列对话
- `conversation:update` - 更新对话
- `conversation:delete` - 删除对话
- `message:create` - 创建消息
- `openclaw:query` - OpenClaw 查询
- `openclaw:status` - 获取状态

## 代码规范

### 1. 服务层规范

```typescript
// ✅ 正确：使用静态方法，明确返回类型
export class ConversationService {
  static async getConversationById(id: number): Promise<Conversation | null> {
    // 1. 输入验证
    if (!id || id <= 0) {
      throw new ValidationError('Invalid conversation ID');
    }

    // 2. 业务逻辑
    const conversation = await ConversationRepository.findById(id);

    // 3. 返回结果
    return conversation;
  }
}

// ❌ 错误：缺少类型，混合职责
export class BadService {
  async get(id) {  // 缺少类型
    const data = await db.query('SELECT * FROM table');  // 直接访问数据库
    // 缺少错误处理
    return data;
  }
}
```

### 2. 仓库层规范

```typescript
// ✅ 正确：单一职责，使用参数化查询
export class ConversationRepository {
  static findById(id: number): Conversation | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(id) as Conversation | null;
  }
}
```

### 3. 错误处理规范

```typescript
// ✅ 正确：使用自定义错误类
import { AppError, ValidationError, NotFoundError } from '../api/middleware/error.middleware';

async function processData(data: unknown) {
  try {
    if (!data) {
      throw new ValidationError('Data is required');
    }
    // 处理逻辑
  } catch (error) {
    if (error instanceof AppError) {
      // 已知错误，直接抛出
      throw error;
    }
    // 未知错误，包装后抛出
    throw new AppError('INTERNAL_ERROR', 'Processing failed', { original: error });
  }
}
```

## 依赖规则

### 允许的方向

```
API Layer → Backend Layer → Data Layer → Models Layer
     ↓
Renderer (via IPC)
```

### 禁止的依赖

- ❌ Models 层不能依赖任何其他层
- ❌ Data 层不能依赖 Backend 层
- ❌ Backend 层不能依赖 API 层
- ❌ 循环依赖

## 安全规范

### 1. 输入验证

所有外部输入必须经过验证：

```typescript
import { validateInput } from '../backend/services/security.service';

function handleUserInput(input: string) {
  // ✅ 验证并清理输入
  const cleanInput = validateInput(input, 1000);

  // 使用清理后的输入
  processData(cleanInput);
}
```

### 2. SQL 注入防护

使用参数化查询：

```typescript
// ✅ 正确：参数化查询
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
const user = stmt.get(userId);

// ❌ 错误：字符串拼接
const user = db.exec(`SELECT * FROM users WHERE id = ${userId}`);
```

### 3. 审计日志

关键操作必须记录审计日志：

```typescript
import { logAudit } from '../backend/services/audit.service';

async function deleteUser(userId: number) {
  await UserRepository.delete(userId);

  // ✅ 记录审计日志
  await logAudit({
    userId: currentUserId,
    action: AuditAction.USER_DELETE,
    level: AuditLevel.WARNING,
    details: `Deleted user: ${userId}`,
  });
}
```

## 测试规范

### 1. 单元测试

```typescript
describe('ConversationService', () => {
  describe('createConversation', () => {
    it('should create conversation with valid data', async () => {
      // Arrange
      const data = { userId: 1, title: 'Test' };

      // Act
      const result = await ConversationService.createConversation(data);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result.title).toBe('Test');
    });

    it('should throw ValidationError with invalid data', async () => {
      // Arrange
      const data = { userId: 0, title: '' };

      // Act & Assert
      await expect(
        ConversationService.createConversation(data)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

## 代码审查清单

### 架构合规性
- [ ] 代码是否遵循 BMAD 分层架构？
- [ ] 依赖方向是否正确？
- [ ] 是否存在循环依赖？

### 接口规范
- [ ] API 响应是否符合标准格式？
- [ ] IPC 通道命名是否规范？
- [ ] 错误处理是否使用标准错误类？

### 代码质量
- [ ] 类型定义是否完整？
- [ ] 错误处理是否充分？
- [ ] 是否包含适当的日志记录？
- [ ] 安全验证是否到位？

### 测试
- [ ] 是否包含单元测试？
- [ ] 测试覆盖率是否足够？
- [ ] 边界条件是否被测试？

## 迁移指南

### 从旧架构迁移

1. **逐步迁移**：每次只迁移一个模块
2. **保持兼容**：维护旧的导入路径直到完全迁移
3. **更新引用**：迁移后更新所有引用

### 迁移步骤

1. 创建新的 BMAD 目录结构
2. 迁移 Models 层（无依赖，最先迁移）
3. 迁移 Data 层（依赖 Models）
4. 迁移 Backend 层（依赖 Data 和 Models）
5. 迁移 API 层（依赖 Backend）
6. 更新入口文件引用
7. 删除旧文件

---

**最后更新：** 2026-02-26
**版本：** 1.0.0
