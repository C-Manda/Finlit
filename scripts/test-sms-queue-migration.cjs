const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

execFileSync('python3', ['-c', `
import sqlite3
db = sqlite3.connect(':memory:')
db.execute("create table candidates(owner text not null,id text not null,sender text not null,body text not null,received integer not null,subscription text,payload text,done integer not null default 0,primary key(owner,id))")
db.executemany("insert into candidates(owner,id,sender,body,received,payload,done) values(?,?,?,?,?,?,?)", [
  ("owner", "pending", "MTN", "pending body", 1, '{"pending":true}', 0),
  ("owner", "handled", "MTN", "handled body", 2, '{"handled":true}', 1),
])
db.execute("alter table candidates add column state text not null default 'handled'")
db.execute("update candidates set state=case when done=0 then 'pending' else 'handled' end")
rows = {row[0]: row[1:] for row in db.execute("select id,state,body,payload from candidates")}
assert rows["pending"] == ("pending", "pending body", '{"pending":true}')
assert rows["handled"] == ("handled", "handled body", '{"handled":true}')
`], { stdio: 'inherit' });

console.log('SMS queue migration PASS: v1 pending and handled rows preserve state, bodies and payloads.');
