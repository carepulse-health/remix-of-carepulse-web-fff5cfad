INSERT INTO public.clinic_members (clinic_id, user_id, role)
SELECT '8793ed3c-25d3-4245-8b97-f2ce43532854'::uuid, u.id, 'admin'
FROM auth.users u
WHERE u.email = 'adeyosolaadegoke09@gmail.com' AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (clinic_id, user_id) DO UPDATE SET role = 'admin';