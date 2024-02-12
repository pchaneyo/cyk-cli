drop function if exists t_load_cache;

create or replace function t_load_cache (
) returns table(
    t_actor json,
    t_film json
    )
language plpgsql
as $$
declare t_actor json;
declare t_film json;
begin
    select array_to_json(array_agg(actor)) into t_actor from t_actor actor;
    select array_to_json(array_agg(film)) into t_film from t_film film;

    return query select t_actor, t_film;
end;$$;