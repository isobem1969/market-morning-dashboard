"""Publish real exchange sessions, not a fixed 'four days old' freshness rule."""
import datetime as dt
import json
from pathlib import Path
from source_support import publication_events, UTC


def build(now=None):
    now = now or dt.datetime.now(UTC)
    return {'schemaVersion':1,'generatedAt':now.isoformat(),
            'feeds':{key:publication_events(exchange,now,mode) for key,exchange,mode in [
                ('jpFund','XTKS','fund'),('jpPrice','XTKS','quote'),('jpDaily','XTKS','daily'),
                ('usPrice','XNYS','quote'),('usDaily','XNYS','daily')]}}


if __name__=='__main__':
    target=Path(__file__).resolve().parents[1]/'public/data/health-calendar.json'
    target.write_text(json.dumps(build(),ensure_ascii=False,separators=(',',':'))+'\n')
