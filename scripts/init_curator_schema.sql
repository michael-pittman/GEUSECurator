CREATE TABLE IF NOT EXISTS artworks (
  objectid BIGINT PRIMARY KEY
);

ALTER TABLE artworks ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS attribution TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS displaydate TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS medium TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS beginyear INTEGER;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS endyear INTEGER;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS creditline TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS ai_description TEXT NOT NULL DEFAULT '';
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(6,4) NOT NULL DEFAULT 1.0;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS last_ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS artwork_images (
  id BIGSERIAL PRIMARY KEY,
  objectid BIGINT NOT NULL REFERENCES artworks(objectid) ON DELETE CASCADE
);

ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS uuid TEXT;
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS iiifurl TEXT NOT NULL DEFAULT '';
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS iiifthumburl TEXT NOT NULL DEFAULT '';
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS viewtype TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS assistivetext TEXT NOT NULL DEFAULT '';
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE artwork_images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Remove duplicate image rows per (objectid, viewtype), keeping the newest id.
DELETE FROM artwork_images a
USING artwork_images b
WHERE a.id < b.id
  AND a.objectid = b.objectid
  AND a.viewtype = b.viewtype;

-- Hard guard: only one row per (objectid, viewtype).
CREATE UNIQUE INDEX IF NOT EXISTS uq_artwork_images_objectid_viewtype
ON artwork_images (objectid, viewtype);

CREATE INDEX IF NOT EXISTS idx_artworks_last_ingested_at ON artworks (last_ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_updated_at ON artworks (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_artwork_images_objectid ON artwork_images (objectid);
CREATE INDEX IF NOT EXISTS idx_artwork_images_viewtype ON artwork_images (viewtype);
CREATE INDEX IF NOT EXISTS idx_artwork_images_objectid_sequence ON artwork_images (objectid, sequence);
