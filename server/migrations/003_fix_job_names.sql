DELETE FROM user_jobs
WHERE job_name NOT IN (
  'Paysan', 'Pêcheur', 'Trappeur', 'Mineur', 'Herboriste', 'Forestier',
  'Ébéniste', 'Tailleur', 'Bijoutier', 'Armurier', 'Maître d''Armes', 'Maroquinier',
  'Cuisinier', 'Boulanger'
);
