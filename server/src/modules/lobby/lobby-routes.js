function sendActionError(res, error, fallbackMessage, fallbackStatus = 500) {
    const message = error?.message || fallbackMessage;
    const status = /not found|not in this team/i.test(message)
        ? 404
        : /already|cannot|only leader|requires approval|full/i.test(message)
            ? 400
            : fallbackStatus;
    return res.status(status).json({ success: false, error: message || fallbackMessage });
}

function isGameNameBindingRequired(error) {
    return /game name binding required/i.test(error?.message || '');
}

function sendGameNameBindingRequired(res) {
    return res.status(400).json({
        success: false,
        error: '\u8bf7\u5148\u7ed1\u5b9a\u6e38\u620f\u540d\uff0c\u5426\u5219\u65e0\u6cd5\u52a0\u5165\u3001\u7533\u8bf7\u6216\u4f7f\u7528\u961f\u5185\u804a\u5929\u3002'
    });
}

function registerLobbyRoutes(app, queryService, commandService, options = {}) {
    const logger = options.logger || console;
    const presence = options.presence;
    const requireUser = options.requireUser;

    app.get('/api/team-types', async (req, res) => {
        try {
            res.vary('Accept-Language');
            const teamTypes = await queryService.getTeamTypes(req.lang);
            res.json(teamTypes);
        } catch (error) {
            logger.error('创建团队时发生错误:', error);
            res.error('error', 500);
        }
    });

    app.get('/api/lobby/online-users', async (req, res) => {
        try {
            res.json(await queryService.getOnlineUsers(presence?.getOnlineUserIds?.() ?? []));
        } catch (error) {
            logger.error('Failed to get lobby online users:', error);
            res.status(500).json({ error: error.message || 'Failed to get lobby online users' });
        }
    });
    
    // 获取系统消息
    app.get('/api/system-message/:messageKey', async (req, res) => {
        try {
            const { messageKey } = req.params;
            const message = await queryService.getSystemMessage(messageKey, req.lang);
            if (message) {
                res.success({ content: message });
            } else {
                res.error('not_found', 404);
            }
        } catch (error) {
            logger.error('获取系统消息失败:', error);
            res.error('error', 500);
        }
    });
    
    // 获取车队列表
    // 参数：team_type（可选，按团队类型筛选）
    // 返回：车队信息数组
    app.get('/api/teams', async (req, res) => {
        try {
            const { team_type } = req.query;
            const teams = await queryService.getTeams(team_type, req.lang, true);
            res.json(teams);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 获取单个车队
    // 参数：id（车队ID）
    // 返回：车队信息对象
    app.get('/api/teams/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const team = await queryService.getTeam(id, req.lang);
            if (!team) {
                res.status(404).json({ error: 'Team not found' });
                return;
            }
            res.json(team);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 创建车队
    // 参数：name（车队名称）、team_type（团队类型ID）、max_members（最大成员数）、leader_id（队长用户ID）
    // 返回：创建的车队信息对象
    app.post('/api/teams', requireUser, async (req, res) => {
        try {
            const { name, team_type, max_members, min_combat_power, requires_approval } = req.body;
            
            if (!name || !team_type || !max_members) {
                return res.error('missing_required_fields', 400);
            }
    
            const team = await commandService.createTeam({
                name,
                team_type,
                leader_id: req.user.userId,
                max_members: parseInt(max_members),
                min_combat_power: parseInt(min_combat_power) || 0,
                requires_approval: !!requires_approval
            });
    
            // 通过WebSocket广播团队创建通知
            
            // 发送用户团队状态更新通知给创建者
    
            res.success(team, 'team_created_success');
        } catch (error) {
            logger.error('创建团队失败:', error.message);
            if (error.message === 'User is already in an active team') {
                return res.status(400).json({ success: false, error: '你已经在团队中，不能再创建团队' });
            }
            return res.status(500).json({ success: false, error: error.message || '创建团队失败' });
        }
    });
    
    // 加入车队
    // 参数：id（车队ID）、user_id（用户ID）
    // 返回：加入结果（成功或失败）
    app.post('/api/teams/:id/join', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            
            // 先获取团队和用户信息用于WebSocket通知
            
            await commandService.joinTeam(parseInt(id), req.user.userId);
            
            // 通过WebSocket广播团队加入通知
            
            // 发送用户团队状态更新通知给加入者
            
            res.success({ team_id: id }, 'team_join_success');
        } catch (error) {
            logger.error('加入团队错误:', error.message);
            
            // 根据错误类型返回具体的错误信息
            if (isGameNameBindingRequired(error)) {
                return sendGameNameBindingRequired(res);
            } else if (error.message.includes('User is already in an active team') || error.message.includes('用户已在其他团队中')) {
                return res.status(400).json({ 
                    success: false, 
                    error: '您已经在其他团队中，请先退出当前团队再加入新团队' 
                });
            } else if (error.message.includes('Team not found') || error.message.includes('团队不存在')) {
                return res.status(404).json({ 
                    success: false, 
                    error: '团队不存在或已被删除' 
                });
            } else if (error.message.includes('Team has ended') || error.message.includes('团队已结束')) {
                return res.status(400).json({ 
                    success: false, 
                    error: '该团队已结束，无法加入' 
                });
            } else if (error.message.includes('Team is full') || error.message.includes('团队已满员')) {
                return res.status(400).json({ 
                    success: false, 
                    error: '团队已满员，无法加入' 
                });
            } else if (error.message.includes('Leader cannot join own team') || error.message.includes('用户已在该团队中')) {
                return res.status(400).json({ 
                    success: false, 
                    error: '您已经在该团队中了' 
                });
            } else if (error.message.includes('Team requires approval')) {
                return res.status(400).json({
                    success: false,
                    error: '该团队需要审核，请提交申请'
                });
            } else {
                return res.status(500).json({ 
                    success: false, 
                    error: '加入团队失败，请稍后重试' 
                });
            }
        }
    });
    
    // 退出团队
    // 参数：id（团队ID）、user_id（用户ID）
    // 返回：退出结果
    app.post('/api/teams/:id/leave', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            
            // 先获取团队和用户信息用于WebSocket通知
            
            await commandService.leaveTeam(parseInt(id), req.user.userId);
            
            // 通过WebSocket广播团队退出通知
            
            // 发送用户团队状态更新通知给退出者
            
            res.success(null, 'team_leave_success');
        } catch (error) {
            logger.error('退出团队错误:', error.message);
            sendActionError(res, error, '退出团队失败');
        }
    });
    
    // 踢出团队成员
    // 参数：id（团队ID）、leader_id（队长ID）、member_id（被踢出成员ID）
    // 返回：踢出结果
    app.post('/api/teams/:id/kick', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            const { member_id } = req.body;
            
            if (!member_id) {
                return res.error('missing_required_params', 400);
            }
            
            // 获取团队和被踢出用户信息用于WebSocket通知
            
            await commandService.kickMember(parseInt(id), req.user.userId, parseInt(member_id));
            
            // 通过WebSocket广播团队踢出通知
            
            // 发送用户团队状态更新通知给被踢出者
            
            res.success(null, 'team_kick_success');
        } catch (error) {
            logger.error('踢出团队成员错误:', error.message);
            sendActionError(res, error, '踢出团队成员失败');
        }
    });
    
    // 结束团队
    // 参数：id（团队ID）、leader_id（队长ID）
    // 返回：结束结果
    app.post('/api/teams/:id/end', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            
            // 获取团队信息用于WebSocket通知
            
            await commandService.endTeam(parseInt(id), req.user.userId);
            
            // 通过WebSocket广播团队结束通知
            
            // 发送用户团队状态更新通知给队长
            
            res.success(null, 'team_end_success');
        } catch (error) {
            logger.error('结束团队错误:', error.message);
            sendActionError(res, error, '结束团队失败');
        }
    });
    
    // 获取团队成员列表
    // 参数：id（团队ID）
    // 返回：成员列表
    app.get('/api/teams/:id/members', async (req, res) => {
        try {
            const { id } = req.params;
            const members = await queryService.getTeamMembers(parseInt(id));
            res.json({ success: true, data: members });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // 获取用户参与的团队
    // 参数：userId（用户ID）
    // 返回：用户团队列表
    app.get('/api/users/:userId/teams', requireUser, async (req, res) => {
        try {
            const teams = await queryService.getUserTeams(req.user.userId, req.lang);
            res.json({ success: true, data: teams });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // ========================================================================================
    // 团队审核相关API
    // ========================================================================================
    
    // 设置团队审核状态
    // 参数：id（团队ID）、leader_id（队长ID）、requires_approval（是否需要审核）
    // 返回：设置结果
    app.post('/api/teams/:id/approval-setting', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            const { requires_approval } = req.body;
            
            if (requires_approval === undefined) {
                return res.status(400).json({ 
                    success: false, 
                    error: '缺少必要参数' 
                });
            }
            
            const result = await commandService.setTeamApproval(
                parseInt(id), 
                req.user.userId,
                requires_approval
            );
            
            // 通过WebSocket广播团队设置更新
            
            res.json(result);
        } catch (error) {
            logger.error('设置团队审核状态错误:', error.message);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });
    
    // 提交团队申请
    // 参数：id（团队ID）、user_id（用户ID）
    // 返回：申请结果
    app.post('/api/teams/:id/apply', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await commandService.submitTeamApplication(
                parseInt(id), 
                req.user.userId
            );
            
            // 通知队长有新的申请
            
            res.json(result);
        } catch (error) {
            if (isGameNameBindingRequired(error)) return sendGameNameBindingRequired(res);
            logger.error('提交团队申请错误:', error.message);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });
    
    // 提交团队申请（备用端点）
    // 参数：team_id（团队ID）、user_id（用户ID）
    // 返回：申请结果
    app.post('/api/team-applications', requireUser, async (req, res) => {
        try {
            const { team_id } = req.body;
            
            if (!team_id) {
                return res.status(400).json({ 
                    success: false, 
                    error: '缺少必要参数' 
                });
            }
            
            const result = await commandService.submitTeamApplication(
                parseInt(team_id), 
                req.user.userId
            );
            
            // 通知队长有新的申请
            
            res.json(result);
        } catch (error) {
            if (isGameNameBindingRequired(error)) return sendGameNameBindingRequired(res);
            logger.error('提交团队申请错误:', error.message);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });
    
    // 获取团队申请列表
    // 参数：id（团队ID）、leader_id（队长ID）
    // 返回：申请列表
    app.get('/api/teams/:id/applications', requireUser, async (req, res) => {
        try {
            const { id } = req.params;
            
            const applications = await queryService.getTeamApplications(
                parseInt(id), 
                req.user.userId
            );
            
            res.json({ 
                success: true, 
                data: applications 
            });
        } catch (error) {
            logger.error('获取团队申请列表错误:', error.message);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });
    
    // 处理团队申请
    // 参数：applicationId（申请ID）、leader_id（队长ID）、action（操作：approve/reject）
    // 返回：处理结果
    app.post('/api/team-applications/:applicationId/process', requireUser, async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { action } = req.body;
            
            if (!action) {
                return res.status(400).json({ 
                    success: false, 
                    error: '缺少必要参数' 
                });
            }
            
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ 
                    success: false, 
                    error: '无效的操作类型' 
                });
            }
            
            const { application, result } = await commandService.processTeamApplication(
                parseInt(applicationId),
                req.user.userId,
                action
            );
            
            if (!application) {
                return res.status(404).json({ 
                    success: false, 
                    error: '申请不存在或已处理' 
                });
            }
            
            res.json(result);
        } catch (error) {
            if (isGameNameBindingRequired(error)) return sendGameNameBindingRequired(res);
            logger.error('处理团队申请错误:', error.message);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });
    
    // 获取聊天消息
    // 参数：limit（可选，消息数量限制，默认50）
    // 返回：消息数组
    app.get('/api/messages', async (req, res) => {
        try {
            const { limit = 50 } = req.query;
            const messages = await queryService.getMessages(parseInt(limit));
            res.json(messages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/teams/:id/messages', requireUser, async (req, res) => {
        const teamId = Number.parseInt(req.params.id, 10);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
        if (!Number.isInteger(teamId) || teamId <= 0) return res.status(400).json({ error: 'Invalid team' });
        try {
            res.json(await queryService.getTeamMessages(teamId, req.user.userId, limit));
        } catch (error) {
            const status = /not in this active team/i.test(error.message) ? 403 : 500;
            res.status(status).json({ error: error.message || 'Failed to get team messages' });
        }
    });
    
    // 发送聊天消息
    // 参数：username（用户名）、status（状态，默认玩家）、content（消息内容）
    // 返回：发送结果（成功或失败）
    app.post('/api/messages', requireUser, async (req, res) => {
        try {
            const { status, content, reply_to_id } = req.body;
            const username = req.user.username;
            logger.log('收到聊天消息请求:', { username, status, content });
            
            if (!content) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            const replyToId = reply_to_id === undefined || reply_to_id === null || reply_to_id === ''
                ? null
                : Number.parseInt(String(reply_to_id), 10);
            if (replyToId !== null && (!Number.isInteger(replyToId) || replyToId <= 0)) {
                res.status(400).json({ error: 'Invalid reply message' });
                return;
            }
    
            const message = await commandService.createMessage({
                username,
                status: status || '玩家',
                content,
                reply_to_id: replyToId
            });
            logger.log('消息已保存到数据库:', message);
    
            res.json({
                ...message,
                message: 'Message sent successfully'
            });
        } catch (error) {
            logger.error('发送聊天消息失败:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/teams/:id/messages', requireUser, async (req, res) => {
        const teamId = Number.parseInt(req.params.id, 10);
        const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
        const replyToId = req.body.reply_to_id === undefined || req.body.reply_to_id === null || req.body.reply_to_id === ''
            ? null
            : Number.parseInt(String(req.body.reply_to_id), 10);
        if (!Number.isInteger(teamId) || teamId <= 0) return res.status(400).json({ error: 'Invalid team' });
        if (!content || content.length > 200) return res.status(400).json({ error: 'Message content must be between 1 and 200 characters' });
        if (replyToId !== null && (!Number.isInteger(replyToId) || replyToId <= 0)) return res.status(400).json({ error: 'Invalid reply message' });
        try {
            const message = await commandService.createTeamMessage(teamId, req.user.userId, {
                username: req.user.username,
                status: '玩家',
                content,
                reply_to_id: replyToId
            });
            res.status(201).json(message);
        } catch (error) {
            if (isGameNameBindingRequired(error)) return sendGameNameBindingRequired(res);
            const status = /not in this active team/i.test(error.message) ? 403 : /Invalid reply message/i.test(error.message) ? 400 : 500;
            res.status(status).json({ error: error.message || 'Failed to send team message' });
        }
    });
    
    app.get('/api/stats', async (req, res) => {
        try {
            const stats = await queryService.getStats();
            stats.online_users = presence.getOnlineUserCount();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = { registerLobbyRoutes };
