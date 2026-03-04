# Fast Science Infrastructure Visualizer

Interactive dashboard showing the full Fast Science GCP infrastructure — L0 foundation (Stellar Engine), L1 project factory, and L2 researcher workloads — as a live ReactFlow graph with nested project and VPC boundaries.

## Architecture

```
L0 (IT Admin)          L1 (IT Admin)           L2 (Researcher)
+---------------+   +------------------+   +------------------+
| Bootstrap     |   | Project Factory  |   | Workload Projects|
| Folders/SAs   |-->| YAML per project |-->| VMs, Buckets,    |
| VPCs/NVAs/NAT |   | Shared VPC       |   | Notebooks        |
| KMS/Alerts    |   | IAM, Billing     |   | Pipelines        |
+---------------+   +------------------+   +------------------+
```

**Data sources**: Auto-discovers infrastructure from the Stellar Engine outputs bucket (tfvars), then uses Cloud Asset Inventory for live resource state.

## Setup

### 1. Find your outputs bucket

The Stellar Engine bootstrap stage (L0 Stage 0) creates an outputs bucket following the convention `{prefix}-prod-iac-core-outputs-0`. This bucket contains tfvars JSON files that describe your entire deployment — projects, VPCs, subnets, regions, and folder structure. The visualizer reads these to auto-discover everything.

```bash
# Find it in your bootstrap outputs:
cd fast-science-0-stellar-engine/fast/stages-aw/0-bootstrap
terraform output -raw automation | jq -r '.outputs_bucket'

# Or list GCS buckets matching the pattern:
gcloud storage ls | grep prod-iac-core-outputs
```

### 2. Authenticate

```bash
gcloud auth login
gcloud auth application-default login
```

The authenticated user needs:
- `storage.objects.get` on the outputs bucket (to read tfvars)
- `cloudasset.assets.searchAllResources` on the discovered projects (typically `roles/cloudasset.viewer`)

### 3. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Pass your outputs bucket — everything else is auto-discovered
export OUTPUTS_BUCKET="<prefix>-prod-iac-core-outputs-0"
python main.py
```

The backend reads the tfvars, discovers all projects (hub, spoke, workloads), and serves live resource data on `http://localhost:5000`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## What It Auto-Discovers

| Source | What's Discovered |
|--------|------------------|
| `0-globals.auto.tfvars.json` | Prefix, org ID, domain, enabled features |
| `1-resman.auto.tfvars.json` | Folder IDs (Networking, Security, Envs) |
| `2-networking.auto.tfvars.json` | Hub project, spoke project, VPC names, subnet CIDRs, regions, VDSS config |
| Cloud Asset Inventory | Live VMs (state, tags, IPs), ILBs, Cloud NAT, routes, GCS buckets |
| CAI + envs folder ID | Workload projects (auto-discovered from the Prod folder) |

## What It Shows

- **IT Admin section**: L0 stages, hub project with Landing/DMZ VPCs, NVA MIGs, ILBs, Cloud NAT, VPC peering, spoke project with subnets — all discovered dynamically
- **Researcher section**: Auto-discovered L2 workload projects with VM status, GCS buckets
- **Live status**: Green = running/active, blue = in progress, gray = pending
- **GCP differentiators**: Click on key resources to see "Why Google Cloud" tooltips
- **Graceful degradation**: Deployments without VDSS/NVA skip the hub section; deployments with one region show one set of resources

## Related Repos

| Layer | Repo | Purpose |
|-------|------|---------|
| **L0** | [fast-science-0-stellar-engine](https://github.com/WandLZhang/fast-science-0-stellar-engine) | GCP org landing zone |
| **L1** | [fast-science-1-researcher-lab](https://github.com/WandLZhang/fast-science-1-researcher-lab) | Researcher project provisioning |
| **L2** | [fast-science-2-workload-catalog](https://github.com/WandLZhang/fast-science-2-workload-catalog) | Science workloads |
