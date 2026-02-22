/**
 * FreeIPA MCP Server Type Definitions
 */

// FreeIPA JSON-RPC API Types
export interface FreeIPARequest {
  method: string;
  params: [any[], Record<string, any>?];
  id: number;
}

export interface FreeIPAResponse<T = any> {
  result: {
    result: T;
    summary?: string;
    count?: number;
    truncated?: boolean;
  };
  error?: {
    code: number;
    message: string;
    name: string;
  };
  id: number;
  principal?: string;
  version?: string;
}

// User Management Types
export interface FreeIPAUser {
  uid: string[];
  givenname?: string[];
  sn?: string[];
  cn?: string[];
  mail?: string[];
  loginshell?: string[];
  homedirectory?: string[];
  uidnumber?: string[];
  gidnumber?: string[];
  memberof_group?: string[];
  has_keytab?: boolean;
  has_password?: boolean;
}

export interface FreeIPAGroup {
  cn: string[];
  description?: string[];
  gidnumber?: string[];
  member_user?: string[];
  member_group?: string[];
}

// Sudo Rule Types
export interface FreeIPASudoRule {
  cn: string[];
  description?: string[];
  ipaenabledflag?: boolean[];
  memberuser_user?: string[];
  memberuser_group?: string[];
  memberhost_host?: string[];
  memberhost_hostgroup?: string[];
  memberallowcmd_sudocmd?: string[];
  memberallowcmd_sudocmdgroup?: string[];
  cmdcategory?: string[];
  hostcategory?: string[];
  usercategory?: string[];
}

export interface FreeIPASudoCmdGroup {
  cn: string[];
  description?: string[];
  member_sudocmd?: string[];
}

export interface FreeIPASudoCmd {
  sudocmd: string[];
  description?: string[];
}

// HBAC Rule Types
export interface FreeIPAHBACRule {
  cn: string[];
  description?: string[];
  ipaenabledflag?: boolean[];
  memberuser_user?: string[];
  memberuser_group?: string[];
  memberhost_host?: string[];
  memberhost_hostgroup?: string[];
  memberservice_hbacsvc?: string[];
  memberservice_hbacsvcgroup?: string[];
  usercategory?: string[];
  hostcategory?: string[];
  servicecategory?: string[];
}

// Certificate Types
export interface FreeIPACertificate {
  certificate: string;
  serial_number: number;
  subject: string;
  issuer: string;
  valid_not_before: string;
  valid_not_after: string;
  revoked?: boolean;
}

export interface FreeIPAService {
  krbprincipalname: string[];
  krbcanonicalname?: string[];
  managedby_host?: string[];
  has_keytab?: boolean;
}

// Host Types
export interface FreeIPAHost {
  fqdn: string[];
  description?: string[];
  l?: string[];
  macaddress?: string[];
  nshostlocation?: string[];
  nshardwareplatform?: string[];
  nsosversion?: string[];
  memberof_hostgroup?: string[];
  has_keytab?: boolean;
  has_password?: boolean;
}

export interface FreeIPADNSRecord {
  idnsname: string[];
  arecord?: string[];
  aaaarecord?: string[];
  cnamerecord?: string[];
  ptrrecord?: string[];
}

// Configuration Types
export interface FreeIPAConfig {
  server: string;
  username: string;
  password: string;
  caCert?: string;
  verifySSL?: boolean;
  timeout?: number;
}

// SSH Connection Types
export interface SSHConfig {
  host: string;
  username: string;
  password: string;
  port?: number;
}

export interface SSHCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// MCP Tool Parameter Types
export interface UserFindParams {
  uid?: string;
  givenname?: string;
  sn?: string;
  mail?: string;
  all?: boolean;
  raw?: boolean;
}

export interface UserAddParams {
  uid: string;
  givenname: string;
  sn: string;
  cn?: string;
  mail?: string;
  userpassword?: string;
  loginshell?: string;
  homedirectory?: string;
}

export interface UserModParams {
  uid: string;
  givenname?: string;
  sn?: string;
  cn?: string;
  mail?: string;
  loginshell?: string;
  homedirectory?: string;
}

export interface GroupAddMemberParams {
  cn: string;
  user?: string[];
  group?: string[];
}

export interface SudoRuleAddParams {
  cn: string;
  description?: string;
  hostcategory?: 'all';
  usercategory?: 'all';
  cmdcategory?: 'all';
}

export interface SudoRuleModifyParams {
  cn: string;
  description?: string;
}

export interface SudoCmdGroupAddParams {
  cn: string;
  description?: string;
}

export interface SudoCmdAddParams {
  sudocmd: string;
  description?: string;
}

export interface HBACRuleAddParams {
  cn: string;
  description?: string;
  hostcategory?: 'all';
  usercategory?: 'all';
  servicecategory?: 'all';
}

export interface CertRequestParams {
  csr: string;
  principal: string;
  profile_id?: string;
  add?: boolean;
}

export interface ServiceAddParams {
  krbprincipalname: string;
  force?: boolean;
}

export interface HostAddParams {
  fqdn: string;
  description?: string;
  l?: string;
  macaddress?: string;
  force?: boolean;
}

export interface DNSRecordAddParams {
  dnszonename: string;
  idnsname: string;
  arecord?: string;
  aaaarecord?: string;
  cnamerecord?: string;
  ptrrecord?: string;
}

// SSSD Cache Management Types
export interface CacheClearParams {
  hosts: string[];
  force?: boolean;
}

export interface CacheTimeoutParams {
  hosts: string[];
  mode: 'testing' | 'production';
  entry_cache_timeout?: number;
  entry_cache_sudo_timeout?: number;
}

export interface SSSDStatusResult {
  host: string;
  status: 'active' | 'inactive' | 'failed';
  cacheStatus?: string;
  lastUpdate?: string;
}

// Error Types
export class FreeIPAError extends Error {
  public code?: number;

  constructor(
    message: string,
    code?: number,
    errorName?: string
  ) {
    super(message);
    this.name = errorName || 'FreeIPAError';
    this.code = code;
  }
}

export class SSHError extends Error {
  constructor(
    message: string,
    public host?: string,
    public exitCode?: number
  ) {
    super(message);
    this.name = 'SSHError';
  }
}
