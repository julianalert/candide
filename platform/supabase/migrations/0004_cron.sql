-- Scheduled jobs. pg_cron is available on hosted Supabase; the block is guarded so the
-- migration still applies where it is not, in which case `npm run ops` covers both jobs.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname in ('candide_end_stale_sessions', 'candide_purge_transcripts');
    perform cron.schedule('candide_end_stale_sessions', '*/10 * * * *', $job$ select public.end_stale_sessions(); $job$);
    perform cron.schedule('candide_purge_transcripts', '15 3 * * *', $job$ select public.purge_old_transcripts(); $job$);
  else
    raise notice 'pg_cron not available: run `npm run ops end-stale` and `npm run ops purge-transcripts` on a schedule instead.';
  end if;
end;
$$;
