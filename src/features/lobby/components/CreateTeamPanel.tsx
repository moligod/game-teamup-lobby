import { type FormEvent, useState } from 'react'
import { Plus } from 'lucide-react'
import { createTeam } from '../api/lobby-api'
import { useI18n } from '@/lib/i18n-react'
import type { Team, TeamType, User } from '@/lib/types'
import { Button } from '@/shared/ui/Button'

type RunAction = (task: () => Promise<unknown>, message: string) => Promise<boolean>

export function CreateTeamPanel({
  user,
  teamTypes,
  runAction,
  onCreated,
}: {
  user: User | null
  teamTypes: TeamType[]
  runAction: RunAction
  onCreated: (team: Team) => Promise<void>
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [teamType, setTeamType] = useState('')
  const [maxMembers, setMaxMembers] = useState(8)
  const [minPower, setMinPower] = useState(0)
  const [requiresApproval, setRequiresApproval] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    let createdTeam: Team | null = null
    const succeeded = await runAction(
      async () => {
        createdTeam = await createTeam({
          name: name.trim(),
          team_type: teamType,
          max_members: maxMembers,
          min_combat_power: minPower,
          requires_approval: requiresApproval,
          leader_id: user.id,
        })
      },
      t('team_react.createdNotice'),
    )

    if (!succeeded || !createdTeam) return

    await onCreated(createdTeam)
    setName('')
    setTeamType('')
    setMaxMembers(8)
    setMinPower(0)
    setRequiresApproval(false)
  }

  return (
    <div className="team-create-inline">
      <div className="team-create-inline-head">
        <h3>{t('team.create_team')}</h3>
        <p className="muted">{t('team_react.createTeamHint', undefined, '\u8bbe\u7f6e\u961f\u4f0d\u4fe1\u606f\uff0c\u53d1\u5e03\u540e\u5373\u53ef\u63a5\u53d7\u73a9\u5bb6\u7533\u8bf7\u3002')}</p>
      </div>

      {!user ? <p className="dialog-notice">{t('team_react.loginFirst')}</p> : null}

      <form className="form-stack team-create-form" id="team-create-form" onSubmit={submit}>
        <label className="team-create-name">
          {t('team_react.teamNameShort')}
          <input disabled={!user} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={t('team_react.teamNamePlaceholder')} required value={name} />
        </label>
        <label className="team-create-field">
          {t('team_react.typeShort')}
          <select disabled={!user} onChange={(event) => setTeamType(event.target.value)} required value={teamType}>
            <option value="">{t('team.select_team_type_placeholder')}</option>
            {teamTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </label>
        <label className="team-create-field">
          {t('team.max_members')}
          <input disabled={!user} max={99} min={2} onChange={(event) => setMaxMembers(Number(event.target.value))} type="number" value={maxMembers} />
        </label>
        <label className="team-create-field">
          {t('team.min_combat_power')}
          <input disabled={!user} min={0} onChange={(event) => setMinPower(Number(event.target.value))} type="number" value={minPower} />
        </label>
        <label className="checkbox-row team-create-approval">
          <input checked={requiresApproval} disabled={!user} onChange={(event) => setRequiresApproval(event.target.checked)} type="checkbox" />
          {t('team.requires_approval', undefined, '\u9700\u8981\u5ba1\u6838')}
        </label>
        <Button className="team-create-submit" disabled={!user} fullWidth icon={<Plus size={16} />} type="submit" variant="primary">
          {t('team.create')}
        </Button>
      </form>
    </div>
  )
}
