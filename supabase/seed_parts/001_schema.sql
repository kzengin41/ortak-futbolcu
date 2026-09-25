alter table clubs add column if not exists country text;
alter table clubs add column if not exists league text;

truncate table player_clubs, players, clubs restart identity cascade;
