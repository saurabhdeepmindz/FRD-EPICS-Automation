"""
AWS Deployment View — structured model (§7 of the reference HLD).

Where §3–§6 answer "what is the architecture", §7 answers "how does it run". It
is ONE concrete deployment instantiation on AWS of the cloud-agnostic architecture
from §4: a layered service-catalogue diagram (Users/Edge/API → Compute → Async
messaging → Data → Observability/Security/Platform), each layer naming the specific
AWS managed services that host it. It then produces four sub-sections: §7.1 the
AWS service mapping (HLD layer → component → AWS service → rationale), §7.2 the
serverless choices (where Lambda fits), §7.3 what is deliberately NOT in this view,
and §7.4 how the view evolves. Everything is grounded in the project's actual
PRD/FRD/HLD components; anything inferred/missing is reported in `gaps`.
"""

DEPLOYMENT_VIEW_SYSTEM_PROMPT = """You are an expert AWS solutions architect. From the project's PRD/FRD/HLD, produce an AWS DEPLOYMENT VIEW (§7) as a STRICT JSON object. This is ONE concrete deployment instantiation on AWS of the cloud-agnostic architecture described in the HLD's layered/technical view. The platform is cloud-agnostic by design — nothing in the application code binds it to AWS — but this section shows how it runs on AWS, naming the specific AWS managed service that hosts each architectural layer/component.

Ground EVERYTHING in the given project. Map the project's ACTUAL components (the databases, queues, caches, search engines, compute units, AI/LLM usage, integrations it really has) to their AWS managed equivalents. Do NOT invent services the project does not need. Be honest for simpler projects: if a whole layer does not apply (e.g. no async messaging in a synchronous CRUD app, no AI/ML layer in a non-AI product), mark that layer `applicable=false` with a one-line reason and leave its services empty.

Return EXACTLY this shape:
{
  "intro": "string",                 // 2–3 sentences: cloud-agnostic by design; this is one AWS instantiation; why AWS is a reasonable target for THIS project. Reference the project's real component choices.
  "cloud": "AWS",
  "region": "string",                // a sensible single region, e.g. "ap-south-1 (Mumbai)" for an India-focused product, "us-east-1 (N. Virginia)" otherwise. Infer from the project; default to a generic primary region if unknown.
  "account": "string",               // short account label, e.g. "prod" or "<product>-prod"
  "scopeNote": "string",             // 1–2 sentences on what this v1 view deliberately keeps simple: which AWS service runs each layer, what serverless paths exist, where data sits — and that networking topology (VPC/subnets/NAT), autoscaling, multi-AZ, multi-region and DR are explicitly NOT in this view.
  "layers": [                        // horizontal bands, top→bottom, SAME keys/names/order
    {"key":"edge",          "name":"Users · Edge · API",                         "applicable":true, "outOfScope":"", "services":[ ... ], "subGroups":[]},
    {"key":"compute",       "name":"Compute — containers for long-running services, serverless where it fits", "applicable":true, "outOfScope":"", "services":[], "subGroups":[ ... ]},
    {"key":"async",         "name":"Async messaging · Events · Scheduling",       "applicable":true, "outOfScope":"", "services":[ ... ], "subGroups":[]},
    {"key":"data",          "name":"Data layer — managed services, encryption at rest via KMS", "applicable":true, "outOfScope":"", "services":[ ... ], "subGroups":[]},
    {"key":"observability", "name":"Observability · Security · Platform (cross-cutting)", "applicable":true, "outOfScope":"", "services":[ ... ], "subGroups":[]}
  ],
  "serviceMapping": [                 // §7.1 — traces every concern from the architecture to the AWS service that delivers it
    {"hldLayer":"string", "component":"string", "awsService":"string", "rationale":"string"}
  ],
  "serverless": {                     // §7.2 — where Lambda / serverless fits (selective, not the primary compute model)
    "intro":"string",
    "patterns":[ {"pattern":"string", "detail":"string"} ],
    "closing":"string"
  },
  "notInView": [ {"item":"string", "reason":"string"} ],   // §7.3 — deliberate omissions (so reviewers do not mistake omission for ignorance)
  "evolution": [ {"when":"string", "added":"string"} ],    // §7.4 — what gets added to this view as the project's phases/roadmap progress
  "gaps": ["string"]
}

Each service tile is:
  {"name":"string",      // AWS service display name, e.g. "Amazon RDS for PostgreSQL", "AWS Lambda", "Amazon EKS"
   "abbr":"string",      // SHORT 2–4 char tag, e.g. "RDS", "EKS", "S3", "MSK", "SQS", "CW"
   "family":"string",    // AWS service-family for icon colour — see enum below
   "subtext":"string"}   // ≈2–6 word note, e.g. "multi-tenant · RLS", "domain events", "edge cache"

`family` MUST be one of (choose the correct AWS service-family for the icon colour):
  "compute"        — EC2, Lambda, Batch
  "containers"     — EKS, ECS, ECR, Fargate, App Runner
  "storage"        — S3, S3 Glacier, EFS, EBS
  "database"       — RDS, Aurora, DynamoDB, ElastiCache, Redshift-as-DB, Neptune
  "analytics"      — Redshift, Athena, EMR, Kinesis, OpenSearch (analytics/log use), Glue, QuickSight
  "appIntegration" — SQS, SNS, EventBridge, API Gateway, Step Functions, MSK, MQ, AppSync
  "security"       — IAM, KMS, Secrets Manager, Cognito, WAF, Shield, GuardDuty, Certificate Manager
  "mlai"           — Bedrock, SageMaker, Comprehend, Textract, Rekognition, Kendra
  "networking"     — Route 53, CloudFront, VPC, ALB/ELB, API Gateway-as-edge, Global Accelerator
  "management"     — CloudWatch, X-Ray, CloudFormation, CloudTrail, Config, Systems Manager, Managed Grafana/Prometheus

Field rules:
- `layers`: most layers use the flat `services` array. The `compute` layer SHOULD use `subGroups` to separate long-running container workloads from serverless: e.g. [{"label":"<Containers> cluster","services":[...]}, {"label":"Serverless paths","services":[...]}]. Only add serverless sub-group if the project actually has bursty/scheduled/event paths; otherwise put everything under one container sub-group or a flat list.
- Pick services that mirror the project's REAL stack: e.g. if the HLD uses PostgreSQL → "Amazon RDS for PostgreSQL"; Redis → "Amazon ElastiCache for Redis"; Kafka → "Amazon MSK"; if it uses Anthropic Claude → "Amazon Bedrock" (managed runtime) and note other LLMs go via direct provider APIs with keys in Secrets Manager; object storage / MinIO → "Amazon S3"; OpenSearch/Elasticsearch → "Amazon OpenSearch Service"; Kubernetes/containers → "Amazon EKS"; a CDN → "Amazon CloudFront"; auth → "Amazon Cognito" (note enterprise SSO still federates to the tenant's own IdP).
- ALWAYS include the cross-cutting observability/security layer: CloudWatch, plus whatever the project implies (X-Ray, Managed Prometheus/Grafana if it uses Prometheus/Grafana, IAM, KMS, Secrets Manager, VPC, CloudFormation/CDK).
- `serviceMapping` (§7.1): one row per architectural concern that maps to an AWS service — cover edge, compute, async, data, observability, security, networking, platform. Where the HLD picks an in-house tool (e.g. self-hosted Vault, MinIO, ClickHouse), name BOTH the AWS-native equivalent AND a one-line trade-off note. 12–24 rows depending on project size.
- `serverless` (§7.2): explain that long-running services stay on containers (they hold state / multiplex requests) and Lambda is reserved for bursty or scheduled paths. List the project's real serverless candidates as `patterns` (e.g. webhook ingress, cron/scheduled jobs, document/file processing). If the project has NO obvious serverless path, say so honestly in `intro` and leave `patterns` short or empty.
- `notInView` (§7.3): list deliberate omissions for THIS view — typically DR topology, multi-AZ detail, autoscaling rules, VPC/subnet/security-group detail, multi-region, cost model. Give each a one-line reason (belongs to a deployment-engineering doc, or out of scope for v1).
- `evolution` (§7.4): tie to the project's roadmap/phases if the PRD/HLD has one (POC → next module → GA). Each row: when, and what AWS content is added (e.g. ML training infra, multi-AZ explicit, per-tenant cost dashboards, multi-region for residency, DR runbooks).
- Keep it honest and project-specific. If the project is small/simple, produce a small, simple AWS view — do not force-fit enterprise services it will never use.
- `gaps`: anything inferred, defaulted (e.g. region guess), or missing from the docs."""


def build_deployment_view_user_message(product_name: str, prd_context: str, hld_context: str) -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:9000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:7000]}")
    parts.append("\n## Task\nReturn the AWS Deployment View JSON described above, as one concrete AWS instantiation grounded in this project's real components.")
    return "\n".join(parts)
