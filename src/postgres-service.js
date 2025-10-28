// src/postgres-service.js
let pool;

async function getPool() {
  if (!pool) {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    pool.on('connect', () => console.log('[DB] Conectado ao Neon'));
    pool.on('error', (err) => console.error('[DB] Erro:', err.message));
  }
  return pool;
}

class PostgresService {
  async upsert(data) {
    const client = await getPool();
    const query = `
      INSERT INTO document_editors (
        "documentId", "documentName", "documentLink", "folderPath",
        "editorName", "firstEdit", "lastEdit", "totalMinutes"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("documentId", "editorName")
      DO UPDATE SET
        "documentName" = EXCLUDED."documentName",
        "documentLink" = EXCLUDED."documentLink",
        "folderPath" = EXCLUDED."folderPath",
        "lastEdit" = EXCLUDED."lastEdit",
        "totalMinutes" = EXCLUDED."totalMinutes"
      RETURNING *;
    `;

    const values = [
      data.documento_id,
      data.documento_nome,
      data.documento_link || null,
      data.pastas_pai_nomes || null,
      data.ultimo_editor_nome,
      data.data_primeira_edicao,
      data.data_ultima_modificacao,
      parseFloat(data.tempo_total_editado_min)
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async getCurrentTime(documentId, editorName) {
    const client = await getPool();
    const result = await client.query(
      `SELECT "totalMinutes", "firstEdit" FROM document_editors 
       WHERE "documentId" = $1 AND "editorName" = $2`,
      [documentId, editorName]
    );
    return result.rows[0] || { totalMinutes: 0 };
  }
}

module.exports = PostgresService;