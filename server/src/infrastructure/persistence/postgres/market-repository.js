class PostgresMarketRepository {
    constructor(database) {
        this.database = database;
    }

    query(sql, params = []) {
        return this.database.query(sql, params);
    }

    one(sql, params = []) {
        return this.database.one(sql, params);
    }

    listPublicListings() {
        return this.query(`SELECT listing.id, listing.seller_id, seller.username AS seller_name,
            listing.category, listing.title, listing.description, listing.price, listing.price_unit,
            listing.stock, listing.player_name, listing.delivery_method, listing.is_pinned, listing.created_at,
            review_summary.average_rating,
            COALESCE(review_summary.review_count, 0) AS review_count
          FROM market_listings listing
          INNER JOIN users seller ON seller.id = listing.seller_id
          LEFT JOIN (
            SELECT seller_id,
              ROUND(AVG(rating)::numeric, 1)::float AS average_rating,
              COUNT(*)::int AS review_count
            FROM market_reviews
            GROUP BY seller_id
          ) review_summary ON review_summary.seller_id = listing.seller_id
          WHERE listing.is_active = TRUE
          ORDER BY listing.is_pinned DESC, listing.created_at DESC, listing.id DESC`);
    }

    countPublicListings(category, query) {
        return this.one(`SELECT COUNT(*)::int AS total
          FROM market_listings listing
          INNER JOIN users seller ON seller.id = listing.seller_id
          WHERE listing.is_active = TRUE
            AND listing.category = $1
            AND ($2 = ''
              OR lower(listing.title) LIKE '%' || $2 || '%'
              OR lower(seller.username) LIKE '%' || $2 || '%')`, [category, query]);
    }

    listPublicListingsPage(category, query, limit, offset) {
        return this.query(`WITH page_listings AS MATERIALIZED (
            SELECT listing.id, listing.seller_id, seller.username AS seller_name,
              listing.category, listing.title, listing.description, listing.price, listing.price_unit,
              listing.stock, listing.player_name, listing.delivery_method, listing.is_pinned, listing.created_at
            FROM market_listings listing
            INNER JOIN users seller ON seller.id = listing.seller_id
            WHERE listing.is_active = TRUE
              AND listing.category = $1
              AND ($2 = ''
                OR lower(listing.title) LIKE '%' || $2 || '%'
                OR lower(seller.username) LIKE '%' || $2 || '%')
            ORDER BY listing.is_pinned DESC,
              CASE WHEN $1 = 'flux' THEN listing.price END ASC,
              listing.created_at DESC,
              listing.id DESC
            LIMIT $3 OFFSET $4
          ), page_sellers AS (
            SELECT DISTINCT seller_id
            FROM page_listings
          ), review_summary AS (
            SELECT review.seller_id,
              ROUND(AVG(review.rating)::numeric, 1)::float AS average_rating,
              COUNT(*)::int AS review_count
            FROM market_reviews review
            INNER JOIN page_sellers seller ON seller.seller_id = review.seller_id
            GROUP BY review.seller_id
          )
          SELECT listing.id, listing.seller_id, listing.seller_name,
            listing.category, listing.title, listing.description, listing.price, listing.price_unit,
            listing.stock, listing.player_name, listing.delivery_method, listing.is_pinned, listing.created_at,
            review_summary.average_rating,
            COALESCE(review_summary.review_count, 0) AS review_count
          FROM page_listings listing
          LEFT JOIN review_summary ON review_summary.seller_id = listing.seller_id
          ORDER BY listing.is_pinned DESC,
            CASE WHEN listing.category = 'flux' THEN listing.price END ASC,
            listing.created_at DESC,
            listing.id DESC`, [category, query, limit, offset]);
    }

    countAdminListings(query) {
        return this.one(`SELECT COUNT(*)::int AS total
          FROM market_listings listing
          INNER JOIN users seller ON seller.id = listing.seller_id
          WHERE $1 = ''
            OR listing.title ILIKE '%' || $1 || '%'
            OR seller.username ILIKE '%' || $1 || '%'`, [query]);
    }

    listAdminListings(query, limit, offset) {
        return this.query(`SELECT listing.id, listing.seller_id, seller.username AS seller_name,
            listing.category, listing.title, listing.description, listing.price, listing.price_unit,
            listing.stock, listing.player_name, listing.delivery_method, listing.is_active, listing.is_pinned,
            listing.created_at, listing.updated_at
          FROM market_listings listing
          INNER JOIN users seller ON seller.id = listing.seller_id
          WHERE $1 = ''
            OR listing.title ILIKE '%' || $1 || '%'
            OR seller.username ILIKE '%' || $1 || '%'
          ORDER BY listing.is_pinned DESC, listing.updated_at DESC, listing.id DESC
          LIMIT $2 OFFSET $3`, [query, limit, offset]);
    }

    setListingPinned(id, isPinned) {
        return this.one(`UPDATE market_listings
          SET is_pinned = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, seller_id, category, title, description, price, price_unit, stock, player_name,
            delivery_method, is_active, is_pinned, created_at, updated_at`, [id, isPinned]);
    }

    deleteAdminListing(id) {
        return this.one('DELETE FROM market_listings WHERE id = $1 RETURNING id', [id]);
    }

    listSellerListings(sellerId) {
        return this.query(`SELECT id, seller_id, category, title, description, price, price_unit,
            stock, player_name, delivery_method, is_active, is_pinned, created_at, updated_at
          FROM market_listings
          WHERE seller_id = $1
          ORDER BY is_active DESC, updated_at DESC, id DESC`, [sellerId]);
    }

    createListing(input) {
        return this.one(`INSERT INTO market_listings (
              seller_id, category, title, description, price, price_unit, stock, player_name,
              delivery_method, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, seller_id, category, title, description, price, price_unit,
              stock, player_name, delivery_method, is_active, is_pinned, created_at, updated_at`, [
            input.seller_id,
            input.category,
            input.title,
            input.description,
            input.price,
            input.price_unit,
            input.stock,
            input.player_name,
            input.delivery_method,
            input.is_active
        ]);
    }

    updateSellerListing(id, sellerId, input) {
        return this.one(`UPDATE market_listings
          SET category = $3,
              title = $4,
              description = $5,
              price = $6,
              price_unit = $7,
              stock = $8,
              player_name = $9,
              delivery_method = $10,
              is_active = $11,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND seller_id = $2
          RETURNING id, seller_id, category, title, description, price, price_unit,
            stock, player_name, delivery_method, is_active, is_pinned, created_at, updated_at`, [
            id,
            sellerId,
            input.category,
            input.title,
            input.description,
            input.price,
            input.price_unit,
            input.stock,
            input.player_name,
            input.delivery_method,
            input.is_active
        ]);
    }

    findActiveListingForConversation(listingId) {
        return this.one(`SELECT id, seller_id, title
          FROM market_listings
          WHERE id = $1 AND is_active = TRUE`, [listingId]);
    }

    getOrCreateConversation(listingId, buyerId) {
        return this.one(`INSERT INTO market_conversations (listing_id, buyer_id, seller_id)
          SELECT id, $2, seller_id
          FROM market_listings
          WHERE id = $1 AND is_active = TRUE
          ON CONFLICT (listing_id, buyer_id) DO UPDATE
          SET updated_at = market_conversations.updated_at
          RETURNING id, listing_id, buyer_id, seller_id, last_message_at, created_at, updated_at`, [listingId, buyerId]);
    }

    getConversationForUser(conversationId, userId) {
        return this.one(`SELECT conversation.id, conversation.listing_id, conversation.buyer_id,
            conversation.seller_id, conversation.last_message_at, conversation.created_at,
            listing.title AS listing_title,
            buyer.username AS buyer_name,
            seller.username AS seller_name
          FROM market_conversations conversation
          INNER JOIN market_listings listing ON listing.id = conversation.listing_id
          INNER JOIN users buyer ON buyer.id = conversation.buyer_id
          INNER JOIN users seller ON seller.id = conversation.seller_id
          WHERE conversation.id = $1
            AND (conversation.buyer_id = $2 OR conversation.seller_id = $2)`, [conversationId, userId]);
    }

    getConversationForBuyer(conversationId, buyerId) {
        return this.one(`SELECT id, listing_id, buyer_id, seller_id
          FROM market_conversations
          WHERE id = $1 AND buyer_id = $2`, [conversationId, buyerId]);
    }

    listConversationsForUser(userId) {
        return this.query(`SELECT conversation.id, conversation.listing_id, conversation.buyer_id,
            conversation.seller_id, conversation.last_message_at, conversation.created_at,
            listing.title AS listing_title,
            CASE WHEN conversation.buyer_id = $1 THEN seller.id ELSE buyer.id END AS counterpart_id,
            CASE WHEN conversation.buyer_id = $1 THEN seller.username ELSE buyer.username END AS counterpart_name,
            latest_message.body AS last_message_body,
            latest_message.created_at AS last_message_created_at
          FROM market_conversations conversation
          INNER JOIN market_listings listing ON listing.id = conversation.listing_id
          INNER JOIN users buyer ON buyer.id = conversation.buyer_id
          INNER JOIN users seller ON seller.id = conversation.seller_id
          LEFT JOIN LATERAL (
            SELECT body, created_at
            FROM market_messages
            WHERE conversation_id = conversation.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          ) latest_message ON TRUE
          WHERE conversation.buyer_id = $1 OR conversation.seller_id = $1
          ORDER BY conversation.last_message_at DESC, conversation.id DESC`, [userId]);
    }

    listConversationMessages(conversationId, limit) {
        return this.query(`SELECT message.id, message.conversation_id, message.sender_id,
            sender.username AS sender_name, message.body, message.created_at
          FROM market_messages message
          INNER JOIN users sender ON sender.id = message.sender_id
          WHERE message.conversation_id = $1
          ORDER BY message.created_at ASC, message.id ASC
          LIMIT $2`, [conversationId, limit]);
    }

    async createConversationMessage(conversationId, senderId, body) {
        return this.database.withTransaction(async (query) => {
            const inserted = await query(`INSERT INTO market_messages (conversation_id, sender_id, body)
                VALUES ($1, $2, $3)
                RETURNING id, conversation_id, sender_id, body, created_at`, [conversationId, senderId, body]);
            await query(`UPDATE market_conversations
                SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1`, [conversationId]);
            return inserted.rows[0];
        });
    }

    listSellerReviews(sellerId, limit) {
        return this.query(`SELECT review.id, review.conversation_id, review.rating, review.comment,
            review.image_urls, review.created_at, review.updated_at, buyer.username AS buyer_name
          FROM market_reviews review
          INNER JOIN users buyer ON buyer.id = review.buyer_id
          WHERE review.seller_id = $1
          ORDER BY review.updated_at DESC, review.id DESC
          LIMIT $2`, [sellerId, limit]);
    }

    createOrUpdateReview(input) {
        return this.one(`INSERT INTO market_reviews (
              conversation_id, buyer_id, seller_id, rating, comment, image_urls
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT (conversation_id) DO UPDATE SET
              rating = EXCLUDED.rating,
              comment = EXCLUDED.comment,
              image_urls = EXCLUDED.image_urls,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id, conversation_id, buyer_id, seller_id, rating, comment, image_urls,
              created_at, updated_at`, [
            input.conversation_id,
            input.buyer_id,
            input.seller_id,
            input.rating,
            input.comment,
            JSON.stringify(input.image_urls)
        ]);
    }

    countPublicDishonestyReports(query) {
        return this.one(`SELECT COUNT(*)::int AS total
          FROM dishonesty_reports report
          WHERE report.status = 'approved'
            AND ($1 = ''
              OR COALESCE(report.dishonest_qq, '') ILIKE '%' || $1 || '%'
              OR COALESCE(report.dishonest_player_name, '') ILIKE '%' || $1 || '%')`, [query]);
    }

    listPublicDishonestyReports(query, limit, offset) {
        return this.query(`SELECT report.id, report.dishonest_qq, report.dishonest_player_name,
            report.reason, report.evidence_urls, report.reviewed_at, report.created_at
          FROM dishonesty_reports report
          WHERE report.status = 'approved'
            AND ($1 = ''
              OR COALESCE(report.dishonest_qq, '') ILIKE '%' || $1 || '%'
              OR COALESCE(report.dishonest_player_name, '') ILIKE '%' || $1 || '%')
          ORDER BY report.reviewed_at DESC NULLS LAST, report.id DESC
          LIMIT $2 OFFSET $3`, [query, limit, offset]);
    }

    createDishonestyReport(input) {
        return this.one(`INSERT INTO dishonesty_reports (
              reporter_id, dishonest_qq, dishonest_player_name, reason, evidence_urls
            ) VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING id, reporter_id, dishonest_qq, dishonest_player_name, reason,
              evidence_urls, status, created_at`, [
            input.reporter_id,
            input.dishonest_qq,
            input.dishonest_player_name,
            input.reason,
            JSON.stringify(input.evidence_urls)
        ]);
    }

    countAdminDishonestyReports(query, status) {
        return this.one(`SELECT COUNT(*)::int AS total
          FROM dishonesty_reports report
          WHERE ($1 = 'all' OR report.status = $1)
            AND ($2 = ''
              OR COALESCE(report.dishonest_qq, '') ILIKE '%' || $2 || '%'
              OR COALESCE(report.dishonest_player_name, '') ILIKE '%' || $2 || '%'
              OR report.reason ILIKE '%' || $2 || '%')`, [status, query]);
    }

    listAdminDishonestyReports(query, status, limit, offset) {
        return this.query(`SELECT report.id, report.reporter_id, reporter.username AS reporter_name,
            report.dishonest_qq, report.dishonest_player_name, report.reason, report.evidence_urls,
            report.status, report.reviewer_id, reviewer.username AS reviewer_name,
            report.reviewed_at, report.created_at
          FROM dishonesty_reports report
          INNER JOIN users reporter ON reporter.id = report.reporter_id
          LEFT JOIN users reviewer ON reviewer.id = report.reviewer_id
          WHERE ($1 = 'all' OR report.status = $1)
            AND ($2 = ''
              OR COALESCE(report.dishonest_qq, '') ILIKE '%' || $2 || '%'
              OR COALESCE(report.dishonest_player_name, '') ILIKE '%' || $2 || '%'
              OR report.reason ILIKE '%' || $2 || '%')
          ORDER BY CASE report.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
            report.created_at DESC, report.id DESC
          LIMIT $3 OFFSET $4`, [status, query, limit, offset]);
    }

    reviewDishonestyReport(id, status, reviewerId) {
        return this.one(`UPDATE dishonesty_reports
          SET status = $2, reviewer_id = $3, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND status = 'pending'
          RETURNING id, reporter_id, dishonest_qq, dishonest_player_name, reason, evidence_urls,
            status, reviewer_id, reviewed_at, created_at`, [id, status, reviewerId]);
    }
}

module.exports = { PostgresMarketRepository };
