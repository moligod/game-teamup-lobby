function createAnnouncementService(repository) {
    return {
        async getChannels() { return repository.listChannels(); },
        async getAnnouncements({ page = 1, pageSize = 10, channelName = null } = {}) {
            const [count, items] = await Promise.all([
                repository.countAnnouncements(channelName),
                repository.listAnnouncements(channelName, pageSize, (page - 1) * pageSize)
            ]);
            const total = Number(count?.total) || 0;
            return { status: { provider: 'manual', refreshed_at: null, last_error: null, refresh_interval_ms: 0 }, items, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } };
        }
    };
}
module.exports = { createAnnouncementService };
