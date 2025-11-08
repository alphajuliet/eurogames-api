-- Migration: Add explicit primary key to log table
-- This adds a play_id column as the unique identifier for each play record
-- The existing rowid values will be used for play_id during the backfill

-- Step 1: Drop views that depend on log table (in order of dependencies)
DROP VIEW IF EXISTS last_played;
DROP VIEW IF EXISTS winner;
DROP VIEW IF EXISTS wins;
DROP VIEW IF EXISTS played;
DROP VIEW IF EXISTS game_list2;

-- Step 2: Create a temporary table with the new schema
CREATE TABLE log_new (
  play_id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  id INTEGER,
  winner TEXT,
  scores TEXT,
  comment TEXT
);

-- Step 3: Copy data from old table to new table, using rowid as play_id
INSERT INTO log_new (play_id, date, id, winner, scores, comment)
SELECT rowid, date, id, winner, scores, comment FROM log;

-- Step 4: Drop the old table
DROP TABLE log;

-- Step 5: Rename the new table to the original name
ALTER TABLE log_new RENAME TO log;

-- Step 6: Recreate views in the correct order
CREATE VIEW game_list2 AS
SELECT
    bgg.name,
    bgg.id,
    notes.status,
    bgg.complexity,
    bgg.ranking,
    COALESCE(play_counts.games, 0) AS games,
    last_played_dates.lastPlayed,
    notes.uri
FROM bgg
LEFT JOIN notes ON bgg.id = notes.id
LEFT JOIN (
    SELECT id, COUNT(*) AS games
    FROM log
    GROUP BY id
) AS play_counts ON bgg.id = play_counts.id
LEFT JOIN (
    SELECT id, MAX(date) AS lastPlayed
    FROM log
    GROUP BY id
) AS last_played_dates ON bgg.id = last_played_dates.id
ORDER BY bgg.name;

CREATE VIEW played AS
SELECT DISTINCT
    log.date,
    log.id,
    bgg.name,
    log.winner,
    log.scores,
    log.comment
FROM log
LEFT JOIN bgg ON bgg.id = log.id
ORDER BY log.date DESC;

CREATE VIEW wins AS
SELECT
    bgg.name,
    log.id,
    log.winner,
    COUNT(log.winner) AS wins
FROM log
LEFT JOIN bgg ON log.id = bgg.id
GROUP BY bgg.name, log.id, log.winner;

CREATE VIEW winner AS
SELECT
    bgg.name,
    log.id,
    COUNT(*) AS Games,
    SUM(CASE WHEN log.winner = 'Andrew' THEN 1 ELSE 0 END) AS Andrew,
    SUM(CASE WHEN log.winner = 'Trish' THEN 1 ELSE 0 END) AS Trish,
    SUM(CASE WHEN log.winner = 'Draw' THEN 1 ELSE 0 END) AS Draw
FROM log
LEFT JOIN bgg ON log.id = bgg.id
GROUP BY bgg.name, log.id
ORDER BY bgg.name ASC;

CREATE VIEW last_played AS
SELECT
    MAX(log.date) AS lastPlayed,
    julianday('now') - julianday(MAX(log.date)) AS daysSince,
    COUNT(log.date) AS games,
    log.id,
    bgg.name
FROM log
LEFT JOIN bgg ON log.id = bgg.id
LEFT JOIN notes ON log.id = notes.id
WHERE notes.status = 'Playing'
GROUP BY bgg.name, log.id
ORDER BY MAX(log.date) DESC;
