# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-18

### Added

#### User & Group Management (7 tools)
- `freeipa_user_find` - Search for users in FreeIPA
- `freeipa_user_show` - Get detailed user information
- `freeipa_user_add` - Create new users
- `freeipa_check_user_groups` - Check user group membership
- `freeipa_group_find` - Search for groups
- `freeipa_group_add_member` - Add users to groups
- `freeipa_group_remove_member` - Remove users from groups

#### Sudo Rule Management (10 tools)
- `freeipa_sudorule_find` - List all sudo rules
- `freeipa_sudorule_show` - Get sudo rule details
- `freeipa_sudorule_add` - Create new sudo rule
- `freeipa_sudorule_enable` - Enable sudo rule
- `freeipa_sudorule_disable` - Disable sudo rule
- `freeipa_sudorule_add_user` - Add users/groups to sudo rule
- `freeipa_sudorule_add_host` - Add hosts to sudo rule
- `freeipa_sudorule_add_command` - Add allowed commands to sudo rule
- `freeipa_sudocmdgroup_add` - Create sudo command group
- `freeipa_sudocmdgroup_add_member` - Add commands to command group

#### HBAC Rule Management (8 tools)
- `freeipa_hbacrule_find` - List all HBAC rules
- `freeipa_hbacrule_show` - Get HBAC rule details
- `freeipa_hbacrule_add` - Create new HBAC rule
- `freeipa_hbacrule_enable` - Enable HBAC rule
- `freeipa_hbacrule_disable` - Disable HBAC rule
- `freeipa_hbacrule_add_user` - Add users/groups to HBAC rule
- `freeipa_hbacrule_add_host` - Add hosts to HBAC rule
- `freeipa_hbacrule_add_service` - Add services to HBAC rule

#### Certificate Management (2 tools)
- `freeipa_service_add` - Create service principal for certificates
- `freeipa_cert_request` - Request certificate from FreeIPA CA

#### Host Management (2 tools)
- `freeipa_host_find` - Search for hosts
- `freeipa_host_add` - Add new host to FreeIPA

#### SSSD Cache Management (5 tools)
- `freeipa_clear_sssd_cache` - Clear SSSD cache on hosts
- `freeipa_update_sssd_timeout` - Update cache timeout settings
- `freeipa_check_sssd_status` - Check SSSD service status
- `freeipa_invalidate_user_cache` - Invalidate cache for specific user
- `freeipa_test_ssh_connectivity` - Test SSH connectivity to hosts

#### Utility Tools (2 tools)
- `freeipa_ping` - Test FreeIPA server connection
- `freeipa_get_server_info` - Get server information

#### Infrastructure
- TypeScript-based MCP server using `@modelcontextprotocol/sdk`
- FreeIPA JSON-RPC API client with session authentication
- SSH manager for remote SSSD cache operations
- Comprehensive type definitions for all API responses
- Parallel execution support for multi-host operations

#### Documentation
- Comprehensive README with tool descriptions and examples
- Real-world workflow examples
- Installation and configuration guide
- Troubleshooting section
- Security considerations
- Migration guide from standalone scripts

#### Development
- TypeScript project structure with strict type checking
- Environment-based configuration
- .env.example template for credentials
- Comprehensive .gitignore for security
- MIT License
- Contributing guidelines

### Changed
- Replaced 40+ one-off Python/Bash scripts with unified MCP server
- Centralized credential management in environment variables
- Improved error handling with custom error classes

### Deprecated
- Standalone Python/Bash scripts (still available but not recommended)

### Security
- All credentials stored in .env (gitignored)
- No hardcoded credentials in source code
- SSL certificate verification disabled for self-signed certs
- Session-based authentication with FreeIPA

## [Unreleased]

### Planned Features
- Add DNS record management tools
- Add user password reset functionality
- Add group creation and deletion tools
- Add batch operations for bulk user creation
- Add certificate revocation tools
- Add comprehensive test suite
- Add GitHub Actions CI/CD pipeline
- Add automated changelog generation

---

## Version History

- **1.0.0** (2025-01-18): Initial release with 36 MCP tools
