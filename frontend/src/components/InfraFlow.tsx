import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GroupNode } from './nodes/GroupNode';
import { ResourceNode } from './nodes/ResourceNode';
import { DetailPanel } from './panels/DetailPanel';
import { Header } from './layout/Header';
import { fetchAllResources } from '../api/client';
import type { AllResources } from '../types/resources';
import './InfraFlow.css';

const nodeTypes = {
  groupNode: GroupNode,
  resource: ResourceNode,
};

const GCP_DIFFERENTIATORS: Record<string, string> = {
  'nva': 'Centralized egress inspection using iptables masquerade on Container-Optimized OS.\nDual-NIC VMs bridge Landing and DMZ VPCs.\nAll spoke traffic funnels through NVA ILB for inspection before reaching Cloud NAT.',
  'cloud-nat': 'No public IPs needed on workload VMs.\nAuto-scaling NAT gateway with per-second billing.\nPer-VM endpoint-independent mapping for deterministic port allocation.',
  'shared-vpc': 'Multi-project networking with subnet-level IAM.\nCentral IT controls network topology; researchers just get a project ID.\nService agents auto-granted compute.networkUser on specific subnets.',
  'pga': 'Access 200+ Google APIs (Vertex AI, GCS, BigQuery) without internet egress.\nTraffic stays on Google backbone via restricted.googleapis.com VIPs.\n40+ DNS response policy rules for googleapis, notebooks, pkg.dev, gcr.io.',
  'vpc-peering': 'Custom route exchange between hub and spoke via VPC peering.\n0.0.0.0/0 exported from Landing VPC so spoke traffic flows through NVAs.\nSubnet routes auto-exchanged; custom routes controlled via peering config.',
  'project-factory': 'One YAML file = one researcher project.\n24 APIs pre-enabled, SA provisioned, Shared VPC attached, budget alerts configured.\nLeast-privilege subnet IAM: service agents get networkUser on specific subnets only.',
  'kms': 'HSM-backed encryption keys with automatic rotation (90-day default).\nCIS Benchmark 1.10 compliant.\nEncrypt boot disks, GCS objects, and BigQuery datasets with customer-managed keys.',
};

// ─── Layout Margins (relative positioning) ───
const M = {
  GROUP_TOP: 45,     // space below group header for content start
  GROUP_PAD: 15,     // padding inside groups (sides & bottom)
  ROW_GAP: 20,       // vertical gap between rows of resources
  SECTION_GAP: 20,   // gap between major sections
  RES_H: 55,         // approximate resource node height
  STAGE_SPACING: 310, // horizontal spacing between stage badges
};

function buildStaticNodes(data: AllResources | null): Node[] {
  const nodes: Node[] = [];
  const prefix = data?.config?.prefix || '';
  const primary = data?.config?.regions?.primary || '';
  const secondary = data?.config?.regions?.secondary;
  const hasVdss = data?.config?.hasVdss ?? false;
  const hubProject = data?.config?.hubProject;
  const spokeProject = data?.config?.spokeProject;
  const subnets = (data?.config as any)?.subnets || {};
  const hubInstances = data?.hub?.instances || [];
  const hubNats = data?.hub?.nats || [];
  const hubFwdRules = data?.hub?.forwardingRules || [];

  const nvaStatus = hubInstances.some(i => i.tags?.includes('nva') && i.state === 'running') ? 'active' : 'pending';
  const natStatus = hubNats.length > 0 ? 'active' : 'pending';
  const ilbStatus = hubFwdRules.length > 0 ? 'active' : 'pending';

  // Build subnet display strings from discovered data
  const subnetEntries = Object.entries(subnets) as [string, any][];
  const primarySubnets = subnetEntries.filter(([, s]) => s.region === primary);
  const secondarySubnets = secondary ? subnetEntries.filter(([, s]) => s.region === secondary) : [];

  // ─── Compute dynamic heights bottom-up ───
  const vpcContentH = secondary
    ? M.RES_H + M.ROW_GAP + M.RES_H  // two rows of resources
    : M.RES_H;                          // one row
  const vpcH = M.GROUP_TOP + vpcContentH + M.GROUP_PAD;
  const hubH = M.GROUP_TOP + vpcH + M.GROUP_PAD;
  const spokeVpcH = M.GROUP_TOP + M.RES_H + M.GROUP_PAD;
  const spokeH = M.GROUP_TOP + spokeVpcH + M.GROUP_PAD;
  const l0ContentH = M.RES_H + M.SECTION_GAP + hubH + M.SECTION_GAP + spokeH;
  const l0H = M.GROUP_TOP + l0ContentH + M.GROUP_PAD;
  const l1H = M.GROUP_TOP + M.RES_H + M.GROUP_PAD;
  const itH = M.GROUP_TOP + l0H + M.SECTION_GAP + l1H + M.GROUP_PAD;

  const workloadProjects = data?.config?.workloadProjects || [];
  const wlProjectH = M.GROUP_TOP + M.RES_H + M.GROUP_PAD;
  const numProjects = Math.max(workloadProjects.length, 1);
  const l2ContentH = M.GROUP_TOP + (wlProjectH + M.SECTION_GAP) * numProjects;
  const l2H = Math.max(l2ContentH, 120);
  const researcherH = M.GROUP_TOP + l2H + M.GROUP_PAD;

  // ════════════════════════════════════════
  // IT ADMIN (outermost container)
  // ════════════════════════════════════════
  nodes.push({
    id: 'g-it', type: 'groupNode',
    position: { x: 0, y: 0 },
    data: { label: 'IT Admin', icon: 'admin_panel_settings', width: 1420, height: itH, groupType: 'it' },
    draggable: false, selectable: false,
  });

  // ════════════════════════════════════════
  // L0: FOUNDATION — child of IT Admin
  // ════════════════════════════════════════
  nodes.push({
    id: 'g-l0', type: 'groupNode',
    parentNode: 'g-it',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'L0: Foundation (Stellar Engine)', icon: 'layers', width: 1390, height: l0H, groupType: 'layer' },
    draggable: false, selectable: false,
  });

  // Stage badges — children of L0
  ['Stage 0: Bootstrap', 'Stage 1: Folders', 'Stage 2: Networking', 'Stage 3: Security'].forEach((label, i) => {
    nodes.push({
      id: `stage-${i}`, type: 'resource',
      parentNode: 'g-l0',
      position: { x: M.GROUP_PAD + 20 + i * M.STAGE_SPACING, y: M.GROUP_TOP },
      data: { label, subtitle: ['Org, IAM, Policies', 'SAs, State Buckets', 'VPCs, NVAs, NAT', 'KMS, Alerts'][i], icon: ['shield', 'folder_shared', 'hub', 'lock'][i], status: 'active' },
    });
  });

  // ════════════════════════════════════════
  // HUB PROJECT — child of L0
  // ════════════════════════════════════════
  const hubY = M.GROUP_TOP + M.RES_H + M.SECTION_GAP;
  nodes.push({
    id: 'g-hub', type: 'groupNode',
    parentNode: 'g-l0',
    position: { x: M.GROUP_PAD, y: hubY },
    data: { label: 'Hub Project', icon: 'cloud', width: 1360, height: hubH, groupType: 'project', subtitle: hubProject || `${prefix}-net-vdss-host` },
    draggable: false, selectable: false,
  });

  // ── Landing VPC — child of Hub ──
  nodes.push({
    id: 'g-landing', type: 'groupNode',
    parentNode: 'g-hub',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'Landing VPC', icon: 'lan', width: 620, height: vpcH, groupType: 'vpc', subtitle: 'vdss-landing-0' },
    draggable: false, selectable: false,
  });

  // Landing resources — children of Landing VPC
  nodes.push({
    id: 'landing-subnet', type: 'resource',
    parentNode: 'g-landing',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'Landing Subnet', subtitle: `${primary}/landing-default`, icon: 'dns', status: 'active' },
  });
  nodes.push({
    id: 'nva-ilb', type: 'resource',
    parentNode: 'g-landing',
    position: { x: 300, y: M.GROUP_TOP },
    data: { label: 'NVA ILB', subtitle: 'nva-vdss-primary', icon: 'mediation', status: ilbStatus },
  });

  // ── DMZ VPC — child of Hub ──
  nodes.push({
    id: 'g-dmz', type: 'groupNode',
    parentNode: 'g-hub',
    position: { x: 660, y: M.GROUP_TOP },
    data: { label: 'DMZ VPC', icon: 'shield', width: 685, height: vpcH, groupType: 'vpc', subtitle: 'vdss-dmz-0' },
    draggable: false, selectable: false,
  });

  // DMZ resources — children of DMZ VPC
  nodes.push({
    id: 'nva-mig', type: 'resource',
    parentNode: 'g-dmz',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'NVA MIG (2x COS)', subtitle: `${primary} — iptables masquerade`, icon: 'memory', status: nvaStatus },
  });
  nodes.push({
    id: 'cloud-nat', type: 'resource',
    parentNode: 'g-dmz',
    position: { x: 370, y: M.GROUP_TOP },
    data: { label: 'Cloud NAT', subtitle: `nat-${primary}`, icon: 'router', status: natStatus },
  });

  // ── Secondary Region resources (if exists) ──
  if (secondary) {
    const secY = M.GROUP_TOP + M.RES_H + M.ROW_GAP;

    // Secondary in Landing VPC
    nodes.push({
      id: 'sec-landing-subnet', type: 'resource',
      parentNode: 'g-landing',
      position: { x: M.GROUP_PAD, y: secY },
      data: { label: `Landing Subnet`, subtitle: `${secondary}/landing-default`, icon: 'dns', status: 'active' },
    });
    nodes.push({
      id: 'sec-nva-ilb', type: 'resource',
      parentNode: 'g-landing',
      position: { x: 300, y: secY },
      data: { label: 'NVA ILB', subtitle: 'nva-vdss-secondary', icon: 'mediation', status: ilbStatus },
    });

    // Secondary in DMZ VPC
    nodes.push({
      id: 'sec-nva-mig', type: 'resource',
      parentNode: 'g-dmz',
      position: { x: M.GROUP_PAD, y: secY },
      data: { label: 'NVA MIG (2x COS)', subtitle: `${secondary} — masquerade`, icon: 'memory', status: nvaStatus },
    });
    nodes.push({
      id: 'sec-cloud-nat', type: 'resource',
      parentNode: 'g-dmz',
      position: { x: 370, y: secY },
      data: { label: 'Cloud NAT', subtitle: `nat-${secondary}`, icon: 'router', status: natStatus },
    });
  }

  // ════════════════════════════════════════
  // SPOKE PROJECT — child of L0
  // ════════════════════════════════════════
  const spokeY = hubY + hubH + M.SECTION_GAP;
  nodes.push({
    id: 'g-spoke', type: 'groupNode',
    parentNode: 'g-l0',
    position: { x: M.GROUP_PAD, y: spokeY },
    data: { label: 'Spoke Project', icon: 'cloud', width: 1360, height: spokeH, groupType: 'project', subtitle: spokeProject || `${prefix}-prod-net-host` },
    draggable: false, selectable: false,
  });

  // Spoke VPC — child of Spoke Project
  nodes.push({
    id: 'g-spoke-vpc', type: 'groupNode',
    parentNode: 'g-spoke',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'Prod Spoke VPC', icon: 'lan', width: 1330, height: spokeVpcH, groupType: 'vpc', subtitle: 'prod-spoke-0  (VPC Peering to Landing)' },
    draggable: false, selectable: false,
  });

  // Spoke resources — children of Spoke VPC
  nodes.push({
    id: 'spoke-primary', type: 'resource',
    parentNode: 'g-spoke-vpc',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'Primary Subnet', subtitle: primarySubnets.length > 0 ? `${primarySubnets[0][0]} — ${primarySubnets[0][1].cidr}` : `${primary}/default`, icon: 'dns', status: 'active' },
  });

  if (secondary) {
    nodes.push({
      id: 'spoke-secondary', type: 'resource',
      parentNode: 'g-spoke-vpc',
      position: { x: 460, y: M.GROUP_TOP },
      data: { label: 'Secondary Subnet', subtitle: secondarySubnets.length > 0 ? `${secondarySubnets[0][0]} — ${secondarySubnets[0][1].cidr}` : `${secondary}/default`, icon: 'dns', status: 'active' },
    });
  }

  nodes.push({
    id: 'spoke-pga', type: 'resource',
    parentNode: 'g-spoke-vpc',
    position: { x: 940, y: M.GROUP_TOP },
    data: { label: 'Private Google Access', subtitle: 'restricted.googleapis.com', icon: 'vpn_lock', status: 'active' },
  });

  // ════════════════════════════════════════
  // L1: PROJECT FACTORY — child of IT Admin
  // ════════════════════════════════════════
  const l1Y = M.GROUP_TOP + l0H + M.SECTION_GAP;
  nodes.push({
    id: 'g-l1', type: 'groupNode',
    parentNode: 'g-it',
    position: { x: M.GROUP_PAD, y: l1Y },
    data: { label: 'L1: Project Factory (Researcher Lab)', icon: 'assignment', width: 1390, height: l1H, groupType: 'layer' },
    draggable: false, selectable: false,
  });

  // L1 resources — children of L1
  nodes.push({
    id: 'pf-sa', type: 'resource',
    parentNode: 'g-l1',
    position: { x: M.GROUP_PAD + 20, y: M.GROUP_TOP },
    data: { label: 'Project Factory SA', subtitle: `${prefix}-prod-resman-pf-0`, icon: 'person', status: 'active' },
  });
  nodes.push({
    id: 'pf-yaml', type: 'resource',
    parentNode: 'g-l1',
    position: { x: 460, y: M.GROUP_TOP },
    data: { label: 'YAML Configs', subtitle: 'data/projects/*.yaml', icon: 'description', status: 'info' },
  });
  nodes.push({
    id: 'pf-apply', type: 'resource',
    parentNode: 'g-l1',
    position: { x: 950, y: M.GROUP_TOP },
    data: { label: 'Terraform Apply', subtitle: 'Creates researcher projects', icon: 'play_arrow', status: 'active' },
  });

  // ════════════════════════════════════════
  // RESEARCHER (separate top-level container)
  // ════════════════════════════════════════
  nodes.push({
    id: 'g-researcher', type: 'groupNode',
    position: { x: 0, y: itH + M.SECTION_GAP },
    data: { label: 'Researcher', icon: 'science', width: 1420, height: researcherH, groupType: 'researcher' },
    draggable: false, selectable: false,
  });

  // L2: Workloads — child of Researcher
  nodes.push({
    id: 'g-l2', type: 'groupNode',
    parentNode: 'g-researcher',
    position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
    data: { label: 'L2: Workloads', icon: 'biotech', width: 1390, height: l2H, groupType: 'layer' },
    draggable: false, selectable: false,
  });

  // Workload project cards — full-width, stacked vertically inside L2
  if (workloadProjects.length > 0) {
    workloadProjects.forEach((projId, i) => {
      const projData = data?.workloads?.[projId] as any;
      const firstInst = projData?.instances?.[0];
      const vmStatus = firstInst?.state === 'running' ? 'running' : 'pending';
      const bucketStatus = (projData?.buckets?.length ?? 0) > 0 ? 'active' : 'pending';
      const shortName = projId.replace(`${prefix}-`, '');

      // Extract enriched network info from instance
      const machineType = firstInst?.machineType || '';
      const network = firstInst?.network || 'prod-spoke-0';
      const internalIP = firstInst?.internalIPs?.[0] || '';
      const vmName = firstInst?.name || shortName;
      const vmSubtitle = machineType
        ? `${vmName} · ${machineType}${internalIP ? ` · ${internalIP}` : ''}`
        : vmName;

      const projectY = M.GROUP_TOP + i * (wlProjectH + M.SECTION_GAP);

      nodes.push({
        id: `g-wl-${i}`, type: 'groupNode',
        parentNode: 'g-l2',
        position: { x: M.GROUP_PAD, y: projectY },
        data: { label: 'Project', icon: 'folder', width: 1360, height: wlProjectH, groupType: 'project', subtitle: projId },
        draggable: false, selectable: false,
      });
      nodes.push({
        id: `wl-net-${i}`, type: 'resource',
        parentNode: `g-wl-${i}`,
        position: { x: M.GROUP_PAD, y: M.GROUP_TOP },
        data: { label: 'Shared VPC', subtitle: `${network} (service project)`, icon: 'lan', status: 'active' },
      });
      nodes.push({
        id: `wl-vm-${i}`, type: 'resource',
        parentNode: `g-wl-${i}`,
        position: { x: 380, y: M.GROUP_TOP },
        data: { label: 'Workbench VM', subtitle: vmSubtitle, icon: 'terminal', status: vmStatus },
      });
      nodes.push({
        id: `wl-bucket-${i}`, type: 'resource',
        parentNode: `g-wl-${i}`,
        position: { x: 840, y: M.GROUP_TOP },
        data: { label: 'GCS Bucket', subtitle: projData?.buckets?.[0]?.name || `${projId}-bucket`, icon: 'cloud_upload', status: bucketStatus },
      });
    });
  } else {
    nodes.push({
      id: 'wl-placeholder', type: 'resource',
      parentNode: 'g-l2',
      position: { x: M.GROUP_PAD + 20, y: M.GROUP_TOP },
      data: { label: 'No workload projects found', subtitle: 'Create researcher projects via L1', icon: 'info', status: 'pending' },
    });
  }

  return nodes;
}

function buildStaticEdges(data: AllResources | null): Edge[] {
  const secondary = data?.config?.regions?.secondary;
  const edgeStyle = { stroke: '#DADCE0', strokeWidth: 1.5 };
  const activeStyle = { stroke: '#34A853', strokeWidth: 2 };

  const edges: Edge[] = [
    // Stage flow
    { id: 'e-s0-s1', source: 'stage-0', target: 'stage-1', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true },
    { id: 'e-s1-s2', source: 'stage-1', target: 'stage-2', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true },
    { id: 'e-s2-s3', source: 'stage-2', target: 'stage-3', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true },

    // NVA path: Landing ILB → NVA MIG → Cloud NAT
    { id: 'e-ilb-nva', source: 'nva-ilb', target: 'nva-mig', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true, label: 'eth1 → eth0' },
    { id: 'e-nva-nat', source: 'nva-mig', target: 'cloud-nat', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true },

    // Subnet → ILB
    { id: 'e-lsub-ilb', source: 'landing-subnet', target: 'nva-ilb', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: edgeStyle },

    // VPC Peering: Spoke → Landing
    { id: 'e-peering', source: 'spoke-primary', target: 'landing-subnet', sourceHandle: 'source-top', targetHandle: 'target-bottom', type: 'smoothstep', style: { ...activeStyle, strokeDasharray: '6 3' }, label: 'VPC Peering' },

    // L1 flow
    { id: 'e-pf-sa-yaml', source: 'pf-sa', target: 'pf-yaml', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: edgeStyle },
    { id: 'e-pf-yaml-apply', source: 'pf-yaml', target: 'pf-apply', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: edgeStyle },
  ];

  // Shared VPC edges: workload network cards → spoke VPC
  const workloadProjects = data?.config?.workloadProjects || [];
  workloadProjects.forEach((_, i) => {
    edges.push({
      id: `e-wl-net-${i}`, source: `wl-net-${i}`, target: 'spoke-primary',
      sourceHandle: 'source-top', targetHandle: 'target-bottom',
      type: 'smoothstep',
      style: { stroke: '#4285F4', strokeWidth: 2, strokeDasharray: '6 3' },
      label: 'Shared VPC',
    });
  });

  if (secondary) {
    edges.push(
      { id: 'e-sec-ilb-nva', source: 'sec-nva-ilb', target: 'sec-nva-mig', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true },
      { id: 'e-sec-nva-nat', source: 'sec-nva-mig', target: 'sec-cloud-nat', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: activeStyle, animated: true },
      { id: 'e-sec-sub-ilb', source: 'sec-landing-subnet', target: 'sec-nva-ilb', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', style: edgeStyle },
      { id: 'e-sec-peering', source: 'spoke-secondary', target: 'sec-landing-subnet', sourceHandle: 'source-top', targetHandle: 'target-bottom', type: 'smoothstep', style: { ...activeStyle, strokeDasharray: '6 3' }, label: 'VPC Peering' },
    );
  }

  return edges;
}

const InfraFlowInner: React.FC = () => {
  const [data, setData] = useState<AllResources | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchAllResources();
      setData(result);
      setLastRefresh(new Date().toLocaleTimeString('en-US', { hour12: false }));
    } catch (err) {
      console.error('Failed to fetch resources:', err);
      // Use fallback static data for demo
      setData({
        config: {
          orgId: '', domain: '', prefix: 'demo',
          hubProject: 'demo-net-vdss-host',
          spokeProject: 'demo-prod-net-host',
          workloadProjects: ['demo-workload-1'],
          hasVdss: true,
          regions: { primary: 'us-central1', secondary: 'us-west1' },
        },
        hierarchy: { orgId: '', domain: '', folders: [] },
        hub: { networks: [], instances: [], forwardingRules: [], nats: [] },
        spoke: { networks: [], subnets: [] },
        workloads: {},
      } as AllResources);
      setLastRefresh('(demo mode)');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  // Update nodes and edges when API data changes
  useEffect(() => {
    setNodes(buildStaticNodes(data));
    setEdges(buildStaticEdges(data));
  }, [data, setNodes, setEdges]);

  const selectedDetail = selectedNode ? {
    title: selectedNode,
    icon: 'info',
    details: {} as Record<string, string>,
    differentiator: GCP_DIFFERENTIATORS[selectedNode],
  } : null;

  return (
    <div className="infra-flow-wrapper">
      <Header lastRefresh={lastRefresh} isLoading={isLoading} onRefresh={loadData} />
      <div className="infra-content">
        <div className="flow-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => setSelectedNode(node.id)}
            onPaneClick={() => setSelectedNode(null)}
          >
            <Background color="#E8EAED" gap={20} />
            <Controls />
          </ReactFlow>
        </div>
        {selectedDetail && (
          <div className="detail-sidebar">
            <DetailPanel {...selectedDetail} details={{}} />
          </div>
        )}
      </div>
    </div>
  );
};

export const InfraFlow: React.FC = () => (
  <ReactFlowProvider>
    <InfraFlowInner />
  </ReactFlowProvider>
);
