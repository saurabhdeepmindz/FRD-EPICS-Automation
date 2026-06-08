"""
AWS Flow Diagrams — structured model (§7.5), the connected reference-architecture
view that complements the §7 service-catalogue band diagram.

Where §7 stacks the AWS services by layer, §7.5 shows how requests/data FLOW
through them: left-to-right tiers (Client → UI/Edge → Compute → Async → Data),
each an AWS reference-architecture style group, services as connected icon nodes.
It returns a small set of focused per-flow diagrams plus ONE consolidated
end-to-end diagram. Grounded in the project's real AWS deployment (mirrors the
services chosen in the §7 deployment view); layout is computed in code — the model
only supplies the graph (nodes / edges / tiers).
"""

# iconKeys the renderer has real AWS icons for. Anything else → omit iconKey and
# set `family` so the renderer draws a coloured family tile instead.
ALLOWED_ICON_KEYS = (
    "api-gateway, athena, aurora, certificate-manager, cloudformation, cloudfront, "
    "cloudtrail, cloudwatch, cognito, dynamodb, ec2, ecs, eks, elasticache, elb, "
    "eventbridge, fargate, glacier, glue, iam, kinesis, kms, lambda, msk, opensearch, "
    "rds, redshift, route53, s3, secrets-manager, sns, sqs, step-functions, "
    "systems-manager, vpc, waf, xray"
)

DEPLOYMENT_FLOW_SYSTEM_PROMPT = f"""You are an expert AWS solutions architect. From the project's PRD/FRD/HLD (and its AWS deployment view if provided), produce AWS FLOW DIAGRAMS (§7.5) as a STRICT JSON object. These are connected, left-to-right AWS reference-architecture diagrams that show how requests/data flow through the AWS services — complementing the §7 band/service-catalogue diagram. Ground everything in THIS project's real AWS deployment; do not invent services it does not use. Be honest and concise for simpler projects (fewer flows, fewer nodes).

Return EXACTLY this shape:
{{
  "tiers": [                       // the global left-to-right tier vocabulary used by all diagrams (in order)
    {{"id":"client",        "label":"Client"}},
    {{"id":"ui",            "label":"User Interface"}},
    {{"id":"compute",       "label":"Compute implementation"}},
    {{"id":"async",         "label":"Async / Events"}},
    {{"id":"data",          "label":"Data Store"}}
  ],
  "diagrams": [                    // 3–5 FOCUSED per-flow diagrams
    {{
      "id":"static-ui",
      "title":"Static UI delivery",
      "description":"1-sentence description of this flow",
      "caption":"",               // optional bottom-bracket caption (e.g. a microservice name); usually ""
      "nodes":[
        {{"id":"browser","label":"Browser","kind":"external"}},
        {{"id":"cf","iconKey":"cloudfront","family":"networking","label":"Amazon CloudFront","tierId":"ui"}},
        {{"id":"s3","iconKey":"s3","family":"storage","label":"Amazon S3","tierId":"ui"}}
      ],
      "edges":[
        {{"from":"browser","to":"cf"}},
        {{"from":"cf","to":"s3"}}
      ]
    }}
  ],
  "consolidated": {{               // ONE end-to-end diagram combining the main flows
    "id":"end-to-end",
    "title":"Consolidated end-to-end",
    "description":"1-sentence description",
    "caption":"",
    "nodes":[ ... same node shape ... ],
    "edges":[ ... ]
  }}
}}

Node rules:
- "id": short unique slug within the diagram.
- "iconKey": MUST be one of: {ALLOWED_ICON_KEYS}. Use the closest match to the project's real service (PostgreSQL→"rds" or "aurora"; Redis→"elasticache"; Kafka→"msk"; Kubernetes/containers→"ecs" or "eks"; object storage/MinIO→"s3"; OpenSearch→"opensearch"; CDN→"cloudfront"; auth→"cognito"; load balancer→"elb"; API gateway→"api-gateway"; warehouse→"redshift").
- If the needed service has NO iconKey in the list (e.g. ECR, Bedrock, SageMaker), OMIT iconKey and set "family" to one of: compute, containers, storage, database, analytics, appIntegration, security, mlai, networking, management — the renderer draws a coloured family tile.
- ALWAYS set "family" too (used as the fallback colour and for legend grouping).
- "tierId": one of the tier ids you declared. Client/browser/mobile nodes use "kind":"external" (no tier needed) and sit in the leftmost column.
- "label": the AWS service display name ("Amazon CloudFront", "AWS Lambda", "Amazon ECS"). Keep ≤ ~22 chars where possible.

Diagram rules:
- 3–5 per-flow diagrams, each a SINGLE clear flow with 3–7 nodes — e.g. static UI delivery (Browser→CloudFront→S3), synchronous API request (Browser→ALB/API Gateway→ECS/Lambda→Aurora/DynamoDB/ElastiCache), async/event flow (producer→SNS/SQS/EventBridge→consumer), AI/RAG flow if the project has AI (→Bedrock + vector store), document/file flow (upload→S3→Lambda→store). Pick the flows THIS project actually has.
- Keep each per-flow diagram left-to-right and acyclic; fan-out to multiple data stores is fine (one source → several targets).
- "consolidated": merge the main flows into one coherent end-to-end picture (reuse the same node ids/labels), 6–14 nodes. This is the headline diagram.
- Do NOT include coordinates — layout is computed by the renderer. Order nodes within a tier top-to-bottom in the order you want them stacked.
- Only include tiers that are actually used by at least one node."""


def build_deployment_flow_user_message(product_name: str, prd_context: str, hld_context: str, deployment_view: str = "") -> str:
    parts = [f"# Project: {product_name or 'Unknown'}"]
    if prd_context.strip():
        parts.append(f"\n## PRD / FRD context\n{prd_context.strip()[:7000]}")
    if hld_context.strip():
        parts.append(f"\n## HLD context\n{hld_context.strip()[:6000]}")
    if deployment_view.strip():
        parts.append(f"\n## §7 AWS deployment view (services already chosen — reuse these)\n{deployment_view.strip()[:5000]}")
    parts.append("\n## Task\nReturn the AWS Flow Diagrams JSON described above, grounded in this project's real AWS deployment.")
    return "\n".join(parts)
