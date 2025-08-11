# Cross-Modal Fusion Displays Plan
Status: Draft
Updated: 2025-08-10

## Goal
Provide unified visualization & interaction surfaces that combine text, audio, image, and (future) sensor/structured data to amplify insight discovery and agent reasoning transparency.

## Primary Fusion Scenarios (Phase 1)
1. Email + Attachment Intelligence
   - Pair summarization, key entities, and preview thumbnails (images / docs) in a single expandable panel.
2. Knowledge Graph Node Lens
   - Node selection shows aggregated multimodal artifacts (snippets, images, waveform segments) aligned on a semantic timeline.
3. Meeting Intelligence Card
   - Transcript excerpt + sentiment arc + action item list + audio energy mini-chart.
4. Contact Relationship Insight
   - Recent communications (emails, chat summary), shared files thumbnails, last meeting snippet.

## Data Contracts
### Unified Artifact Object
```json
{
  "id": "uuid",
  "modality": "text|image|audio|video|embedding|structured",
  "source": "gmail|drive|meeting|rag|manual",
  "timestamp": "2025-08-10T12:00:00Z",
  "summary": "Short human readable description",
  "payload_ref": "hfbin:... or url or db-key",
  "meta": { "mime": "image/png", "duration_ms": 12345, "size": 204800 }
}
```

### Fusion Panel Response
```json
{
  "context_id": "entity_or_thread_id",
  "artifacts": [UnifiedArtifact...],
  "relationships": [{"from":"artifactId","to":"artifactId","type":"derived|temporal|semantic"}],
  "embeddings_cluster": {"centroid": "[0.1,0.2,...]", "count": 42},
  "insights": [{"type":"action_item","text":"Follow up with client"},{"type":"sentiment_trend","value":"improving"}]
}
```

## Backend Layer Additions
Service: FusionAggregationService
Responsibilities:
- Accept query (entity_id, time range, modalities[])
- Fetch artifact metadata from existing stores (emails, transcripts, knowledge entries, binary tokens)
- Join & normalize to Unified Artifact
- Perform lightweight semantic clustering (use existing embeddings) for grouping
- Derive inline insights (basic heuristics first)

Endpoints (Phase 1):
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/fusion/context/:contextId | Fetch fused artifact view |
| GET | /api/fusion/search?q=... | Cross-modal artifact search (metadata only) |

## UI Components
- <FusionPanel contextId="..." />
  - Header: context label, modality filter chips, refresh
  - Cluster Overview: pill with artifact count + cluster cohesion score
  - Timeline Strip: horizontal scroll with artifact markers (icon by modality)
  - Artifact Grid/List Toggle
  - Insight Sidebar: key actions, trends, anomalies
- <ArtifactCard /> modality-aware rendering stubs
  - text → snippet
  - image → thumb + open modal
  - audio → waveform placeholder + play

## Incremental Delivery Plan
1. Contract + dummy endpoint returning mocked fused response.
2. Frontend FusionPanel with mock fetch + rendering placeholders.
3. Integrate into KnowledgeHub node detail (lens) & Email details drawer.
4. Real data wiring for emails + images (attachments) + transcripts.
5. Add clustering & embeddings centroid stats.
6. Add timeline & filters.

## Telemetry
Spans: fusion.aggregate, fusion.cluster
Counters: fusion_requests_total{modality}
Gauge: fusion_context_artifacts{context_type}

## Performance Considerations
- Lazy load large binary assets; only fetch metadata first.
- Implement pagination / windowing for artifact lists.

## Security & Privacy
- Enforce ownership for artifacts; validate hfbin: token ownership.
- Redact PII in summaries for shared collaborative contexts (future).

## Future Enhancements
- Real-time incremental artifact streaming (websocket) during live meetings.
- Cross-context similarity jump suggestions.
- Multimodal embedding projection (2D map) interactive.

---
End of plan.
