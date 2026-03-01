# OpenClaw Usage Guide for Developers

## Overview
OpenClaw is a multi-platform messaging gateway that enables AI agents to interact through various messaging platforms like WhatsApp, Telegram, Discord, and iMessage. It acts as a bridge between your AI application and these communication channels, allowing agents to send and receive messages programmatically.

## Key Features
- Multi-platform support (WhatsApp, Telegram, Discord, iMessage, Slack, Signal, etc.)
- Secure agent-to-human communication
- Message routing and session management
- Rich media handling (images, audio, documents)
- Tool integration for extended capabilities
- Sandboxed execution environment

## Architecture

### Core Components
1. **Gateway** - Main process that connects to messaging platforms
2. **Agent System** - AI-powered message processing engine
3. **Session Management** - Tracks conversations per user/channel
4. **Tool Framework** - Extensible API for agent capabilities
5. **Configuration System** - Flexible JSON5-based settings

### Configuration
OpenClaw uses a JSON5 configuration file typically located at `~/.openclaw/openclaw.json`. Key sections:

```json5
{
  // Logging configuration
  logging: { level: "info" },

  // Agent settings
  agent: {
    model: "anthropic/claude-opus-4-6",       // AI model to use
    workspace: "~/.openclaw/workspace",       // Agent workspace directory
    thinkingDefault: "high",                  // Default thinking level
    timeoutSeconds: 1800,                     // Agent timeout
    heartbeat: { every: "0m" },               // Heartbeat interval
  },

  // Channel configurations
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],            // Whitelisted senders
      groups: {
        "*": { requireMention: true },        // Require @mentions in groups
      },
    },
  },

  // Routing rules
  routing: {
    groupChat: {
      mentionPatterns: ["@openclaw", "openclaw"],
    },
  },

  // Session management
  session: {
    scope: "per-sender",                      // Session isolation
    resetTriggers: ["/new", "/reset"],        // Reset commands
    reset: {
      mode: "daily",                          // Auto-reset mode
      atHour: 4,
      idleMinutes: 10080,                     // 7 days
    },
  },
}
```

## Available Tools

### Core Agent Tools
1. **Message Tool** - Send, receive, and manage messages across platforms
2. **Browser Tool** - Web browsing and interaction capabilities
3. **Canvas Tool** - Canvas-based UI interactions
4. **Web Search/Fetch** - Internet search and content retrieval
5. **Image Tool** - Image processing and computer vision
6. **TTS Tool** - Text-to-speech capabilities
7. **Gateway Tool** - Gateway management functions
8. **Session Tools** - Session listing, history, and management
9. **Cron Tool** - Scheduled task management
10. **Subagents Tool** - Spawn and manage subagent processes

### Message Tool Actions
- `send` - Send a text message
- `sendWithEffect` - Send with message effect (e.g., invisible ink)
- `sendAttachment` - Send media files
- `reply` - Reply to a specific message
- `thread-reply` - Reply in thread (for platforms supporting it)
- `broadcast` - Broadcast to multiple recipients
- `react` - Add emoji reactions
- `pin` - Pin messages
- `delete` - Delete messages
- `fetch` - Fetch historical messages
- `poll` - Create polls
- `thread-create` - Create discussion threads
- `event-create` - Create calendar events
- `moderate` - Moderate content/users
- `presence` - Set presence status

### Example Message Tool Usage
```json
{
  "action": "send",
  "target": "+15555550123",
  "message": "Hello! How can I help?",
  "media": "https://example.com/image.jpg"
}
```

## Session Management

### Session Scopes
- `per-sender` - Separate sessions for each user
- `per-channel` - One session per channel
- `shared` - Shared session across all users

### Session Controls
- `/new` or `/reset` - Start a fresh session
- `/compact [instructions]` - Compact session context
- Auto-reset based on configuration

### Heartbeats
- Default: every 30 minutes
- Customizable heartbeat instructions via `HEARTBEAT.md`
- Disabled with `agent.heartbeat.every: "0m"`

## Security Features

### Allow Lists
- Configure `channels.whatsapp.allowFrom` to restrict who can interact
- Use channel-specific allow lists for enhanced security
- Sender verification mechanisms

### Sandboxing
- Optional sandboxed execution for tools
- File system access policies
- Browser isolation capabilities

### Authentication
- Per-channel authentication methods
- Token-based gateway communication
- OAuth flows where supported

## Workspace Files

The agent workspace contains essential files:

- `AGENTS.md` - Agent definitions and capabilities
- `SOUL.md` - Agent personality and instructions
- `TOOLS.md` - Tool availability and configuration
- `IDENTITY.md` - Identity information
- `USER.md` - User context information
- `HEARTBEAT.md` - Heartbeat instructions
- `MEMORY.md` - Long-term memory (optional)
- `BOOTSTRAP.md` - Bootstrap instructions (created once)

## Gateway Operations

### Starting the Gateway
```bash
openclaw gateway --port 18789
```

### Common Commands
```bash
openclaw status          # Local status check
openclaw status --all    # Full diagnostic
openclaw health --json   # Gateway health check
openclaw dashboard       # Open web dashboard
openclaw channels login  # Login to messaging channels
```

### Media Handling
- Inbound attachments: `{{MediaPath}}`, `{{MediaUrl}}`, `{{Transcript}}`
- Outbound attachments: Include `MEDIA:<path-or-url>` on its own line
- Supported formats vary by platform

## Extension System

### Plugins
- Located in `extensions/*` directory
- Extend functionality for specific platforms/features
- Configured through `openclaw.plugin.json` files
- Loaded automatically when available

### Plugin Development
- Follow the plugin SDK conventions
- Define tool interfaces with proper schemas
- Handle authentication and error states
- Document plugin-specific configuration

## Best Practices

### Safety
- Always configure allow lists before going live
- Use a dedicated phone number for assistants
- Start with conservative permissions
- Monitor usage and adjust as needed

### Configuration
- Keep configs in version control (but not secrets)
- Use separate configs for dev/prod environments
- Document custom configurations
- Regularly review security settings

### Development
- Test thoroughly before deploying to production
- Monitor logs for unusual activity
- Implement proper error handling
- Keep dependencies updated

## Integration with ClawStation

In the ClawStation application, OpenClaw serves as the primary communication gateway for the AI agent. The application interacts with OpenClaw through:

1. The IPC handlers in `src/main/ipc-handlers.ts`
2. The OpenClaw manager in `src/main/openclaw-manager.ts`
3. Proper session management for user interactions
4. Security considerations for local communication

The gateway runs on port 18791 by default in ClawStation, ensuring secure local communication between the desktop app and the OpenClaw service.