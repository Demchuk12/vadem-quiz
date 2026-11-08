-- A host may bring their own AI key (ChatGPT, Claude...). Those calls are paid by the host, so they
-- do not spend the shared free quota; a limit of their own still keeps the function from serving
-- as an open proxy. The key itself never reaches the database.
alter table private.ai_usage add column own_calls int not null default 0;

create function public.consume_own_ai_call(p_quiz_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_per_quiz constant int := 200;
  v_today date := (now() at time zone 'utc')::date;
begin
  perform private.assert_quiz_owner(p_quiz_id, p_token);

  perform pg_advisory_xact_lock(hashtext('private.ai_usage'));

  if coalesce(
    (select own_calls from private.ai_usage where day = v_today and quiz_id = p_quiz_id), 0
  ) >= v_per_quiz then
    raise exception 'ai_limit';
  end if;

  insert into private.ai_usage (day, quiz_id, own_calls)
  values (v_today, p_quiz_id, 1)
  on conflict (day, quiz_id) do update set own_calls = private.ai_usage.own_calls + 1;
end $$;

revoke all on function public.consume_own_ai_call(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_own_ai_call(uuid, text) to service_role;
