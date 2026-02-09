# NGA Curator – Product Requirements Document (PRD)

## 1. Overview and Assumptions

### Project Summary

The NGA Curator is an AI-powered web platform that lets users explore the National Gallery of Art's open collection through an interactive gallery and AI "curator" chat assistant. Users can anonymously browse artworks in a responsive image grid and ask questions to an AI curator that provides context, answers, and related artwork suggestions. The system integrates a static front-end (hosted on Geuse.io's S3) with a sleek, "Liquid Glass"-inspired design, and a no-code back-end orchestrated by n8n (v2.6.3) workflows. All data (a subset of NGA's open data) is stored in Postgres and Qdrant (vector DB) and all AI responses are generated via an internal Ollama LLM service.

### Key Updated Choices

Unlike earlier blueprints, the front-end is delivered as a static site (no server-side rendering) for simplicity and speed. The gallery grid not only displays art thumbnails but doubles as the chat interface – the user can converse with the AI curator without leaving the gallery view. The back-end uses n8n's built-in integration nodes for Postgres, Qdrant, and Ollama (avoiding generic HTTP calls) for maintainability. An AI Agent node (with tool integrations) is employed within n8n to handle complex query routing, Retrieval-Augmented Generation (RAG) context assembly, and answer drafting by the LLM.

The initial deployment will ingest only a small sample of the NGA open data (for example, a few hundred to a few thousand artworks) due to storage constraints, with plans to scale up over time.

### Assumptions and Constraints

#### Deployment & Infrastructure

- **Static Webapp**: The front-end is a static bundle served from an S3 bucket on Geuse.io, ensuring global availability via CDN. All dynamic data fetches go to n8n webhooks over HTTPS.
- **n8n Workflow Engine**: An n8n instance (v2.6.3) is running at https://n8n.geuse.io with webhook endpoints enabled.
- **Back-end Services**: PostgreSQL, Qdrant, and Ollama are running as internal services (e.g. Docker containers) accessible to n8n via internal hostnames (`http://postgres:5432`, `http://qdrant:6333`, `http://ollama:11434`). These services are not exposed publicly – the front-end communicates only with n8n.
- **AI Models**: Ollama (run in Docker) has the following models pre-loaded: `nomic-embed-text:latest` and `mxbai-embed-large:latest` for embeddings (768-dim), `llama3.2:3b` for the curator chat, and `llava:latest` for vision (e.g. image description during ingestion). No calls to external AI APIs are required, keeping all AI inference on internal infrastructure for data privacy.

#### Data & Content

- **NGA Open Data**: The full NGA dataset (~130k artworks, ~20k artists) is available via CSV on GitHub. MVP will ingest only a limited subset (e.g. one department or a random sample of a few hundred objects) to keep indices small and iteration fast. All metadata and images are public domain (CC0).
- **Image Hosting**: The open data provides IIIF image URLs for many artworks. The application will use these image links (with thumbnails for performance) to display artwork images. No local image storage needed beyond caching thumbnails as needed.
- **Update Frequency**: The NGA data is updated periodically (daily on GitHub). The system assumes it can fetch updates at least daily (e.g. nightly ingestion jobs) to stay in sync.
- **Data Schema**: The NGA data includes multiple CSVs (objects, constituents, terms, images, etc.). The Postgres schema is designed to mirror this normalized structure (see Section 3). The Qdrant vector index stores embeddings for textual fields of objects (and eventually artists) to enable semantic search and retrieval. Only public metadata is stored; no private user data is retained in the system (the application is read-only for collection data).

#### User Model

- **Anonymous Sessions**: Users do not log in. A unique session UUID is generated on the client (or by n8n) to track a user's chat session and any actions like content flagging. This session ID (stored in local storage or a cookie) is passed with requests to identify the conversation context and apply rate limits. For now, personalization is not implemented; all users see the same general gallery by default.
- **No PII Collected**: Since there's no login, the system collects no personal data. Any optional inputs (e.g. an email if a user flags content and wants updates) are strictly voluntary.
- **Usage Volume**: Initially expected to be low (internal testing and a small public beta). The architecture should handle a few concurrent users easily on modest infrastructure. As usage grows, scaling strategies (outlined later) will be employed.

#### Security & Moderation

- **Content Moderation**: The AI curator is instructed not to output disallowed content (e.g. no profanity, hate, or NSFW descriptions). Additionally, users can flag artworks or AI responses they find problematic (see Section 9 for the flagging process). Flags are reviewed by administrators (no automatic takedowns).
- **System Security**: All API calls are over HTTPS. n8n is protected by basic auth for its editor, but the webhook endpoints are public (optionally with an API key). Postgres credentials are stored securely in n8n. Qdrant's API key feature is enabled for production. The front-end is static, minimizing attack surface. Standard web security best practices apply (CSP headers, sanitization of any user inputs, etc.).

#### Performance Targets

- The UI should remain responsive and visually fluid even on image-heavy pages. We target < 2 second initial load for the gallery page (with lazy-loading images).
- Search queries should return results within ~500ms p95 latency. AI curator responses (which involve LLM processing) can take a bit longer, but aim for < 3 seconds for a response on average. We will implement streaming of the AI answer text if possible, so the user sees the answer appear progressively (enhancing perceived speed).
- The system should handle at least 10 simultaneous users in MVP without performance degradation. As we ingest more data and traffic grows, we will introduce caching and scale-out as needed (see Rollout Plan and Scaling).

## 2. High-Level Architecture

The NGA Curator platform follows a modular, decoupled architecture consisting of a static client application and a suite of backend services orchestrated by n8n workflows. The diagram below illustrates the major components and their interactions:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Front-End (Web)                                                              │
│  Static site on Geuse.io (S3 + CDN)                                         │
│                                                                               │
│ ┌───────────────┐  ┌──────────────┐  ┌──────────────┐                        │
│ │ Gallery Grid  │  │ Search &    │  │ Artwork      │                        │
│ │ + Chat UI     │  │ Filter UI   │  │ Detail View  │                        │
│ └───────────────┘  └──────────────┘  └──────────────┘                        │
│                                                                               │
│        |        |        |                                                    │
│        └────────┴────────┼────────────────────────────┐                       │
│                          ▼                          │                       │
│         (HTTPS API calls via fetch)                │                       │
└──────────────────────────────────────────────────────┼───────────────────────┘
                                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Back-End (n8n)                                                              │
│  Low-code workflows (v2.6.3)                                                 │
│                                                                               │
│ ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐            │
│ │ Webhook    │ │ Webhook     │ │ Webhook    │ │ Webhook      │            │
│ │ /search    │ │ /curator    │ │ /detail    │ │ /flag        │            │
│ └──────┬─────┘ └──────┬───────┘ └──────┬─────┘ └──────┬───────┘            │
│        |              |                |              |                     │
│ ┌──────▼────┐ ┌───────▼────────┐ ┌────▼─────┐ ┌──────▼──────┐             │
│ │ Search    │ │ Curator Agent │ │ Detail   │ │ Flagging   │             │
│ │ Workflow  │ │ Workflow      │ │ Workflow │ │ Workflow   │             │
│ └──────┬────┘ └───────┬────────┘ └────┬─────┘ └──────┬──────┘             │
│        |               |                |              |                     │
│        └───────────────┴────────────────┴──────────────┘                     │
│                          ▼                                                   │
│                          │ Internal calls                                    │
└──────────────────────────┼───────────────────────────────────────────────────┘
                           ▼
┌────────────────┐  ┌─────────────────┐  ┌────────────────┐
│ PostgreSQL     │  │ Qdrant Vector  │  │ Ollama LLM    │
│ (Data Storage) │  │ DB (semantic)   │  │ (Embeddings & │
│                │◄─┼─►│                │◄─┼─►│ Chat Model)   │
│                │  │                │  │                │
└────────────────┘  └─────────────────┘  └────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
         └───── Scheduled Ingestion Workflow ─────┘
         (GitHub CSV → DB → Qdrant →…)
```

### Component Overview

The front-end is a static Single Page Application (SPA) (built with React or similar, then exported to static files) that renders the gallery, search bar, filters, and an overlay chat interface. It communicates with the back-end exclusively via RESTful webhook endpoints exposed by n8n. The back-end consists of n8n workflows that encapsulate all logic for searching, Q&A, and data management. The n8n instance serves as the integration hub, connecting to the Postgres database (which holds canonical art metadata), the Qdrant vector store (for semantic search and similarity), and the Ollama service (for generating embeddings and answering questions with an LLM). The AI curator functionality is implemented as an AI Agent workflow in n8n, which can use tools (like vector search or direct DB queries) to gather information before formulating an answer.

### Data Flow Summary

The system supports several key flows:

1. **Ingestion (ETL) Flow**: A scheduled n8n workflow pulls the latest CSV data from NGA's GitHub each night, parses it, and updates the Postgres tables (insert/update). For each artwork, it generates a fresh embedding (via Ollama's embedding model) and upserts the vector + metadata into Qdrant. This keeps the vector index in sync with the structured data. (Initially, only a limited set of records are ingested to Qdrant due to storage limits.)

2. **Search Flow**: When a user uses the search bar or filters, the front-end calls the `/search` webhook. The n8n Search Workflow performs a hybrid search – it generates an embedding for the query using Ollama and searches Qdrant for semantically similar artworks, while also querying Postgres for keyword matches and applying any filters. The two result sets are merged (e.g. using reciprocal rank fusion) to produce relevant, diverse results. These results (artwork metadata and image links) are returned as JSON to the front-end, which updates the gallery grid.

3. **Curator Q&A Flow**: When the user asks a free-form question in the chat (e.g. "Tell me about Impressionist paintings in the gallery"), the front-end calls the `/curator` webhook. The Curator Agent Workflow in n8n handles this: it first vector-searches Qdrant for relevant artworks or artists (to gather context), possibly runs a Postgres query for any specific data (e.g. counts or dates if needed), and then invokes the Ollama LLM to generate a natural language answer. The LLM is prompted with a system message defining the curator's persona and rules, plus a formatted compilation of the context data (titles, artist names, descriptions of top relevant artworks, etc.). The output is returned to the front-end and displayed in the chat UI, with citations (e.g. referencing specific artwork titles or IDs) that the UI can highlight or link to the relevant pieces.

4. **Detail View Flow**: If the user clicks on a particular artwork in the grid, the front-end might open a detail view or overlay for that piece. The front-end can call the `/detail` webhook with the object ID to fetch a comprehensive set of data on that artwork (full metadata, high-resolution image links, related works). The Detail Workflow simply queries Postgres (and possibly Qdrant for related pieces) and returns the data. (In MVP, the detail page may be static or pre-fetched, but the webhook provides a way to get fresh data or related suggestions on demand.)

5. **Flagging Flow**: If a user flags an artwork or a chat response (to report an issue), the front-end calls the `/flag` webhook. The Flagging Workflow validates the input (category, description), checks abuse (e.g. rate-limits by session to prevent spam), then records the flag in Postgres (with a status of "pending"). Optionally, it can notify administrators (e.g. via email or Slack integration in n8n) for review. Admins use a separate interface (or direct DB access) to review and resolve flags (see Section 9).

### Internal Service Orchestration

All interactions between n8n and the services use specialized nodes: e.g., the Postgres node for database queries and upserts, the Qdrant Vector Store node for similarity search and vector upsert, and the Ollama nodes for generating embeddings and chat completions. By using these nodes, the workflows remain high-level and declarative (no raw HTTP calls), improving reliability and readability. n8n's new AI Agent node is leveraged in the Curator workflow – it enables an LLM-powered decision process to pick the right "tools" (e.g. whether to do a vector search, a DB lookup, or directly answer from context) for a given user question. This makes the system flexible: for instance, the agent could decide to perform a direct database query if the user asks "How many paintings are in the collection?", whereas for "Tell me about Van Gogh's works" it will do a semantic search and then generate an answer with details. All such logic is contained within the n8n workflows, simplifying the front-end (which just sends user queries and displays results).

### Scalability & Future-Proofing

The architecture separates concerns cleanly. The stateless front-end can scale via CDN. The n8n workflows can be scaled by running multiple n8n workers (if needed) or by offloading heavy computation (like vector search) to dedicated services (Qdrant). Postgres can be scaled vertically (and read-replicas added) once the dataset or traffic grows. Qdrant is also horizontally scalable (sharding by vector collection, etc.). The design also allows integrating additional tools or services into the AI agent pipeline in the future (for example, an external knowledge base or a translation service for multilingual support). Monitoring will be set up on key metrics (response times, error rates, etc.) to inform scaling decisions (see Rollout Plan for scaling checkpoints).

## 3. Postgres Schema Design

The PostgreSQL database serves as the source of truth for structured art data and user-generated flags. It stores artworks (objects), artist/creator info (constituents), and various related tables derived from NGA's open data schema. We adopt a 3NF relational design closely mirroring the source CSV files for ease of ingestion and data integrity. Below is an Entity-Relationship overview of the core tables:

```
┌──────────────┐    ┌────────────────────┐    ┌──────────────────┐
│ objects      │◄───►│ objects_constituents├───►│ constituents     │
│ (artworks)   │    │ (artists linkage)  │    │ (artists/creators)│
└─────┬────────┘    └────────────────────┘    └──────────────────┘
      │
      ├───►│objects_terms │    ┌───────────────┐
      │    │(subjects, etc)│    │ locations     │
      │    └───────────────┘    │ (geography)  │
      │                          └───────────────┘
      ├───►│published_images│   ┌───────────────┐
      │    │(image URLs)    │   │object_associations│
      │    └───────────────┘   │ (related works)│
      │                         └───────────────┘
      ├───►│objects_dimensions│  ┌───────────────┐
      └───►│objects_text_entries│
           └───────────────┘    └───────────────┘

┌──────────────┐    ┌──────────────┐
│ content_flags│    │ ingestion_log│
│(user reports)│    │(ETL history) │
└──────────────┘    └──────────────┘
```

### Core Tables

- **objects** – the master table for artworks (paintings, sculptures, etc.). Each row represents one artwork with columns for title, type, classification, medium, creation dates, etc. Important fields include `object_id` (primary key from the NGA data), `object_number` (accession number), `is_public_domain` (boolean flag), and textual fields like `title`, `attribution` (artist name info), `display_date` (e.g. "c. 1880"). We also add some fields for search: a concatenated `search_text` (for full-text indexing of relevant text) and an `embedding_vector_id` which links to the corresponding vector in Qdrant. Timestamps for `last_ingested_at` and `data_hash` help track updates.

- **constituents** – the table of people or organizations related to artworks. E.g. artists, donors, makers. Key fields are `constituent_id` (PK), `display_name`, `nationality`, birth/death years, and a text `biography`. Like objects, it has `search_text` and `embedding_vector_id` for future search capabilities. (Note: In the initial MVP, we may not ingest all constituents due to storage limits, but the schema is in place to add them later.)

### Junction & Detail Tables

- **objects_constituents** – a junction table linking artworks to one or more constituents (e.g. an object may have an artist, a donor, etc.). It includes a `role` (e.g. "artist" vs "donor") and `is_primary` to flag the main artist.

- **published_images** – stores image URLs for each object. Each object can have multiple images (different views or details), with a flag for the primary image. We store the IIIF manifest URLs and direct image links (thumbnail and full) as provided by the NGA open data.

- **objects_terms** – stores subject keywords, materials, styles, etc. associated with an object. This helps with filtering and can be shown on detail views.

- **locations**, **objects_dimensions**, **objects_text_entries**, etc. – additional tables for physical location, dimensions, and text descriptions/labels. These are populated from the respective CSVs. They are mainly for completeness; MVP might not fully utilize these in the UI, but having them ingested means the AI curator could potentially draw on these details if needed (e.g. dimensions or inscriptions).

### User & System Tables

- **content_flags** – records user-submitted flags on content. It contains the flagged object or constituent ID (if applicable), the category of issue, a text description, a reporter session ID or email (if provided), timestamps, and status (pending/resolved, etc.). This facilitates the moderation workflow (Section 9).

- **ingestion_log** – a simple log of ingestion runs (timestamp, commit hash from GitHub, number of records processed, success/fail) for auditability.

### Schema Implementation

All tables have proper primary keys and foreign keys linking to parent tables (with cascade deletes where appropriate, so if an object is removed, its related term or image records get removed). Indexes are added on key query fields to optimize performance – e.g., indexes on `objects(classification)`, `objects(begin_year)`, `objects(search_text)` (using a GIN index for full-text search), and on `constituents(nationality)` and full-text for constituent names. These indexes allow efficient filtering (e.g. filtering paintings vs sculptures, or searching name text). We also index the `embedding_vector_id` in case we need to lookup an object given a Qdrant vector ID (though typically Qdrant will store the actual vector and we use that ID only for back-reference).

**Note on Sample Data**: Because we initially ingest only a sample, the Postgres tables will initially contain only a subset of rows (perhaps a few hundred objects rather than all 130k). The schema, however, is built to accommodate the full dataset. We ensure that even with partial data, referential integrity holds (only ingest constituents that relate to ingested objects, etc.). As we scale up ingestion in later phases, no schema change should be needed – the design is already suited for the entire NGA collection.

## 4. Qdrant Vector Index Design

To enable semantic search and similarity queries, we use Qdrant as our vector database. We create dedicated Qdrant collections for different entity types (artworks, artists, etc.), each storing fixed-dimensional embedding vectors along with metadata (payload) for filtering and identification. Below is the Qdrant collections plan:

| Collection | Vector Dim & Model | Payload Fields | Purpose |
|------------|-------------------|----------------|---------|
| `nga_objects` | 768-dim (text embedding) | Rich artwork metadata + Postgres `object_id` as key | Semantic search on artworks |
| `nga_constituents` | 768-dim (text embedding) | Artist metadata + Postgres `constituent_id` | Semantic search on artists (future) |
| `nga_insights` (future) | 768-dim | custom insight text + references | Curated Q&A cache (optional) |

For MVP, `nga_objects` is the primary collection in use (we may hold off on ingesting `nga_constituents` until we start doing artist-centric queries). All vectors use cosine similarity for matching since the embedding model outputs normalized vectors.

### Collection Schema – nga_objects

This collection stores an embedding for each artwork's textual data. Key parameters: vector size 768 (matching the chosen embedding model's output), cosine distance metric, and persistence to disk enabled for durability. We also configure HNSW index parameters (`m=16`, `ef=100`) for balanced recall and performance, and set some optimizer configs for segmenting data as it grows.

Each vector point's payload contains identifying info and metadata for filtering. For example:

```json
{
  "postgres_key": 12345,
  "entity_type": "object",
  "title": "Water Lilies",
  "attribution": "Claude Monet",
  "medium": "Oil on canvas",
  "classification": "Painting",
  "object_type": "Painting",
  "display_date": "c.1916",
  "begin_year": 1916,
  "end_year": 1916,
  "is_public_domain": true,
  "has_image": true,
  "primary_image_url": "https://.../12345-primary.jpg",
  "constituent_names": ["Claude Monet"],
  "terms": {
    "subjects": ["water lilies", "pond"],
    "materials": ["oil paint"],
    "styles": ["Impressionism"]
  },
  "searchable_text": "...",
  "embedding_version": "v1",
  "ingested_at": "2026-02-10T02:00:00Z"
}
```

This mirrors the schema outlined in the blueprint. The payload allows us to do filtered vector searches – e.g., we can ask Qdrant for the top-10 similar vectors where `classification == "Painting"` and `is_public_domain == true`. It also means when we get results, we have the basic info to display or further query (we have the `postgres_key` to join back to Postgres for full details if needed).

We also define payload indexes in Qdrant for fields we plan to filter by (like `classification`, `object_type`, maybe `begin_year` ranges) to optimize those queries.

### Collection Schema – nga_constituents

(For future use) Similar structure with `postgres_key` as `constituent_id`, and fields like `display_name`, `nationality`, `birth_year`, plus a short `biography_snippet`. This would let us do semantic searches for artists (e.g. "French sculptors") if needed, or to enhance QA responses involving artist info. We will likely ingest a small subset of major artists initially to test this out in later phases.

### Vector ID Strategy

We use a human-readable point ID format: e.g. `"obj_12345"` for an object with `object_id` 12345. This makes debugging easier and ensures we can derive the ID on the fly if needed. The `embedding_vector_id` stored in Postgres `objects` table corresponds to this Qdrant point ID. Using stable IDs means we can upsert vectors idempotently (if an object's metadata changes, we generate a new embedding and upsert to the same ID in Qdrant).

### Embedding Content

We carefully design the text that gets embedded for each object to maximize meaningful information in the vector. The embedding text for an artwork concatenates fields like title, artist name, medium, classification, object type, date, and terms (subjects, materials, etc.). This is done in the ingestion workflow (see Section 6) – effectively we create a descriptive paragraph for each artwork. We limit it to ~2000 characters so it's within the model's context length. For example, an object's embedding text might be: "Water Lilies. Claude Monet. Oil on canvas. Painting. Impressionist style. Subject: water lilies, pond. 1916.". This helps the semantic search: a query embedding for "Impressionist paintings of water lilies" would likely match strongly with this vector.

### Qdrant Usage in Workflows

We utilize n8n's Qdrant Vector Store nodes for operations: one to upsert points during ingestion (batching for efficiency), and one to search for similar points during queries. The official n8n Qdrant node allows specifying the collection, the query vector (we pass the user query embedding), and optional filters. For example, in the Search workflow we do a Qdrant "Get Many" (search) for collection `nga_objects`, with `limit = 10` and filters reflecting any user-selected facets. The node returns the top matches with their IDs and similarity scores, which we then join with Postgres data. In the Curator Q&A workflow, a similar search is done to retrieve context points related to the user's question. If the user's question references a specific known artwork (e.g. by ID or title), we might skip vector search and instead do a direct Postgres lookup (the AI agent can choose that tool), but generally semantic search helps find relevant context even if not explicitly mentioned.

### Limited Initial Data

Since only a subset of objects are ingested, Qdrant initially holds relatively few vectors (perhaps a few hundred). This is trivial for Qdrant to handle; search will be extremely fast. As we scale up to tens of thousands of vectors, we will monitor Qdrant's performance. It's designed for many millions of vectors, so we anticipate no issues, but we have plans to add replicas or sharding if needed at higher scales. For now, the small size means we could even consider in-memory indexing (but we'll keep on-disk so we don't re-embed everything on restart).

## 5. Ollama AI Services and Prompting Strategy

Ollama serves two roles in our architecture: embedding generation (for indexing and semantic search) and LLM-driven answer generation (the AI curator's brain). All AI models are self-hosted via Ollama, meaning no external API calls or keys (ensuring cost control and privacy). Below we outline the model setup and how we prompt the AI curator.

### Models and Configuration

The following models are loaded in Ollama on the server (as of the current deployment; list via `docker exec -i ollama ollama list`):

| Purpose | Model | Size | Details |
|---------|-------|------|---------|
| Embeddings | `nomic-embed-text:latest` | 274 MB | 768-dimensional text embeddings for semantic search and ingestion |
| Embeddings | `mxbai-embed-large:latest` | 669 MB | 768-dimensional text embeddings (alternative or primary for search) |
| Chat (primary) | `llama3.2:3b` | 2.0 GB | ~3B parameter LLM, instruction-tuned for curator Q&A |
| Vision | `llava:latest` | 4.7 GB | Vision-language model for image description (e.g. during ingestion) |

**Rationale**: We use two embedding models (`nomic-embed-text` and `mxbai-embed-large`), both producing 768-dim vectors compatible with the Qdrant collection. Either can be used for vectorizing artwork text and query embeddings; workflows may standardize on one (e.g. `nomic-embed-text`) for consistency. The primary chat model is Llama 3.2 3B (`llama3.2:3b`), which is lightweight and suitable for the AI curator’s responses with RAG context. The vision model `llava` is used when generating or enriching artwork descriptions from images during ingestion. All models run in the Ollama Docker container and are exposed at `ollama:11434` for embedding and chat completion.

### Embedding Generation

In the ingestion workflow, for each artwork (or batch of artworks) we send a request to Ollama's embedding API. This is done with n8n's Ollama Embeddings node (or an HTTP node if needed, but using the integration is preferred). Use model `nomic-embed-text` or `mxbai-embed-large` (e.g. `POST http://ollama:11434/api/embeddings` with JSON body `{"model": "nomic-embed-text", "prompt": "<text to embed>"}`). The response gives the 768-dim vector. In n8n, the Embedding node can output this vector which we then directly forward to the Qdrant node for upsert. We batch records (e.g. 100 at a time) to amortize overhead. We also monitor embedding generation time – typically a 768-dim embedding for <2000 characters should be quick (<0.5s). With hundreds or thousands to do, the ingestion is the slowest part of the pipeline, but since it runs offline (e.g. nightly) this is acceptable.

### AI Curator Prompt Strategy

Crafting the right prompt for the AI curator is crucial to ensure accurate and helpful responses that cite the collection data. We define a consistent system prompt that sets the role and rules for the AI, and we format each user query along with retrieved context into a user prompt that we send to the model. Below is our prompt design:

**System Prompt (AI persona and rules)**:

```
You are the NGA Curator, an AI assistant for the National Gallery of Art's Open Data collection.
Your role is to help users discover and understand artworks using the provided context.

RULES:
1. Answer **only** using the provided context. If information is not in the context, say "I don't have that information in the current records."
2. Cite specific artworks by title and artist when making factual claims.
3. Distinguish between facts (from the database) and your interpretations or explanations.
4. Suggest related works when appropriate, using any "Related objects" provided.
5. Be concise but informative, and use appropriate art historical terminology.
6. If asked about sensitive content, respond in a neutral, professional tone.
7. Never invent artists, dates, or provenance details that are not present in the context.
```

This system prompt ensures the AI sticks to the data and has a clear "curator" voice. It explicitly forbids hallucinations (rule 1 and 7) and encourages citations and contextual suggestions (rules 2 and 4). It also sets the tone (professional, informative).

**User Prompt Template (context formatting)**: After retrieving relevant objects and related works, the workflow will format them into a single prompt for the AI. For example:

```
USER QUESTION: {user_query}

CONTEXT:
{Object 1 Title} – {Artist}, {Date}. Medium: {Medium}. Description: {Brief description or label text if available}.
{Object 2 Title} – {Artist}, {Date}. Medium: {Medium}. Description: {…}
... (multiple context entries if relevant) ...

RELATED WORKS:
- {Title A} by {Artist A} (ID: 11111)
- {Title B} by {Artist B} (ID: 22222)

Please provide a helpful answer to the user's question, referencing the above works in your explanation where relevant and citing them by title.
```

The exact formatting may vary, but the idea is to enumerate a few retrieved items (with key info) as context. If there are directly related works (e.g. other works by the same artist or same style), we list them separately as "Related Works" so the AI might weave them in as recommendations. We also include the user's original question verbatim at the top to avoid ambiguity.

The final user prompt sent to the model thus contains everything: system role (as separate system message via API), and this constructed user message. The n8n workflow handles this assembly in a code node or directly in the AI Agent node configuration.

**Example**: If the user asks "I love Van Gogh. Do you have any of his paintings? Tell me about them." – the system might retrieve a couple of Van Gogh artworks from the collection (say "Self-Portrait – Vincent van Gogh, 1889…" etc.) as context. The prompt to AI would list those artworks with their details. The AI might answer: "Yes, we have Self-Portrait by Vincent van Gogh (1889) on display. It's an oil on canvas painting of the artist himself, created during his time in Saint-Rémy. The brushwork is very bold. Another work is Flower Beds in Holland by van Gogh (1883), which depicts fields of flowers in bloom. Both are excellent examples of his early style. You can find them in our Impressionist collection." – Note how the answer would ideally cite the titles and maybe the year (which came from context). The rules ensure it doesn't hallucinate works we don't have.

### Guardrails

We enforce some guardrails in the prompt and in post-processing:

- The system prompt already addresses hallucination and citation. After generation, the workflow can validate that the answer contains at least one mention of a known artwork if it made factual claims. If the AI fails to cite, we can append a gentle reminder in the prompt in future iterations.
- If the vector retrieval confidence is low (e.g. no relevant artworks found or similarity scores below a threshold ~0.5-0.6), the workflow can decide not to answer definitively. Instead, it might respond with "I'm sorry, I don't have information on that" as per rule, or give a general answer that is clearly not from data. This prevents the AI from speculating.
- Content filtering: Since the dataset is mostly public art info, problematic content is rare. But if user asks something totally off-topic or disallowed, we rely on the LLM's internal moderation (or we could add an n8n content filter node prior to generation). The AI is instructed to be professional on sensitive topics (e.g. describing nudity or violence in art objectively). We can also maintain a list of banned phrases for the AI to avoid (like no explicit sexual terms) if needed.
- Session memory: For MVP, each question is treated independently (with its own retrieved context). We do attach a session ID to allow the back-end to potentially thread follow-ups: e.g., if the user asks "Who painted Starry Night?" and then follows with "What else did he paint here?", having the same `session_id` could let us know "he" refers to Van Gogh from the prior answer. However, implementing full conversation memory is complex. We will start with mostly one-turn interactions; multi-turn contextual follow-ups may be supported in a limited way (perhaps by storing the last question/answer for a session in memory). This can be expanded in future versions if chat history becomes important.

### Integration via n8n

We use n8n's Ollama Chat node (or OpenAI-compatible Chat node pointed at Ollama) to send the system and user prompt to the model and get a completion. The workflow will send messages as in the JSON example:

```json
{
  "model": "llama3.2:3b",
  "messages": [
    {"role": "system", "content": "<system prompt text>"},
    {"role": "user", "content": "<constructed user prompt text>"}
  ],
  "temperature": 0.3,
  "max_tokens": 800
}
```

Temperature is set low-ish (0.3) to keep answers factual and consistent. Max tokens ~800 should suffice for a few paragraphs answer. We disable streaming in the initial implementation for simplicity (n8n will just wait for the full response). Optionally, we can enable streaming at the HTTP level and forward partial tokens to the front-end to display a typing effect – this is a nice-to-have if time permits.

In summary, Ollama allows us to run the AI components locally with fine control. The prompting approach ensures the AI curator stays grounded in actual NGA data and behaves in line with curatorial standards.

## 6. n8n Workflow Specifications

All application logic is handled by dedicated n8n workflows triggered by HTTP webhooks or schedules. Each workflow will be built using a combination of built-in nodes (for data access, transformation, and AI calls) and occasional code nodes (for custom logic like formatting or ranking). Here we outline each major workflow with its implementation steps:

### Workflow 1: Ingestion Pipeline (Data ETL)

**Trigger**: Scheduled daily (e.g. 02:00 UTC) and on-demand manual trigger for initial setup.

**Summary**: Fetch latest NGA open data CSVs, parse them, upsert into Postgres, generate embeddings and upsert to Qdrant, log the run.

**Steps**:

1. **Schedule Trigger** – Cron expression for daily runs (and a manual trigger for one-click reingestion as needed).

2. **Download Data** – HTTP Request node (or a dedicated GitHub node) to fetch the `objects.csv` (and other CSVs like `constituents.csv`, `published_images.csv`, etc.) from the NGA Open Data GitHub repository. Using raw GitHub URLs (e.g. `https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/objects.csv`). We might first check if there's a new commit: blueprint did this by comparing commit hashes, which we can replicate to avoid unnecessary processing.

3. **Parse CSV** – an n8n CSV node or a custom Code node using PapaParse to stream parse. This yields items for each row. We then map CSV columns to our database schema fields.

4. **Batch & Upsert to Postgres** – We accumulate or batch the parsed objects (maybe 100 at a time using the Batch node). For each batch, use a Postgres node in "Execute Query" mode with an UPSERT query (using `INSERT ... ON CONFLICT DO UPDATE`) to write to the objects table. We include all relevant columns. We also compute a `data_hash` (e.g. SHA256 of concatenated fields) to detect changes – the UPSERT can skip updating if the hash is unchanged to save time.

5. **Generate Embeddings** – For each object (or batch), prepare the embedding input text (using a Code node that concatenates title, artist, medium, etc., as described in Section 4). Then call the Ollama Embeddings node with model `nomic-embed-text` or `mxbai-embed-large` to get the 768-dim vector. This can be done in batches if the node supports it, or one by one. (If one by one, we might parallelize with multiple branches to speed it up, but given a small dataset initial, it's fine sequentially.)

6. **Upsert to Qdrant** – After obtaining an embedding vector, use the Qdrant node (Upsert mode) to insert the vector into the `nga_objects` collection. We include the payload fields (the node likely lets us map fields from the item JSON to Qdrant payload JSON). The `point_id` is set to `"obj_{object_id}"` as per our ID strategy. If the object already exists in Qdrant, this will update its vector and payload.

7. **Repeat for other CSVs**: After objects, we do similar for related tables if needed – e.g. constituents (artists), images, terms. These can be separate sub-workflows or simply additional steps: parse `constituents.csv`, upsert into constituents table, generate embeddings for constituents (if doing artist semantic search later) and upsert into `nga_constituents` collection. For MVP, we might skip or limit constituent embedding to primary artists due to volume.

8. **Log Completion** – Insert a record into `ingestion_log` table noting the timestamp, number of objects processed, and commit hash of data. This helps track that the job ran successfully.

**Error Handling**: The workflow should have basic error catching – e.g. if the GitHub fetch fails or Ollama is down, catch the error and alert (maybe via email node to admin). n8n's retry on nodes (like HTTP nodes retry 3 times by default) will be used as in blueprint. We'll also wrap the whole flow in logic so that if no new data (commit unchanged), we skip processing to save resources.

**Note**: In initial deployment, because we are ingesting only a small sample, we might manually create a trimmed CSV to ingest rather than the full 130k records, just to expedite development. But the workflow is built to handle the full dataset when enabled.

### Workflow 2: Search API (Text & Filter Search)

**Trigger**: HTTP Webhook POST `/webhook/search` with a JSON body containing the search query and optional filters.

**Request Schema**:
```json
{
  "query": "impressionist landscapes",
  "filters": {
    "classification": ["Painting"],
    "is_public_domain": true,
    "date_range": { "from": 1870, "to": 1900 }
  },
  "limit": 20,
  "offset": 0
}
```

In plain terms, the request can include a free-text query (which could be blank or "*" to just apply filters), and filters like classification (e.g. only Paintings), a public domain flag, date range, etc. This schema is flexible to extend with more filters or facets as needed.

**Steps**:

1. **Webhook (Search)** – n8n listens at `/webhook/search` for POST. We enable CORS if needed so the front-end can call directly. The webhook node captures the JSON input.

2. **Validate & Prep Input** – A Code node can verify the JSON structure (ensure query is present and not too long, parse filter values, etc.). We also might lowercase the query or trim it.

3. **Generate Query Embedding** – Pass the query text to an Ollama Embeddings node (with the same model as used for objects, ensuring vector compatibility) to get the query vector. If the query is empty (user just filtering without keywords), we could skip this and just rely on filters + maybe a default vector (or set results to all in filter). But typically, if query is empty, we might treat it as a wildcard and use only Postgres filtering.

4. **Semantic Search (Qdrant)** – Use the Qdrant Search node: point it to `nga_objects` collection, input the query vector, and set `limit = N` (e.g. 20 or slightly more to combine with keyword results). If filters were provided, translate them to Qdrant filter conditions (the Qdrant node likely allows adding filtering on payload fields). For example, `classification = Painting AND is_public_domain = true AND begin_year >= 1870 AND end_year <= 1900`. Qdrant returns a list of point IDs with similarity scores.

5. **Keyword Search (Postgres)** – In parallel, query Postgres for textual match: e.g., use a `to_tsvector` index on `search_text` to find objects matching the query terms. Also apply the same filters in SQL (classification, date range, etc.). For example:
```sql
SELECT object_id, ts_rank(search_text, plainto_tsquery($1)) AS pg_rank
FROM objects
WHERE search_text @@ plainto_tsquery($1)
AND classification = ANY($2)
AND is_public_domain = $3
AND begin_year >= $4 AND end_year <= $5
LIMIT 50;
```
We get a list of matching IDs with a Postgres rank or we can simply rely on similarity vs text as separate.

6. **Merge Results** – A Code node takes the two lists (semantic and keyword). We combine them giving weight to both. Blueprint used a reciprocal rank fusion approach – we can do similar: e.g., normalize Qdrant similarity (0-1) and Postgres text rank (0-1), then combine like `score = 0.6*semantic + 0.4*text`. Or simpler: interleave the results ensuring anything that appears in both gets a boost. The goal is the final list of unique object IDs ordered by relevance.

7. **Fetch Object Data** – Take the top K object IDs from the merged list and query Postgres for their details (or possibly our search already retrieved details). Likely we'll do a query to get title, artist, year, thumbnail URL, etc. Possibly we have a view or function for this. For efficiency, use `SELECT * FROM objects WHERE object_id = ANY($idList)` and then maybe join or separate queries to get the primary image from `published_images` for each. Since this is small (<=20 objects), a couple of quick queries or a single JOIN query is fine.

8. **Response Formatting** – Format the results as JSON: an array of result objects each containing fields needed for display (`object_id`, `title`, artist name, image thumbnail, maybe a brief snippet or description). Also include facets info if we want to power filter UI (e.g. counts per classification, etc. – not mandatory for MVP but something to consider).

9. **Return Response** – The final node is a Webhook response node that sends HTTP 200 with the JSON payload to the caller.

**Post-Processing**: On the front-end, the results are received and the gallery grid UI updates to show the new set. If no results, the response can include an empty list and maybe a message like "No artworks found for your search."

**Example**: If user searches for "impressionist landscapes" with filter Painting, the Qdrant might return a set of paintings that are about landscapes with impressionist style (even if not explicitly labeled as such), while Postgres text search might return those that literally have "Impressionism" or related terms in text. The merge ensures core relevant ones show up. The user sees thumbnails of paintings matching that theme.

### Workflow 3: Curator Q&A (AI Agent)

**Trigger**: HTTP Webhook POST `/webhook/curator` for chat queries.

**Request Schema**:
```json
{
  "query": "What can you tell me about the Monet paintings here?",
  "context_object_id": 12345,  // optional, if question is about a specific object currently viewed
  "session_id": "abcd-efgh-1234-5678",  // client-generated UUID for session
  "include_related": true  // whether to include related works suggestions
}
```

The `context_object_id` is optional; if provided, it hints that the user's question relates to a specific artwork (e.g. they clicked "Ask about this artwork"). The `session_id` ties multiple questions from the same user. `include_related` lets the client indicate if they want related works or just a direct Q&A (default true).

**Steps**:

1. **Webhook (Curator)** – Receives the question and parameters. We capture the text and session ID.

2. **Validate Input** – Code node to ensure query is present and not too long (we may enforce a 500 char limit). Also we might sanitize it for any problematic content (basic profanity filter) to avoid feeding that to AI.

3. **Determine Retrieval Strategy (AI Agent)** – Here we leverage n8n's AI Agent node. We configure an agent with two tools: (a) a Vector Search Tool (which when given a query will perform a Qdrant search in `nga_objects` and return top results with some metadata), and (b) a DB Query Tool (which can run a parameterized SQL on Postgres, e.g. if asked "how many X", it can count). The agent node will take the user query and decide which tool(s) to use. This is using LangChain under the hood. We provide the agent with a prompt that describes each tool's usage. For instance:
   - **VectorSearchTool**: use this to find artworks related to the question. Input: user question text. Output: list of artworks (title, artist, date, description).
   - **DBQueryTool**: use this for direct data lookup. Capable of: "COUNT_OBJECTS_BY_ARTIST(Name)" etc. (We might restrict to some predefined query patterns to avoid arbitrary SQL for safety.)

   The AI agent will likely first invoke the VectorSearch tool with the user query. We set it up so that tool returns a condensed text of top results (maybe 3-5 artworks) that the agent can then use in composing the final answer. If the question explicitly asks for a count or list, the agent could use DBQuery tool.

   **If not using an AI agent node**: Alternatively, implement retrieval with fixed steps: run Qdrant search for top 3-5 items (similar to Search workflow but with a broader net, since user might ask very general things), and separately, if `context_object_id` is given, always include that specific object's data as high-priority context. Also possibly retrieve a small set of "related works" (for the suggestions part) – e.g. we could use an existing field or a simple approach: if user's question or context object has a particular artist or style, pick other works with same artist/style as related. This can be done via a Postgres query or another Qdrant search on style/artist name.

4. **Retrieve Context Data**: Either through the AI agent's tool invocation or explicit nodes, gather the context:
   - **a. Qdrant Search (for Q&A)**: Use the user query embedding (from Ollama Embeddings node) to search `nga_objects` for, say, 5 items. If `context_object_id` is provided, we could boost that item (or just fetch it directly from DB and include it).
   - **b. Postgres fetch details**: For each result ID from Qdrant, fetch the object's title, artist, date, medium, and maybe a short description text (if available from `objects_text_entries` or a concatenation of attribution and classification as a pseudo-description). We then format these into a text block.
   - **c. Related works**: If `include_related=true`, determine a few related pieces. For example, if all retrieved objects are by Monet, perhaps list other Monet works in the collection. Or if they share a style/period, list a couple others in that category. We can do a simple Postgres query (e.g., take the primary artist of object 1 and find another object by them; take the classification/style of object and find another). Keep it small (1-3 suggestions).

5. **Build Prompt for LLM**: Construct the final system and user messages as described in Section 5. The system message with rules is static (could be pre-loaded in a global variable or in the node). The user message will include the question and context (the formatted list of artworks, and the list of related titles if any). We do this in a Code node if not using AI Agent (but if using AI Agent node, it might handle combining tool results with a prompt – still, we might prefer full control).

6. **Generate Response (LLM)** – Invoke Ollama Chat model with the assembled prompt. This returns the AI's answer. Because of our prompt, the answer should include references to artwork titles or IDs. We then do a quick check: for instance, ensure at least one known artwork title or ID is mentioned if the answer contains factual claims. If not, we might consider re-prompting or appending "(If you reference an artwork, be sure to cite it)" to system prompt next time.

7. **Parse & Format Answer**: We might format the answer into a structured JSON before returning. For example, detect mentions of object IDs or titles and turn them into hyperlinks or separate fields. A simple approach: the AI could be asked to output in a JSON with fields `"answer": "...text..."` and `"mentions": [ { "object_id": 12345, "title": "Water Lilies" }, ...]`. However, parsing LLM output can be tricky. As an intermediate step, we can return just the text and on the front-end do a regex to find "(Object ID: 12345)" patterns that our prompt includes when citing. Blueprint's citation format suggestion was "[Title] by [Artist] (Object ID: [ID])" – we can rely on that pattern.

8. **Return Response**: Send back a JSON containing the answer text (and maybe a list of related suggestion IDs separately). For example:
```json
{
  "answer": "Monet's painting **Water Lilies** (Object ID: 201234) is one highlight. It was painted in 1916 and depicts his garden pond... [another sentence]. We also have **The Japanese Footbridge** by Monet (Object ID: 201235), showing a similar scene... ",
  "related": [201236, 201237]
}
```
The `related` could be IDs of other works suggested (if we decide to handle it that way).

The front-end will display the answer text in the chat bubble, and can highlight or make clickable any object IDs mentioned (to, say, focus or bring up that artwork's detail if the user clicks the reference). The related list could be used to show thumbnails of those works below the answer, if we want a visual suggestion (this is a nice enhancement to keep users exploring).

**Example Flow**: A user asks: "What Renaissance paintings can I see here?". The workflow does a Qdrant search for "Renaissance paintings" – finds e.g. a Da Vinci, a Botticelli, etc. It fetches those details. The prompt to LLM includes maybe 2-3 paintings with their info. The LLM responds describing those paintings and possibly mentioning one or two related artists. The answer is returned and shown, with the titles cited. The user can click on a cited title to see it in the grid or detail panel.

### Workflow 4: Artwork Detail Fetch (Mini API)

**Trigger**: HTTP Webhook POST `/webhook/detail` (or GET, but n8n webhooks typically use POST for JSON).

**Input**: `{ "object_id": 12345 }`

**Steps**: This simple workflow just does:

1. Validate `object_id` is provided.
2. Query Postgres for the object row (join with constituents to get artist name, join with all images, join with terms maybe) or call a stored function `get_object_details(id)` that returns a JSON. Alternatively, do multiple queries: one for object core info, one for images, one for related objects (based on associations table or a simple similarity query).
3. Return the aggregated data as JSON.

This allows the front-end to fetch full detail on demand (for the detail page or modal). It's straightforward and mostly just SQL. Since blueprint included it in architecture, we note it, though it's not a heavy workflow.

### Workflow 5: Content Flagging

**Trigger**: HTTP Webhook POST `/webhook/flag` for user-submitted flags.

**Request Schema**:
```json
{
  "object_id": 12345,  // optional, the artwork being flagged (if applicable)
  "constituent_id": null,  // optional, if an artist entry is being flagged
  "category": "inaccurate_description",
  "description": "The date for this painting is wrong, I believe it was 1872.",
  "reporter_email": "",  // optional email of user
  "reporter_session_id": "abcd-1234-..."  // to tie to a session/user (if not provided, use session cookie)
}
```

**Steps**:

1. **Webhook (Flag)** – Receives the flag data.

2. **Validate & Rate-limit**: Code node to ensure a category and description are provided (and description length is within say 2000 chars). Also check a simple captcha or honeypot (maybe a hidden field in the form to deter bots). Then check the rate of flags from this session: use a Postgres node to count how many flags this `reporter_session_id` has submitted in the past hour. If over a threshold (say > 10/hour), we short-circuit reject with a message (and possibly flag the session as abusive).

3. **Insert Flag**: Use Postgres node to insert a new row into `content_flags` with status "pending", the provided category and text, the session ID, and email if given. Also capture current timestamp. The `object_id` or `constituent_id` gets recorded if present.

4. **Respond to User**: Return a simple success JSON (`{ "status": "received" }`). The UI will show a thank-you or confirmation message.

5. **Notify Admins (Optional)**: For MVP, this might be omitted. In v1.1, we'd add an Email node or Slack node here to notify that a new flag was submitted, including the content and maybe a direct link to an admin review UI.

6. **Auto-check (Optional)**: If we want to automatically categorize severity: e.g., certain categories might be auto-marked high severity. Or if the description contains certain keywords, maybe auto-escalate. MVP likely not needed; everything just goes to pending for manual review.

Admin handling of flags is outside these public workflows – it could be done via a small admin interface that queries `content_flags` and allows updating status. That interface can be a simple protected web page or even done directly in the database by an admin. Since blueprint envisioned an admin panel, we mention it below in UI.

### Other Workflows

- **Admin actions workflow**: (for completeness) If we have an admin UI that when admin clicks "Resolve" on a flag, it could trigger a webhook to update the flag status and send an email to the reporter. Those would be separate flows with proper authentication (basic auth or an API key required so only admins can call them). This is noted for future implementation.

- **Healthcheck workflow**: We might have a simple `/webhook/health` that the front-end or a load balancer can ping. It would do quick checks like `SELECT 1` on Postgres and hitting Qdrant's `/healthz` endpoint, then return OK. Not critical but useful for monitoring.

Each workflow will be thoroughly tested with sample inputs. We will also use n8n's version control (export workflows to JSON and store in Git) to track changes.

## 7. API Design (Front-End ↔ Back-End)

The front-end communicates with n8n through RESTful API endpoints (webhooks). Here we summarize the external API contract for the web application. All endpoints are under a common base, for example:

**Base URL**: `https://n8n.geuse.io/webhook` (the exact domain/path might differ depending on n8n config, but this is assumed).

The following endpoints are available:

- **`GET /webhook/health`** – health check (returns 200 OK if up, with maybe version info). Used for monitoring.

- **`POST /webhook/search`** – search for artworks.
  - **Request**: JSON as described in Workflow 2 (query string and filters).
  - **Response**: JSON with `results` array of artworks. Each artwork object might include: `object_id`, `title`, `artist_display_name`, `display_date`, `thumbnail_url`, `score` (optional relevance score). Possibly also a `facets` section if we return facet counts. Example response:
  ```json
  {
    "results": [
      {
        "object_id": 101,
        "title": "Water Lilies",
        "artist": "Claude Monet",
        "display_date": "c.1916",
        "thumbnail_url": "https://images/101.jpg"
      },
      {
        "object_id": 102,
        "title": "The Japanese Footbridge",
        "artist": "Claude Monet",
        "display_date": "1899",
        "thumbnail_url": "https://images/102.jpg"
      }
    ]
  }
  ```

- **`POST /webhook/curator`** – ask the AI curator a question.
  - **Request**: JSON with `query` and optional context as described in Workflow 3.
  - **Response**: JSON with the AI answer. At minimum: `{ "answer": "text..." }`. We may include structured references, e.g. `{ "answer": "...", "mentions": [ { "object_id": X, "title": "..." }, ... ] }` or similar, to help the front-end link references. If the question couldn't be answered from context (or was invalid), the answer might say so (and we could set an HTTP 400 if it's a bad request like empty query). Typically, though, always 200 with a safe answer.

- **`POST /webhook/detail`** – fetch detailed data for a specific artwork (could also be used to get multiple if we allow an array of IDs).
  - **Request**: `{ "object_id": <ID> }`.
  - **Response**: Full detail JSON, e.g.:
  ```json
  {
    "object_id": 101,
    "title": "Water Lilies",
    "attribution": "Claude Monet",
    "display_date": "c.1916",
    "medium": "Oil on canvas",
    "dimensions": "200 x 300 cm",
    "classification": "Painting",
    "description": "Monet's Water Lilies is one of his series…",
    "images": [
      {
        "iiif_url": ".../manifest/101",
        "primary": true,
        "width": 5000,
        "height": 3000,
        "url": "https://images/101-primary.jpg"
      },
      {
        "iiif_url": "...",
        "primary": false,
        "url": "https://images/101-detail1.jpg"
      }
    ],
    "constituents": [
      {
        "constituent_id": 55,
        "role": "Artist",
        "name": "Claude Monet",
        "bio": "...",
        "birth_year": 1840,
        "death_year": 1926
      }
    ],
    "terms": {
      "subjects": ["water lilies", "garden"],
      "style": ["Impressionism"]
    },
    "related_objects": [102, 103]
  }
  ```
  This gives the front-end everything to display a detail page/modal.

- **`POST /webhook/flag`** – submit a content flag/report.
  - **Request**: `{ "object_id":…, "category": "...", "description": "...", "reporter_email": "..." }`.
  - **Response**: `{ "status": "ok" }` or an error message. If rate-limited or invalid, we might return a 429 or 400 with `{"error": "Too many flags"}` etc.

All these endpoints require no auth for end-users (to keep it frictionless). However, n8n can be configured with a secret path or an API key if we want obscurity. For now, we'll treat them as open but not advertise the endpoints beyond the app usage.

The front-end will handle errors gracefully: e.g., if `/curator` times out or returns an error, show a message like "The curator is currently unavailable, please try again."

## 8. Front-End UX and Components

The front-end is a responsive web application that provides an immersive, modern interface for interacting with the art collection and the AI curator. The design will draw inspiration from Apple's **Liquid Glass** aesthetic – meaning translucent surfaces, smooth animations, and a focus on content. This creates a visually engaging experience that still puts the art first.
**Design Reference:**  
See the [UX mockup here](./@Ux.png) for the "Liquid Glass" gallery and chat interface concept.


### Page Structure and Navigation

Since it's a single-page application (or a few static pages), we outline the main views:

- **Gallery View (Home)**: A grid of artwork thumbnails fills the screen. This is the default view on load, showing either a curated selection or all artworks (if dataset is small). A top header bar contains the NGA Curator title/logo and possibly a search box or icon. The user can scroll the gallery (infinite scroll or pagination if many items). From here, they can: click an artwork to see details, use filters to refine, or open the AI chat. The gallery is essentially also the "search results" page – performing a search just filters/updates this grid, rather than navigating away. This unification keeps context consistent.

- **Detail View**: When an artwork is selected, a detail panel appears. This could be a modal overlay on top of the gallery (with a translucent glass background) or a dedicated page/route. It shows a larger image, full metadata, and perhaps a IIIF viewer for zoom/pan on high-res images. Also, from here the user might trigger the curator chat specifically about this item (e.g. a button "Ask about this artwork" that opens the chat with `context_object_id`). We ensure that closing the detail returns the user to where they were in the grid.

- **Search/Filter UI**: Rather than a separate page, search is integrated via a search bar (in header or as a floating element) and filters either in a sidebar or a pop-over. On desktop, a sidebar can list facets (Classification, Century, etc.). On mobile, a "Filter" button opens a drawer with filtering options. The user selections instantly update the gallery (with a loading state while fetching results). The search bar supports suggestions/autocomplete (e.g. as user types "Monet", suggestions for "Claude Monet – Artist" or "Monet's Garden – Painting" can drop down, which when clicked perform the search). *(Suggestions can be powered by a simple prefix search on popular terms or even using the vector search in an "autocomplete" mode – but likely a simpler approach for MVP: hardcode some popular searches or use a precomputed list of artist names.)*

- **Curator Chat Panel**: The chat UI is accessible from any page (primarily the gallery). We envision an overlay panel that can slide up from the bottom or side. For example, a chat icon or "Ask the Curator" button is fixed in the UI. When clicked, it opens a panel that covers, say, one-third of the screen (on desktop, perhaps a right-side panel; on mobile, a full-screen modal). The panel has a translucent glass background so the gallery is vaguely visible behind it, maintaining context. The chat panel shows the conversation history (if we keep multiple turns) or just the latest Q&A. The user can type a question in a text box at the bottom. When the AI responds, the answer appears as a message bubble in the panel. If artworks are referenced in the answer, those references might be interactive (hover highlight or click to see that artwork – e.g., clicking a cited title could scroll the gallery to that item or open detail). The panel can be closed to return focus to the full gallery.

- **Admin Interface (future)**: An admin-only page for reviewing flags might be a simple table of reports. This will be behind authentication. It's not needed for the public, but we note it for completeness.

### Key UI Components

We will likely build the front-end using a component-based framework (React or Svelte etc.). The following are the main components and their responsibilities:

**Layout & Navigation:**
- **AppShell/Header** – Top bar with site title "NGA Curator", possibly a menu or info icon. May include the search input or just an icon that opens a search bar. Also might include a toggle for dark/light mode (if we support it) or other global actions.
- **Footer** – A minimal footer with links (NGA copyright, open data source acknowledgment, maybe a link to feedback). Could be sticky or appear at bottom of content.

**Gallery & Search Components:**
- **ArtworkCard** – displays a thumbnail image and a short caption (title/artist). We might have a compact mode (image only with overlay on hover) vs. detailed mode (with text always shown). Hover state: on desktop, hovering an artwork could show a translucent overlay with the artwork title and artist, and maybe a slight scale-up of the image (to reinforce interactivity). We will use a *glassmorphism* effect on the overlay (blurred background) to align with aesthetic.
- **ArtworkGrid** – lays out multiple ArtworkCards in a responsive grid. It handles the loading state (show skeleton cards or spinner) and empty state ("No results found"). The grid will reflow for different screen sizes (e.g., 1 column on narrow mobile, 2 on small tablet, 3-4 on desktop).
- **SearchBar** – an input field for search text. On focus, it might expand and show suggestions (autocomplete list). On mobile, this might be a full width bar on top of gallery. Possibly includes a "clear" button and a "submit" icon. Could integrate voice input in future (not now).
- **FilterPanel/Sidebar** – UI for filters (checkboxes for classifications, sliders for date range, etc.). On desktop, a sidebar on left with sections for each facet. On mobile, this is a popup panel. Changing any filter immediately triggers a new search API call (with debounce).
- **FacetChips** – if filters are selected, we can show them as removable chips above the grid (e.g. "Painting ✕" to remove filter). Helps users keep track of active filters.
- **SortDropdown** – possibly an option to sort results (by date, title, etc.). MVP might not need, but we have a placeholder.

**Curator (Chat) Components:**
- **CuratorPanel (ChatOverlay)** – the container for the chat UI. It contains the message list and input box. This panel will be styled with a **glass** background – e.g., semi-transparent with backdrop-filter blur to allow the gallery colors to bleed through slightly (giving that fluid glass effect, as seen in iOS). It can animate in/out (slide or fade).
- **CuratorMessage** – represents a single message in the chat (either user question or AI answer). For AI answers, the component will parse the text to identify any artwork citations (like "(Object ID: 123)" or known titles) and render them with a special style (e.g., as clickable links or with a tooltip). Possibly, hovering a citation could highlight the corresponding artwork card in the background grid (if present) – that would be a slick interaction: the grid might scroll to or glow around that item. (This linking may be complex; a simpler approach is clicking a citation opens that detail). The message bubble styling will also use translucent backgrounds (white or gray with opacity) to fit the aesthetic.
- **SuggestedQueries** – (Optional) a component to display suggested questions for the user to ask. For instance, below the chat input we could show a few prompts like "What is Impressionism?" or "Show me highlights". Clicking one auto-submits that question. This can help users get started. The suggestions could be static or based on context (e.g., if viewing Monet, suggest "Tell me about Monet").
- **CitationBadge** – a UI element for citations if we choose to show them separately (for example, a small badge in the message that when clicked, shows the artwork info). But likely we integrate this into message text as described.

**Detail & Media Components:**
- **ImageViewer** – a carousel or lightbox for artwork images. If an artwork has multiple images, the user can swipe/arrow through them. We can integrate a deep zoom (IIIF viewer) as a separate component:
- **IIIFViewer** – uses the IIIF manifest to let user zoom into a painting. This might be a later addition (P1 feature as per blueprint), not critical for MVP.

**Flagging Components:**
*(These appear in UI only when a user chooses to report an issue)*
- **FlagButton** – a small button (possibly an icon of a flag) shown on each detail page or next to an AI answer. For example, on an artwork detail, "Report an issue with this data"; on an AI message, "Report this response" if it was inappropriate or incorrect. Clicking opens the flag form.
- **FlagForm (Modal)** – a modal dialog with a form to submit a flag. Fields: category dropdown, description text area, optional email. Also maybe a note "This will be reviewed by our team." The modal uses the same glass style for consistency.
- **FlagCategorySelect, SeveritySlider** – form sub-components for selecting category (with predefined options) and severity (if we even expose severity to user, likely not – severity is internal, user just picks category). Possibly skip severity input on user side.

**Admin Components:** (for internal use, summarized)
- **FlagQueueTable** – table of all flags with columns: date, object/title, category, status.
- **FlagDetailCard** – shows full details of a flag and provides actions (buttons to resolve, dismiss, etc.).
- **StatusBadge** – a small UI element to display status of a flag (pending/resolved/etc.).
- **AdminSidebar** – navigation for admin panel (if multiple sections). This admin UI will be behind a login.

Many of these admin components are future (phase 3). MVP might handle moderation outside the app.

### Responsive Design & Interactions

The interface will be fully responsive:

- On **mobile** (small screens < 640px), the layout condenses to a single-column or two-column grid. The header becomes a fixed top bar with perhaps just a menu icon and title (search could be an overlay or just use the chat as primary interaction if typing in search is hard on mobile). Filters would be a full-screen overlay. The chat panel would be full-screen modal with a back button to close. Touch interactions and scroll should feel native (we avoid any heavy fixed elements that obstruct scrolling, except maybe the header).

- On **tablet** (640–1024px), maybe a two-column grid and filters in a collapsible side panel. Chat could either still be an overlay or a side-by-side if there's room (but likely overlay to keep it consistent).

- On **desktop** (>1024px), a comfortable multi-column grid (maybe 4 columns). Filters can sit in a sidebar to the left of grid, always visible. The chat panel could appear on the right side partially overlaying the grid or pushing the grid aside if we prefer. We'll likely choose overlay for simplicity – it's like a chatbot drawer.

We'll adhere to standard breakpoints (tailwind or bootstrap like breakpoints as given above).

**Hover and Animation Effects:**
- **Hover on artworks**: On desktop, hovering an ArtworkCard will trigger a subtle transformation – e.g., scale up 3-5%, drop-shadow glow, and show the title overlay if not already shown. The transition will be smooth (200ms ease-in-out) to feel "alive". This effect draws from Liquid Glass principles of making UI feel dynamic and tactile (though on mobile, no hover, so we ensure all needed info is always visible or on tap).
- **Glassmorphism**: The header and any modal/panel have semi-transparent backgrounds with backdrop blur. For instance, the header bar might be translucent white, so the top of the gallery scrolls under it gets blurred behind it. This adds depth. The chat and filter panels similarly blur the content behind, giving that layered glass look. We'll use CSS `backdrop-filter: blur(10px)` plus a translucent background color (e.g. `rgba(255,255,255,0.3)` for light theme).
- **Opening/closing chat**: Could animate – e.g., clicking "Ask Curator" fades in the panel from opacity 0 to 100 and slides it up. When closing, reverse. These small touches make the experience feel polished.
- **Loading states**: Use skeleton loaders for grid items (gray boxes for images) while waiting for search results. For chat, while waiting for answer, perhaps show an animated ellipsis or a typing indicator ("Curator is thinking…") in the message area. If streaming is implemented, the text will appear gradually which itself indicates progress.

**Key User Interactions Flow:**

1. **Searching**: User types in the search bar, suggestions drop down (if implemented). After they hit enter or select suggestion, the gallery grid refreshes to show new results. We show a brief loading overlay on the grid. The URL could update (we might push state so that the search can be sharable via query params). Scrolling is reset/preserved appropriately.

2. **Filtering**: User clicks a filter checkbox (e.g. "Sculpture"), the grid immediately updates to only sculptures. If multiple filters, they can combine (OR within a category, AND across categories). The UI should make it clear that results are updating (maybe a spinner icon next to the filter while fetching) but since our queries are fast, it may be almost instantaneous.

3. **Using Curator chat**: User opens chat, types question, sends (press enter). The user's question appears in the chat panel as a bubble (maybe immediately, optimistic UI). The AI answer bubble then appears after a moment with a loading indicator if delayed. The user reads answer; if they tap on a mentioned artwork in the answer, we could either highlight that artwork's card (if the card is currently visible in grid) by scrolling it into view and maybe flashing it, **or** directly open the detail view for that artwork. We will implement the simpler: clicking reference opens detail overlay for that object (because the grid might not have loaded that object if it wasn't in the current filter). The user can then see it and close detail to return. The conversation can continue – e.g. user asks another question; we may or may not retain the previous context. For MVP, each question stands alone, so the chat history is more for the user's record than the AI's memory.

4. **Flagging content**: If the user clicks the flag icon on an AI response, a "Report issue" form appears. They fill it and submit. We show a thank-you and remove the form. Similarly on an artwork detail page if they report incorrect data, same flow. This is a minor interaction but important for feedback loop.

Throughout, we prioritize clarity: text should be legible atop images (using overlays/shadows as needed), and the UI should not overwhelm the art – rather, complement it. Liquid Glass design is used to *enhance* focus (through depth and blur), not distract. We will test the contrast and adjust translucency so that content (titles, chat text) is always readable.

## 9. Content Flagging & Moderation

*(This section outlines how content issues are categorized and handled, guiding both user-facing reporting and internal moderation processes.)*

### Flag Categories

We define a set of categories for user reports, to standardize and prioritize issues. Users will choose one when reporting. The categories and their meanings:

| Category | Code | Description | Example Report |
|----------|------|-------------|----------------|
| **Sensitive Imagery** | `sensitive_imagery` | Artwork image may be sensitive (nudity, violence, etc.) | "This painting contains graphic violence that might disturb viewers." |
| **Cultural Concern** | `cultural_concern` | Culturally sensitive content or context (sacred objects, colonial history, etc.) | "This piece might be looted art; its provenance is problematic." |
| **Inaccurate Data** | `inaccurate_description` | Factual error in metadata (title, date, attribution) | "The title is misspelled and the date is wrong; it should be 1872, not 1972." |
| **Copyright Issue** | `copyright_issue` | Potential copyright/rights issue with image or text | "This image isn't public domain as claimed – it's a copyrighted photo." |
| **Other** | `other` | None of the above; a general issue | "The app is not loading on my browser." or any miscellaneous comment |

*(We simplified some names from blueprint for clarity. "Inaccurate Description" covers any metadata error.)*

These categories help the moderators quickly understand the nature of the report. On the user form, these will be explained in simple terms.

### Severity Levels

Internally, each flag is assigned a severity level upon review. We define guidelines for how quickly to address them:

| Level | Criteria | Target Response Time |
|-------|----------|---------------------|
| **Critical** | Legal or ethical imperative, or severe risk (e.g. a copyright takedown notice, or extremely sensitive content that must be removed) | 24 hours (immediate attention) |
| **High** | Significant factual errors or offensive content that could mislead or harm reputation | 3 days (72 hours) |
| **Medium** | Minor inaccuracies or subjective concerns; improvements but not urgent | 2 weeks (14 days) |
| **Low** | Trivial issues, typos, suggestions; no real impact | 30 days (next routine update) |

Initially, all user flags come in as untriaged "pending". A moderator will assign severity after evaluating. If a user selects "Sensitive Imagery," that might be tentatively marked High until looked at. Many "Inaccurate data" might be Medium unless it's a major artist name error (then High). This system ensures the team addresses the most critical issues first.

### Moderation Workflow

(for admin use)

Once a flag is submitted, the following process occurs (mostly offline, but can be modeled as needed):

**User Submission** → **Auto-Check** (rate limits, spam filter) → **Log Flag** (status = PENDING in DB) → **Notify Admins** (email or Slack) → **Admin Review & Research** → **Decision**: Update Data OR Dismiss OR Escalate

In diagram form (simplified from blueprint):

- The system automatically checks for spam (we rate-limit and could auto-reject obviously spammy content).
- The flag is recorded in the database (pending).
- Admins get notified (for MVP this might just be a manual check, but ideally an email summary of new flags).
- A curator moderator reviews the report. This might involve verifying the claim (e.g., checking if indeed the date is wrong by researching the artwork).
- The admin then takes an action:
  - **Resolve**: If the issue is valid and fixed – e.g., update the metadata in our database (and maybe propagate upstream to NGA if appropriate), mark flag as resolved with notes. Optionally email the reporter thanking them and noting it's fixed.
  - **Dismiss**: If the report is not valid or not actionable – mark as dismissed with notes. Optionally email the reporter (if they provided email) explaining why (or simply that it's not an issue).
  - **Escalate**: For very serious issues (legal or PR concern), escalate to senior staff. Mark status as escalated. This triggers perhaps additional notifications (to higher-ups). For example, looted art claim might need museum director input.
  - **Request Info**: If the report is unclear, contact the reporter (if email given) for more details. Mark status `pending_info`.

Each action might be represented in the admin UI with a button. The `content_flags` table stores the status and any admin notes or resolution details.

The front-end for users doesn't expose all this complexity – they just get a confirmation. But it's important for us to have this pipeline defined for smooth operations.

### Preventing Abuse

We implemented basic rate limiting (no more than 10 flags per hour per session). If a single IP or session spams flags beyond that, we could further block or ignore those. We also consider adding a simple verification for flags (maybe a reCAPTCHA or a question like "2+2=?" to ensure it's a human – but maybe not needed initially).

### Privacy

Flags can be submitted anonymously. If email is given, we use it only to follow up and it's stored with the flag. We'll include that in our privacy notice.

By handling flags in a structured way, we ensure the AI and data remain trustworthy. Users essentially become partners in improving the system, and we have a clear path to address their concerns.

## 10. Rollout Plan and Evolution

We will roll out NGA Curator in phases, focusing first on core functionality and then adding enhancements in subsequent versions. Below is a proposed timeline and feature set for each phase, along with success metrics:

### Phase 1: MVP (Weeks 1–4)

**Goal**: Deliver a functional gallery experience with basic search and browsing of a sample dataset. Establish the core infrastructure (n8n, Postgres, Qdrant, Ollama) and ensure everything works end-to-end with a limited scope.

**Scope & Tasks** (P0 = critical, P1 = nice-to-have if time):

| Priority | Task | Owner |
|----------|------|-------|
| P0 | Set up Postgres database (deploy instance, apply schema for core tables: objects, etc.) | Backend |
| P0 | Implement initial ingestion workflow in n8n (load sample objects.csv into Postgres, maybe limited to 1000 rows) | Backend (n8n) |
| P0 | Implement basic search API (keyword-only or simple title search via Postgres) | Backend (n8n) |
| P0 | Create front-end scaffold: static site setup, routing, and Gallery page layout | Frontend |
| P0 | Display artwork grid with sample thumbnails (maybe hardcoded or from a JSON dump initially) | Frontend |
| P0 | Integrate front-end with search API: search bar input calls /search and updates grid | Frontend |
| P0 | (Design) Apply responsive layout and basic "liquid glass" styling for header and cards | Frontend |
| P1 | Include Qdrant semantic search and hybrid ranking in search API (so results improve) | Backend (n8n) |
| P1 | Deploy Ollama and generate embeddings for those sample objects (to support semantic search) | Backend |
| P1 | Basic detail view page (or modal) showing a bit more info for an artwork | Frontend |
| P1 | Add a few filter options (e.g. filter by classification = Painting/Sculpture) to test facet mechanism | Frontend |

**Success Criteria (MVP)**:
- At least, say, 500–1000 objects are ingested and searchable (this ensures we have enough content to test the features, even if not full dataset).
- Users (testers) can load the gallery page and see artworks, perform a text search, and get relevant results within <1 second for query.
- The UI is responsive (works on mobile and desktop) and basic interactions (search, click artwork) function correctly.
- Basic styling is in place (the app looks presentable and modern, even if not fully polished yet).

(Internal review at end of week 4 to decide if ready for a small pilot release or needs another iteration.)

### Phase 2: v1.0 (Weeks 5–8)

**Goal**: Introduce the AI Curator chat functionality and flesh out the user experience. At the end of this phase, the product should deliver the full envisioned experience: chat interactions alongside browsing.

**Scope & Tasks**:

| Priority | Task | Owner |
|----------|------|-------|
| P0 | Integrate Ollama fully: ensure the chosen LLM model is loaded and responding (e.g. fine-tune if needed for tone) | Backend |
| P0 | Build the Curator Agent workflow in n8n (context retrieval + LLM) | Backend (n8n) |
| P0 | Implement the chat UI panel on front-end, with message display and input sending to /curator | Frontend |
| P0 | Connect chat UI to the curator API (display AI responses nicely with citations) | Frontend |
| P0 | Add "Ask about this artwork" functionality: if user is viewing detail, pre-fill context_object_id in curator request | Frontend/Backend |
| P0 | Add "related works" suggestion in AI responses (backend already retrieving, just ensure front-end can show them, e.g. as thumbnails) | Backend + Frontend |
| P1 | Expand ingestion: include more objects (maybe scale up to entire Painting category or 10k objects if stable) | Backend |
| P1 | Ingest constituents (artists) and relationships into Postgres (and possibly embed a few major artists) | Backend (n8n) |
| P1 | Build simple Artist detail pages (listing all works by that artist, short bio) | Frontend |
| P1 | Add an image zoom viewer (integrate a IIIF viewer for high-res) | Frontend |
| P2 | Implement a caching layer (if needed) – e.g. in-memory cache for recent search results or answers, to improve performance | Backend |

**Success Criteria (v1.0)**:
- The AI Curator can answer user questions with relevant, factually correct information and proper citations >90% of the time (tested with a set of sample queries).
- End-to-end latency for an AI answer is <3 seconds on average (with our smaller dataset).
- Users in a pilot group report that the chat is helpful and the interface is intuitive.
- The related works recommendations provided by the AI are sensible >80% of the time (subjective measure, but we want the suggestions to make sense given the context).
- At least a few thousand objects are now browsable and searchable, showing readiness to scale content.

At this point (week 8), we would likely do a soft launch/beta for internal stakeholders or a small external group.

### Phase 3: v1.1 (Weeks 9–12)

**Goal**: Introduce content flagging and an initial moderation workflow, plus administrative tools to manage the system. Also address any issues from beta testing and refine the UX.

**Scope & Tasks**:

| Priority | Task | Owner |
|----------|------|-------|
| P0 | Implement the flagging workflow in n8n and create content_flags schema (if not already) | Backend (n8n) |
| P0 | Add Flag button UI on artwork detail and AI chat messages | Frontend |
| P0 | Build a simple admin view for flags (could even be a protected route in the same front-end) | Frontend |
| P0 | Add basic authentication for admin routes/actions (could use HTTP basic auth or a simple login) | Backend/Auth |
| P1 | Integrate email/Slack notifications for new flags via n8n | Backend (n8n) |
| P1 | Create an admin dashboard for analytics (flag counts, usage stats) | Frontend |
| P2 | Support batch operations on flags (select multiple, mark resolved) | Frontend/Admin |
| P2 | Possibly integrate a feedback form for general user feedback outside flags | Frontend |

**Success Criteria (v1.1)**:
- Admins can see all user flags and update their status through the provided interface (or via DB with ease).
- The system has received and processed some flags (if any issues were found during beta) and the team has successfully resolved them, demonstrating the moderation loop works.
- No unchecked spam: rate limiting and abuse measures are effective (no more than 1% of content flags are spam, or those that are get auto-dismissed quickly).
- Basic usage analytics (if implemented) show the number of chats, searches, etc., giving insight into user engagement.

After v1.1, the product is essentially complete in terms of promised features. The focus shifts to enhancement and scale.

### Phase 4: Future Enhancements (Post v1.1)

This is an open-ended phase for improvements based on user feedback and scaling needs. Potential enhancements include:

- **Advanced Search Features**: Add more filter options (e.g. a slider for year range, multi-select facets for terms) and autocomplete suggestions to guide user queries. Possibly implement an image similarity search using a vision model (CLIP) to find visually similar artworks.
- **Personalization**: Introduce user accounts so users can save favorite artworks or past conversations. Logged-in users could also receive notifications if new relevant art is added.
- **Multi-language Support**: Allow the AI curator to answer in multiple languages (could integrate a translation model or fine-tune a multilingual model). Also possibly translate the UI.
- **Public API**: Consider exposing some read-only APIs for others to query the collection or the AI (with rate limiting and API keys).
- **Mobile App**: If usage is high and requires a better mobile experience, package the webapp as a mobile app (using React Native or similar) for offline features or push notifications.
- **Scalability Upgrades**: As dataset approaches >200k items or userbase grows, scale out infrastructure: add read replicas for Postgres, add replicas or shards for Qdrant, potentially move embedding generation to a dedicated service or use GPUs for Ollama if needed. Use a CDN for images (the IIIF server likely is CDN-backed already).
- **Monitoring & Alerts**: Deploy monitoring dashboards for performance metrics and set up alerts (e.g., if curator response time goes >10s or any workflow failure).
- **Continuous Data Updates**: Automate the ingestion to run daily and incorporate delta updates smoothly (only embed new/changed items by checking `data_hash`).
- **AI Improvements**: Evaluate upgrading to larger LLMs as they become feasible, for more nuanced answers. Possibly incorporate knowledge of art historical context beyond NGA data for richer answers (but clearly indicate when it's beyond collection info). Also, integrate image analysis – e.g., AI vision to answer questions about an image's content (a big leap, but possible future).

Each of these would be planned and prioritized based on actual user needs and resource availability.

### Deployment and Rollout Strategy

During MVP and v1.0, we'll likely do internal testing. Once v1.0 is stable, do a soft launch on the NGA website or a subdomain, without heavy publicity, to gather usage and feedback. Have a feedback channel (maybe link to a survey or use the flag mechanism for "general feedback").

By v1.1 with flagging in place, we could do a public launch announcement, inviting the public to try the NGA Curator. Expect an influx of users and ensure the infrastructure can handle it (maybe load test the n8n workflows beforehand).

We will monitor the system closely post-launch, addressing any issues (especially anything the AI says that might be contentious – though our safeguards should minimize that).

## 11. Implementation Notes & Best Practices

(A few additional pointers to ensure the engineering and design teams have clarity and use modern best practices.)

### Version Control & Dev Workflow

All n8n workflows should be exported to JSON and stored in a Git repository. Similarly, front-end code will be in Git. We'll use a CI/CD pipeline to build and deploy the static site (e.g., using a tool like GitHub Actions or Vercel's build to S3). For n8n, we might employ infrastructure-as-code (Docker Compose or similar) to manage n8n, Postgres, Qdrant, Ollama services together (the AI Starter Kit by n8n could be a starting point). We should maintain separate dev and prod environments.

### Testing

Write unit tests for any custom code (like the formatting functions in n8n code nodes, and front-end utility functions). Also test workflows with representative data (n8n allows manual triggering and step-by-step execution). Before launch, conduct user acceptance testing with museum staff or a small group to ensure the AI answers are appropriate and the UI is intuitive.

### Accessibility

Ensure the UI meets basic accessibility standards (WCAG AA). That includes: alt text for images (the artwork title can serve as alt text for thumbnails), sufficient color contrast especially with translucent layers, the ability to navigate via keyboard (e.g., tabbing through artworks or focusing the chat input). The chat and other dynamic content should announce updates to screen readers (we might use ARIA live regions for new messages). Though the design is visually fancy, we must not sacrifice accessibility.

### Performance Optimizations

Use lazy-loading for images (only load images that are in or near the viewport). Combine and minify CSS/JS, and leverage the CDN for caching static assets. For n8n, enable its own caching for HTTP nodes if possible (e.g., cache GitHub fetch for a minute or so during ingestion to avoid rate limits). Monitor memory usage of Ollama – since it runs in Docker, ensure the host has enough RAM for the loaded models (e.g. llama3.2:3b ~2 GB, llava ~4.7 GB, plus embedding models).

### Security

Follow OWASP best practices. For example, protect against SQL injection by only using parameterized queries in Postgres nodes (which n8n supports by binding variables). Validate all inputs on the server side (even though front-end also does). Set a Content Security Policy on the static site to restrict third-party scripts. Since our data is mostly public domain images/text, we have less concern about data exposure, but we still treat the infrastructure securely (no open db ports, etc.). Also, do not expose the n8n editor to the public – use basic auth as configured.

### Analytics & Logging

Include some form of usage logging to track how the feature is used (e.g., count of searches, popular search terms, number of questions asked). This can be done in n8n (log events to Postgres) or via a simple analytics script on front-end (though avoid heavy trackers). Logging AI questions and answers (anonymously) in a secure way can help improve the system over time (we might log Q&A pairs to analyze how well the AI is doing and if it made mistakes).

### Collaboration with NGA

Since the data comes from NGA's official source, if users via the curator flag errors, we should consider feeding those back to the NGA data maintainers so they can correct the official dataset. Establish a process for that in long term.

---

This PRD provides a comprehensive roadmap for implementing the NGA Curator. By following the phased approach and adhering to these requirements and guidelines, the team will deliver an innovative, engaging experience that leverages modern AI and design to connect the public with the NGA's rich art collection in a new way. The end result will be a scalable platform that can grow in content and features, always keeping the art and the user's curiosity at the center.

## References

- [Automating Processes with Qdrant and n8n - Qdrant](https://qdrant.tech/documentation/qdrant-n8n/)
- [Qdrant Vector Store node documentation | n8n Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoreqdrant/)
- [AI Agent node documentation | n8n Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)