/**
 * FreeIPA JSON-RPC API Client
 * TypeScript implementation of FreeIPA API client with session-based authentication
 */

import axios, { AxiosInstance } from 'axios';
import https from 'https';
import {
  FreeIPAConfig,
  FreeIPARequest,
  FreeIPAResponse,
  FreeIPAError,
  FreeIPAUser,
  FreeIPAGroup,
  FreeIPASudoRule,
  FreeIPASudoCmdGroup,
  FreeIPAHBACRule,
  FreeIPACertificate,
  FreeIPAService,
  FreeIPAHost,
  FreeIPADNSRecord
} from './types.js';
import { config as appConfig } from './config.js';

export class FreeIPAClient {
  private server: string;
  private username: string;
  private password: string;
  private baseUrl: string;
  private client: AxiosInstance;
  private authenticated: boolean = false;
  private cookies: string = '';
  private requestId: number = 0;

  constructor(config?: Partial<FreeIPAConfig>) {
    this.server = config?.server || appConfig.freeipa.server;
    this.username = config?.username || appConfig.freeipa.username;
    this.password = config?.password || appConfig.freeipa.password;
    this.baseUrl = `https://${this.server}/ipa`;

    // Create axios instance with SSL verification disabled for self-signed certs
    this.client = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: config?.verifySSL ?? appConfig.freeipa.verifySSL
      }),
      timeout: config?.timeout || appConfig.freeipa.timeout,
      maxRedirects: 5
    });
  }

  /**
   * Authenticate with FreeIPA server using form-based login
   */
  async authenticate(): Promise<boolean> {
    const loginUrl = `${this.baseUrl}/session/login_password`;

    try {
      const response = await this.client.post(
        loginUrl,
        new URLSearchParams({
          user: this.username,
          password: this.password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/plain',
            'Referer': this.baseUrl
          }
        }
      );

      if (response.status === 200) {
        // Extract cookies from response
        const setCookies = response.headers['set-cookie'];
        if (setCookies) {
          this.cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
        }

        this.authenticated = true;
        console.error(`✓ Successfully authenticated to FreeIPA as ${this.username}`);
        return true;
      }

      throw new FreeIPAError(`Authentication failed: HTTP ${response.status}`);
    } catch (error: any) {
      if (error instanceof FreeIPAError) throw error;
      throw new FreeIPAError(`Network error during authentication: ${error.message}`);
    }
  }

  /**
   * Make a JSON-RPC API call to FreeIPA
   */
  private async apiCall<T = any>(
    method: string,
    params: any[] = [],
    options: Record<string, any> = {}
  ): Promise<T> {
    if (!this.authenticated) {
      throw new FreeIPAError('Not authenticated. Call authenticate() first.');
    }

    const apiUrl = `${this.baseUrl}/json`;

    // Build params array according to FreeIPA JSON-RPC format
    const apiParams: [any[], Record<string, any>] = params.length > 0
      ? [params, options]
      : [[], options];

    const payload: FreeIPARequest = {
      method,
      params: apiParams,
      id: ++this.requestId
    };

    try {
      const response = await this.client.post<FreeIPAResponse<T>>(
        apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Referer': this.baseUrl,
            'Cookie': this.cookies
          }
        }
      );

      if (response.status !== 200) {
        throw new FreeIPAError(`API call failed: HTTP ${response.status}`);
      }

      const result = response.data;

      if (result.error) {
        throw new FreeIPAError(
          result.error.message,
          result.error.code,
          result.error.name
        );
      }

      return result.result?.result as T;
    } catch (error: any) {
      if (error instanceof FreeIPAError) throw error;

      // Handle axios errors
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        throw new FreeIPAError(apiError.message, apiError.code, apiError.name);
      }

      throw new FreeIPAError(`Network error during API call: ${error.message}`);
    }
  }

  // ============= User Management Methods =============

  async userFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPAUser[]> {
    return this.apiCall<FreeIPAUser[]>('user_find', [pattern], options);
  }

  async userShow(uid: string, options: Record<string, any> = {}): Promise<FreeIPAUser> {
    return this.apiCall<FreeIPAUser>('user_show', [uid], options);
  }

  async userAdd(
    uid: string,
    givenname: string,
    sn: string,
    options: Record<string, any> = {}
  ): Promise<FreeIPAUser> {
    return this.apiCall<FreeIPAUser>('user_add', [uid], {
      givenname,
      sn,
      ...options
    });
  }

  async userMod(uid: string, options: Record<string, any> = {}): Promise<FreeIPAUser> {
    return this.apiCall<FreeIPAUser>('user_mod', [uid], options);
  }

  async userDel(uid: string): Promise<boolean> {
    await this.apiCall('user_del', [uid], {});
    return true;
  }

  // ============= Group Management Methods =============

  async groupFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPAGroup[]> {
    return this.apiCall<FreeIPAGroup[]>('group_find', [pattern], options);
  }

  async groupShow(cn: string, options: Record<string, any> = {}): Promise<FreeIPAGroup> {
    return this.apiCall<FreeIPAGroup>('group_show', [cn], options);
  }

  async groupAddMember(
    cn: string,
    users?: string[],
    groups?: string[],
    options: Record<string, any> = {}
  ): Promise<FreeIPAGroup> {
    const params: Record<string, any> = { ...options };
    if (users) params.user = users;
    if (groups) params.group = groups;
    return this.apiCall<FreeIPAGroup>('group_add_member', [cn], params);
  }

  async groupRemoveMember(
    cn: string,
    users?: string[],
    groups?: string[],
    options: Record<string, any> = {}
  ): Promise<FreeIPAGroup> {
    const params: Record<string, any> = { ...options };
    if (users) params.user = users;
    if (groups) params.group = groups;
    return this.apiCall<FreeIPAGroup>('group_remove_member', [cn], params);
  }

  // ============= Sudo Rule Management Methods =============

  async sudoruleFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPASudoRule[]> {
    return this.apiCall<FreeIPASudoRule[]>('sudorule_find', [pattern], options);
  }

  async sudoruleShow(cn: string, options: Record<string, any> = {}): Promise<FreeIPASudoRule> {
    return this.apiCall<FreeIPASudoRule>('sudorule_show', [cn], options);
  }

  async sudoruleAdd(
    cn: string,
    description: string = '',
    options: Record<string, any> = {}
  ): Promise<FreeIPASudoRule> {
    return this.apiCall<FreeIPASudoRule>('sudorule_add', [cn], {
      description,
      ...options
    });
  }

  async sudoruleDel(cn: string): Promise<boolean> {
    await this.apiCall('sudorule_del', [cn], {});
    return true;
  }

  async sudoruleEnable(cn: string): Promise<boolean> {
    await this.apiCall('sudorule_enable', [cn], {});
    return true;
  }

  async sudoruleDisable(cn: string): Promise<boolean> {
    await this.apiCall('sudorule_disable', [cn], {});
    return true;
  }

  async sudoruleAddUser(
    cn: string,
    users?: string[],
    groups?: string[]
  ): Promise<FreeIPASudoRule> {
    const params: Record<string, any> = {};
    if (users) params.user = users;
    if (groups) params.group = groups;
    return this.apiCall<FreeIPASudoRule>('sudorule_add_user', [cn], params);
  }

  async sudoruleAddHost(
    cn: string,
    hosts?: string[],
    hostgroups?: string[]
  ): Promise<FreeIPASudoRule> {
    const params: Record<string, any> = {};
    if (hosts) params.host = hosts;
    if (hostgroups) params.hostgroup = hostgroups;
    return this.apiCall<FreeIPASudoRule>('sudorule_add_host', [cn], params);
  }

  async sudoruleAddAllowCommand(
    cn: string,
    commands?: string[],
    commandgroups?: string[]
  ): Promise<FreeIPASudoRule> {
    const params: Record<string, any> = {};
    if (commands) params.sudocmd = commands;
    if (commandgroups) params.sudocmdgroup = commandgroups;
    return this.apiCall<FreeIPASudoRule>('sudorule_add_allow_command', [cn], params);
  }

  async sudoruleAddDenyCommand(
    cn: string,
    commands?: string[],
    commandgroups?: string[]
  ): Promise<FreeIPASudoRule> {
    const params: Record<string, any> = {};
    if (commands) params.sudocmd = commands;
    if (commandgroups) params.sudocmdgroup = commandgroups;
    return this.apiCall<FreeIPASudoRule>('sudorule_add_deny_command', [cn], params);
  }

  async sudoruleAddRunasuser(
    cn: string,
    users?: string[],
    groups?: string[]
  ): Promise<FreeIPASudoRule> {
    const params: Record<string, any> = {};
    if (users) params.user = users;
    if (groups) params.group = groups;
    return this.apiCall<FreeIPASudoRule>('sudorule_add_runasuser', [cn], params);
  }

  // ============= Sudo Command Methods =============

  async sudocmdFind(pattern: string = '', options: Record<string, any> = {}): Promise<any[]> {
    return this.apiCall<any[]>('sudocmd_find', [pattern], options);
  }

  async sudocmdAdd(
    command: string,
    description: string = '',
    options: Record<string, any> = {}
  ): Promise<any> {
    return this.apiCall('sudocmd_add', [command], {
      description,
      ...options
    });
  }

  async sudocmdShow(command: string, options: Record<string, any> = {}): Promise<any> {
    return this.apiCall('sudocmd_show', [command], options);
  }

  // ============= Sudo Command Group Methods =============

  async sudocmdgroupFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPASudoCmdGroup[]> {
    return this.apiCall<FreeIPASudoCmdGroup[]>('sudocmdgroup_find', [pattern], options);
  }

  async sudocmdgroupAdd(
    cn: string,
    description: string = '',
    options: Record<string, any> = {}
  ): Promise<FreeIPASudoCmdGroup> {
    return this.apiCall<FreeIPASudoCmdGroup>('sudocmdgroup_add', [cn], {
      description,
      ...options
    });
  }

  async sudocmdgroupAddMember(cn: string, commands: string[]): Promise<FreeIPASudoCmdGroup> {
    return this.apiCall<FreeIPASudoCmdGroup>('sudocmdgroup_add_member', [cn], {
      sudocmd: commands
    });
  }

  // ============= HBAC Rule Management Methods =============

  async hbacruleFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPAHBACRule[]> {
    return this.apiCall<FreeIPAHBACRule[]>('hbacrule_find', [pattern], options);
  }

  async hbacruleShow(cn: string, options: Record<string, any> = {}): Promise<FreeIPAHBACRule> {
    return this.apiCall<FreeIPAHBACRule>('hbacrule_show', [cn], options);
  }

  async hbacruleAdd(
    cn: string,
    description: string = '',
    options: Record<string, any> = {}
  ): Promise<FreeIPAHBACRule> {
    return this.apiCall<FreeIPAHBACRule>('hbacrule_add', [cn], {
      description,
      ...options
    });
  }

  async hbacruleDel(cn: string): Promise<boolean> {
    await this.apiCall('hbacrule_del', [cn], {});
    return true;
  }

  async hbacruleEnable(cn: string): Promise<boolean> {
    await this.apiCall('hbacrule_enable', [cn], {});
    return true;
  }

  async hbacruleDisable(cn: string): Promise<boolean> {
    await this.apiCall('hbacrule_disable', [cn], {});
    return true;
  }

  async hbacruleAddUser(
    cn: string,
    users?: string[],
    groups?: string[]
  ): Promise<FreeIPAHBACRule> {
    const params: Record<string, any> = {};
    if (users) params.user = users;
    if (groups) params.group = groups;
    return this.apiCall<FreeIPAHBACRule>('hbacrule_add_user', [cn], params);
  }

  async hbacruleAddHost(
    cn: string,
    hosts?: string[],
    hostgroups?: string[]
  ): Promise<FreeIPAHBACRule> {
    const params: Record<string, any> = {};
    if (hosts) params.host = hosts;
    if (hostgroups) params.hostgroup = hostgroups;
    return this.apiCall<FreeIPAHBACRule>('hbacrule_add_host', [cn], params);
  }

  async hbacruleAddService(
    cn: string,
    services?: string[],
    servicegroups?: string[]
  ): Promise<FreeIPAHBACRule> {
    const params: Record<string, any> = {};
    if (services) params.hbacsvc = services;
    if (servicegroups) params.hbacsvcgroup = servicegroups;
    return this.apiCall<FreeIPAHBACRule>('hbacrule_add_service', [cn], params);
  }

  // ============= Certificate Management Methods =============

  async certRequest(
    csr: string,
    principal: string,
    profileId: string = 'caIPAserviceCert',
    options: Record<string, any> = {}
  ): Promise<FreeIPACertificate> {
    return this.apiCall<FreeIPACertificate>('cert_request', [csr], {
      principal,
      profile_id: profileId,
      ...options
    });
  }

  async certShow(serialNumber: string, options: Record<string, any> = {}): Promise<FreeIPACertificate> {
    return this.apiCall<FreeIPACertificate>('cert_show', [serialNumber], options);
  }

  async certFind(options: Record<string, any> = {}): Promise<FreeIPACertificate[]> {
    return this.apiCall<FreeIPACertificate[]>('cert_find', [], options);
  }

  async certRevoke(serialNumber: string, reason: number = 0, options: Record<string, any> = {}): Promise<FreeIPACertificate> {
    return this.apiCall<FreeIPACertificate>('cert_revoke', [serialNumber], {
      revocation_reason: reason,
      ...options
    });
  }

  // ============= Service Management Methods =============

  async serviceFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPAService[]> {
    return this.apiCall<FreeIPAService[]>('service_find', [pattern], options);
  }

  async serviceAdd(principal: string, options: Record<string, any> = {}): Promise<FreeIPAService> {
    return this.apiCall<FreeIPAService>('service_add', [principal], options);
  }

  async serviceShow(principal: string, options: Record<string, any> = {}): Promise<FreeIPAService> {
    return this.apiCall<FreeIPAService>('service_show', [principal], options);
  }

  async serviceAllowCreateKeytab(
    principal: string,
    users?: string[],
    groups?: string[],
    hosts?: string[],
    hostgroups?: string[]
  ): Promise<FreeIPAService> {
    const params: Record<string, any> = {};
    if (users) params.user = users;
    if (groups) params.group = groups;
    if (hosts) params.host = hosts;
    if (hostgroups) params.hostgroup = hostgroups;
    return this.apiCall<FreeIPAService>('service_allow_create_keytab', [principal], params);
  }

  async serviceAllowRetrieveKeytab(
    principal: string,
    users?: string[],
    groups?: string[],
    hosts?: string[],
    hostgroups?: string[]
  ): Promise<FreeIPAService> {
    const params: Record<string, any> = {};
    if (users) params.user = users;
    if (groups) params.group = groups;
    if (hosts) params.host = hosts;
    if (hostgroups) params.hostgroup = hostgroups;
    return this.apiCall<FreeIPAService>('service_allow_retrieve_keytab', [principal], params);
  }

  // ============= Host Management Methods =============

  async hostFind(pattern: string = '', options: Record<string, any> = {}): Promise<FreeIPAHost[]> {
    return this.apiCall<FreeIPAHost[]>('host_find', [pattern], options);
  }

  async hostAdd(fqdn: string, options: Record<string, any> = {}): Promise<FreeIPAHost> {
    return this.apiCall<FreeIPAHost>('host_add', [fqdn], options);
  }

  async hostShow(fqdn: string, options: Record<string, any> = {}): Promise<FreeIPAHost> {
    return this.apiCall<FreeIPAHost>('host_show', [fqdn], options);
  }

  async hostDel(fqdn: string): Promise<boolean> {
    await this.apiCall('host_del', [fqdn], {});
    return true;
  }

  // ============= DNS Record Methods =============

  async dnsrecordAdd(
    dnszonename: string,
    idnsname: string,
    options: Record<string, any> = {}
  ): Promise<FreeIPADNSRecord> {
    return this.apiCall<FreeIPADNSRecord>('dnsrecord_add', [dnszonename, idnsname], options);
  }

  async dnsrecordShow(
    dnszonename: string,
    idnsname: string,
    options: Record<string, any> = {}
  ): Promise<FreeIPADNSRecord> {
    return this.apiCall<FreeIPADNSRecord>('dnsrecord_show', [dnszonename, idnsname], options);
  }

  async dnsrecordDel(dnszonename: string, idnsname: string): Promise<boolean> {
    await this.apiCall('dnsrecord_del', [dnszonename, idnsname], {});
    return true;
  }

  // ============= Utility Methods =============

  async ping(): Promise<any> {
    return this.apiCall('ping', [], {});
  }

  async getServerInfo(): Promise<any> {
    return this.apiCall('env', [], {});
  }
}
