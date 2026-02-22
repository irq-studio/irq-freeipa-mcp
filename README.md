# irq-freeipa-mcp

MCP server for FreeIPA identity management. Provides 36 tools for managing users, groups, sudo rules, HBAC rules, certificates, hosts, and SSSD cache.

## Setup

```bash
npm install
npm run build
```

Configure credentials:

```bash
cp config.yaml.example config.yaml   # non-sensitive settings
cp .env.example .env                  # passwords (required)
```

Passwords **must** be set via environment variables in `.env` — they are ignored if placed in `config.yaml`.

## MCP Configuration

```json
{
  "mcpServers": {
    "irq-freeipa": {
      "command": "node",
      "args": ["/path/to/irq-freeipa-mcp/build/index.js"]
    }
  }
}
```

## Tools

| Category | Tools | Examples |
|----------|-------|---------|
| **User Management** | `freeipa_user_find`, `freeipa_user_show`, `freeipa_user_add`, `freeipa_check_user_groups` | Search, create, inspect users |
| **Group Management** | `freeipa_group_find`, `freeipa_group_add_member`, `freeipa_group_remove_member` | Manage group membership |
| **Sudo Rules** | `freeipa_sudorule_find`, `_show`, `_add`, `_enable`, `_disable`, `_add_user`, `_add_host`, `_add_command`, `freeipa_sudocmdgroup_add`, `_add_member` | Create and configure sudo policies |
| **HBAC Rules** | `freeipa_hbacrule_find`, `_show`, `_add`, `_enable`, `_disable`, `_add_user`, `_add_host`, `_add_service` | Host-based access control |
| **Certificates** | `freeipa_service_add`, `freeipa_cert_request` | Service principals and TLS certs |
| **Hosts** | `freeipa_host_find`, `freeipa_host_add` | Manage FreeIPA hosts |
| **SSSD Cache** | `freeipa_clear_sssd_cache`, `_update_sssd_timeout`, `_check_sssd_status`, `_invalidate_user_cache`, `_test_ssh_connectivity` | Remote cache management via SSH |
| **Utility** | `freeipa_ping`, `freeipa_get_server_info` | Connection testing |

All tools include descriptive `inputSchema` definitions — your MCP client will display parameter docs automatically.

## Configuration Reference

**config.yaml** — non-sensitive settings (server hostnames, timeouts, SSSD domain/timeouts).

**`.env`** — credentials only:

```env
FREEIPA_PASSWORD=your-freeipa-password
SSH_PASSWORD=your-ssh-password
```

Environment variables override config.yaml. See `config.yaml.example` and `.env.example` for all options.

## License

MIT
