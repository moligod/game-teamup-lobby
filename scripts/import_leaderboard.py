#!/usr/bin/env python3
"""Upload game-agnostic leaderboard rows from CSV to a Game Hub snapshot."""
import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path


def read_boards(path):
    boards = {}
    with Path(path).open('r', encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        required = {'leaderboard_id', 'leaderboard_name', 'rank', 'player_name', 'score'}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError('CSV requires: leaderboard_id, leaderboard_name, rank, player_name, score')
        for row_number, row in enumerate(reader, start=2):
            board_id = (row['leaderboard_id'] or '').strip()
            name = (row['leaderboard_name'] or '').strip()
            player = (row['player_name'] or '').strip()
            score = (row['score'] or '').strip()
            try:
                rank = int(row['rank'])
            except (TypeError, ValueError) as exc:
                raise ValueError(f'Row {row_number}: rank must be a positive integer') from exc
            if not board_id or not name or not player or not score or rank < 1:
                raise ValueError(f'Row {row_number}: all fields are required and rank must be positive')
            if board_id in boards and boards[board_id]['leaderboard_name'] != name:
                raise ValueError(f'Row {row_number}: leaderboard name differs for the same ID')
            board = boards.setdefault(board_id, {'leaderboard_id': board_id, 'leaderboard_type': name, 'leaderboard_name': name, 'items': []})
            board['items'].append({'rank': rank, 'player_name': player, 'score': score})
    if not boards or len(boards) > 256:
        raise ValueError('CSV must contain between 1 and 256 leaderboards')
    return boards


def upload(base, token, boards, source_date):
    parsed = urllib.parse.urlsplit(base.strip())
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('GAME_HUB_URL must be an http(s) origin without credentials, query or fragment')
    endpoint = base.rstrip('/') + '/api/collector/leaderboard/snapshots'
    def post(url, data):
        request = urllib.request.Request(url, data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token}, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f'Server returned HTTP {exc.code} for {urllib.parse.urlsplit(url).path}') from exc
    snapshot = post(endpoint, {'source_date': source_date, 'expected_board_ids': list(boards)})
    snapshot_id = urllib.parse.quote(str(snapshot['snapshot_id']), safe='')
    for board in boards.values():
        post(f'{endpoint}/{snapshot_id}/boards', board)
    post(f'{endpoint}/{snapshot_id}/publish', {})
    return snapshot_id


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_file', help='UTF-8 CSV file to upload')
    parser.add_argument('--date', default=date.today().isoformat(), help='Source date (YYYY-MM-DD)')
    args = parser.parse_args()
    try:
        date.fromisoformat(args.date)
        token = os.environ.get('LEADERBOARD_COLLECTOR_TOKEN', '').strip()
        base = os.environ.get('GAME_HUB_URL', '').strip()
        if len(token) < 32 or not base:
            raise ValueError('Set GAME_HUB_URL and LEADERBOARD_COLLECTOR_TOKEN (at least 32 characters)')
        boards = read_boards(args.csv_file)
        snapshot_id = upload(base, token, boards, args.date)
        print(f'Published {len(boards)} leaderboard(s), snapshot {snapshot_id}')
    except (ValueError, OSError, RuntimeError, KeyError, json.JSONDecodeError) as exc:
        print(f'Import failed: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
