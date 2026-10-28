const assert = require('node:assert/strict');
const test = require('node:test');
const { PostgresSocialRepository } = require('../src/infrastructure/persistence/postgres/social-repository');
const { createSocialService } = require('../src/modules/social/social-service');

test('user search matches the lower-username trigram index expression', async () => {
    const calls = [];
    const repository = new PostgresSocialRepository({
        query: async (sql, params) => {
            calls.push({ sql, params });
            return [];
        }
    });

    await repository.searchUsers('Alice');

    assert.match(calls[0].sql, /lower\(username\) LIKE lower\(\$1\)/);
    assert.deepEqual(calls[0].params, ['%Alice%']);
});

test('sending a friend request persists it and notifies the target user', async () => {
    const calls = [];
    const service = createSocialService({
        addFriend: async (userId, friendId) => {
            calls.push(['addFriend', userId, friendId]);
            return { id: 12 };
        },
        getUserById: async () => ({ id: 3, username: 'sender', avatar: null })
    }, {
        sendFriendRequest: (userId, user) => calls.push(['sendFriendRequest', userId, user.username])
    });

    assert.deepEqual(await service.sendFriendRequest({ userId: 3, friendId: 9 }), { success: true, id: 12 });
    assert.deepEqual(calls, [
        ['addFriend', 3, 9],
        ['sendFriendRequest', '9', 'sender']
    ]);
});

test('accepting a friend request updates both users through realtime events', async () => {
    const events = [];
    const service = createSocialService({
        acceptFriend: async () => ({ success: true }),
        getUserById: async (id) => ({ id, username: `user-${id}`, avatar: null })
    }, {
        sendFriendAccepted: (id) => events.push(['accepted', id]),
        sendFriendListUpdate: (id) => events.push(['list', id]),
        sendFriendRequestUpdate: (id) => events.push(['requests', id])
    });

    assert.deepEqual(await service.acceptFriendRequest(2, 1), { success: true });
    assert.deepEqual(events, [
        ['accepted', '1'],
        ['list', '1'],
        ['list', '2'],
        ['requests', '2']
    ]);
});

test('direct messages are persisted before both participants receive the realtime event', async () => {
    const events = [];
    const message = {
        id: 18,
        sender_id: 3,
        recipient_id: 9,
        sender_name: 'sender',
        body: 'Hello friend',
        created_at: '2026-07-20T12:00:00.000Z'
    };
    const service = createSocialService({
        areFriends: async (senderId, recipientId) => senderId === 3 && recipientId === 9,
        createDirectMessage: async (senderId, recipientId, body) => {
            assert.equal(senderId, 3);
            assert.equal(recipientId, 9);
            assert.equal(body, 'Hello friend');
            return message;
        }
    }, {
        sendDirectMessage: (userId, payload) => events.push([userId, payload.message])
    });

    assert.deepEqual(await service.sendDirectMessage(3, { friendId: 9, body: ' Hello friend ' }), message);
    assert.deepEqual(events, [
        ['3', message],
        ['9', message]
    ]);
});
