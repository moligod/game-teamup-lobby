import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n-react'

function AboutPage() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const features = en
    ? [
        ['Find a team', 'Browse the lobby, create a team, set requirements, and manage applications.'],
        ['Stay connected', 'Find friends, send private messages, and chat in the lobby or with your team.'],
        ['Explore leaderboards', 'Browse available player and leaderboard data.'],
        ['Browse the market', 'Publish listings, contact sellers, leave reviews, and report dishonest activity.'],
        ['Read game news', 'Read announcements published by the site administrator.'],
      ]
    : [
        ['寻找队伍', '浏览组队大厅、创建队伍、设置加入条件，并管理入队申请。'],
        ['保持联系', '搜索和添加好友、发送私信，也可以在大厅或队伍中聊天。'],
        ['查看排行榜', '浏览可用的玩家和排行榜数据。'],
        ['浏览交易市场', '发布商品、联系卖家、留下评价，并提交失信举报。'],
        ['查看游戏资讯', '浏览站点管理员发布的公告与资讯。'],
      ]

  return (
    <section className="main-stack readable">
      <div className="toolbar">
        <div>
          <h1>Game Hub</h1>
          <p>{en ? 'Find teammates. Play together.' : '找到队友，一起开黑。'}</p>
        </div>
      </div>
      <div className="panel doc-panel">
        <h2>{en ? 'About Game Hub' : '关于 Game Hub'}</h2>
        <p>{en
          ? 'Game Hub is a game lobby for finding teammates and keeping useful player tools in one place. Each deployment can be configured for its own game.'
          : 'Game Hub 是一个帮助玩家寻找队友的游戏大厅，把组队、聊天和常用玩家工具放在一起。每个部署可以按自己的游戏进行配置。'}</p>
        <h2>{en ? 'What you can do' : '你可以做什么'}</h2>
        {features.map(([title, description]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
        <h2>{en ? 'Getting started' : '开始使用'}</h2>
        <p>{en
          ? 'Browse the lobby first. Sign in to create or join teams and use account features. Site operators must configure QQ login and any optional integrations before they can be used.'
          : '可以先浏览组队大厅。创建或加入队伍、使用账户功能时需要登录；站点管理员需要先配置 QQ 登录和所需的可选服务。'}</p>
        <p><Link to="/">{en ? 'Go to the lobby →' : '前往组队大厅 →'}</Link></p>
      </div>
    </section>
  )
}

export default AboutPage
