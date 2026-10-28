const { randomUUID } = require('crypto');
const channels = { announcement: 'announcements', update: 'game-updates', promotion: 'sales', pts: 'pts-announcements' };
function invalid(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Invalid announcement');
    const { title, content, category } = input;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) throw invalid('Title must be 1–200 characters');
    if (typeof content !== 'string' || !content.trim() || content.trim().length > 20000) throw invalid('Content must be 1–20000 characters');
    if (typeof category !== 'string' || !Object.hasOwn(channels, category)) throw invalid('Invalid category');
    return { title: title.trim(), content: content.trim(), category, channel_name: channels[category] };
}
function validateId(id) {
    if (typeof id !== 'string' || !/^manual:[0-9a-f-]{36}$/i.test(id)) throw invalid('Invalid announcement ID');
    return id;
}
function createManualAnnouncementService(repository, options = {}) {
    const makeId = options.makeId || randomUUID;
    return {
        list: () => repository.listManualAnnouncements(),
        async create(input) { return repository.createManualAnnouncement({ ...validate(input), id: `manual:${makeId()}` }); },
        async update(id, input) {
            const row = await repository.updateManualAnnouncement(validateId(id), validate(input));
            if (!row) throw invalid('Announcement not found', 404);
            return row;
        },
        async remove(id) {
            if (!await repository.deleteManualAnnouncement(validateId(id))) throw invalid('Announcement not found', 404);
        }
    };
}
module.exports = { createManualAnnouncementService };
