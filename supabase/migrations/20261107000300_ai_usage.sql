-- Daily limits for AI generation. The free AI quota is shared by the whole app, so one quiz must not
-- be able to spend it. Only the Edge Function may call this: the key stays with the service role.
create table private.ai_usage (
  day date not null default (now() at time zone 'utc')::date,
  quiz_id uuid not null references private.quizzes on delete cascade,
  calls int not null default 0,
  primary key (day, quiz_id)
);

create function public.consume_ai_call(p_quiz_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_per_quiz constant int := 15;
  v_per_day constant int := 150;
  v_today date := (now() at time zone 'utc')::date;
begin
  perform private.assert_quiz_owner(p_quiz_id, p_token);

  -- Simultaneous generations must not slip past the limit together.
  perform pg_advisory_xact_lock(hashtext('private.ai_usage'));

  if coalesce((select sum(calls) from private.ai_usage where day = v_today), 0) >= v_per_day
    or coalesce(
      (select calls from private.ai_usage where day = v_today and quiz_id = p_quiz_id), 0
    ) >= v_per_quiz then
    raise exception 'ai_limit';
  end if;

  insert into private.ai_usage (day, quiz_id, calls)
  values (v_today, p_quiz_id, 1)
  on conflict (day, quiz_id) do update set calls = private.ai_usage.calls + 1;
end $$;

revoke all on function public.consume_ai_call(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_call(uuid, text) to service_role;
