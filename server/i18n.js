// 多语言支持模块
const messages = {
  zh: {
    // 通用消息
    'success': '操作成功',
    'error': '操作失败',
    'invalid_params': '参数无效',
    'missing_required_fields': '缺少必填字段',
    'unauthorized': '未授权访问',
    'not_found': '资源未找到',
    
    // 团队相关
    'team_created_success': '团队创建成功',
    'team_join_success': '加入团队成功',
    'team_leave_success': '退出团队成功',
    'team_kick_success': '踢出成员成功',
    'team_end_success': '团队已结束',
    'team_not_found': '团队不存在',
    'team_full': '团队已满',
    'already_in_team': '已在团队中',
    'not_in_team': '不在团队中',
    'not_team_leader': '不是团队队长',
    'missing_user_id': '缺少用户ID',
    'missing_leader_id': '缺少队长ID',
    'missing_required_params': '缺少必要参数',
    
    // 用户相关
    'user_not_found': '用户不存在',
    'user_register_success': '注册成功',
    'user_login_success': '登录成功',
    'user_logout_success': '退出成功',
    'invalid_credentials': '用户名或密码错误',
    'username_exists': '用户名已存在',
    'email_exists': '邮箱已存在',
    
    // 好友相关
    'friend_request_sent': '好友请求已发送',
    'friend_request_accepted': '好友请求已接受',
    'friend_request_rejected': '好友请求已拒绝',
    'friend_removed': '好友已删除',
    'already_friends': '已经是好友',
    'friend_request_exists': '好友请求已存在',
    
    // 聊天相关
    'message_sent': '消息发送成功',
    'message_too_long': '消息过长',
    'chat_cleared': '聊天记录已清空',
    
    // 团队审核相关
    'application_submitted': '申请已提交，请等待审核',
    'application_approved': '申请已通过',
    'application_rejected': '申请已拒绝',
    'requires_approval': '需要审核',
    'no_approval_required': '无需审核',
    'pending_applications': '待审核申请',
    'approve_application': '同意申请',
    'reject_application': '拒绝申请'
  },
  
  en: {
    // Common messages
    'success': 'Operation successful',
    'error': 'Operation failed',
    'invalid_params': 'Invalid parameters',
    'missing_required_fields': 'Missing required fields',
    'unauthorized': 'Unauthorized access',
    'not_found': 'Resource not found',
    
    // Team related
    'team_created_success': 'Team created successfully',
    'team_join_success': 'Joined team successfully',
    'team_leave_success': 'Left team successfully',
    'team_kick_success': 'Member kicked successfully',
    'team_end_success': 'Team ended',
    'team_not_found': 'Team not found',
    'team_full': 'Team is full',
    'already_in_team': 'Already in team',
    'not_in_team': 'Not in team',
    'not_team_leader': 'Not team leader',
    'missing_user_id': 'Missing user ID',
    'missing_leader_id': 'Missing leader ID',
    'missing_required_params': 'Missing required parameters',
    
    // User related
    'user_not_found': 'User not found',
    'user_register_success': 'Registration successful',
    'user_login_success': 'Login successful',
    'user_logout_success': 'Logout successful',
    'invalid_credentials': 'Invalid username or password',
    'username_exists': 'Username already exists',
    'email_exists': 'Email already exists',
    
    // Friend related
    'friend_request_sent': 'Friend request sent',
    'friend_request_accepted': 'Friend request accepted',
    'friend_request_rejected': 'Friend request rejected',
    'friend_removed': 'Friend removed',
    'already_friends': 'Already friends',
    'friend_request_exists': 'Friend request already exists',
    
    // Chat related
    'message_sent': 'Message sent successfully',
    'message_too_long': 'Message too long',
    'chat_cleared': 'Chat history cleared',
    
    // Team approval related
    'application_submitted': 'Application submitted, please wait for approval',
    'application_approved': 'Application approved',
    'application_rejected': 'Application rejected',
    'requires_approval': 'Requires approval',
    'no_approval_required': 'No approval required',
    'pending_applications': 'Pending applications',
    'approve_application': 'Approve application',
    'reject_application': 'Reject application'
  }
};

// 获取翻译文本
function t(key, lang = 'zh') {
  const langMessages = messages[lang] || messages['zh'];
  return langMessages[key] || key;
}

function resolveLanguage(acceptLanguage = 'zh-CN') {
  const preferredRange = String(acceptLanguage || 'zh-CN').split(',', 1)[0];
  const preferredLanguage = preferredRange.split(';', 1)[0].trim().toLowerCase();
  return preferredLanguage === 'en' || preferredLanguage.startsWith('en-') ? 'en' : 'zh';
}

// 多语言中间件
function i18nMiddleware(req, res, next) {
  // 从请求头获取语言设置
  const acceptLanguage = req.headers['accept-language'] || 'zh-CN';
  const lang = resolveLanguage(acceptLanguage);
  
  // 将语言和翻译函数添加到请求对象
  req.lang = lang;
  req.t = (key) => t(key, lang);
  
  // 为响应对象添加多语言支持的方法
  res.success = function(data, messageKey = 'success') {
    return this.json({
      success: true,
      data: data,
      message: req.t(messageKey)
    });
  };
  
  res.error = function(messageKey = 'error', statusCode = 500) {
    return this.status(statusCode).json({
      success: false,
      error: req.t(messageKey)
    });
  };
  
  next();
}

module.exports = {
  i18nMiddleware,
  resolveLanguage,
  t,
  messages
};
