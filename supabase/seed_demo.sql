-- =====================================================================
-- HLPI Facilities CMMS — sample data (optional)
--
-- Loads a realistic sample distribution centre so you can try every
-- screen: MHE units, cold-chain plant, dock equipment, fire systems,
-- PM schedules, spare parts, vendors, contracts and a compliance register.
-- Vendor names are fictional. Dates are relative to today.
--
-- Run AFTER schema.sql, and after you have signed up once (so the sample
-- work can be assigned to you). Running it twice does nothing the 2nd time.
-- To clear it before going live, run reset_data.sql.
-- =====================================================================

do $$
declare
  site uuid;
  today date := local_today();
  admin_id uuid := (select id from profiles where role = 'admin' and active order by created_at limit 1);
  tech_id uuid;
  unit_rec record;
  tpl record;
  hist record;
  wo uuid;
  i int;
  n int;
  created timestamptz;
  wo_kind text;
  asset_pick uuid;
begin
  if exists (select 1 from sites where code = 'PLD') then
    raise notice 'Sample data is already loaded (site PLD exists) – nothing to do.';
    return;
  end if;
  tech_id := coalesce((select id from profiles where role = 'technician' and active order by created_at limit 1), admin_id);
  perform setseed(0.42);

  -- ------------------------------------------------------------ site
  insert into sites (code, name, address) values ('PLD', 'Plaridel DC', 'Plaridel, Bulacan')
  returning id into site;

  -- ------------------------------------------------------- locations
  insert into locations (site_id, name, kind, temp_zone) values
    (site, 'Warehouse Building', 'Building', null),
    (site, 'Utilities', 'Building', null),
    (site, 'Office Building', 'Building', null),
    (site, 'Yard & Perimeter', 'Yard', null);

  insert into locations (site_id, parent_id, name, kind, temp_zone)
  select site, p.id, v.name, v.kind, v.temp
  from (values
    ('Warehouse Building', 'Dry Storage', 'Storage zone', 'Ambient'),
    ('Warehouse Building', 'Chiller Room', 'Storage zone', 'Chiller'),
    ('Warehouse Building', 'Freezer Room', 'Storage zone', 'Freezer'),
    ('Warehouse Building', 'Cross-dock / Anteroom', 'Staging', 'Chiller'),
    ('Warehouse Building', 'Loading Docks', 'Dock', null),
    ('Warehouse Building', 'Battery Charging Room', 'Room', null),
    ('Warehouse Building', 'MHE Maintenance Bay', 'Room', null),
    ('Utilities', 'Powerhouse / Genset Room', 'Utility', null),
    ('Utilities', 'Electrical Room', 'Utility', null),
    ('Utilities', 'Refrigeration Machine Room', 'Utility', null),
    ('Utilities', 'Pump House & Water Tank', 'Utility', null),
    ('Utilities', 'Sewage Treatment Plant', 'Utility', null),
    ('Office Building', 'Admin Office', 'Room', null),
    ('Office Building', 'Canteen & Lockers', 'Room', null),
    ('Yard & Perimeter', 'Guardhouse & Main Gate', 'Yard', null)
  ) as v(parent, name, kind, temp)
  join locations p on p.site_id = site and p.name = v.parent;

  -- ---------------------------------------------------------- vendors
  insert into vendors (name, service_type, contact_person, phone, email) values
    ('LiftCare MHE Services', 'MHE rental & maintenance', 'Engr. R. Dizon', '0917 555 0101', 'service@liftcare.example'),
    ('ColdLine Refrigeration Services', 'Refrigeration & HVAC', 'A. Mercado', '0918 555 0102', 'ops@coldline.example'),
    ('PowerCore Genset Services', 'Generators & electrical', 'J. Villanueva', '0919 555 0103', 'pms@powercore.example'),
    ('FireGuard Systems PH', 'Fire protection & FDAS', 'M. Santos', '0920 555 0104', 'support@fireguard.example'),
    ('DockPro Equipment Services', 'Dock levelers & doors', 'P. Reyes', '0921 555 0105', 'hello@dockpro.example'),
    ('Northgate Pest Solutions', 'Pest control', 'L. Cruz', '0922 555 0106', 'ipm@northgate.example'),
    ('AquaClear Testing Laboratory', 'Water & wastewater testing', 'Dr. E. Ramos', '0923 555 0107', 'lab@aquaclear.example'),
    ('RackSafe Inspections', 'Racking inspection', 'K. Tan', '0924 555 0108', 'inspect@racksafe.example')
  on conflict (name) do nothing;

  insert into contracts (vendor_id, site_id, title, scope, start_date, end_date, value, billing, renewal_notice_days)
  select v.id, site, c.title, c.scope, today + c.s, today + c.e, c.val, c.bill, c.notice
  from (values
    ('LiftCare MHE Services', 'MHE rental and full maintenance', 'Reach trucks RT-01–RT-06 incl. batteries, 250-hour PMS and breakdown response within 4 hours', -400, 330, 4860000.00, 'Monthly', 90),
    ('ColdLine Refrigeration Services', 'Refrigeration plant PMS', 'Freezer and chiller condensing units, evaporators, controls; 24/7 emergency call-out', -320, 45, 780000.00, 'Quarterly', 60),
    ('PowerCore Genset Services', 'Genset PMS and load bank test', 'Quarterly PMS of GEN-01 and ATS-01, annual load bank test', -165, 200, 240000.00, 'Quarterly', 60),
    ('FireGuard Systems PH', 'FDAS and sprinkler maintenance', 'Quarterly FDAS test, sprinkler and fire pump inspection, extinguisher refilling', -370, -5, 185000.00, 'Annual', 60),
    ('Northgate Pest Solutions', 'Integrated pest management', 'Monthly service, bait station map, trend report for FSSC 22000', -345, 20, 216000.00, 'Monthly', 45),
    ('DockPro Equipment Services', 'Dock levelers and doors PMS', 'Semi-annual PMS of dock levelers, shelters, sectional and high-speed doors', -245, 120, 150000.00, 'Semi-annual', 60),
    ('AquaClear Testing Laboratory', 'Water and effluent testing', 'Semi-annual potable water bacteriological test, quarterly STP effluent test', -85, 280, 60000.00, 'Per service', 30)
  ) as c(vendor, title, scope, s, e, val, bill, notice)
  join vendors v on v.name = c.vendor;

  -- ----------------------------------------------------------- assets
  insert into assets (code, name, category_id, site_id, location_id, criticality, make, model, serial_no, install_date,
                      mhe_type, capacity_kg, lift_height_mm, power_type, battery_ref, ownership, current_meter, cert_expiry, vendor_id)
  select v.code, v.name, c.id, site, l.id, v.crit, v.make, v.model, v.serial, v.installed::date,
         v.mhe_type, v.cap, v.lift, v.power, v.batt, v.own, v.meter, today + v.cert, vd.id
  from (values
    ('RT-01', 'Reach Truck 01', 'Material Handling Equipment (MHE)', 'Freezer Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1A4471', '2021-03-15', 'Reach Truck', 1600.0, 9500.0, 'Electric (lead-acid)', 'BAT-01', 'Leased', 6480.0, 140, 'LiftCare MHE Services'),
    ('RT-02', 'Reach Truck 02', 'Material Handling Equipment (MHE)', 'Freezer Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1A4472', '2021-03-15', 'Reach Truck', 1600.0, 9500.0, 'Electric (lead-acid)', 'BAT-02', 'Leased', 6122.5, 12, 'LiftCare MHE Services'),
    ('RT-03', 'Reach Truck 03', 'Material Handling Equipment (MHE)', 'Freezer Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1A4473', '2021-03-15', 'Reach Truck', 1600.0, 9500.0, 'Electric (lead-acid)', 'BAT-03', 'Leased', 5890.0, 140, 'LiftCare MHE Services'),
    ('RT-04', 'Reach Truck 04', 'Material Handling Equipment (MHE)', 'Chiller Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1B0918', '2022-01-10', 'Reach Truck', 1600.0, 9500.0, 'Electric (lead-acid)', 'BAT-04', 'Leased', 4312.0, 200, 'LiftCare MHE Services'),
    ('RT-05', 'Reach Truck 05', 'Material Handling Equipment (MHE)', 'Chiller Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1B0919', '2022-01-10', 'Reach Truck', 1600.0, 9500.0, 'Electric (lead-acid)', 'BAT-05', 'Leased', 4105.5, 200, 'LiftCare MHE Services'),
    ('RT-06', 'Reach Truck 06', 'Material Handling Equipment (MHE)', 'Dry Storage', 'High', 'Crown', 'ESR 5200', 'CRW-1C2230', '2023-06-01', 'Reach Truck', 1600.0, 10500.0, 'Electric (lithium-ion)', 'BAT-06', 'Leased', 2244.0, 250, 'LiftCare MHE Services'),
    ('FL-01', 'Electric Forklift 01', 'Material Handling Equipment (MHE)', 'Loading Docks', 'High', 'Toyota', '8FBE20', 'TYT-80341', '2020-08-20', 'Counterbalance Forklift (Electric)', 2000.0, 4500.0, 'Electric (lead-acid)', null, 'Owned', 8830.0, 75, null),
    ('FL-02', 'Electric Forklift 02', 'Material Handling Equipment (MHE)', 'Loading Docks', 'High', 'Toyota', '8FBE20', 'TYT-80342', '2020-08-20', 'Counterbalance Forklift (Electric)', 2000.0, 4500.0, 'Electric (lead-acid)', null, 'Owned', 8514.0, 75, null),
    ('FL-03', 'LPG Forklift 03', 'Material Handling Equipment (MHE)', 'Yard & Perimeter', 'Medium', 'Toyota', '8FG25', 'TYT-55120', '2019-02-11', 'Counterbalance Forklift (LPG)', 2500.0, 3000.0, 'LPG', null, 'Owned', 9760.0, -20, null),
    ('EPT-01', 'Electric Pallet Truck 01', 'Material Handling Equipment (MHE)', 'Cross-dock / Anteroom', 'High', 'Jungheinrich', 'EJE 120', 'JH-99120', '2022-05-02', 'Electric Pallet Truck', 2000.0, null, 'Electric (lithium-ion)', null, 'Owned', 3120.0, 180, null),
    ('EPT-02', 'Electric Pallet Truck 02', 'Material Handling Equipment (MHE)', 'Cross-dock / Anteroom', 'High', 'Jungheinrich', 'EJE 120', 'JH-99121', '2022-05-02', 'Electric Pallet Truck', 2000.0, null, 'Electric (lithium-ion)', null, 'Owned', 2988.0, 180, null),
    ('EPT-03', 'Electric Pallet Truck 03', 'Material Handling Equipment (MHE)', 'Loading Docks', 'Medium', 'Jungheinrich', 'EJE 120', 'JH-99122', '2022-05-02', 'Electric Pallet Truck', 2000.0, null, 'Electric (lithium-ion)', null, 'Owned', 3301.0, 180, null),
    ('EPT-04', 'Electric Pallet Truck 04', 'Material Handling Equipment (MHE)', 'Loading Docks', 'Medium', 'Jungheinrich', 'EJE 120', 'JH-99123', '2023-09-18', 'Electric Pallet Truck', 2000.0, null, 'Electric (lithium-ion)', null, 'Owned', 1570.0, 180, null),
    ('STK-01', 'Electric Stacker 01', 'Material Handling Equipment (MHE)', 'Dry Storage', 'Medium', 'Linde', 'L12', 'LND-12077', '2021-11-05', 'Electric Stacker', 1200.0, 3000.0, 'Electric (lead-acid)', null, 'Owned', 2410.0, 60, null),
    ('OP-01', 'Order Picker 01', 'Material Handling Equipment (MHE)', 'Dry Storage', 'Medium', 'Crown', 'SP 3500', 'CRW-SP3301', '2022-07-14', 'Order Picker', 1000.0, 7600.0, 'Electric (lead-acid)', null, 'Leased', 1985.0, 95, 'LiftCare MHE Services'),
    ('MPJ-01', 'Manual Pallet Jack 01', 'Material Handling Equipment (MHE)', 'Cross-dock / Anteroom', 'Low', 'Noblelift', 'AC25', null, '2023-01-09', 'Manual Pallet Jack', 2500.0, null, 'Manual', null, 'Owned', null, null, null),
    ('MPJ-02', 'Manual Pallet Jack 02', 'Material Handling Equipment (MHE)', 'Loading Docks', 'Low', 'Noblelift', 'AC25', null, '2023-01-09', 'Manual Pallet Jack', 2500.0, null, 'Manual', null, 'Owned', null, null, null),
    ('SL-01', 'Scissor Lift 01', 'Material Handling Equipment (MHE)', 'MHE Maintenance Bay', 'Medium', 'Genie', 'GS-1930', 'GN-193044', '2021-04-22', 'Scissor Lift', 227.0, 5790.0, 'Electric (lead-acid)', null, 'Owned', 610.0, 30, null),
    ('BAT-01', 'Traction Battery 01 (48 V 620 Ah)', 'MHE Batteries & Chargers', 'Battery Charging Room', 'High', 'EnerSys', 'Hawker 48V 620Ah', 'ENS-620-101', '2021-03-15', 'Traction Battery', null, null, 'Electric (lead-acid)', null, 'Leased', null, null, 'LiftCare MHE Services'),
    ('BAT-02', 'Traction Battery 02 (48 V 620 Ah)', 'MHE Batteries & Chargers', 'Battery Charging Room', 'High', 'EnerSys', 'Hawker 48V 620Ah', 'ENS-620-102', '2021-03-15', 'Traction Battery', null, null, 'Electric (lead-acid)', null, 'Leased', null, null, 'LiftCare MHE Services'),
    ('CHG-01', 'Battery Charger 01', 'MHE Batteries & Chargers', 'Battery Charging Room', 'High', 'EnerSys', 'Lifetech Modular', 'ENS-CH-201', '2021-03-15', 'Battery Charger', null, null, null, null, 'Leased', null, null, 'LiftCare MHE Services'),
    ('CHG-02', 'Battery Charger 02', 'MHE Batteries & Chargers', 'Battery Charging Room', 'High', 'EnerSys', 'Lifetech Modular', 'ENS-CH-202', '2021-03-15', 'Battery Charger', null, null, null, null, 'Leased', null, null, 'LiftCare MHE Services'),
    ('GEN-01', 'Standby Diesel Genset 500 kVA', 'Power Generation & UPS', 'Powerhouse / Genset Room', 'Critical', 'Cummins', 'C500D5', 'CMS-500-7781', '2019-06-30', null, null, null, 'Diesel', null, 'Owned', 1850.0, null, 'PowerCore Genset Services'),
    ('ATS-01', 'Automatic Transfer Switch 1600 A', 'Power Generation & UPS', 'Powerhouse / Genset Room', 'Critical', 'ASCO', '7000 Series', 'ASC-16-4410', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'PowerCore Genset Services'),
    ('UPS-01', 'UPS 20 kVA (WMS servers & network)', 'Power Generation & UPS', 'Admin Office', 'High', 'APC', 'Smart-UPS SRT', 'APC-20K-0091', '2022-02-14', null, null, null, null, null, 'Owned', null, null, null),
    ('TX-01', 'Pad-mounted Transformer 750 kVA', 'Electrical & Lighting', 'Electrical Room', 'Critical', null, '750 kVA 13.2 kV/400 V', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('MDP-01', 'Main Distribution Panel', 'Electrical & Lighting', 'Electrical Room', 'Critical', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('LGT-WH', 'Warehouse LED High-bay Lighting (186 fixtures)', 'Electrical & Lighting', 'Warehouse Building', 'Medium', null, '150 W LED high-bay', null, '2021-09-01', null, null, null, null, null, 'Owned', null, null, null),
    ('CU-F01', 'Freezer Condensing Unit 01', 'Refrigeration & Cold Rooms', 'Refrigeration Machine Room', 'Critical', 'Bitzer', 'LH135E/4FES-5Y', 'BTZ-F01-3321', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'),
    ('CU-F02', 'Freezer Condensing Unit 02', 'Refrigeration & Cold Rooms', 'Refrigeration Machine Room', 'Critical', 'Bitzer', 'LH135E/4FES-5Y', 'BTZ-F02-3322', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'),
    ('CU-C01', 'Chiller Condensing Unit 01', 'Refrigeration & Cold Rooms', 'Refrigeration Machine Room', 'Critical', 'Bitzer', 'LH114/4DES-5Y', 'BTZ-C01-5540', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'),
    ('EVAP-F01', 'Freezer Evaporator 01', 'Refrigeration & Cold Rooms', 'Freezer Room', 'High', 'Güntner', 'GACC RX 050', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'),
    ('EVAP-F02', 'Freezer Evaporator 02', 'Refrigeration & Cold Rooms', 'Freezer Room', 'High', 'Güntner', 'GACC RX 050', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'),
    ('TMS-01', 'Cold Room Temperature Monitoring System', 'Weighing & Measuring', 'Warehouse Building', 'Critical', 'Testo', 'Saveris 2', null, '2022-03-01', null, null, null, null, null, 'Owned', null, null, null),
    ('DL-01', 'Dock Leveler – Dock 1', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-01', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('DL-02', 'Dock Leveler – Dock 2', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-02', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('DL-03', 'Dock Leveler – Dock 3', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-03', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('DL-04', 'Dock Leveler – Dock 4', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-04', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('DD-01', 'Sectional Dock Door – Dock 1', 'Doors & Gates', 'Loading Docks', 'Medium', 'Hörmann', 'SPU F42', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('DD-02', 'Sectional Dock Door – Dock 2', 'Doors & Gates', 'Loading Docks', 'Medium', 'Hörmann', 'SPU F42', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('HSD-01', 'High-speed Door – Freezer', 'Doors & Gates', 'Freezer Room', 'Critical', 'Efaflex', 'EFA-SRT Iso', 'EFX-7781', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('HSD-02', 'High-speed Door – Chiller', 'Doors & Gates', 'Chiller Room', 'High', 'Efaflex', 'EFA-SRT', 'EFX-7782', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'),
    ('RACK-DRY', 'Selective Pallet Racking – Dry', 'Racking & Storage', 'Dry Storage', 'High', null, 'Selective, 6 levels', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'RackSafe Inspections'),
    ('RACK-FRZ', 'Drive-in Racking – Freezer', 'Racking & Storage', 'Freezer Room', 'High', null, 'Drive-in, 5 levels', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'RackSafe Inspections'),
    ('FP-01', 'Fire Pump (electric, 750 gpm)', 'Fire Protection & Life Safety', 'Pump House & Water Tank', 'Critical', null, 'Split-case 750 gpm', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'),
    ('JP-01', 'Jockey Pump', 'Fire Protection & Life Safety', 'Pump House & Water Tank', 'High', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'),
    ('FDAS-01', 'Fire Detection & Alarm Panel', 'Fire Protection & Life Safety', 'Admin Office', 'Critical', 'Notifier', 'NFS2-3030', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'),
    ('SPR-01', 'Sprinkler System (ESFR)', 'Fire Protection & Life Safety', 'Warehouse Building', 'Critical', null, 'ESFR', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'),
    ('FE-SET', 'Portable Fire Extinguishers (48 units)', 'Fire Protection & Life Safety', 'Warehouse Building', 'High', null, 'ABC 10 lb / CO2 10 lb', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'),
    ('EL-SET', 'Emergency Lights & Exit Signs (64 units)', 'Fire Protection & Life Safety', 'Warehouse Building', 'High', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('WP-01', 'Domestic Water Booster Pump', 'Plumbing, Water & Wastewater', 'Pump House & Water Tank', 'Medium', 'Grundfos', 'CMBE 5-62', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('WT-01', 'Water Storage Tank 50 m³', 'Plumbing, Water & Wastewater', 'Pump House & Water Tank', 'Medium', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('STP-01', 'Sewage Treatment Plant', 'Plumbing, Water & Wastewater', 'Sewage Treatment Plant', 'High', null, '30 m³/day', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'AquaClear Testing Laboratory'),
    ('AC-01', 'Split-type Aircon – Admin Office', 'HVAC & Ventilation', 'Admin Office', 'Low', 'Carrier', '2.5 HP inverter', null, '2021-05-10', null, null, null, null, null, 'Owned', null, null, null),
    ('AC-02', 'Split-type Aircon – Canteen', 'HVAC & Ventilation', 'Canteen & Lockers', 'Low', 'Carrier', '3.0 HP inverter', null, '2021-05-10', null, null, null, null, null, 'Owned', null, null, null),
    ('EXF-01', 'Battery Room Exhaust Fans', 'HVAC & Ventilation', 'Battery Charging Room', 'High', null, 'Explosion-proof axial', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('CMP-01', 'Air Compressor 7.5 kW', 'Compressed Air', 'MHE Maintenance Bay', 'Medium', 'Atlas Copco', 'G7', null, '2020-01-20', null, null, null, null, null, 'Owned', 5320.0, null, null),
    ('SCALE-01', 'Pallet Weighing Scale', 'Weighing & Measuring', 'Loading Docks', 'Medium', 'Mettler Toledo', 'PBA430', null, '2021-02-01', null, null, null, null, null, 'Owned', null, null, null),
    ('CCTV-01', 'CCTV System (32 cameras, NVR)', 'Security & CCTV', 'Guardhouse & Main Gate', 'Medium', 'Hikvision', null, null, '2020-10-01', null, null, null, null, null, 'Owned', null, null, null),
    ('GATE-01', 'Motorised Sliding Main Gate', 'Doors & Gates', 'Guardhouse & Main Gate', 'Medium', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('ROOF-01', 'Warehouse Roof, Gutters & Downspouts', 'Building & Civil', 'Warehouse Building', 'High', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null),
    ('SCR-01', 'Ride-on Floor Scrubber', 'Cleaning Equipment', 'MHE Maintenance Bay', 'Low', 'Tennant', 'T7', 'TNT-T7-5521', '2022-08-01', null, null, null, 'Electric (lead-acid)', null, 'Owned', 1320.0, null, null)
  ) as v(code, name, cat, loc, crit, make, model, serial, installed, mhe_type, cap, lift, power, batt, own, meter, cert, vendor)
  left join asset_categories c on c.name = v.cat
  left join locations l on l.site_id = site and l.name = v.loc
  left join vendors vd on vd.name = v.vendor;

  -- Batteries and chargers belong to their trucks' fleet; batteries sit under the unit.
  update assets b set parent_id = r.id
    from assets r where r.code = replace(b.code, 'BAT-', 'RT-') and b.code like 'BAT-%';

  -- Give the history a starting point well before the reporting window.
  update asset_status_log set changed_at = now() - interval '400 days';
  update assets set status = 'Needs Attention' where code in ('DL-03', 'CU-F02');
  update asset_status_log set changed_at = now() - interval '3 days', note = 'Lip not extending fully'
   where asset_id = (select id from assets where code = 'DL-03') and status = 'Needs Attention';
  update asset_status_log set changed_at = now() - interval '1 day', note = 'High head pressure alarm'
   where asset_id = (select id from assets where code = 'CU-F02') and status = 'Needs Attention';
  -- RT-02 was out of service for two days earlier this month.
  insert into asset_status_log (asset_id, status, note, changed_at)
  select id, s.status, s.note, now() - s.ago
    from assets, (values ('Out of Service', 'Mast chain replaced under warranty', interval '19 days'),
                         ('Operational', 'Returned to service', interval '17 days')) as s(status, note, ago)
   where code = 'RT-02';

  -- ------------------------------------------------------------ parts
  insert into parts (part_no, name, category, unit, site_id, bin_location, min_qty, max_qty, unit_cost, vendor_id)
  select p.no, p.name, p.cat, p.unit, site, p.bin, p.min, p.max, p.cost, v.id
  from (values
    ('HYD-46', 'Hydraulic oil ISO VG 46', 'Lubricants', 'L', 'LUB-01', 40.0, 200.0, 185.00, null),
    ('GRS-EP2', 'Grease EP2, 400 g cartridge', 'Lubricants', 'pc', 'LUB-02', 12.0, 48.0, 165.00, null),
    ('DIST-W20', 'Battery water, distilled 20 L', 'MHE – Battery', 'can', 'BAT-A1', 6.0, 30.0, 450.00, 'LiftCare MHE Services'),
    ('SB350-G', 'Battery connector SB350 grey', 'MHE – Battery', 'pc', 'BAT-A2', 4.0, 12.0, 1850.00, 'LiftCare MHE Services'),
    ('DW-RR', 'Drive wheel, polyurethane – reach truck', 'MHE – Wheels', 'pc', 'MHE-03', 2.0, 6.0, 14500.00, 'LiftCare MHE Services'),
    ('LW-85', 'Load wheel 85 × 100 PU', 'MHE – Wheels', 'pc', 'MHE-03', 8.0, 24.0, 1650.00, null),
    ('EPT-TSW', 'Tiller head micro switch', 'MHE – Electrical', 'pc', 'MHE-05', 3.0, 10.0, 2400.00, null),
    ('FUSE-355', 'Traction fuse 355 A', 'MHE – Electrical', 'pc', 'MHE-05', 4.0, 12.0, 980.00, null),
    ('CHN-LH', 'Lift chain LH1066, per metre', 'MHE – Mast', 'm', 'MHE-06', 5.0, 20.0, 3200.00, 'LiftCare MHE Services'),
    ('LED-HB150', 'LED high-bay 150 W', 'Electrical', 'pc', 'ELE-01', 10.0, 40.0, 6800.00, null),
    ('LED-T8', 'LED tube T8 18 W', 'Electrical', 'pc', 'ELE-02', 30.0, 120.0, 320.00, null),
    ('MCB-20', 'MCB 2P 20 A', 'Electrical', 'pc', 'ELE-03', 6.0, 24.0, 850.00, null),
    ('CTR-40', 'Contactor 3P 40 A, 220 V coil', 'Electrical', 'pc', 'ELE-03', 2.0, 8.0, 4200.00, null),
    ('R404A', 'Refrigerant R404A, 10.9 kg cylinder', 'Refrigeration', 'cyl', 'REF-01', 2.0, 6.0, 16500.00, 'ColdLine Refrigeration Services'),
    ('CFM-450', 'Condenser fan motor 450 W', 'Refrigeration', 'pc', 'REF-02', 1.0, 3.0, 18500.00, 'ColdLine Refrigeration Services'),
    ('DHT-F', 'Defrost heater element – freezer evaporator', 'Refrigeration', 'pc', 'REF-02', 2.0, 6.0, 5200.00, 'ColdLine Refrigeration Services'),
    ('DHS-C', 'Door heater strip – chiller high-speed door', 'Dock & Doors', 'pc', 'DCK-02', 1.0, 3.0, 9600.00, 'DockPro Equipment Services'),
    ('OF-GEN', 'Oil filter – genset', 'Genset', 'pc', 'GEN-01', 2.0, 6.0, 1450.00, 'PowerCore Genset Services'),
    ('FF-GEN', 'Fuel filter – genset', 'Genset', 'pc', 'GEN-01', 2.0, 6.0, 1250.00, 'PowerCore Genset Services'),
    ('EO-1540', 'Engine oil 15W-40, 18 L pail', 'Genset', 'pail', 'GEN-02', 2.0, 6.0, 6200.00, 'PowerCore Genset Services'),
    ('DS-PAD', 'Dock shelter side pad', 'Dock & Doors', 'pc', 'DCK-01', 2.0, 8.0, 7800.00, 'DockPro Equipment Services'),
    ('WS-DOOR', 'Door bottom weather seal, per metre', 'Dock & Doors', 'm', 'DCK-02', 10.0, 40.0, 420.00, null),
    ('FE-10', 'Fire extinguisher ABC 10 lb (spare)', 'Fire Safety', 'pc', 'SAF-01', 2.0, 6.0, 2850.00, 'FireGuard Systems PH')
  ) as p(no, name, cat, unit, bin, min, max, cost, vendor)
  left join vendors v on v.name = p.vendor;

  insert into part_transactions (part_id, kind, qty, unit_cost, reference, created_at)
  select p.id, 'Receive', r.qty, p.unit_cost, 'Opening balance', now() - interval '95 days'
  from (values ('HYD-46', 140), ('GRS-EP2', 24), ('DIST-W20', 8), ('SB350-G', 5), ('DW-RR', 3), ('LW-85', 14),
               ('EPT-TSW', 5), ('FUSE-355', 6), ('CHN-LH', 10), ('LED-HB150', 18), ('LED-T8', 60), ('MCB-20', 10),
               ('CTR-40', 3), ('R404A', 4), ('CFM-450', 2), ('OF-GEN', 4), ('FF-GEN', 4), ('EO-1540', 4),
               ('DS-PAD', 4), ('WS-DOOR', 18), ('FE-10', 3)) as r(no, qty)
  join parts p on p.part_no = r.no;

  -- ----------------------------------------------------- PM schedules
  -- Hour-meter PMs for the powered trucks.
  insert into pm_schedules (title, instructions, site_id, asset_id, type, priority, assigned_to, vendor_id,
                            trigger_type, meter_interval, meter_last, meter_lead, estimated_hours, tasks)
  select a.code || ' – 250-hour service', 'Service per manufacturer schedule. Record hour meter on completion.',
         site, a.id, 'Preventive', 'High', tech_id, a.vendor_id, 'Meter', 250, floor(a.current_meter / 250) * 250, 20, 3,
         '["Check and top up hydraulic oil","Inspect lift chains; measure elongation and lubricate","Inspect forks and fork heels for wear (max 10%)","Check drive, load and caster wheels","Test service and parking brakes","Check steering and horn","Clean and inspect battery, cables and connector","Check all safety devices, lights and alarms","Grease all fittings","Record hour meter and road-test"]'::jsonb
    from assets a
   where a.site_id = site and a.mhe_type in ('Reach Truck','Counterbalance Forklift (Electric)','Counterbalance Forklift (LPG)','Order Picker','Electric Stacker');

  insert into pm_schedules (title, instructions, site_id, asset_id, location_id, type, priority, assigned_to, vendor_id,
                            trigger_type, interval_value, interval_unit, next_due, lead_days, estimated_hours, tasks)
  select p.title, p.instr, site, a.id, l.id, p.typ, p.pri, tech_id, v.id,
         'Calendar', p.every, p.unit, today + p.due, p.lead, p.hrs, p.tasks::jsonb
  from (values
    ('Electric pallet trucks – monthly inspection', null, 'Cross-dock / Anteroom', 'Inspection', 'Medium', null, 1, 'month', 4, 5, 2.0,
     '["EPT-01: tiller, brake, belly switch, E-stop","EPT-02: tiller, brake, belly switch, E-stop","EPT-03: tiller, brake, belly switch, E-stop","EPT-04: tiller, brake, belly switch, E-stop","Clean wheels of stretch film; check load rollers","Check battery charge cycles and connector"]'),
    ('Traction batteries – weekly watering & equalise', 'Wear face shield, apron and gloves. Eyewash station must be working.', 'Battery Charging Room', 'Preventive', 'Medium', null, 1, 'week', 2, 1, 1.5,
     '["Check electrolyte level after charging; top up with distilled water only","Clean battery tops and neutralise any spillage","Check cable, connector and vent caps","Run equalise charge on lead-acid batteries","Check eyewash station and spill kit","Log specific gravity of pilot cells"]'),
    ('GEN-01 weekly no-load test run', 'Run 30 minutes. Coordinate with warehouse supervisor before switching.', 'GEN-01', 'Inspection', 'High', null, 1, 'week', 1, 1, 1.0,
     '["Check fuel, oil and coolant levels before start","Check battery charger and starting battery voltage","Start and run 30 min at no load","Record voltage, frequency, oil pressure and coolant temperature","Check for leaks, abnormal noise or smoke","Return controls to AUTO"]'),
    ('GEN-01 quarterly PMS', 'Performed by contractor. Attach service report.', 'GEN-01', 'Preventive', 'High', 'PowerCore Genset Services', 3, 'month', 25, 10, 4.0,
     '["Change engine oil and oil filter","Replace fuel filters","Check air filter and radiator","Check belts, hoses and coolant","Test ATS transfer and re-transfer","Record hour meter"]'),
    ('Freezer condensing units – monthly PM', null, 'CU-F01', 'Preventive', 'High', 'ColdLine Refrigeration Services', 1, 'month', -2, 5, 3.0,
     '["Clean condenser coils","Check suction and discharge pressures","Check compressor oil level and amps","Check refrigerant charge (sight glass)","Check fan motors and blades","Check electrical terminals for heat marks"]'),
    ('Chiller condensing unit – monthly PM', null, 'CU-C01', 'Preventive', 'High', 'ColdLine Refrigeration Services', 1, 'month', 9, 5, 2.5,
     '["Clean condenser coils","Check suction and discharge pressures","Check compressor oil level and amps","Check refrigerant charge (sight glass)","Check fan motors and blades"]'),
    ('Freezer evaporators – coil cleaning & drain check', null, 'EVAP-F01', 'Preventive', 'Medium', 'ColdLine Refrigeration Services', 3, 'month', 40, 7, 3.0,
     '["Clean evaporator coils","Check defrost heaters and termination","Clear and check drain line heater","Check fan motors"]'),
    ('Dock levelers – monthly lubrication & inspection', null, 'Loading Docks', 'Preventive', 'Medium', null, 1, 'month', 4, 5, 2.0,
     '["Lubricate hinge pins and lip hinges (all docks)","Check hydraulic oil level and hoses","Test full raise, lip extend and auto-return","Check toe guards and bumpers","Check dock shelter pads and curtains"]'),
    ('High-speed doors – quarterly PM', null, 'HSD-01', 'Preventive', 'High', 'DockPro Equipment Services', 3, 'month', 15, 7, 2.0,
     '["Check curtain and guides","Test safety light curtain and reversing","Check door heater strips (freezer/chiller)","Check drive, brake and limits"]'),
    ('Fire extinguishers – monthly inspection', 'Tag each unit with the inspection date.', 'FE-SET', 'Safety', 'High', null, 1, 'month', 6, 5, 2.0,
     '["Pressure gauge in green zone","Pin and seal intact","No physical damage or corrosion","Mounted, visible and unobstructed","Inspection tag signed"]'),
    ('Fire pump weekly churn test', null, 'FP-01', 'Inspection', 'High', null, 1, 'week', 3, 2, 1.0,
     '["Record suction and discharge pressure","Run pump 10 minutes","Check packing gland drip and bearings","Check controller alarms","Return controller to AUTO"]'),
    ('FDAS quarterly test', 'Notify guards and the monitoring station before testing.', 'FDAS-01', 'Inspection', 'High', 'FireGuard Systems PH', 3, 'month', 50, 10, 3.0,
     '["Test a sample of smoke and heat detectors","Test manual call points","Test sounders and strobes","Test battery backup","Check event log for faults"]'),
    ('Emergency lights & exit signs – monthly test', null, 'EL-SET', 'Safety', 'High', null, 1, 'month', -1, 5, 2.0,
     '["Run 30-second discharge test on every unit","Replace failed lamps or batteries","Record any unit that failed"]'),
    ('Racking – quarterly visual inspection', 'Use the traffic-light system: red = offload now.', 'RACK-FRZ', 'Inspection', 'High', null, 3, 'month', 20, 7, 4.0,
     '["Inspect uprights for dents and twists","Check beam locking pins","Check base plates and anchors","Check load signs are posted","Log damage with bay location"]'),
    ('Aircon cleaning – quarterly', null, 'AC-01', 'Preventive', 'Low', null, 3, 'month', 33, 7, 2.0,
     '["Clean filters and indoor coil","Flush drain line","Clean outdoor coil","Check amps and refrigerant pressure"]'),
    ('Pallet scale calibration', 'Calibration by an accredited provider; keep the certificate.', 'SCALE-01', 'Inspection', 'Medium', null, 1, 'year', 75, 14, 1.0,
     '["Calibrate with certified test weights","Attach calibration certificate"]'),
    ('Water tank cleaning & disinfection', null, 'WT-01', 'Preventive', 'Medium', null, 6, 'month', 100, 14, 6.0,
     '["Drain and clean tank","Disinfect and flush","Collect water sample for testing"]'),
    ('Temperature loggers – calibration check', 'FSSC 22000 prerequisite: keep the calibration records.', 'TMS-01', 'Inspection', 'High', null, 6, 'month', 12, 10, 2.0,
     '["Compare each probe with a reference thermometer","Check alarm set points (freezer ≤ -18 °C, chiller 0–4 °C)","Test SMS / email alarm delivery","Replace logger batteries as needed"]')
  ) as p(title, instr, target, typ, pri, vendor, every, unit, due, lead, hrs, tasks)
  left join assets a on a.site_id = site and a.code = p.target
  left join locations l on l.site_id = site and l.name = p.target
  left join vendors v on v.name = p.vendor;

  -- -------------------------------------------- 12 weeks of history
  for i in 1..64 loop
    created := now() - make_interval(days => 3 + floor(random() * 82)::int, hours => floor(random() * 10)::int);
    wo_kind := (array['Corrective','Corrective','Corrective','Preventive','Preventive','Inspection','Safety','Emergency'])[1 + floor(random() * 8)::int];
    select id into asset_pick from assets where site_id = site and status <> 'Decommissioned'
      order by case when wo_kind in ('Preventive','Inspection') then random() else random() * (case when mhe_type is not null then 0.5 else 1 end) end
      limit 1;
    insert into work_orders (title, type, priority, status, site_id, asset_id, assigned_to, due_date,
                             created_at, started_at, completed_at, action_taken, failure_cause, asset_down, downtime_hours, created_by)
    select case wo_kind
             when 'Preventive' then 'Scheduled PM – ' || a.code
             when 'Inspection' then 'Routine inspection – ' || a.code
             when 'Safety' then 'Safety corrective action – ' || a.code
             when 'Emergency' then 'Emergency breakdown – ' || a.code
             else (array['Not working – ','Abnormal noise – ','Leak found – ','Intermittent fault – ','Damaged – '])[1 + floor(random() * 5)::int] || a.code
           end,
           wo_kind,
           case when wo_kind = 'Emergency' then 'Critical' else (array['Low','Medium','Medium','High'])[1 + floor(random() * 4)::int] end,
           'Completed', site, a.id, tech_id,
           (created + make_interval(days => case when wo_kind in ('Preventive','Inspection') then 5 else 2 end))::date,
           created,
           created + interval '2 hours',
           -- about one PM in seven closes late; repairs take hours to a few days
           created + case when wo_kind in ('Preventive','Inspection') and random() < 0.14 then interval '8 days'
                          when wo_kind = 'Emergency' then make_interval(hours => 3 + floor(random() * 10)::int)
                          else make_interval(hours => 4 + floor(random() * 60)::int) end,
           case when wo_kind in ('Preventive','Inspection') then 'Completed all checklist items; no defects found'
                else (array['Replaced faulty component and tested','Adjusted and re-tested; working normally','Tightened fittings and cleaned; leak stopped','Repaired wiring and replaced fuse'])[1 + floor(random() * 4)::int] end,
           case when wo_kind in ('Corrective','Emergency') then (array['Wear and tear','Operator damage','Loose connection','Lack of lubrication','Unknown'])[1 + floor(random() * 5)::int] end,
           wo_kind = 'Emergency',
           case when wo_kind = 'Emergency' then round((3 + random() * 10)::numeric, 1) end,
           admin_id
      from assets a where a.id = asset_pick
    returning id into wo;

    insert into wo_labor (work_order_id, technician_id, work_date, hours, rate)
    select wo, tech_id, (created + interval '2 hours')::date, round((0.5 + random() * 5)::numeric * 2) / 2, 220;
  end loop;

  -- A few parts issued against that history.
  n := 0;
  for hist in select w.id, w.created_at from work_orders w join assets a on a.id = w.asset_id
            where w.site_id = site and w.type in ('Corrective','Emergency') and a.mhe_type is not null
            order by w.created_at limit 4 loop
    n := n + 1;
    insert into part_transactions (part_id, kind, qty, work_order_id, created_at)
    select p.id, 'Issue', q.qty, hist.id, hist.created_at + interval '3 hours'
      from (values (1, 'HYD-46', 6), (1, 'GRS-EP2', 1), (2, 'LW-85', 2), (3, 'FUSE-355', 1), (3, 'DIST-W20', 2), (4, 'CHN-LH', 3), (4, 'LED-T8', 6)) as q(k, no, qty)
      join parts p on p.part_no = q.no
     where q.k = n;
  end loop;
  insert into part_transactions (part_id, kind, qty, reference, created_at)
  select p.id, 'Issue', q.qty, 'Aisle lighting replacement', now() - interval '12 days'
    from (values ('LED-T8', 32), ('LED-HB150', 9)) as q(no, qty) join parts p on p.part_no = q.no;

  -- --------------------------------------------- current open work
  insert into work_orders (title, description, type, priority, status, site_id, asset_id, location_id, assigned_to,
                           due_date, created_at, hold_reason, asset_down, requester_name, created_by)
  select w.title, w.descr, w.typ, w.pri, w.st, site, a.id, coalesce(l.id, a.location_id),
         case when w.st = 'Requested' then null else tech_id end,
         case when w.st = 'Requested' then null else today + w.due end,
         now() - make_interval(days => w.ago), w.hold, w.down, w.req, admin_id
  from (values
    ('Dock leveler lip not extending fully', 'Lip stops at about 70%. Trucks being loaded at docks 1, 2 and 4 meanwhile.', 'Corrective', 'High', 'In Progress', 'DL-03', null, 1, 3, null, true, 'Dock supervisor'),
    ('High head pressure alarm on CU-F02', 'Alarm repeating every afternoon. Freezer holding at -20 °C on CU-F01.', 'Corrective', 'Critical', 'Open', 'CU-F02', null, 0, 1, null, false, null),
    ('Replace failed LED high-bays, Dry aisles 4–6', 'Six fixtures out. Needs the scissor lift.', 'Corrective', 'Medium', 'Open', 'LGT-WH', 'Dry Storage', 5, 2, null, false, null),
    ('Door heater strip not working – ice build-up', 'Ice forming on the bottom guide of the chiller high-speed door.', 'Corrective', 'High', 'On Hold', 'HSD-02', null, -2, 6, 'Waiting for heater strip from supplier', false, null),
    ('Roof leak above dock 2 during heavy rain', 'Water dripping near the dock 2 leveler pit. Wet floor sign placed.', 'Corrective', 'High', 'Open', 'ROOF-01', 'Loading Docks', -3, 6, null, false, 'Warehouse supervisor'),
    ('Install bollards at battery charging room entrance', 'Protect the charger bank from truck impact.', 'Improvement', 'Medium', 'Open', null, 'Battery Charging Room', 20, 4, null, false, null),
    ('Repaint pedestrian walkway markings – cross-dock', 'Yellow lines faded at the anteroom crossing.', 'Safety', 'Medium', 'Open', null, 'Cross-dock / Anteroom', 10, 8, null, false, 'Safety officer'),
    ('Noisy bearing on water booster pump', null, 'Corrective', 'Medium', 'In Progress', 'WP-01', null, 3, 4, null, false, null),
    ('Exit sign not lit at freezer anteroom', 'Found during safety walk.', 'Safety', 'High', 'Open', 'EL-SET', 'Cross-dock / Anteroom', 1, 1, null, false, 'Safety officer'),
    ('Aircon in admin office not cooling', 'Room stays at 28 °C in the afternoon.', 'Corrective', 'Medium', 'Requested', 'AC-01', null, 0, 1, null, false, 'HR – Maria'),
    ('Canteen sink clogged', null, 'Corrective', 'Low', 'Requested', null, 'Canteen & Lockers', 0, 0, null, false, 'Canteen staff'),
    ('Loose beam locking pin, Dry aisle 3 bay 12', 'Pin missing on level 2 beam. Area coned off.', 'Safety', 'High', 'Requested', 'RACK-DRY', null, 0, 0, null, false, 'Warehouse supervisor')
  ) as w(title, descr, typ, pri, st, asset_code, loc_name, due, ago, hold, down, req)
  left join assets a on a.site_id = site and a.code = w.asset_code
  left join locations l on l.site_id = site and l.name = w.loc_name;

  insert into wo_labor (work_order_id, technician_id, hours, notes)
  select w.id, tech_id, 1.5, 'Diagnosis: hydraulic pressure low, suspect lip cylinder seal'
    from work_orders w where w.site_id = site and w.title = 'Dock leveler lip not extending fully';
  insert into wo_activity (work_order_id, kind, body, author_id)
  select w.id, 'comment', 'Seal kit requested from DockPro, ETA tomorrow.', tech_id
    from work_orders w where w.site_id = site and w.title = 'Dock leveler lip not extending fully';

  -- ------------------------------------------------- pre-use checks
  for unit_rec in select x.id, x.code, x.mhe_type, x.current_meter from assets x
            where x.site_id = site and x.mhe_type in ('Reach Truck','Counterbalance Forklift (Electric)','Electric Pallet Truck','Order Picker')
            order by x.code loop
    select * into tpl from checklist_templates where unit_rec.mhe_type = any(applies_to) and active limit 1;
    continue when tpl.id is null;
    -- yesterday: everything passed
    insert into checklist_submissions (asset_id, template_id, operator_name, shift, meter_reading, results, created_at)
    select unit_rec.id, tpl.id, (array['R. Santos','J. dela Cruz','M. Bautista','A. Garcia','K. Mendoza'])[1 + floor(random() * 5)::int],
           'Shift 1', unit_rec.current_meter - 7,
           (select jsonb_agg(item || '{"result":"OK"}'::jsonb) from jsonb_array_elements(tpl.items) item),
           now() - interval '1 day';
    continue when unit_rec.code in ('FL-02', 'OP-01', 'RT-06');   -- not checked yet today
    insert into checklist_submissions (asset_id, template_id, operator_name, shift, meter_reading, results, remarks)
    select unit_rec.id, tpl.id, (array['R. Santos','J. dela Cruz','M. Bautista','A. Garcia','K. Mendoza'])[1 + floor(random() * 5)::int],
           'Shift 1', case when unit_rec.current_meter is not null then unit_rec.current_meter + 1.5 end,
           (select jsonb_agg(item || case
                      when unit_rec.code = 'RT-04' and item->>'text' like 'Service brake%' then '{"result":"Fail","note":"Pedal spongy, truck rolls on ramp"}'::jsonb
                      when unit_rec.code = 'EPT-03' and item->>'text' like 'Load wheels%' then '{"result":"Fail","note":"Stretch film wrapped on left load roller"}'::jsonb
                      else '{"result":"OK"}'::jsonb end order by ord)
              from jsonb_array_elements(tpl.items) with ordinality as e(item, ord)),
           case when unit_rec.code = 'RT-04' then 'Parked at MHE bay and tagged' end;
  end loop;

  -- ------------------------------------------------ compliance register
  insert into compliance_items (site_id, name, category, authority, reference, frequency_months, last_done, next_due, responsible_id, vendor_id, notes)
  select site, c.name, c.cat, c.auth, c.ref, c.freq,
         case when c.last is not null then today + c.last end, today + c.due, admin_id, v.id, c.notes
  from (values
    ('Fire Safety Inspection Certificate (FSIC)', 'Certificate', 'Bureau of Fire Protection', 'RA 9514 (Fire Code)', 12, -300, 65, null, 'Renew with the business permit.'),
    ('Business / Mayor''s Permit', 'Permit', 'LGU – Business Permits & Licensing', 'Local revenue code', 12, -270, 95, null, null),
    ('Sanitary Permit', 'Permit', 'LGU – Municipal Health Office', 'PD 856 (Sanitation Code)', 12, -280, 85, null, null),
    ('Certificate of Annual Electrical Inspection', 'Certificate', 'LGU – Office of the Building Official', 'PD 1096 (Building Code)', 12, -350, 15, null, null),
    ('Permit to Operate – standby genset', 'Permit', 'DENR-EMB', 'RA 8749 (Clean Air Act)', 12, -380, -15, null, 'Expired – application filed, awaiting inspection.'),
    ('Wastewater Discharge Permit', 'Permit', 'DENR-EMB', 'RA 9275 (Clean Water Act)', 12, -200, 165, null, null),
    ('Quarterly Self-Monitoring Report', 'Report', 'DENR-EMB', 'RA 8749 / RA 9275', 3, -80, 10, null, 'Submit through the EMB online system.'),
    ('Pollution Control Officer accreditation', 'License', 'DENR-EMB', 'DAO 2014-02', 36, -600, 495, null, null),
    ('Potable water bacteriological test', 'Testing', 'DOH-accredited laboratory', 'PD 856 (Sanitation Code)', 6, -150, 30, 'AquaClear Testing Laboratory', null),
    ('Pest control service report', 'Inspection', 'Pest control contractor', 'FSSC 22000 prerequisite programme', 1, -25, 5, 'Northgate Pest Solutions', null),
    ('MHE third-party inspection & load test', 'Inspection', 'Accredited third-party inspector', 'RA 11058 (OSH Law)', 12, -325, 40, 'LiftCare MHE Services', 'All powered trucks and the scissor lift.'),
    ('Fire drill', 'Training', 'Internal, observed by BFP', 'RA 9514 (Fire Code)', 6, -170, 10, null, null),
    ('Safety Officer (SO2) accreditation', 'Training', 'DOLE-accredited training organisation', 'DOLE DO 198-18', 36, -700, 395, null, null),
    ('FSSC 22000 surveillance audit', 'Audit', 'Certification body', 'FSSC 22000', 12, -200, 165, null, null),
    ('External racking inspection', 'Inspection', 'Racking inspector', 'EN 15635 (guidance)', 12, -150, 215, 'RackSafe Inspections', null)
  ) as c(name, cat, auth, ref, freq, last, due, vendor, notes)
  left join vendors v on v.name = c.vendor;

  -- ------------------------------------------ create due PM work orders
  perform generate_pm_work_orders();

  raise notice 'Sample data loaded for site PLD (Plaridel DC).';
end $$;
