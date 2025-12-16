# Intelligence Operations Hub - Technical Overview

**Documentación técnica para equipos de desarrollo**

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                      Vercel Edge Network                     │
│                    (CDN + Edge Functions)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TS)                     │
│  SearchPage · InsightsPage · AnalysisPage · ArchivePage     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Serverless API Layer (Node.js)                  │
│    /api/news · /api/insights · /api/analysis · /api/admin   │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   News APIs     │  │   OpenAI API    │  │  PostgreSQL DB  │
│  (6 providers)  │  │  GPT-4o-mini    │  │   (Neon.tech)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 📁 Estructura del Repositorio

```
social_mind_ai/
├── frontend/                  # React + TypeScript + Ant Design
│   ├── src/
│   │   ├── pages/            # Vistas principales
│   │   │   ├── SearchPage.tsx       # Búsqueda de noticias
│   │   │   ├── InsightsPage.tsx     # Clasificación con IA
│   │   │   ├── AnalysisPage.tsx     # Análisis periodístico
│   │   │   ├── ArchivePage.tsx      # Hemeroteca
│   │   │   └── HistoryPage.tsx      # Historial
│   │   ├── api.ts            # Cliente HTTP
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utilidades (imageProxy, etc.)
│   ├── index.html            # Entry point (Findasense branding)
│   └── package.json
│
├── api/                      # Vercel Serverless Functions (Node.js)
│   ├── news.js              # Agregación de 6 APIs
│   ├── news/archive.js      # Hemeroteca histórica
│   ├── insights.js          # Proxy a clasificación
│   ├── insights/
│   │   ├── classify.js      # Clasificación OpenAI
│   │   └── list.js          # Listado paginado
│   ├── analysis/
│   │   ├── run.js           # Análisis agregado
│   │   └── history.js       # Historial de análisis
│   └── admin/
│       └── clear-database.js # Limpieza de tablas (admin only)
│
├── serverless_lib/          # Librerías compartidas (Node.js)
│   ├── db.js                # PostgreSQL client + schema migrations
│   ├── openai.js            # OpenAI API wrapper
│   ├── news.js              # Lógica de agregación de noticias
│   ├── insights.js          # Lógica de clasificación
│   └── analysis.js          # Lógica de análisis periodístico
│
├── news_service/            # FastAPI service (Python) - desarrollo local
│   └── app.py               # Servicio de noticias
│
├── insights_service/        # FastAPI service (Python) - desarrollo local
│   └── app.py               # Servicio de insights
│
├── analysis_service/        # FastAPI service (Python) - desarrollo local
│   └── app.py               # Servicio de análisis
│
├── docker-compose.yml       # Orquestación local (dev)
├── run_all.sh              # Script de inicio rápido
├── .env.example            # Variables de entorno template
└── README.md               # Documentación general
```

---

## 🔧 Stack Tecnológico

### **Frontend**
- **React 18** - UI library
- **TypeScript** - Type safety
- **Ant Design** - UI components
- **Vite** - Build tool
- **Framer Motion** - Animaciones

### **Backend**
- **Node.js 20+** - Serverless functions runtime
- **FastAPI** - Python services (local dev)
- **Express** - (implícito en Vercel functions)

### **Database**
- **PostgreSQL 15** - Neon.tech (production)
- **SQLite** - Local development fallback
- **Schema:**
  - `news_articles` (26 columns)
  - `insights` (35 columns - 17 campos enriquecidos)
  - `analysis_results` (42 columns - 37 campos enriquecidos)

### **AI & External APIs**
- **OpenAI GPT-4o-mini** - Clasificación y análisis
- **NewsAPI** - 60,000+ fuentes globales
- **GNews** - Noticias en 60+ idiomas
- **NewsData.io** - Cobertura internacional
- **World News API** - Noticias categorizadas
- **The Guardian** - Periodismo de calidad
- **New York Times** - Fuente prestigiosa

### **Infrastructure**
- **Vercel** - Hosting + Serverless + CDN
- **GitHub** - Version control
- **Docker** - Local development (opcional)

---

## 🗄️ Esquema de Base de Datos

### **Tabla: `news_articles`**
Almacena noticias agregadas de todas las fuentes.

```sql
CREATE TABLE news_articles (
  id BIGSERIAL PRIMARY KEY,
  term TEXT,                    -- Término de búsqueda
  provider TEXT,                -- newsapi, gnews, newsdata, etc.
  source JSONB,                 -- {id, name}
  author TEXT,
  title TEXT,
  description TEXT,
  content TEXT,
  url TEXT,
  url_hash TEXT UNIQUE,         -- Deduplicación
  url_to_image TEXT,
  category TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Tabla: `insights`**
Clasificación enriquecida de noticias con OpenAI (17 campos).

```sql
CREATE TABLE insights (
  id BIGSERIAL PRIMARY KEY,
  term TEXT NOT NULL,
  -- Análisis básico
  sentimiento TEXT,             -- positivo, negativo, neutral, mixto
  resumen TEXT,
  resumen_ejecutivo TEXT,       -- 50-100 palabras
  categoria TEXT,
  etiquetas TEXT,
  marca TEXT,
  entidad TEXT,
  -- Análisis avanzado (nuevos campos)
  tono TEXT,                    -- formal, informal, alarmista, técnico
  temas_principales TEXT,
  subtemas TEXT,
  stakeholders TEXT,            -- CSV de actores clave
  impacto_social TEXT,
  impacto_economico TEXT,
  impacto_politico TEXT,
  palabras_clave_contextuales TEXT,
  trending_topics TEXT,
  analisis_competitivo TEXT,
  credibilidad_fuente REAL,    -- 0-100
  sesgo_detectado TEXT,
  localizacion_geografica TEXT,
  fuentes_citadas TEXT,
  datos_numericos TEXT,
  urgencia TEXT,               -- alta, media, baja
  audiencia_objetivo TEXT,
  -- Metadata del artículo
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
```

### **Tabla: `analysis_results`**
Análisis periodístico agregado de múltiples noticias (37 campos).

```sql
CREATE TABLE analysis_results (
  id BIGSERIAL PRIMARY KEY,
  term TEXT,
  insight_ids BIGINT[] NOT NULL,  -- Array de IDs de insights analizados
  result_json JSONB NOT NULL,     -- Respuesta completa de OpenAI
  count INT NOT NULL,              -- Número de insights analizados
  -- Análisis periodístico enriquecido
  sintesis_general TEXT,           -- 200-300 palabras
  narrativa_principal TEXT,
  narrativas_alternativas TEXT,
  framing_predominante TEXT,
  linea_temporal TEXT,
  contexto_necesario TEXT,
  actores_principales TEXT,
  voces_presentes TEXT,
  voces_ausentes TEXT,
  posiciones_enfrentadas TEXT,
  puntos_de_consenso TEXT,
  puntos_de_conflicto TEXT,
  datos_clave TEXT,
  fuentes_primarias TEXT,
  citas_destacadas TEXT,           -- Separadas por |
  tono_general_cobertura TEXT,
  equilibrio_cobertura TEXT,
  calidad_periodistica TEXT,
  nivel_credibilidad TEXT,
  consistencia_hechos TEXT,
  verificacion_necesaria TEXT,
  sesgos_identificados TEXT,
  lenguaje_cargado TEXT,
  epicentro_geografico TEXT,
  alcance_geografico TEXT,
  zonas_afectadas TEXT,
  temas_dominantes TEXT,
  temas_emergentes TEXT,
  palabras_clave_frecuentes TEXT,
  hashtags_tendencia TEXT,
  impacto_social_proyectado TEXT,
  impacto_politico_proyectado TEXT,
  impacto_economico_proyectado TEXT,
  escenarios_posibles TEXT,
  eventos_por_vigilar TEXT,
  aspectos_ignorados TEXT,
  audiencia_objetivo_agregada TEXT,
  nivel_tecnico TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 Flujo de Datos Completo

### **1. Búsqueda de Noticias**
```
Usuario → SearchPage → /api/news?term=X
                         ↓
               Llamadas paralelas a 6 APIs:
               - NewsAPI
               - GNews
               - NewsData.io
               - World News API
               - The Guardian
               - NY Times
                         ↓
               Deduplicación por URL hash
                         ↓
               Almacenamiento en news_articles
                         ↓
               Respuesta al frontend (merged articles)
```

### **2. Clasificación con IA**
```
Usuario selecciona artículos → /api/insights/classify
                                        ↓
                              Fetch artículos de DB
                                        ↓
                              Para cada artículo:
                              OpenAI GPT-4o-mini
                              Prompt: "Clasifica este artículo..."
                              Response: JSON con 17 campos
                                        ↓
                              INSERT INTO insights
                                        ↓
                              Respuesta al frontend
```

### **3. Análisis Periodístico**
```
Usuario selecciona insights → /api/analysis/run
                                      ↓
                            Fetch insights de DB
                                      ↓
                            OpenAI GPT-4o-mini
                            Prompt: "Analiza este conjunto..."
                            Response: JSON con 37 campos
                                      ↓
                            INSERT INTO analysis_results
                            (tanto result_json como campos individuales)
                                      ↓
                            Respuesta al frontend
```

---

## 🔐 Seguridad

### **Variables de Entorno Sensibles**
```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini

# Database
POSTGRES_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...

# News APIs
NEWS_API_KEY=...
GNEWS_API_KEY=...
NEWSDATA_API_KEY=...
WORLDNEWS_API_KEY=...
GUARDIAN_API_KEY=...
NYT_API_KEY=...

# Admin
ADMIN_TOKEN=...  # Para endpoint /api/admin/clear-database
```

### **Medidas de Seguridad Implementadas**
✅ Variables encriptadas en Vercel
✅ Endpoints admin protegidos con token
✅ SQL injection prevention (prepared statements)
✅ XSS protection (Ant Design sanitiza inputs)
✅ CORS configurado apropiadamente
✅ Rate limiting preparado (próximamente)
✅ Sanitización de inputs

---

## ⚡ Performance

### **Métricas Actuales**
- **Búsqueda de noticias:** 2-5 segundos (6 APIs en paralelo)
- **Clasificación (10 artículos):** ~15 segundos
- **Análisis agregado:** ~20 segundos
- **Carga de página:** <2 segundos (SSR + CDN)
- **Time to Interactive:** <3 segundos

### **Optimizaciones Implementadas**
✅ Caching de respuestas OpenAI (300s)
✅ Deduplicación de noticias por URL hash
✅ Imagen proxy con múltiples fallbacks (wsrv.nl, weserv.nl)
✅ Lazy loading de componentes
✅ PostgreSQL indexes en columnas frecuentemente consultadas
✅ Connection pooling (max 5 connections)

### **Optimizaciones Planeadas**
🔜 Redis para caching distribuido
🔜 Rate limiting por IP
🔜 Background jobs para clasificación (no bloquear UI)
🔜 Websockets para updates en tiempo real
🔜 Code splitting del frontend

---

## 🚀 Deployment

### **Vercel Configuration**
```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/frontend/$1" }
  ]
}
```

### **CI/CD Pipeline**
```
Git Push → GitHub
            ↓
      Vercel webhook
            ↓
    Build frontend (npm run build)
            ↓
    Deploy serverless functions
            ↓
    Deploy to Edge Network (CDN)
            ↓
    Production URL live
```

### **Environments**
- **Development:** Local con Docker Compose o directamente Node/Python
- **Preview:** Vercel preview deployments (por cada PR)
- **Production:** Vercel production (rama main)

---

## 🧪 Testing

### **Actualmente:**
❌ No hay tests automatizados (prototipo rápido)

### **Plan de Testing:**
- [ ] Unit tests (Jest + React Testing Library)
- [ ] Integration tests (Supertest para APIs)
- [ ] E2E tests (Playwright)
- [ ] Performance tests (Lighthouse CI)
- [ ] Security scans (Snyk, npm audit)

---

## 📈 Escalabilidad

### **Limitaciones Actuales:**
- **OpenAI API:** Rate limits (tier-based)
- **News APIs:** Rate limits por proveedor
- **PostgreSQL:** Neon free tier (1GB storage, 100 hours compute/mes)
- **Vercel:** Free tier (100GB bandwidth, 100 serverless function hours)

### **Escalabilidad Futura:**
✅ **Horizontal:** Vercel serverless escala automáticamente
✅ **Database:** Migración a Neon Pro o RDS (ilimitado)
✅ **Caching:** Redis para reducir llamadas a OpenAI
✅ **Background Jobs:** BullMQ + Redis para procesamiento async
✅ **Multi-region:** Vercel Edge Network (ya implementado)

---

## 🔧 Local Development

### **Setup Rápido:**
```bash
# 1. Clonar repo
git clone [repo-url]
cd social_mind_ai

# 2. Configurar variables
cp .env.example .env
# Editar .env con tus API keys

# 3. Opción A: Docker Compose (recomendado)
./run_all.sh

# 3. Opción B: Manual
cd frontend && npm install && npm run dev &
cd ../news_service && pip install -r requirements.txt && python app.py &
cd ../insights_service && python app.py &
cd ../analysis_service && python app.py &

# Frontend: http://localhost:19573
# News API: http://localhost:19081
# Insights API: http://localhost:19090
# Analysis API: http://localhost:19100
```

### **Development Tools:**
- VS Code extensions: ESLint, Prettier, Python
- Docker Desktop (opcional)
- PostgreSQL client (DBeaver, pgAdmin, psql)

---

## 📚 Documentación Adicional

- **README.md** - Overview general del proyecto
- **CORREO_FINDASENSE.md** - Propuesta de negocio completa
- **CORREO_EMAIL_VERSION.md** - Versión corta para email
- **ONE_PAGER_FINDASENSE.md** - Resumen ejecutivo de 1 página
- **TECHNICAL_OVERVIEW.md** - Este documento

---

## 🤝 Contribución / Extensión

### **Agregar Nuevo Proveedor de Noticias:**
1. Editar `serverless_lib/news.js`
2. Agregar función `fetchFromProvider(term, lang)`
3. Mapear respuesta a formato estándar
4. Agregar a array de proveedores
5. Configurar API key en `.env`

### **Agregar Nuevo Campo de Análisis:**
1. Agregar columna a tabla (`serverless_lib/db.js`)
2. Actualizar prompt de OpenAI (`serverless_lib/insights.js` o `analysis.js`)
3. Actualizar tipos TypeScript (`frontend/src/types/index.ts`)
4. Actualizar UI (`frontend/src/pages/InsightsPage.tsx` o `AnalysisPage.tsx`)
5. Desplegar cambios

### **Integrar con Nueva Herramienta:**
- **Slack:** Webhook para alertas
- **Power BI:** API endpoint para exportar datos
- **CRM:** Sync bidireccional con insights

---

## 📞 Contacto Técnico

**Alejandro Gutiérrez**
- Email: [tu-email@ejemplo.com]
- GitHub: [tu-github]
- LinkedIn: [tu-linkedin]

**Repositorio:** [GitHub URL]
**Demo Live:** https://social-mind-41o8so6xw-alejingutierrezs-projects.vercel.app

---

**Última actualización:** 16 de diciembre de 2025
