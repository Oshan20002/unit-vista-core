-- Repairs accounts whose email belongs to a tenant record but were saved as landlord.
-- Run once in the Supabase SQL Editor.

-- Allow a signed-in user to read the tenant record matching their own email.
drop policy if exists "Tenant reads own record by email" on public.tenants;
create policy "Tenant reads own record by email" on public.tenants
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Relink profiles to their tenant record.
update public.profiles p
set tenant_id = t.id, owner_id = null, full_name = t.full_name
from auth.users u
join public.tenants t on lower(t.email) = lower(u.email) and t.deleted_at is null
where p.user_id = u.id;

-- Replace landlord role with tenant role for those users.
delete from public.user_roles r
using auth.users u
join public.tenants t on lower(t.email) = lower(u.email) and t.deleted_at is null
where r.user_id = u.id and r.role::text = 'landlord';

insert into public.user_roles (user_id, role)
select u.id, 'tenant'
from auth.users u
join public.tenants t on lower(t.email) = lower(u.email) and t.deleted_at is null
on conflict do nothing;
