
create or replace function public.validar_saldo_legacy(p_customer_id integer, p_usuario text default null)
returns boolean
language plpgsql
security definer
set search_path to 'staging', 'public'
as $function$
begin
  perform staging.validar_saldo_legacy(p_customer_id, coalesce(p_usuario, 'sistema'));
  return true;
end;
$function$;
