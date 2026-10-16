-- Estora — seed data for your own Supabase project.
-- Run AFTER db/schema.sql AND after creating the demo auth users in
-- Supabase Dashboard -> Authentication -> Users (emails below, password
-- "demo1234", tick "Auto Confirm User"):
--   admin@estora.app   (admin)
--   manager@estora.app (property_manager)
--   owner@estora.app   (landlord, owns own-1)
--   owner2@estora.app  (landlord, owns own-2)
--   tenant@estora.app  (tenant, ten-1)
-- Idempotent (ON CONFLICT DO NOTHING). Safe to re-run.

BEGIN;

INSERT INTO public.owners (id, full_name, email, phone, country, address, kyc_status, bank_details_status, approval_threshold, status, created_at) VALUES
  ('own-1', 'Rashid Al Mansoori', 'rashid.almansoori@mansoorigroup.ae', '+971 50 224 8891', 'United Arab Emirates', 'Villa 32, Emirates Hills, Dubai', 'Verified', 'Complete', 400, 'Active', '2023-04-18T09:00:00.000Z'),
  ('own-2', 'Priya Nair', 'priya.nair@nairholdings.sg', '+65 8123 4477', 'Singapore', '18 Marina Boulevard, Level 27, Singapore', 'Pending', 'Complete', 250, 'Active', '2024-01-09T09:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.properties (id, name, type, address, city, country, owner_id, manager_id, status, created_at) VALUES
  ('prop-1', 'Marina Crest Residences', 'Apartment', 'Al Marsa Street, Plot 41', 'Dubai', 'United Arab Emirates', 'own-1', 'usr-pm', 'Under Management', '2023-05-02T09:00:00.000Z'),
  ('prop-2', 'Al Barsha Garden Villas', 'Villa', 'Al Barsha South 3, Community 12', 'Dubai', 'United Arab Emirates', 'own-1', 'usr-pm', 'Active', '2023-11-14T09:00:00.000Z'),
  ('prop-3', 'Jumeirah Bay Tower', 'Building', 'Marasi Drive, Business Bay', 'Dubai', 'United Arab Emirates', 'own-2', 'usr-pm', 'Under Management', '2024-02-27T09:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buildings (id, property_id, name, floors, created_at) VALUES
  ('bld-1', 'prop-1', 'Crest Tower A', 12, '2023-05-02T09:00:00.000Z'),
  ('bld-2', 'prop-1', 'Crest Tower B', 10, '2023-05-02T09:00:00.000Z'),
  ('bld-3', 'prop-2', 'Garden Block One', 2, '2023-11-14T09:00:00.000Z'),
  ('bld-4', 'prop-2', 'Garden Block Two', 2, '2023-11-14T09:00:00.000Z'),
  ('bld-5', 'prop-3', 'Bay Podium Wing', 6, '2024-02-27T09:00:00.000Z'),
  ('bld-6', 'prop-3', 'Bay Sky Wing', 14, '2024-02-27T09:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.units (id, property_id, building_id, unit_number, floor, unit_type, bedrooms, bathrooms, furnished, area_sqft, owner_id, tenant_id, monthly_rent, status) VALUES
  ('unit-1', 'prop-1', 'bld-1', 'A-302', 3, '1 Bedroom Apartment', 1, 1, 'Furnished', 780, 'own-1', null, 6800, 'Occupied'),
  ('unit-2', 'prop-1', 'bld-1', 'A-405', 4, '2 Bedroom Apartment', 2, 2, 'Furnished', 1180, 'own-1', null, 9500, 'Occupied'),
  ('unit-3', 'prop-1', 'bld-1', 'A-611', 6, '2 Bedroom Apartment', 2, 2, 'Furnished', 1240, 'own-1', null, 9800, 'Vacant'),
  ('unit-4', 'prop-1', 'bld-1', 'A-902', 9, '3 Bedroom Apartment', 3, 3, 'Semi-Furnished', 1680, 'own-1', null, 14200, 'Occupied'),
  ('unit-5', 'prop-1', 'bld-2', 'B-208', 2, '1 Bedroom Apartment', 1, 1, 'Furnished', 720, 'own-1', null, 6300, 'Under Maintenance'),
  ('unit-6', 'prop-1', 'bld-2', 'B-506', 5, '2 Bedroom Apartment', 2, 2, 'Furnished', 1150, 'own-1', null, 9200, 'Occupied'),
  ('unit-7', 'prop-1', 'bld-2', 'B-704', 7, '2 Bedroom Apartment', 2, 2, 'Furnished', 1160, 'own-1', null, 9400, 'Reserved'),
  ('unit-8', 'prop-1', 'bld-2', 'B-1001', 10, '3 Bedroom Apartment', 3, 4, 'Semi-Furnished', 1980, 'own-1', null, 16500, 'Occupied'),
  ('unit-9', 'prop-2', 'bld-3', 'V-01', 1, '4 Bedroom Villa', 4, 5, 'Semi-Furnished', 3400, 'own-1', null, 22000, 'Occupied'),
  ('unit-10', 'prop-2', 'bld-3', 'V-02', 1, '4 Bedroom Villa', 4, 5, 'Semi-Furnished', 3400, 'own-1', null, 21500, 'Vacant'),
  ('unit-11', 'prop-2', 'bld-3', 'V-03', 1, '5 Bedroom Villa', 5, 6, 'Semi-Furnished', 4100, 'own-1', null, 26000, 'Occupied'),
  ('unit-12', 'prop-2', 'bld-4', 'V-04', 1, '4 Bedroom Villa', 4, 4, 'Semi-Furnished', 3200, 'own-1', null, 20500, 'Occupied'),
  ('unit-13', 'prop-2', 'bld-4', 'V-05', 1, '5 Bedroom Villa', 5, 6, 'Semi-Furnished', 4250, 'own-1', null, 27000, 'Vacant'),
  ('unit-14', 'prop-2', 'bld-4', 'V-06', 1, '4 Bedroom Villa', 4, 5, 'Semi-Furnished', 3300, 'own-1', null, 21000, 'Inactive'),
  ('unit-15', 'prop-3', 'bld-5', 'P-204', 2, '1 Bedroom Apartment', 1, 1, 'Furnished', 690, 'own-2', null, 5900, 'Occupied'),
  ('unit-16', 'prop-3', 'bld-5', 'P-311', 3, '2 Bedroom Apartment', 2, 2, 'Furnished', 1100, 'own-2', null, 8700, 'Vacant'),
  ('unit-17', 'prop-3', 'bld-5', 'P-508', 5, '2 Bedroom Apartment', 2, 2, 'Furnished', 1120, 'own-2', null, 8900, 'Occupied'),
  ('unit-18', 'prop-3', 'bld-6', 'S-806', 8, '2 Bedroom Apartment', 2, 3, 'Furnished', 1450, 'own-2', null, 12400, 'Reserved'),
  ('unit-19', 'prop-3', 'bld-6', 'S-1103', 11, '3 Bedroom Apartment', 3, 4, 'Semi-Furnished', 1890, 'own-2', null, 16800, 'Occupied'),
  ('unit-20', 'prop-3', 'bld-6', 'S-1302', 13, '3 Bedroom Apartment', 3, 4, 'Semi-Furnished', 1920, 'own-2', null, 17400, 'Vacant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, full_name, email, phone, nationality, unit_id, property_id, status, created_at) VALUES
  ('ten-1', 'Layla Haddad', 'layla.haddad@gmail.com', '+971 55 774 2213', 'Lebanese', 'unit-1', 'prop-1', 'Active', '2024-01-06T09:00:00.000Z'),
  ('ten-2', 'James Okoro', 'james.okoro@outlook.com', '+971 52 118 9043', 'Nigerian', 'unit-2', 'prop-1', 'Active', '2024-02-07T09:00:00.000Z'),
  ('ten-3', 'Marta Kowalski', 'marta.kowalski@proton.me', '+971 56 330 7781', 'Polish', 'unit-4', 'prop-1', 'Active', '2024-03-08T09:00:00.000Z'),
  ('ten-4', 'Hiroshi Tanaka', 'hiroshi.tanaka@icloud.com', '+971 50 662 1190', 'Japanese', 'unit-6', 'prop-1', 'Active', '2024-04-09T09:00:00.000Z'),
  ('ten-5', 'Sofia Marchetti', 'sofia.marchetti@gmail.com', '+971 54 909 3320', 'Italian', 'unit-8', 'prop-1', 'Active', '2024-05-10T09:00:00.000Z'),
  ('ten-6', 'Daniel Weber', 'daniel.weber@web.de', '+971 58 224 6612', 'German', 'unit-9', 'prop-2', 'Active', '2024-06-11T09:00:00.000Z'),
  ('ten-7', 'Aisha Rahman', 'aisha.rahman@gmail.com', '+971 55 481 7702', 'Pakistani', 'unit-11', 'prop-2', 'Active', '2024-07-12T09:00:00.000Z'),
  ('ten-8', 'Chen Wei', 'chen.wei@qq.com', '+971 52 776 5514', 'Chinese', 'unit-12', 'prop-2', 'Active', '2024-08-13T09:00:00.000Z'),
  ('ten-9', 'Emily Brooks', 'emily.brooks@gmail.com', '+971 50 337 2298', 'British', 'unit-15', 'prop-3', 'Active', '2024-09-14T09:00:00.000Z'),
  ('ten-10', 'Omar Farouk', 'omar.farouk@gmail.com', '+971 56 990 1123', 'Egyptian', 'unit-17', 'prop-3', 'Notice Period', '2024-10-15T09:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

-- link units to their tenants (circular FK resolved)
UPDATE public.units SET tenant_id = 'ten-1' WHERE id = 'unit-1';
UPDATE public.units SET tenant_id = 'ten-2' WHERE id = 'unit-2';
UPDATE public.units SET tenant_id = 'ten-3' WHERE id = 'unit-4';
UPDATE public.units SET tenant_id = 'ten-4' WHERE id = 'unit-6';
UPDATE public.units SET tenant_id = 'ten-5' WHERE id = 'unit-8';
UPDATE public.units SET tenant_id = 'ten-6' WHERE id = 'unit-9';
UPDATE public.units SET tenant_id = 'ten-7' WHERE id = 'unit-11';
UPDATE public.units SET tenant_id = 'ten-8' WHERE id = 'unit-12';
UPDATE public.units SET tenant_id = 'ten-9' WHERE id = 'unit-15';
UPDATE public.units SET tenant_id = 'ten-10' WHERE id = 'unit-17';

INSERT INTO public.leases (id, lease_number, property_id, unit_id, owner_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, payment_frequency, status) VALUES
  ('lease-1', 'LSE-2026-1001', 'prop-1', 'unit-1', 'own-1', 'ten-1', '2025-09-01T09:00:00.000Z', '2026-09-01T09:00:00.000Z', 6800, 10200, 'Quarterly', 'Expiring Soon'),
  ('lease-2', 'LSE-2026-1002', 'prop-1', 'unit-2', 'own-1', 'ten-2', '2025-11-01T09:00:00.000Z', '2026-11-01T09:00:00.000Z', 9500, 14250, 'Monthly', 'Active'),
  ('lease-3', 'LSE-2026-1003', 'prop-1', 'unit-4', 'own-1', 'ten-3', '2025-10-01T09:00:00.000Z', '2026-10-01T09:00:00.000Z', 14200, 21300, 'Monthly', 'Expiring Soon'),
  ('lease-4', 'LSE-2026-1004', 'prop-1', 'unit-6', 'own-1', 'ten-4', '2024-12-01T09:00:00.000Z', '2026-09-01T09:00:00.000Z', 9200, 13800, 'Quarterly', 'Expiring Soon'),
  ('lease-5', 'LSE-2026-1005', 'prop-1', 'unit-8', 'own-1', 'ten-5', '2026-01-01T09:00:00.000Z', '2027-01-01T09:00:00.000Z', 16500, 24750, 'Monthly', 'Active'),
  ('lease-6', 'LSE-2026-1006', 'prop-2', 'unit-9', 'own-1', 'ten-6', '2025-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z', 22000, 33000, 'Monthly', 'Expired'),
  ('lease-7', 'LSE-2026-1007', 'prop-2', 'unit-11', 'own-1', 'ten-7', '2026-03-01T09:00:00.000Z', '2027-03-01T09:00:00.000Z', 26000, 39000, 'Quarterly', 'Active'),
  ('lease-8', 'LSE-2026-1008', 'prop-2', 'unit-12', 'own-1', 'ten-8', '2025-06-01T09:00:00.000Z', '2026-06-01T09:00:00.000Z', 20500, 30750, 'Monthly', 'Expired'),
  ('lease-9', 'LSE-2026-1009', 'prop-3', 'unit-15', 'own-2', 'ten-9', '2026-02-01T09:00:00.000Z', '2027-02-01T09:00:00.000Z', 5900, 8850, 'Monthly', 'Active'),
  ('lease-10', 'LSE-2026-1010', 'prop-3', 'unit-17', 'own-2', 'ten-10', '2025-12-01T09:00:00.000Z', '2026-12-01T09:00:00.000Z', 8900, 13350, 'Quarterly', 'Active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rent_schedules (id, lease_id, tenant_id, property_id, unit_id, due_date, amount, paid_amount, status, paid_on, method) VALUES
  ('rent-1', 'lease-1', 'ten-1', 'prop-1', 'unit-1', '2026-06-01T09:00:00.000Z', 6800, 6800, 'Paid', '2026-06-03T09:00:00.000Z', 'Bank Transfer'),
  ('rent-2', 'lease-1', 'ten-1', 'prop-1', 'unit-1', '2026-07-01T09:00:00.000Z', 6800, 6800, 'Paid', '2026-07-03T09:00:00.000Z', 'Bank Transfer'),
  ('rent-3', 'lease-1', 'ten-1', 'prop-1', 'unit-1', '2026-08-01T09:00:00.000Z', 6800, 0, 'Due', null, null),
  ('rent-4', 'lease-2', 'ten-2', 'prop-1', 'unit-2', '2026-07-05T09:00:00.000Z', 9500, 9500, 'Paid', '2026-07-07T09:00:00.000Z', 'Bank Transfer'),
  ('rent-5', 'lease-2', 'ten-2', 'prop-1', 'unit-2', '2026-08-05T09:00:00.000Z', 9500, 4750, 'Partially Paid', '2026-08-07T09:00:00.000Z', 'Bank Transfer'),
  ('rent-6', 'lease-3', 'ten-3', 'prop-1', 'unit-4', '2026-07-01T09:00:00.000Z', 14200, 14200, 'Paid', '2026-07-03T09:00:00.000Z', 'Bank Transfer'),
  ('rent-7', 'lease-3', 'ten-3', 'prop-1', 'unit-4', '2026-08-01T09:00:00.000Z', 14200, 0, 'Overdue', null, null),
  ('rent-8', 'lease-4', 'ten-4', 'prop-1', 'unit-6', '2026-08-03T09:00:00.000Z', 9200, 9200, 'Paid', '2026-08-05T09:00:00.000Z', 'Bank Transfer'),
  ('rent-9', 'lease-4', 'ten-4', 'prop-1', 'unit-6', '2026-09-03T09:00:00.000Z', 9200, 0, 'Upcoming', null, null),
  ('rent-10', 'lease-5', 'ten-5', 'prop-1', 'unit-8', '2026-08-01T09:00:00.000Z', 16500, 16500, 'Paid', '2026-08-03T09:00:00.000Z', 'Bank Transfer'),
  ('rent-11', 'lease-6', 'ten-6', 'prop-2', 'unit-9', '2026-07-10T09:00:00.000Z', 22000, 0, 'Overdue', null, null),
  ('rent-12', 'lease-7', 'ten-7', 'prop-2', 'unit-11', '2026-08-01T09:00:00.000Z', 26000, 26000, 'Paid', '2026-08-03T09:00:00.000Z', 'Bank Transfer'),
  ('rent-13', 'lease-8', 'ten-8', 'prop-2', 'unit-12', '2026-08-15T09:00:00.000Z', 20500, 0, 'Due', null, null),
  ('rent-14', 'lease-9', 'ten-9', 'prop-3', 'unit-15', '2026-09-01T09:00:00.000Z', 5900, 0, 'Upcoming', null, null),
  ('rent-15', 'lease-10', 'ten-10', 'prop-3', 'unit-17', '2026-08-01T09:00:00.000Z', 8900, 8900, 'Paid', '2026-08-03T09:00:00.000Z', 'Bank Transfer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendors (id, name, trade, phone, email) VALUES
  ('ven-1', 'CoolAir Technical Services', 'HVAC', '+971 4 553 8890', 'ops@coolair.ae'),
  ('ven-2', 'AquaFix Plumbing LLC', 'Plumbing', '+971 4 442 7712', 'dispatch@aquafix.ae'),
  ('ven-3', 'Voltra Electrical Works', 'Electrical', '+971 4 331 2204', 'service@voltra.ae'),
  ('ven-4', 'PureSpace Facility Care', 'Cleaning & Pest', '+971 4 220 6611', 'hello@purespace.ae')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.maintenance_tickets (id, reference, property_id, unit_id, tenant_id, owner_id, category, title, description, priority, status, vendor_id, assigned_to, estimated_cost, actual_cost, sla_due_at, created_at, updated_at, timeline, notes, attachments) VALUES
  ('tkt-1', 'MNT-2601', 'prop-1', 'unit-1', 'ten-1', 'own-1', 'HVAC', 'Bedroom AC not cooling after service', 'Bedroom AC not cooling after service. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'High', 'IN PROGRESS', 'ven-1', 'CoolAir Technical Services', 620, null, '2026-08-12T09:00:00.000Z', '2026-08-08T09:00:00.000Z', '2026-08-09T09:00:00.000Z', '[{"at":"2026-08-08T09:00:00.000Z","actor":"Layla Haddad","message":"Request submitted"},{"at":"2026-08-09T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to IN PROGRESS"}]'::jsonb, '[{"at":"2026-08-09T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-2', 'MNT-2602', 'prop-1', 'unit-2', 'ten-2', 'own-1', 'Plumbing', 'Kitchen sink draining slowly', 'Kitchen sink draining slowly. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'Medium', 'ASSIGNED', 'ven-2', 'AquaFix Plumbing LLC', 240, null, '2026-08-24T09:00:00.000Z', '2026-08-20T09:00:00.000Z', '2026-08-21T09:00:00.000Z', '[{"at":"2026-08-20T09:00:00.000Z","actor":"James Okoro","message":"Request submitted"},{"at":"2026-08-21T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to ASSIGNED"}]'::jsonb, '[{"at":"2026-08-21T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-3', 'MNT-2603', 'prop-1', 'unit-4', 'ten-3', 'own-1', 'Electrical', 'Living room sockets tripping the breaker', 'Living room sockets tripping the breaker. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'Emergency', 'UNDER REVIEW', null, null, 900, null, '2026-08-25T09:00:00.000Z', '2026-08-24T09:00:00.000Z', '2026-08-25T09:00:00.000Z', '[{"at":"2026-08-24T09:00:00.000Z","actor":"Marta Kowalski","message":"Request submitted"},{"at":"2026-08-25T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to UNDER REVIEW"}]'::jsonb, '[{"at":"2026-08-25T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-4', 'MNT-2604', 'prop-1', 'unit-6', 'ten-4', 'own-1', 'Appliance Repair', 'Washing machine leaking during spin cycle', 'Washing machine leaking during spin cycle. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'Medium', 'NEW', null, null, 380, null, '2026-08-29T09:00:00.000Z', '2026-08-25T09:00:00.000Z', '2026-08-26T09:00:00.000Z', '[{"at":"2026-08-25T09:00:00.000Z","actor":"Hiroshi Tanaka","message":"Request submitted"},{"at":"2026-08-26T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to NEW"}]'::jsonb, '[{"at":"2026-08-26T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-5', 'MNT-2605', 'prop-2', 'unit-9', 'ten-6', 'own-1', 'Pest Control', 'Ants in the pantry and utility room', 'Ants in the pantry and utility room. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'Low', 'COMPLETED', 'ven-4', 'PureSpace Facility Care', 150, 150, '2026-08-25T09:00:00.000Z', '2026-08-21T09:00:00.000Z', '2026-08-22T09:00:00.000Z', '[{"at":"2026-08-21T09:00:00.000Z","actor":"Daniel Weber","message":"Request submitted"},{"at":"2026-08-22T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to COMPLETED"}]'::jsonb, '[{"at":"2026-08-22T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-6', 'MNT-2606', 'prop-2', 'unit-11', 'ten-7', 'own-1', 'Painting', 'Water stain repair on hallway ceiling', 'Water stain repair on hallway ceiling. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'Low', 'CLOSED', 'ven-4', 'PureSpace Facility Care', 520, 520, '2026-08-26T09:00:00.000Z', '2026-08-22T09:00:00.000Z', '2026-08-23T09:00:00.000Z', '[{"at":"2026-08-22T09:00:00.000Z","actor":"Aisha Rahman","message":"Request submitted"},{"at":"2026-08-23T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to CLOSED"}]'::jsonb, '[{"at":"2026-08-23T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-7', 'MNT-2607', 'prop-3', 'unit-15', 'ten-9', 'own-2', 'Plumbing', 'Bathroom water heater producing no hot water', 'Bathroom water heater producing no hot water. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'High', 'ASSIGNED', 'ven-2', 'AquaFix Plumbing LLC', 470, null, '2026-08-27T09:00:00.000Z', '2026-08-23T09:00:00.000Z', '2026-08-24T09:00:00.000Z', '[{"at":"2026-08-23T09:00:00.000Z","actor":"Emily Brooks","message":"Request submitted"},{"at":"2026-08-24T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to ASSIGNED"}]'::jsonb, '[{"at":"2026-08-24T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb),
  ('tkt-8', 'MNT-2608', 'prop-3', 'unit-19', null, 'own-2', 'HVAC', 'Annual AC coil cleaning and filter change', 'Annual AC coil cleaning and filter change. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.', 'Medium', 'IN PROGRESS', 'ven-1', 'CoolAir Technical Services', 310, null, '2026-08-28T09:00:00.000Z', '2026-08-24T09:00:00.000Z', '2026-08-25T09:00:00.000Z', '[{"at":"2026-08-24T09:00:00.000Z","actor":"Facilities Coordinator","message":"Request submitted"},{"at":"2026-08-25T09:00:00.000Z","actor":"Nadia Kaur (Property Manager)","message":"Status moved to IN PROGRESS"}]'::jsonb, '[{"at":"2026-08-25T09:00:00.000Z","author":"Nadia Kaur","body":"Access arranged with the resident for the technician visit.","internal":true}]'::jsonb, '[{"name":"reported-issue.jpg","size":"1.4 MB"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.approvals (id, reference, ticket_id, property_id, unit_id, owner_id, vendor_id, title, description, amount, status, requested_at, decided_at, decided_by, rejection_reason) VALUES
  ('apr-1', 'APR-4101', 'tkt-3', 'prop-1', 'unit-4', 'own-1', 'ven-3', 'Distribution board replacement', 'Replace faulty distribution board and re-terminate living room circuits.', 900, 'Pending', '2026-08-25T09:00:00.000Z', null, null, null),
  ('apr-2', 'APR-4102', 'tkt-1', 'prop-1', 'unit-1', 'own-1', 'ven-1', 'AC compressor replacement', 'Compressor beyond economical repair; replacement quoted with 12-month warranty.', 620, 'Pending', '2026-08-24T09:00:00.000Z', null, null, null),
  ('apr-3', 'APR-4103', 'tkt-7', 'prop-3', 'unit-15', 'own-2', 'ven-2', 'Water heater unit replacement', 'Existing 50L heater corroded; supply and install replacement unit.', 470, 'Pending', '2026-08-23T09:00:00.000Z', null, null, null),
  ('apr-4', 'APR-4098', 'tkt-6', 'prop-2', 'unit-11', 'own-1', 'ven-4', 'Ceiling repair and repaint', 'Seal leak point, skim and repaint the hallway ceiling.', 520, 'Approved', '2026-08-12T09:00:00.000Z', '2026-08-13T09:00:00.000Z', 'Rashid Al Mansoori', null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.documents (id, name, category, property_id, unit_id, owner_id, tenant_id, uploaded_by, uploaded_at, expires_at, file_type, file_size) VALUES
  ('doc-1', 'Tenancy Contract — A-302 (Layla Haddad).pdf', 'Lease Agreement', 'prop-1', 'unit-1', 'own-1', 'ten-1', 'Nadia Kaur', '2025-09-02T09:00:00.000Z', '2026-09-01T09:00:00.000Z', 'PDF', '412 KB'),
  ('doc-2', 'Emirates ID — James Okoro.pdf', 'Passport / ID', 'prop-1', 'unit-2', null, 'ten-2', 'James Okoro', '2025-11-04T09:00:00.000Z', '2027-03-20T09:00:00.000Z', 'PDF', '268 KB'),
  ('doc-3', 'Title Deed — Marina Crest Residences.pdf', 'Property Document', 'prop-1', null, 'own-1', null, 'Nadia Kaur', '2023-05-06T09:00:00.000Z', null, 'PDF', '1.1 MB'),
  ('doc-4', 'Management Agreement — Nair Holdings.pdf', 'Management Agreement', 'prop-3', null, 'own-2', null, 'Adrian Silva', '2024-03-01T09:00:00.000Z', '2026-09-30T09:00:00.000Z', 'PDF', '760 KB'),
  ('doc-5', 'Move-in Inspection — V-03.pdf', 'Inspection Report', 'prop-2', 'unit-11', 'own-1', 'ten-6', 'Facilities Team', '2025-08-03T09:00:00.000Z', null, 'PDF', '3.4 MB'),
  ('doc-6', 'Quotation — Voltra Electrical Works.pdf', 'Quotation', 'prop-1', 'unit-4', 'own-1', null, 'Nadia Kaur', '2026-08-25T09:00:00.000Z', null, 'PDF', '184 KB'),
  ('doc-7', 'Invoice — PureSpace Facility Care (Aug 2026).pdf', 'Invoice', 'prop-2', null, 'own-1', null, 'Finance', '2026-08-22T09:00:00.000Z', null, 'PDF', '96 KB'),
  ('doc-8', 'Tenancy Contract — P-204 (Aisha Rahman).pdf', 'Lease Agreement', 'prop-3', 'unit-15', 'own-2', 'ten-7', 'Adrian Silva', '2026-03-02T09:00:00.000Z', '2027-03-01T09:00:00.000Z', 'PDF', '398 KB')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notifications (id, user_role, owner_id, tenant_id, title, message, type, read, created_at, href) VALUES
  ('ntf-1', 'LANDLORD', 'own-1', null, 'Approval required — AED 900', 'Distribution board replacement at Marina Crest A-902 needs your approval.', 'Approval', false, '2026-08-25T09:00:00.000Z', '/approvals'),
  ('ntf-2', 'TENANT', null, 'ten-1', 'Rent due on 1 August', 'Your monthly rent of AED 6,800 for unit A-302 is now due.', 'Rent', false, '2026-08-20T09:00:00.000Z', '/rent'),
  ('ntf-3', 'PROPERTY_MANAGER', null, null, 'Rent overdue — B-506', 'Daniel Weber is 18 days overdue on the July rent instalment.', 'Rent', false, '2026-08-24T09:00:00.000Z', '/rent'),
  ('ntf-4', 'ALL', null, null, 'Lease expiring soon', 'Lease LSE-2026-1001 for A-302 expires on 1 September 2026.', 'Lease', true, '2026-08-18T09:00:00.000Z', '/leases'),
  ('ntf-5', 'TENANT', null, 'ten-1', 'Maintenance update', 'Ticket MNT-2601 moved to In Progress. CoolAir Technical Services assigned.', 'Maintenance', true, '2026-08-22T09:00:00.000Z', '/maintenance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.expenses (id, property_id, owner_id, category, amount, incurred_on, description) VALUES
  ('exp-1', 'prop-1', 'own-1', 'Maintenance', 2140, '2026-08-12T09:00:00.000Z', 'HVAC and plumbing callouts'),
  ('exp-2', 'prop-1', 'own-1', 'Management Fee', 2460, '2026-08-01T09:00:00.000Z', '5% management fee'),
  ('exp-3', 'prop-2', 'own-1', 'Maintenance', 1180, '2026-08-15T09:00:00.000Z', 'Landscaping and pest control'),
  ('exp-4', 'prop-2', 'own-1', 'Insurance', 890, '2026-08-05T09:00:00.000Z', 'Annual buildings insurance instalment'),
  ('exp-5', 'prop-3', 'own-2', 'Maintenance', 1620, '2026-08-18T09:00:00.000Z', 'Water heater and AC servicing'),
  ('exp-6', 'prop-3', 'own-2', 'Management Fee', 1740, '2026-08-01T09:00:00.000Z', '5% management fee')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (id, user_name, role, action, entity, entity_id, at, ip, device) VALUES
  ('log-1', 'Nadia Kaur', 'PROPERTY_MANAGER', 'Payment recorded', 'rent_schedules', 'rent-15', '2026-08-26T09:00:00.000Z', '94.204.11.72', 'Chrome · macOS'),
  ('log-2', 'Rashid Al Mansoori', 'LANDLORD', 'Approval approved', 'approvals', 'apr-4', '2026-08-25T09:00:00.000Z', '2.50.183.9', 'Safari · iOS'),
  ('log-3', 'Nadia Kaur', 'PROPERTY_MANAGER', 'Maintenance updated', 'maintenance_tickets', 'tkt-1', '2026-08-25T09:00:00.000Z', '94.204.11.72', 'Chrome · macOS'),
  ('log-4', 'Layla Haddad', 'TENANT', 'Login', 'users', 'usr-tenant', '2026-08-24T09:00:00.000Z', '5.107.44.13', 'Chrome · Android'),
  ('log-5', 'Adrian Silva', 'ADMIN', 'Document uploaded', 'documents', 'doc-8', '2026-08-23T09:00:00.000Z', '185.93.2.41', 'Firefox · Windows'),
  ('log-6', 'Nadia Kaur', 'PROPERTY_MANAGER', 'Lease created', 'leases', 'lease-9', '2026-08-20T09:00:00.000Z', '94.204.11.72', 'Chrome · macOS'),
  ('log-7', 'Adrian Silva', 'ADMIN', 'Property updated', 'properties', 'prop-3', '2026-08-19T09:00:00.000Z', '185.93.2.41', 'Firefox · Windows')
ON CONFLICT (id) DO NOTHING;

-- Link demo auth users (created in the Supabase Auth dashboard) to
-- their app role + owner/tenant. Looked up by email so no hardcoded UUIDs.
INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
SELECT id, 'Adrian Silva', null, null FROM auth.users WHERE email = 'admin@estora.app'
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'admin@estora.app'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
SELECT id, 'Nadia Kaur', null, null FROM auth.users WHERE email = 'manager@estora.app'
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'property_manager'::public.app_role FROM auth.users WHERE email = 'manager@estora.app'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
SELECT id, 'Rashid Al Mansoori', 'own-1', null FROM auth.users WHERE email = 'owner@estora.app'
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'landlord'::public.app_role FROM auth.users WHERE email = 'owner@estora.app'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
SELECT id, 'Priya Nair', 'own-2', null FROM auth.users WHERE email = 'owner2@estora.app'
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'landlord'::public.app_role FROM auth.users WHERE email = 'owner2@estora.app'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
SELECT id, 'Layla Haddad', null, 'ten-1' FROM auth.users WHERE email = 'tenant@estora.app'
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'tenant'::public.app_role FROM auth.users WHERE email = 'tenant@estora.app'
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
