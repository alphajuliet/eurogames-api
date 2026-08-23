-- Migration: Support cooperative game outcomes in the winner view
-- 'Andrew & Trish' is a joint win and counts toward both players' totals.
-- 'Game' is a cooperative loss (the game beats the players), tracked as its
-- own standalone category, like Draw.

DROP VIEW IF EXISTS winner;
CREATE VIEW winner AS
SELECT
    bgg.name,
    log.id,
    COUNT(*) AS Games,
    SUM(CASE WHEN log.winner IN ('Andrew', 'Andrew & Trish') THEN 1 ELSE 0 END) AS Andrew,
    SUM(CASE WHEN log.winner IN ('Trish', 'Andrew & Trish') THEN 1 ELSE 0 END) AS Trish,
    SUM(CASE WHEN log.winner = 'Draw' THEN 1 ELSE 0 END) AS Draw,
    SUM(CASE WHEN log.winner = 'Game' THEN 1 ELSE 0 END) AS Game
FROM log
LEFT JOIN bgg ON log.id = bgg.id
GROUP BY bgg.name, log.id
ORDER BY bgg.name ASC;
