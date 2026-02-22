#!/usr/bin/env node

/**
 * FreeIPA MCP Server
 * Model Context Protocol server for FreeIPA identity management operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { FreeIPAClient } from './freeipa-client.js';
import { SSHManager } from './ssh-manager.js';
import { config } from './config.js';

// Initialize clients
const freeipa = new FreeIPAClient();
const ssh = new SSHManager();

/**
 * Input validation helpers for MCP tool parameters
 */
const SAFE_IDENTIFIER = /^[a-zA-Z0-9._@-]+$/;
const SAFE_HOSTNAME = /^[a-zA-Z0-9._-]+$/;

function validateIdentifier(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${name} is required`);
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`${name} contains invalid characters`);
  return value;
}

function validateHostnames(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${name} must be a non-empty array`);
  for (const h of value) {
    if (typeof h !== 'string' || !SAFE_HOSTNAME.test(h)) {
      throw new Error(`${name} contains invalid hostname: ${h}`);
    }
  }
  return value;
}

// Track authentication state
let isAuthenticated = false;

/**
 * Tool Definitions
 */
const TOOLS: Tool[] = [
  // ========== User Management Tools ==========
  {
    name: 'freeipa_user_find',
    description: 'Search for users in FreeIPA. Returns list of users matching the search pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern for user lookup (username, email, etc.). Leave empty to list all users.'
        },
        all: {
          type: 'boolean',
          description: 'Return all user attributes (default: false)'
        }
      }
    }
  },
  {
    name: 'freeipa_user_show',
    description: 'Get detailed information about a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: 'Username (uid) of the user to retrieve'
        }
      },
      required: ['uid']
    }
  },
  {
    name: 'freeipa_user_add',
    description: 'Create a new user in FreeIPA',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: 'Username (uid) for the new user'
        },
        givenname: {
          type: 'string',
          description: 'First name of the user'
        },
        sn: {
          type: 'string',
          description: 'Last name (surname) of the user'
        },
        mail: {
          type: 'string',
          description: 'Email address of the user'
        },
        userpassword: {
          type: 'string',
          description: 'Initial password for the user'
        }
      },
      required: ['uid', 'givenname', 'sn']
    }
  },
  {
    name: 'freeipa_check_user_groups',
    description: 'Check which groups a user belongs to',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: 'Username (uid) to check group membership for'
        }
      },
      required: ['uid']
    }
  },

  // ========== Group Management Tools ==========
  {
    name: 'freeipa_group_find',
    description: 'Search for groups in FreeIPA',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern for group lookup. Leave empty to list all groups.'
        }
      }
    }
  },
  {
    name: 'freeipa_group_add_member',
    description: 'Add users to a group',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          description: 'Group name (cn) to add members to'
        },
        users: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of usernames to add to the group'
        }
      },
      required: ['group', 'users']
    }
  },
  {
    name: 'freeipa_group_remove_member',
    description: 'Remove users from a group',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          description: 'Group name (cn) to remove members from'
        },
        users: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of usernames to remove from the group'
        }
      },
      required: ['group', 'users']
    }
  },

  // ========== Sudo Rule Management Tools ==========
  {
    name: 'freeipa_sudorule_find',
    description: 'List all sudo rules in FreeIPA',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern for sudo rules. Leave empty to list all rules.'
        }
      }
    }
  },
  {
    name: 'freeipa_sudorule_show',
    description: 'Get detailed information about a specific sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Sudo rule name to retrieve details for'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_sudorule_add',
    description: 'Create a new sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Name for the new sudo rule'
        },
        description: {
          type: 'string',
          description: 'Description of the sudo rule'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_sudorule_enable',
    description: 'Enable a sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Sudo rule name to enable'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_sudorule_disable',
    description: 'Disable a sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Sudo rule name to disable'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_sudorule_add_user',
    description: 'Add users or groups to a sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Sudo rule name'
        },
        users: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of usernames to add to the rule'
        },
        groups: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of group names to add to the rule'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_sudorule_add_host',
    description: 'Add hosts or hostgroups to a sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Sudo rule name'
        },
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to add to the rule'
        },
        hostgroups: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostgroup names to add to the rule'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_sudorule_add_command',
    description: 'Add allowed commands to a sudo rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Sudo rule name'
        },
        commands: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of commands to allow (e.g., ["/usr/bin/systemctl", "/usr/bin/dnf"])'
        },
        commandgroups: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of command groups to allow'
        }
      },
      required: ['rule']
    }
  },

  // ========== Sudo Command Group Tools ==========
  {
    name: 'freeipa_sudocmdgroup_add',
    description: 'Create a new sudo command group',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          description: 'Name for the command group'
        },
        description: {
          type: 'string',
          description: 'Description of the command group'
        }
      },
      required: ['group']
    }
  },
  {
    name: 'freeipa_sudocmdgroup_add_member',
    description: 'Add commands to a sudo command group',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          description: 'Command group name'
        },
        commands: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of commands to add to the group'
        }
      },
      required: ['group', 'commands']
    }
  },

  // ========== HBAC Rule Management Tools ==========
  {
    name: 'freeipa_hbacrule_find',
    description: 'List all HBAC (Host-Based Access Control) rules',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern for HBAC rules. Leave empty to list all rules.'
        }
      }
    }
  },
  {
    name: 'freeipa_hbacrule_show',
    description: 'Get detailed information about a specific HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'HBAC rule name to retrieve details for'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_hbacrule_add',
    description: 'Create a new HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Name for the new HBAC rule'
        },
        description: {
          type: 'string',
          description: 'Description of the HBAC rule'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_hbacrule_enable',
    description: 'Enable an HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'HBAC rule name to enable'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_hbacrule_disable',
    description: 'Disable an HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'HBAC rule name to disable'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_hbacrule_add_user',
    description: 'Add users or groups to an HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'HBAC rule name'
        },
        users: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of usernames to add to the rule'
        },
        groups: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of group names to add to the rule'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_hbacrule_add_host',
    description: 'Add hosts or hostgroups to an HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'HBAC rule name'
        },
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to add to the rule'
        },
        hostgroups: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostgroup names to add to the rule'
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'freeipa_hbacrule_add_service',
    description: 'Add services to an HBAC rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'HBAC rule name'
        },
        services: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of service names to add to the rule (e.g., ["sshd", "login"])'
        }
      },
      required: ['rule', 'services']
    }
  },

  // ========== Certificate Management Tools ==========
  {
    name: 'freeipa_service_add',
    description: 'Create a service principal for certificate management',
    inputSchema: {
      type: 'object',
      properties: {
        principal: {
          type: 'string',
          description: 'Service principal name (e.g., "HTTP/host.example.com")'
        },
        force: {
          type: 'boolean',
          description: 'Force creation even if host does not exist'
        }
      },
      required: ['principal']
    }
  },
  {
    name: 'freeipa_cert_request',
    description: 'Request a certificate from FreeIPA CA',
    inputSchema: {
      type: 'object',
      properties: {
        csr: {
          type: 'string',
          description: 'Certificate Signing Request (CSR) in PEM format'
        },
        principal: {
          type: 'string',
          description: 'Service principal for the certificate'
        },
        profile: {
          type: 'string',
          description: 'Certificate profile to use (default: caIPAserviceCert)'
        }
      },
      required: ['csr', 'principal']
    }
  },

  // ========== Host Management Tools ==========
  {
    name: 'freeipa_host_find',
    description: 'Search for hosts in FreeIPA',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern for host lookup. Leave empty to list all hosts.'
        }
      }
    }
  },
  {
    name: 'freeipa_host_add',
    description: 'Add a new host to FreeIPA',
    inputSchema: {
      type: 'object',
      properties: {
        fqdn: {
          type: 'string',
          description: 'Fully qualified domain name of the host (e.g., "server.example.com")'
        },
        description: {
          type: 'string',
          description: 'Description of the host'
        },
        force: {
          type: 'boolean',
          description: 'Force creation even if DNS record does not exist'
        }
      },
      required: ['fqdn']
    }
  },

  // ========== SSSD Cache Management Tools ==========
  {
    name: 'freeipa_clear_sssd_cache',
    description: 'Clear SSSD cache on one or more hosts to force policy refresh',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to clear cache on (e.g., ["host1.example.com", "host2.example.com"])'
        },
        force: {
          type: 'boolean',
          description: 'Force immediate cache expiration using sss_cache -E'
        }
      },
      required: ['hosts']
    }
  },
  {
    name: 'freeipa_update_sssd_timeout',
    description: 'Update SSSD cache timeout settings on hosts',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to update'
        },
        mode: {
          type: 'string',
          enum: ['testing', 'production'],
          description: 'Cache timeout mode: testing (1-2 min) or production (5-10 min)'
        }
      },
      required: ['hosts', 'mode']
    }
  },
  {
    name: 'freeipa_check_sssd_status',
    description: 'Check SSSD service status on hosts',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to check status on'
        }
      },
      required: ['hosts']
    }
  },
  {
    name: 'freeipa_invalidate_user_cache',
    description: 'Invalidate cache for a specific user on hosts',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to invalidate cache on'
        },
        username: {
          type: 'string',
          description: 'Username to invalidate cache for'
        }
      },
      required: ['hosts', 'username']
    }
  },
  {
    name: 'freeipa_test_ssh_connectivity',
    description: 'Test SSH connectivity to hosts',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hostnames to test connectivity to'
        }
      },
      required: ['hosts']
    }
  },

  // ========== Utility Tools ==========
  {
    name: 'freeipa_ping',
    description: 'Test connection to FreeIPA server',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'freeipa_get_server_info',
    description: 'Get FreeIPA server information and environment details',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Create MCP Server
 */
const server = new Server(
  {
    name: 'irq-freeipa-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Ensure FreeIPA authentication before tool execution
 */
async function ensureAuthenticated() {
  if (!isAuthenticated) {
    await freeipa.authenticate();
    isAuthenticated = true;
  }
}

/**
 * List Tools Handler
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

/**
 * Call Tool Handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Ensure authenticated for all FreeIPA operations
    if (name.startsWith('freeipa_') && name !== 'freeipa_test_ssh_connectivity') {
      await ensureAuthenticated();
    }

    const params = (args ?? {}) as any;

    let result: any;

    // User Management Tools
    switch (name) {
      case 'freeipa_user_find': {
        const users = await freeipa.userFind(params.pattern || '', params.all ? { all: true } : {});
        result = { users, count: users.length };
        break;
      }

      case 'freeipa_user_show': {
        const user = await freeipa.userShow(params.uid);
        result = { user };
        break;
      }

      case 'freeipa_user_add': {
        const options: any = {};
        if (params.mail) options.mail = params.mail;
        if (params.userpassword) options.userpassword = params.userpassword;

        const user = await freeipa.userAdd(params.uid, params.givenname, params.sn, options);
        result = { user, message: `User ${params.uid} created successfully` };
        break;
      }

      case 'freeipa_check_user_groups': {
        const user = await freeipa.userShow(params.uid);
        const groups = user.memberof_group || [];
        result = { username: params.uid, groups, count: groups.length };
        break;
      }

      // Group Management Tools
      case 'freeipa_group_find': {
        const groups = await freeipa.groupFind(params.pattern || '');
        result = { groups, count: groups.length };
        break;
      }

      case 'freeipa_group_add_member': {
        const group = await freeipa.groupAddMember(params.group, params.users);
        result = { group, message: `Added ${params.users.length} users to group ${params.group}` };
        break;
      }

      case 'freeipa_group_remove_member': {
        const group = await freeipa.groupRemoveMember(params.group, params.users);
        result = { group, message: `Removed ${params.users.length} users from group ${params.group}` };
        break;
      }

      // Sudo Rule Management Tools
      case 'freeipa_sudorule_find': {
        const rules = await freeipa.sudoruleFind(params.pattern || '');
        result = { rules, count: rules.length };
        break;
      }

      case 'freeipa_sudorule_show': {
        const rule = await freeipa.sudoruleShow(params.rule);
        result = { rule };
        break;
      }

      case 'freeipa_sudorule_add': {
        const rule = await freeipa.sudoruleAdd(params.rule, params.description || '');
        result = { rule, message: `Sudo rule ${params.rule} created successfully` };
        break;
      }

      case 'freeipa_sudorule_enable': {
        await freeipa.sudoruleEnable(params.rule);
        result = { message: `Sudo rule ${params.rule} enabled` };
        break;
      }

      case 'freeipa_sudorule_disable': {
        await freeipa.sudoruleDisable(params.rule);
        result = { message: `Sudo rule ${params.rule} disabled` };
        break;
      }

      case 'freeipa_sudorule_add_user': {
        const rule = await freeipa.sudoruleAddUser(params.rule, params.users, params.groups);
        result = { rule, message: `Added users/groups to sudo rule ${params.rule}` };
        break;
      }

      case 'freeipa_sudorule_add_host': {
        const rule = await freeipa.sudoruleAddHost(params.rule, params.hosts, params.hostgroups);
        result = { rule, message: `Added hosts/hostgroups to sudo rule ${params.rule}` };
        break;
      }

      case 'freeipa_sudorule_add_command': {
        const rule = await freeipa.sudoruleAddAllowCommand(params.rule, params.commands, params.commandgroups);
        result = { rule, message: `Added commands to sudo rule ${params.rule}` };
        break;
      }

      // Sudo Command Group Tools
      case 'freeipa_sudocmdgroup_add': {
        const group = await freeipa.sudocmdgroupAdd(params.group, params.description || '');
        result = { group, message: `Sudo command group ${params.group} created successfully` };
        break;
      }

      case 'freeipa_sudocmdgroup_add_member': {
        const group = await freeipa.sudocmdgroupAddMember(params.group, params.commands);
        result = { group, message: `Added ${params.commands.length} commands to group ${params.group}` };
        break;
      }

      // HBAC Rule Management Tools
      case 'freeipa_hbacrule_find': {
        const rules = await freeipa.hbacruleFind(params.pattern || '');
        result = { rules, count: rules.length };
        break;
      }

      case 'freeipa_hbacrule_show': {
        const rule = await freeipa.hbacruleShow(params.rule);
        result = { rule };
        break;
      }

      case 'freeipa_hbacrule_add': {
        const rule = await freeipa.hbacruleAdd(params.rule, params.description || '');
        result = { rule, message: `HBAC rule ${params.rule} created successfully` };
        break;
      }

      case 'freeipa_hbacrule_enable': {
        await freeipa.hbacruleEnable(params.rule);
        result = { message: `HBAC rule ${params.rule} enabled` };
        break;
      }

      case 'freeipa_hbacrule_disable': {
        await freeipa.hbacruleDisable(params.rule);
        result = { message: `HBAC rule ${params.rule} disabled` };
        break;
      }

      case 'freeipa_hbacrule_add_user': {
        const rule = await freeipa.hbacruleAddUser(params.rule, params.users, params.groups);
        result = { rule, message: `Added users/groups to HBAC rule ${params.rule}` };
        break;
      }

      case 'freeipa_hbacrule_add_host': {
        const rule = await freeipa.hbacruleAddHost(params.rule, params.hosts, params.hostgroups);
        result = { rule, message: `Added hosts/hostgroups to HBAC rule ${params.rule}` };
        break;
      }

      case 'freeipa_hbacrule_add_service': {
        const rule = await freeipa.hbacruleAddService(params.rule, params.services);
        result = { rule, message: `Added services to HBAC rule ${params.rule}` };
        break;
      }

      // Certificate Management Tools
      case 'freeipa_service_add': {
        const options: any = {};
        if (params.force) options.force = true;
        const service = await freeipa.serviceAdd(params.principal, options);
        result = { service, message: `Service principal ${params.principal} created successfully` };
        break;
      }

      case 'freeipa_cert_request': {
        const cert = await freeipa.certRequest(params.csr, params.principal, params.profile);
        result = { certificate: cert, message: 'Certificate issued successfully' };
        break;
      }

      // Host Management Tools
      case 'freeipa_host_find': {
        const hosts = await freeipa.hostFind(params.pattern || '');
        result = { hosts, count: hosts.length };
        break;
      }

      case 'freeipa_host_add': {
        const options: any = {};
        if (params.description) options.description = params.description;
        if (params.force) options.force = true;
        const host = await freeipa.hostAdd(params.fqdn, options);
        result = { host, message: `Host ${params.fqdn} added successfully` };
        break;
      }

      // SSSD Cache Management Tools
      case 'freeipa_clear_sssd_cache': {
        validateHostnames(params.hosts, 'hosts');
        const results = await ssh.clearSSSDCacheMultiple(params.hosts, params.force || false);
        const summary: any[] = [];
        results.forEach((res, host) => {
          summary.push({
            host,
            success: res.exitCode === 0,
            message: res.exitCode === 0 ? 'Cache cleared successfully' : res.stderr || res.stdout
          });
        });
        result = { results: summary, totalHosts: params.hosts.length };
        break;
      }

      case 'freeipa_update_sssd_timeout': {
        validateHostnames(params.hosts, 'hosts');
        const timeouts = params.mode === 'testing' ? config.sssd.testing : config.sssd.production;
        const entryCacheTimeout = timeouts.entryCacheTimeout;
        const sudoTimeout = timeouts.sudoTimeout;
        const results = await ssh.updateSSSDTimeoutMultiple(params.hosts, entryCacheTimeout, sudoTimeout);
        const summary: any[] = [];
        results.forEach((res, host) => {
          summary.push({
            host,
            success: res.exitCode === 0,
            mode: params.mode,
            entryCacheTimeout,
            sudoTimeout,
            message: res.exitCode === 0 ? 'Timeouts updated successfully' : res.stderr || res.stdout
          });
        });
        result = { results: summary, totalHosts: params.hosts.length };
        break;
      }

      case 'freeipa_check_sssd_status': {
        validateHostnames(params.hosts, 'hosts');
        const results = await ssh.checkSSSDStatusMultiple(params.hosts);
        const summary: any[] = [];
        results.forEach((res, host) => {
          const isActive = res.stdout.includes('Active: active');
          summary.push({
            host,
            status: isActive ? 'active' : 'inactive',
            message: res.stdout.split('\n').slice(0, 5).join('\n')
          });
        });
        result = { results: summary, totalHosts: params.hosts.length };
        break;
      }

      case 'freeipa_invalidate_user_cache': {
        validateHostnames(params.hosts, 'hosts');
        validateIdentifier(params.username, 'username');
        const results = new Map<string, any>();
        for (const host of params.hosts) {
          try {
            const res = await ssh.invalidateUser(host, params.username);
            results.set(host, {
              success: res.exitCode === 0,
              message: res.exitCode === 0 ? `Cache invalidated for ${params.username}` : res.stderr || res.stdout
            });
          } catch (error: any) {
            results.set(host, {
              success: false,
              message: error.message
            });
          }
        }
        const summary: any[] = [];
        results.forEach((res, host) => {
          summary.push({ host, ...res });
        });
        result = { results: summary, username: params.username, totalHosts: params.hosts.length };
        break;
      }

      case 'freeipa_test_ssh_connectivity': {
        validateHostnames(params.hosts, 'hosts');
        const results = await ssh.testConnectivityMultiple(params.hosts);
        const summary: any[] = [];
        results.forEach((connected, host) => {
          summary.push({
            host,
            connected,
            message: connected ? 'SSH connection successful' : 'SSH connection failed'
          });
        });
        result = { results: summary, totalHosts: params.hosts.length };
        break;
      }

      // Utility Tools
      case 'freeipa_ping': {
        const ping = await freeipa.ping();
        result = { status: 'connected', server: config.freeipa.server, response: ping };
        break;
      }

      case 'freeipa_get_server_info': {
        const info = await freeipa.getServerInfo();
        result = { server: config.freeipa.server, info };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error: any) {
    // Reset auth state on session expiry so next call re-authenticates
    if (error.code === 401 || error.message?.includes('Unauthorized') || error.message?.includes('session')) {
      isAuthenticated = false;
    }
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Start Server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FreeIPA MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
