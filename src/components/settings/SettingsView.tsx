interface SettingsViewProps {
  onClearFavorites: () => void
}

export function SettingsView({ onClearFavorites }: SettingsViewProps) {
  const handleClearFavorites = () => {
    if (window.confirm('Clear all saved favorites?')) {
      onClearFavorites()
    }
  }

  const handleClearSession = () => {
    if (window.confirm('Clear your session data?')) {
      localStorage.removeItem('nga-session-id')
      window.location.reload()
    }
  }

  return (
    <div className="px-5 space-y-6">
      {/* About */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">About</h3>
        <div className="rounded-2xl bg-surface-card border border-glass-border p-4 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold text-accent">GEUSE</span>
            <span className="text-xs text-text-secondary">Curator</span>
          </div>
          
          <p className="text-sm text-text-secondary leading-relaxed">
            An enterprise-grade AI platform for discovering and exploring the National Gallery of Art's collection through semantic search, multimodal retrieval, and conversational AI.
          </p>

          <div className="space-y-3 pt-2 border-t border-glass-border">
            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-1.5 uppercase tracking-wider">Data Pipeline & ETL</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Automated ingestion pipeline processes NGA open data CSVs, filters artworks with images, and transforms structured metadata into semantic embeddings. Python-based ETL feeds n8n orchestration workflows for scalable, batch processing.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-1.5 uppercase tracking-wider">Vectorization & Semantic Storage</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Dual-database architecture: PostgreSQL stores structured metadata (title, artist, dates, classification) while Qdrant indexes 768-dimensional embeddings via <code className="text-accent/80">nomic-embed-text</code>. Enables semantic similarity search across ~160,000 artworks with sub-second query performance.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-1.5 uppercase tracking-wider">AI Models & Multimodal Search</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Natural language processing via <code className="text-accent/80">llama3.2:3b</code> for conversational Q&A. Optional computer vision analysis with <code className="text-accent/80">llava</code> for image description and metadata enrichment. Embeddings power information retrieval, recommendation systems, and knowledge graph construction.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-1.5 uppercase tracking-wider">Enterprise Architecture</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                React 19 frontend (static SPA on AWS S3) communicates with n8n workflow orchestration layer. RESTful API microservices handle search, chat, and ingestion. GPU-accelerated inference (Tesla T4) enables real-time semantic search and interpretable AI responses.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-1.5 uppercase tracking-wider">Open Source & Self-Hosted</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Built entirely with open-source tools: Ollama (self-hosted LLM inference), PostgreSQL, Qdrant, and n8n. Zero outbound API calls to external providers—no OpenAI, Anthropic, or Google Cloud dependencies. All AI processing runs on-premises, ensuring data privacy, cost control, and full system autonomy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">Data</h3>
        <div className="rounded-2xl bg-surface-card border border-glass-border divide-y divide-glass-border">
          <button
            type="button"
            onClick={handleClearFavorites}
            className="w-full text-left px-4 py-3.5 text-sm text-text-primary hover:bg-glass-warm transition-colors rounded-t-2xl"
          >
            Clear Favorites
          </button>
          <button
            type="button"
            onClick={handleClearSession}
            className="w-full text-left px-4 py-3.5 text-sm text-text-primary hover:bg-glass-warm transition-colors rounded-b-2xl"
          >
            Clear Session
          </button>
        </div>
      </section>

      {/* Credits */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">Credits</h3>
        <div className="rounded-2xl bg-surface-card border border-glass-border p-4 space-y-2">
          <p className="text-sm text-text-secondary">
            Powered by the National Gallery of Art Open Data Program
          </p>
          <p className="text-xs text-text-muted">
            All artwork images courtesy of the National Gallery of Art, Washington D.C.
          </p>
        </div>
      </section>
    </div>
  )
}
