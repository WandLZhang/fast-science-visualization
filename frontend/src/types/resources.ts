export type ResourceStatus = 'active' | 'running' | 'stopped' | 'pending' | 'error' | 'unknown';

export interface GcpResource {
  name: string;
  type: string;
  project: string;
  location: string;
  state: ResourceStatus;
  displayName?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  consoleUrl?: string;
}

export interface VpcNetwork extends GcpResource {
  routingMode: string;
  subnets: SubnetInfo[];
}

export interface SubnetInfo extends GcpResource {
  ipCidrRange: string;
  region: string;
  vpcName: string;
}

export interface ComputeInstance extends GcpResource {
  zone: string;
  machineType: string;
  networkInterfaces: { network: string; subnetwork: string; networkIP: string }[];
  tags: string[];
}

export interface ForwardingRule extends GcpResource {
  ipAddress: string;
  region: string;
  loadBalancingScheme: string;
  backendService: string;
}

export interface CloudNat extends GcpResource {
  region: string;
  routerName: string;
  natIpAllocateOption: string;
}

export interface ProjectInfo {
  projectId: string;
  projectNumber: string;
  displayName: string;
  state: string;
  parent: string;
  labels: Record<string, string>;
}

export interface FolderInfo {
  folderId: string;
  displayName: string;
  parent: string;
  projects: ProjectInfo[];
}

export interface OrgHierarchy {
  orgId: string;
  domain: string;
  folders: FolderInfo[];
}

export interface InfraConfig {
  orgId: string;
  domain: string;
  prefix: string;
  hubProject: string;
  spokeProject: string;
  workloadProjects: string[];
  regions: { primary: string; secondary?: string };
}

export interface AllResources {
  config: InfraConfig;
  hierarchy: OrgHierarchy;
  hub: {
    networks: VpcNetwork[];
    instances: ComputeInstance[];
    forwardingRules: ForwardingRule[];
    nats: CloudNat[];
  };
  spoke: {
    networks: VpcNetwork[];
    subnets: SubnetInfo[];
  };
  workloads: Record<string, {
    project: ProjectInfo;
    instances: ComputeInstance[];
    buckets: GcpResource[];
  }>;
}
