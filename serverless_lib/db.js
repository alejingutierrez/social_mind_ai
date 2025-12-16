const { Pool } = require('pg')

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED

if (!connectionString) {
  throw new Error('Postgres connection string is not configured')
}

const pool = new Pool({
  connectionString,
  max: 5,
  ssl: { rejectUnauthorized: false },
})

let schemaReady = false

async function ensureSchema() {
  if (schemaReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news_articles (
      id BIGSERIAL PRIMARY KEY,
      term TEXT,
      provider TEXT,
      source JSONB,
      author TEXT,
      title TEXT,
      description TEXT,
      content TEXT,
      url TEXT,
      url_hash TEXT UNIQUE,
      url_to_image TEXT,
      category TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS category TEXT;
    CREATE INDEX IF NOT EXISTS idx_news_term_created ON news_articles(term, created_at DESC);

    CREATE TABLE IF NOT EXISTS insights (
      id BIGSERIAL PRIMARY KEY,
      term TEXT NOT NULL,
      sentimiento TEXT,
      resumen TEXT,
      categoria TEXT,
      etiquetas TEXT,
      marca TEXT,
      entidad TEXT,
      article_title TEXT,
      article_description TEXT,
      article_content TEXT,
      article_url TEXT,
      article_image TEXT,
      idioma TEXT,
      confianza REAL,
      relevancia INTEGER,
      accion_recomendada TEXT,
      cita_clave TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_insights_term_created ON insights(term, created_at DESC);

    ALTER TABLE insights ADD COLUMN IF NOT EXISTS idioma TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS confianza REAL;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS relevancia INTEGER;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS accion_recomendada TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS cita_clave TEXT;

    -- Nuevos campos para análisis enriquecido con OpenAI
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS resumen_ejecutivo TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS tono TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS temas_principales TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS subtemas TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS stakeholders TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS impacto_social TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS impacto_economico TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS impacto_politico TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS palabras_clave_contextuales TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS trending_topics TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS analisis_competitivo TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS credibilidad_fuente REAL;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS sesgo_detectado TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS localizacion_geografica TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS fuentes_citadas TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS datos_numericos TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS urgencia TEXT;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS audiencia_objetivo TEXT;

    CREATE TABLE IF NOT EXISTS analysis_results (
      id BIGSERIAL PRIMARY KEY,
      term TEXT,
      insight_ids BIGINT[] NOT NULL,
      result_json JSONB NOT NULL,
      count INT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_results(created_at DESC);

    -- Nuevos campos para análisis periodístico enriquecido
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS sintesis_general TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS narrativa_principal TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS narrativas_alternativas TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS framing_predominante TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS linea_temporal TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS contexto_necesario TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS actores_principales TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS voces_presentes TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS voces_ausentes TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS posiciones_enfrentadas TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS puntos_de_consenso TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS puntos_de_conflicto TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS datos_clave TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS fuentes_primarias TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS citas_destacadas TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS tono_general_cobertura TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS equilibrio_cobertura TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS calidad_periodistica TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS nivel_credibilidad TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS consistencia_hechos TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS verificacion_necesaria TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS sesgos_identificados TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS lenguaje_cargado TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS epicentro_geografico TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS alcance_geografico TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS zonas_afectadas TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS temas_dominantes TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS temas_emergentes TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS palabras_clave_frecuentes TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS hashtags_tendencia TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS impacto_social_proyectado TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS impacto_politico_proyectado TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS impacto_economico_proyectado TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS escenarios_posibles TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS eventos_por_vigilar TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS aspectos_ignorados TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS audiencia_objetivo_agregada TEXT;
    ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS nivel_tecnico TEXT;
  `)
  schemaReady = true
}

async function query(text, params) {
  await ensureSchema()
  return pool.query(text, params)
}

module.exports = {
  pool,
  query,
  ensureSchema,
}
