# BMAD 架构规范 - ClawStation

## 概述
BMAD (Backend, Models, API, Data) 是一种专注于模块化和职责分离的架构模式，特别适用于Electron应用程序。

## 架构组件

### B - Backend (后端逻辑)
负责应用的业务逻辑、进程管理和系统集成
- 位置: `src/backend/`
- 职责:
  - 主进程管理
  - OpenClaw引擎集成
  - 系统服务协调
  - 安全和审计功能

### M - Models (数据模型)
定义应用中的数据结构和实体关系
- 位置: `src/models/`
- 职责:
  - 定义数据结构
  - 数据验证
  - 类型定义
  - 关系映射

### A - API (接口层)
处理进程间通信和外部接口
- 位置: `src/api/`
- 职责:
  - IPC通信处理
  - 接口定义
  - 请求/响应处理
  - 错误处理

### D - Data (数据层)
管理数据持久化和访问
- 位置: `src/data/`
- 职责:
  - 数据库操作
  - 数据访问对象(DAO)
  - 数据迁移
  - 缓存策略

## 重构计划

### 第一阶段: 模型层 (Models)
- 将数据结构提取到独立的模型文件
- 定义类型安全的数据契约

### 第二阶段: 数据层 (Data)
- 将数据库操作封装到数据访问对象
- 创建独立的数据服务

### 第三阶段: API层 (API)
- 重构IPC处理器为API路由
- 分离请求处理逻辑

### 第四阶段: 后端层 (Backend)
- 重组主进程逻辑
- 整合各层的服务

## 文件结构变更

```
src/
├── backend/              # 后端逻辑
│   ├── index.ts          # 主进程入口
│   ├── services/         # 业务服务
│   │   ├── openclaw.service.ts
│   │   ├── security.service.ts
│   │   └── audit.service.ts
│   └── workers/          # 后台任务
│       └── database.worker.ts
├── models/               # 数据模型
│   ├── user.model.ts
│   ├── conversation.model.ts
│   ├── message.model.ts
│   └── audit.model.ts
├── api/                  # 接口层
│   ├── routes/           # API路由
│   │   ├── user.route.ts
│   │   ├── conversation.route.ts
│   │   └── message.route.ts
│   ├── middleware/       # 中间件
│   │   └── auth.middleware.ts
│   └── handlers/         # 处理器
│       └── ipc.handler.ts
└── data/                 # 数据层
    ├── repositories/     # 数据仓库
    │   ├── user.repository.ts
    │   ├── conversation.repository.ts
    │   └── message.repository.ts
    ├── migrations/       # 数据迁移
    │   └── 001-initial.migration.ts
    └── database.ts       # 数据库连接
```

## 实施准则

### 模块职责
- 每个模块应该只做一件事，并且把它做好
- 遵循单一职责原则(SRP)
- 保持松耦合，高内聚

### 依赖管理
- 依赖应该流向抽象，而不是具体实现
- 使用依赖注入来解耦组件
- 避免循环依赖

### 错误处理
- 在每一层都要有适当的错误处理
- 使用统一的错误格式
- 记录适当的错误日志

### 测试友好
- 每个模块都应该容易测试
- 使用接口进行依赖注入，便于模拟
- 分离纯函数逻辑

## 迁移策略

1. 保留现有的功能完整性
2. 逐步迁移，每次只移动一小部分
3. 每次迁移后验证功能不变
4. 保持向后兼容的API

这种BMAD架构将使项目更易于维护、测试和扩展。