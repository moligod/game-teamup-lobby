const CHANNEL_FILTER_SQL = `$1::text IS NULL
  OR channel_name = $1
  OR regexp_replace(channel_name, '^[^A-Za-z0-9]+', '') = $1`;

class PostgresAnnouncementRepository {
    constructor(database) {
        this.database = database;
    }

    one(sql, params = []) {
        return this.database.one(sql, params);
    }

    query(sql, params = []) {
        return this.database.query(sql, params);
    }

    async hasAnnouncements() {
        const row = await this.one('SELECT EXISTS (SELECT 1 FROM trovepal_announcements) AS has_announcements');
        return Boolean(row?.has_announcements);
    }

    async saveAnnouncements(items) {
        if (!Array.isArray(items) || items.length === 0) return 0;

        const params = [];
        const values = items.map((item, index) => {
            const offset = index * 9;
            params.push(
                item.id,
                item.category,
                item.channel_name,
                item.content,
                item.author_name,
                item.author_username,
                JSON.stringify(item.image_urls),
                item.posted_at,
                item.source_url
            );
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb, $${offset + 8}, $${offset + 9})`;
        });

        const saved = await this.query(`INSERT INTO trovepal_announcements (
              source_id, category, channel_name, content, author_name, author_username,
              image_urls, posted_at, source_url
            ) VALUES ${values.join(', ')}
            ON CONFLICT (source_id) DO UPDATE SET
              category = EXCLUDED.category,
              channel_name = EXCLUDED.channel_name,
              content = EXCLUDED.content,
              author_name = EXCLUDED.author_name,
              author_username = EXCLUDED.author_username,
              image_urls = EXCLUDED.image_urls,
              posted_at = EXCLUDED.posted_at,
              source_url = EXCLUDED.source_url
            RETURNING (xmax = 0) AS inserted`, params);

        return (Array.isArray(saved) ? saved : []).reduce((result, row) => {
            if (row.inserted) result.inserted += 1;
            else result.updated += 1;
            return result;
        }, { inserted: 0, updated: 0 });
    }

    async listChannels() {
        const rows = await this.query('SELECT DISTINCT channel_name FROM trovepal_announcements ORDER BY channel_name');
        return rows.map(row => row.channel_name);
    }

    listManualAnnouncements() {
        return this.query(`SELECT source_id AS id, title, category, content, posted_at
          FROM trovepal_announcements WHERE source_id LIKE 'manual:%'
          ORDER BY posted_at DESC NULLS LAST, source_id DESC LIMIT 500`);
    }

    async createManualAnnouncement(item) {
        return this.one(`INSERT INTO trovepal_announcements
          (source_id, title, category, channel_name, content, author_name, posted_at)
          VALUES ($1, $2, $3, $4, $5, 'Game Hub', CURRENT_TIMESTAMP)
          RETURNING source_id AS id, title, category, content, posted_at`,
          [item.id, item.title, item.category, item.channel_name, item.content]);
    }

    async updateManualAnnouncement(id, item) {
        return this.one(`UPDATE trovepal_announcements SET title=$2, category=$3, channel_name=$4, content=$5
          WHERE source_id=$1 AND source_id LIKE 'manual:%'
          RETURNING source_id AS id, title, category, content, posted_at`,
          [id, item.title, item.category, item.channel_name, item.content]);
    }

    async deleteManualAnnouncement(id) {
        const rows = await this.query(`DELETE FROM trovepal_announcements
          WHERE source_id=$1 AND source_id LIKE 'manual:%' RETURNING source_id`, [id]);
        return Array.isArray(rows) && rows.length > 0;
    }

    countAnnouncements(channelName = null) {
        return this.one(`SELECT COUNT(*)::int AS total
          FROM trovepal_announcements
          WHERE ${CHANNEL_FILTER_SQL}`, [channelName]);
    }

    listAnnouncements(channelName, limit, offset) {
        return this.query(`SELECT source_id AS id, title, category, channel_name, content, author_name,
              author_username, image_urls, posted_at, source_url
          FROM trovepal_announcements
          WHERE ${CHANNEL_FILTER_SQL}
          ORDER BY posted_at DESC NULLS LAST, source_id DESC
          LIMIT $2 OFFSET $3`, [channelName, limit, offset]);
    }
}

module.exports = { PostgresAnnouncementRepository };
