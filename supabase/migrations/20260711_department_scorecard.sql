-- Run the scorecard every Monday at 08:00 UTC. The function is mock-safe when
-- RESEND_API_KEY is unset and returns the generated payload as JSON.
select cron.schedule(
  'community-hero-department-scorecard',
  '0 8 * * 1',
  $$select net.http_post(
    url := 'https://bfxhcevcqkoxlsqlbcny.supabase.co/functions/v1/dept-scorecard',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );$$
)
where not exists (select 1 from cron.job where jobname = 'community-hero-department-scorecard');
