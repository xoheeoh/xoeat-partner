-- =====================================================================
-- 홈 대시보드: "최근 7일" 대신 "이번 달 1일 ~ 오늘" 날짜별 매출을 내려준다
--
-- 홈 매출 카드가 오늘 금액 + 이번 달 추이(주 단위 막대) 구성으로 바뀌면서
-- 7일 데이터(week)는 쓰이지 않게 됐다. 날짜별로 내려주고 주 단위로 묶는 건 앱이 한다.
-- 그래야 묶는 기준(1~7일 / 8~14일 …)을 바꿀 때 서버를 다시 배포하지 않아도 된다.
-- =====================================================================

create or replace function public.dashboard_summary()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid := public.my_store_id();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month_start date := date_trunc('month', v_today::timestamp)::date;
  v_result json;
begin
  select json_build_object(
    'today', (
      select json_build_object(
        'sales',      coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0),
        'orderCount', count(*) filter (where status not in ('REJECTED', 'CANCELED')),
        'pending',    count(*) filter (where status = 'PENDING'),
        'inProgress', count(*) filter (where status in ('ACCEPTED', 'READY', 'DELIVERING'))
      )
      from public.orders
      where store_id = v_store and (created_at at time zone 'Asia/Seoul')::date = v_today
    ),
    'month', (
      select json_build_object(
        'sales',      coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0),
        'orderCount', count(*) filter (where status = 'COMPLETED')
      )
      from public.orders
      where store_id = v_store and date_trunc('month', created_at at time zone 'Asia/Seoul') = date_trunc('month', v_today::timestamp)
    ),
    -- 이번 달 1일부터 오늘까지 하루 한 줄. 주문이 없는 날도 0 으로 채운다.
    'monthDays', (
      select coalesce(json_agg(json_build_object('date', d.day::date, 'sales', coalesce(t.sales, 0), 'orderCount', coalesce(t.cnt, 0)) order by d.day), '[]'::json)
      from generate_series(v_month_start, v_today, interval '1 day') as d(day)
      left join (
        select (created_at at time zone 'Asia/Seoul')::date as day,
               sum(total_amount) filter (where status = 'COMPLETED') as sales,
               count(*) filter (where status = 'COMPLETED') as cnt
          from public.orders
         where store_id = v_store and created_at >= v_month_start::timestamp at time zone 'Asia/Seoul'
         group by 1
      ) t on t.day = d.day::date
    )
  ) into v_result;
  return v_result;
end $$;
