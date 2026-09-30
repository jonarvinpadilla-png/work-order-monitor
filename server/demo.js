import { addDays, localDate } from './time.js';

// Sample distribution centre so every screen has something to show: MHE
// units, cold-chain plant, dock equipment, fire systems, PM schedules,
// spare parts, vendors, contracts and a compliance register. Vendor names
// are fictional. Dates are relative to today. Loading it twice does nothing
// the second time; "Remove all data" in Settings clears it before go-live.

const LOCATIONS_TOP = [
  ['Warehouse Building', 'Building'], ['Utilities', 'Building'], ['Office Building', 'Building'], ['Yard & Perimeter', 'Yard']
];

const LOCATIONS = [
  ['Warehouse Building', 'Dry Storage', 'Storage zone', 'Ambient'],
  ['Warehouse Building', 'Chiller Room', 'Storage zone', 'Chiller'],
  ['Warehouse Building', 'Freezer Room', 'Storage zone', 'Freezer'],
  ['Warehouse Building', 'Cross-dock / Anteroom', 'Staging', 'Chiller'],
  ['Warehouse Building', 'Loading Docks', 'Dock', null],
  ['Warehouse Building', 'Battery Charging Room', 'Room', null],
  ['Warehouse Building', 'MHE Maintenance Bay', 'Room', null],
  ['Utilities', 'Powerhouse / Genset Room', 'Utility', null],
  ['Utilities', 'Electrical Room', 'Utility', null],
  ['Utilities', 'Refrigeration Machine Room', 'Utility', null],
  ['Utilities', 'Pump House & Water Tank', 'Utility', null],
  ['Utilities', 'Sewage Treatment Plant', 'Utility', null],
  ['Office Building', 'Admin Office', 'Room', null],
  ['Office Building', 'Canteen & Lockers', 'Room', null],
  ['Yard & Perimeter', 'Guardhouse & Main Gate', 'Yard', null]
];

const VENDORS = [
  ['LiftCare MHE Services', 'MHE rental & maintenance', 'Engr. R. Dizon', '0917 555 0101', 'service@liftcare.example'],
  ['ColdLine Refrigeration Services', 'Refrigeration & HVAC', 'A. Mercado', '0918 555 0102', 'ops@coldline.example'],
  ['PowerCore Genset Services', 'Generators & electrical', 'J. Villanueva', '0919 555 0103', 'pms@powercore.example'],
  ['FireGuard Systems PH', 'Fire protection & FDAS', 'M. Santos', '0920 555 0104', 'support@fireguard.example'],
  ['DockPro Equipment Services', 'Dock levelers & doors', 'P. Reyes', '0921 555 0105', 'hello@dockpro.example'],
  ['Northgate Pest Solutions', 'Pest control', 'L. Cruz', '0922 555 0106', 'ipm@northgate.example'],
  ['AquaClear Testing Laboratory', 'Water & wastewater testing', 'Dr. E. Ramos', '0923 555 0107', 'lab@aquaclear.example'],
  ['RackSafe Inspections', 'Racking inspection', 'K. Tan', '0924 555 0108', 'inspect@racksafe.example']
];

// vendor, title, scope, start (days from today), end, value, billing, notice days
const CONTRACTS = [
  ['LiftCare MHE Services', 'MHE rental and full maintenance', 'Reach trucks RT-01–RT-06 incl. batteries, 250-hour PMS and breakdown response within 4 hours', -400, 330, 4860000, 'Monthly', 90],
  ['ColdLine Refrigeration Services', 'Refrigeration plant PMS', 'Freezer and chiller condensing units, evaporators, controls; 24/7 emergency call-out', -320, 45, 780000, 'Quarterly', 60],
  ['PowerCore Genset Services', 'Genset PMS and load bank test', 'Quarterly PMS of GEN-01 and ATS-01, annual load bank test', -165, 200, 240000, 'Quarterly', 60],
  ['FireGuard Systems PH', 'FDAS and sprinkler maintenance', 'Quarterly FDAS test, sprinkler and fire pump inspection, extinguisher refilling', -370, -5, 185000, 'Annual', 60],
  ['Northgate Pest Solutions', 'Integrated pest management', 'Monthly service, bait station map, trend report for FSSC 22000', -345, 20, 216000, 'Monthly', 45],
  ['DockPro Equipment Services', 'Dock levelers and doors PMS', 'Semi-annual PMS of dock levelers, shelters, sectional and high-speed doors', -245, 120, 150000, 'Semi-annual', 60],
  ['AquaClear Testing Laboratory', 'Water and effluent testing', 'Semi-annual potable water bacteriological test, quarterly STP effluent test', -85, 280, 60000, 'Per service', 30]
];

const MHE = 'Material Handling Equipment (MHE)';
const BAT = 'MHE Batteries & Chargers';
const LEASED = 'LiftCare MHE Services';

// code, name, category, location, criticality, make, model, serial, installed,
// mhe type, capacity kg, lift mm, power, battery, ownership, hour meter, cert (days), vendor
const ASSETS = [
  ['RT-01', 'Reach Truck 01', MHE, 'Freezer Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1A4471', '2021-03-15', 'Reach Truck', 1600, 9500, 'Electric (lead-acid)', 'BAT-01', 'Leased', 6480, 140, LEASED],
  ['RT-02', 'Reach Truck 02', MHE, 'Freezer Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1A4472', '2021-03-15', 'Reach Truck', 1600, 9500, 'Electric (lead-acid)', 'BAT-02', 'Leased', 6122.5, 12, LEASED],
  ['RT-03', 'Reach Truck 03', MHE, 'Freezer Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1A4473', '2021-03-15', 'Reach Truck', 1600, 9500, 'Electric (lead-acid)', 'BAT-03', 'Leased', 5890, 140, LEASED],
  ['RT-04', 'Reach Truck 04', MHE, 'Chiller Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1B0918', '2022-01-10', 'Reach Truck', 1600, 9500, 'Electric (lead-acid)', 'BAT-04', 'Leased', 4312, 200, LEASED],
  ['RT-05', 'Reach Truck 05', MHE, 'Chiller Room', 'Critical', 'Crown', 'ESR 5200', 'CRW-1B0919', '2022-01-10', 'Reach Truck', 1600, 9500, 'Electric (lead-acid)', 'BAT-05', 'Leased', 4105.5, 200, LEASED],
  ['RT-06', 'Reach Truck 06', MHE, 'Dry Storage', 'High', 'Crown', 'ESR 5200', 'CRW-1C2230', '2023-06-01', 'Reach Truck', 1600, 10500, 'Electric (lithium-ion)', 'BAT-06', 'Leased', 2244, 250, LEASED],
  ['FL-01', 'Electric Forklift 01', MHE, 'Loading Docks', 'High', 'Toyota', '8FBE20', 'TYT-80341', '2020-08-20', 'Counterbalance Forklift (Electric)', 2000, 4500, 'Electric (lead-acid)', null, 'Owned', 8830, 75, null],
  ['FL-02', 'Electric Forklift 02', MHE, 'Loading Docks', 'High', 'Toyota', '8FBE20', 'TYT-80342', '2020-08-20', 'Counterbalance Forklift (Electric)', 2000, 4500, 'Electric (lead-acid)', null, 'Owned', 8514, 75, null],
  ['FL-03', 'LPG Forklift 03', MHE, 'Yard & Perimeter', 'Medium', 'Toyota', '8FG25', 'TYT-55120', '2019-02-11', 'Counterbalance Forklift (LPG)', 2500, 3000, 'LPG', null, 'Owned', 9760, -20, null],
  ['EPT-01', 'Electric Pallet Truck 01', MHE, 'Cross-dock / Anteroom', 'High', 'Jungheinrich', 'EJE 120', 'JH-99120', '2022-05-02', 'Electric Pallet Truck', 2000, null, 'Electric (lithium-ion)', null, 'Owned', 3120, 180, null],
  ['EPT-02', 'Electric Pallet Truck 02', MHE, 'Cross-dock / Anteroom', 'High', 'Jungheinrich', 'EJE 120', 'JH-99121', '2022-05-02', 'Electric Pallet Truck', 2000, null, 'Electric (lithium-ion)', null, 'Owned', 2988, 180, null],
  ['EPT-03', 'Electric Pallet Truck 03', MHE, 'Loading Docks', 'Medium', 'Jungheinrich', 'EJE 120', 'JH-99122', '2022-05-02', 'Electric Pallet Truck', 2000, null, 'Electric (lithium-ion)', null, 'Owned', 3301, 180, null],
  ['EPT-04', 'Electric Pallet Truck 04', MHE, 'Loading Docks', 'Medium', 'Jungheinrich', 'EJE 120', 'JH-99123', '2023-09-18', 'Electric Pallet Truck', 2000, null, 'Electric (lithium-ion)', null, 'Owned', 1570, 180, null],
  ['STK-01', 'Electric Stacker 01', MHE, 'Dry Storage', 'Medium', 'Linde', 'L12', 'LND-12077', '2021-11-05', 'Electric Stacker', 1200, 3000, 'Electric (lead-acid)', null, 'Owned', 2410, 60, null],
  ['OP-01', 'Order Picker 01', MHE, 'Dry Storage', 'Medium', 'Crown', 'SP 3500', 'CRW-SP3301', '2022-07-14', 'Order Picker', 1000, 7600, 'Electric (lead-acid)', null, 'Leased', 1985, 95, LEASED],
  ['MPJ-01', 'Manual Pallet Jack 01', MHE, 'Cross-dock / Anteroom', 'Low', 'Noblelift', 'AC25', null, '2023-01-09', 'Manual Pallet Jack', 2500, null, 'Manual', null, 'Owned', null, null, null],
  ['MPJ-02', 'Manual Pallet Jack 02', MHE, 'Loading Docks', 'Low', 'Noblelift', 'AC25', null, '2023-01-09', 'Manual Pallet Jack', 2500, null, 'Manual', null, 'Owned', null, null, null],
  ['SL-01', 'Scissor Lift 01', MHE, 'MHE Maintenance Bay', 'Medium', 'Genie', 'GS-1930', 'GN-193044', '2021-04-22', 'Scissor Lift', 227, 5790, 'Electric (lead-acid)', null, 'Owned', 610, 30, null],
  ['BAT-01', 'Traction Battery 01 (48 V 620 Ah)', BAT, 'Battery Charging Room', 'High', 'EnerSys', 'Hawker 48V 620Ah', 'ENS-620-101', '2021-03-15', 'Traction Battery', null, null, 'Electric (lead-acid)', null, 'Leased', null, null, LEASED],
  ['BAT-02', 'Traction Battery 02 (48 V 620 Ah)', BAT, 'Battery Charging Room', 'High', 'EnerSys', 'Hawker 48V 620Ah', 'ENS-620-102', '2021-03-15', 'Traction Battery', null, null, 'Electric (lead-acid)', null, 'Leased', null, null, LEASED],
  ['CHG-01', 'Battery Charger 01', BAT, 'Battery Charging Room', 'High', 'EnerSys', 'Lifetech Modular', 'ENS-CH-201', '2021-03-15', 'Battery Charger', null, null, null, null, 'Leased', null, null, LEASED],
  ['CHG-02', 'Battery Charger 02', BAT, 'Battery Charging Room', 'High', 'EnerSys', 'Lifetech Modular', 'ENS-CH-202', '2021-03-15', 'Battery Charger', null, null, null, null, 'Leased', null, null, LEASED],
  ['GEN-01', 'Standby Diesel Genset 500 kVA', 'Power Generation & UPS', 'Powerhouse / Genset Room', 'Critical', 'Cummins', 'C500D5', 'CMS-500-7781', '2019-06-30', null, null, null, 'Diesel', null, 'Owned', 1850, null, 'PowerCore Genset Services'],
  ['ATS-01', 'Automatic Transfer Switch 1600 A', 'Power Generation & UPS', 'Powerhouse / Genset Room', 'Critical', 'ASCO', '7000 Series', 'ASC-16-4410', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'PowerCore Genset Services'],
  ['UPS-01', 'UPS 20 kVA (WMS servers & network)', 'Power Generation & UPS', 'Admin Office', 'High', 'APC', 'Smart-UPS SRT', 'APC-20K-0091', '2022-02-14', null, null, null, null, null, 'Owned', null, null, null],
  ['TX-01', 'Pad-mounted Transformer 750 kVA', 'Electrical & Lighting', 'Electrical Room', 'Critical', null, '750 kVA 13.2 kV/400 V', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['MDP-01', 'Main Distribution Panel', 'Electrical & Lighting', 'Electrical Room', 'Critical', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['LGT-WH', 'Warehouse LED High-bay Lighting (186 fixtures)', 'Electrical & Lighting', 'Warehouse Building', 'Medium', null, '150 W LED high-bay', null, '2021-09-01', null, null, null, null, null, 'Owned', null, null, null],
  ['CU-F01', 'Freezer Condensing Unit 01', 'Refrigeration & Cold Rooms', 'Refrigeration Machine Room', 'Critical', 'Bitzer', 'LH135E/4FES-5Y', 'BTZ-F01-3321', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'],
  ['CU-F02', 'Freezer Condensing Unit 02', 'Refrigeration & Cold Rooms', 'Refrigeration Machine Room', 'Critical', 'Bitzer', 'LH135E/4FES-5Y', 'BTZ-F02-3322', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'],
  ['CU-C01', 'Chiller Condensing Unit 01', 'Refrigeration & Cold Rooms', 'Refrigeration Machine Room', 'Critical', 'Bitzer', 'LH114/4DES-5Y', 'BTZ-C01-5540', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'],
  ['EVAP-F01', 'Freezer Evaporator 01', 'Refrigeration & Cold Rooms', 'Freezer Room', 'High', 'Güntner', 'GACC RX 050', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'],
  ['EVAP-F02', 'Freezer Evaporator 02', 'Refrigeration & Cold Rooms', 'Freezer Room', 'High', 'Güntner', 'GACC RX 050', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'ColdLine Refrigeration Services'],
  ['TMS-01', 'Cold Room Temperature Monitoring System', 'Weighing & Measuring', 'Warehouse Building', 'Critical', 'Testo', 'Saveris 2', null, '2022-03-01', null, null, null, null, null, 'Owned', null, null, null],
  ['DL-01', 'Dock Leveler – Dock 1', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-01', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['DL-02', 'Dock Leveler – Dock 2', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-02', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['DL-03', 'Dock Leveler – Dock 3', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-03', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['DL-04', 'Dock Leveler – Dock 4', 'Dock Equipment', 'Loading Docks', 'High', 'Hörmann', 'HLS-2', 'HRM-DL-04', '2019-06-30', null, null, null, 'Electro-hydraulic', null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['DD-01', 'Sectional Dock Door – Dock 1', 'Doors & Gates', 'Loading Docks', 'Medium', 'Hörmann', 'SPU F42', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['DD-02', 'Sectional Dock Door – Dock 2', 'Doors & Gates', 'Loading Docks', 'Medium', 'Hörmann', 'SPU F42', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['HSD-01', 'High-speed Door – Freezer', 'Doors & Gates', 'Freezer Room', 'Critical', 'Efaflex', 'EFA-SRT Iso', 'EFX-7781', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['HSD-02', 'High-speed Door – Chiller', 'Doors & Gates', 'Chiller Room', 'High', 'Efaflex', 'EFA-SRT', 'EFX-7782', '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'DockPro Equipment Services'],
  ['RACK-DRY', 'Selective Pallet Racking – Dry', 'Racking & Storage', 'Dry Storage', 'High', null, 'Selective, 6 levels', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'RackSafe Inspections'],
  ['RACK-FRZ', 'Drive-in Racking – Freezer', 'Racking & Storage', 'Freezer Room', 'High', null, 'Drive-in, 5 levels', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'RackSafe Inspections'],
  ['FP-01', 'Fire Pump (electric, 750 gpm)', 'Fire Protection & Life Safety', 'Pump House & Water Tank', 'Critical', null, 'Split-case 750 gpm', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'],
  ['JP-01', 'Jockey Pump', 'Fire Protection & Life Safety', 'Pump House & Water Tank', 'High', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'],
  ['FDAS-01', 'Fire Detection & Alarm Panel', 'Fire Protection & Life Safety', 'Admin Office', 'Critical', 'Notifier', 'NFS2-3030', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'],
  ['SPR-01', 'Sprinkler System (ESFR)', 'Fire Protection & Life Safety', 'Warehouse Building', 'Critical', null, 'ESFR', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'],
  ['FE-SET', 'Portable Fire Extinguishers (48 units)', 'Fire Protection & Life Safety', 'Warehouse Building', 'High', null, 'ABC 10 lb / CO2 10 lb', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'FireGuard Systems PH'],
  ['EL-SET', 'Emergency Lights & Exit Signs (64 units)', 'Fire Protection & Life Safety', 'Warehouse Building', 'High', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['WP-01', 'Domestic Water Booster Pump', 'Plumbing, Water & Wastewater', 'Pump House & Water Tank', 'Medium', 'Grundfos', 'CMBE 5-62', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['WT-01', 'Water Storage Tank 50 m³', 'Plumbing, Water & Wastewater', 'Pump House & Water Tank', 'Medium', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['STP-01', 'Sewage Treatment Plant', 'Plumbing, Water & Wastewater', 'Sewage Treatment Plant', 'High', null, '30 m³/day', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, 'AquaClear Testing Laboratory'],
  ['AC-01', 'Split-type Aircon – Admin Office', 'HVAC & Ventilation', 'Admin Office', 'Low', 'Carrier', '2.5 HP inverter', null, '2021-05-10', null, null, null, null, null, 'Owned', null, null, null],
  ['AC-02', 'Split-type Aircon – Canteen', 'HVAC & Ventilation', 'Canteen & Lockers', 'Low', 'Carrier', '3.0 HP inverter', null, '2021-05-10', null, null, null, null, null, 'Owned', null, null, null],
  ['EXF-01', 'Battery Room Exhaust Fans', 'HVAC & Ventilation', 'Battery Charging Room', 'High', null, 'Explosion-proof axial', null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['CMP-01', 'Air Compressor 7.5 kW', 'Compressed Air', 'MHE Maintenance Bay', 'Medium', 'Atlas Copco', 'G7', null, '2020-01-20', null, null, null, null, null, 'Owned', 5320, null, null],
  ['SCALE-01', 'Pallet Weighing Scale', 'Weighing & Measuring', 'Loading Docks', 'Medium', 'Mettler Toledo', 'PBA430', null, '2021-02-01', null, null, null, null, null, 'Owned', null, null, null],
  ['CCTV-01', 'CCTV System (32 cameras, NVR)', 'Security & CCTV', 'Guardhouse & Main Gate', 'Medium', 'Hikvision', null, null, '2020-10-01', null, null, null, null, null, 'Owned', null, null, null],
  ['GATE-01', 'Motorised Sliding Main Gate', 'Doors & Gates', 'Guardhouse & Main Gate', 'Medium', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['ROOF-01', 'Warehouse Roof, Gutters & Downspouts', 'Building & Civil', 'Warehouse Building', 'High', null, null, null, '2019-06-30', null, null, null, null, null, 'Owned', null, null, null],
  ['SCR-01', 'Ride-on Floor Scrubber', 'Cleaning Equipment', 'MHE Maintenance Bay', 'Low', 'Tennant', 'T7', 'TNT-T7-5521', '2022-08-01', null, null, null, 'Electric (lead-acid)', null, 'Owned', 1320, null, null]
];

// part no, name, category, unit, bin, min, max, unit cost, vendor
const PARTS = [
  ['HYD-46', 'Hydraulic oil ISO VG 46', 'Lubricants', 'L', 'LUB-01', 40, 200, 185, null],
  ['GRS-EP2', 'Grease EP2, 400 g cartridge', 'Lubricants', 'pc', 'LUB-02', 12, 48, 165, null],
  ['DIST-W20', 'Battery water, distilled 20 L', 'MHE – Battery', 'can', 'BAT-A1', 6, 30, 450, LEASED],
  ['SB350-G', 'Battery connector SB350 grey', 'MHE – Battery', 'pc', 'BAT-A2', 4, 12, 1850, LEASED],
  ['DW-RR', 'Drive wheel, polyurethane – reach truck', 'MHE – Wheels', 'pc', 'MHE-03', 2, 6, 14500, LEASED],
  ['LW-85', 'Load wheel 85 × 100 PU', 'MHE – Wheels', 'pc', 'MHE-03', 8, 24, 1650, null],
  ['EPT-TSW', 'Tiller head micro switch', 'MHE – Electrical', 'pc', 'MHE-05', 3, 10, 2400, null],
  ['FUSE-355', 'Traction fuse 355 A', 'MHE – Electrical', 'pc', 'MHE-05', 4, 12, 980, null],
  ['CHN-LH', 'Lift chain LH1066, per metre', 'MHE – Mast', 'm', 'MHE-06', 5, 20, 3200, LEASED],
  ['LED-HB150', 'LED high-bay 150 W', 'Electrical', 'pc', 'ELE-01', 10, 40, 6800, null],
  ['LED-T8', 'LED tube T8 18 W', 'Electrical', 'pc', 'ELE-02', 30, 120, 320, null],
  ['MCB-20', 'MCB 2P 20 A', 'Electrical', 'pc', 'ELE-03', 6, 24, 850, null],
  ['CTR-40', 'Contactor 3P 40 A, 220 V coil', 'Electrical', 'pc', 'ELE-03', 2, 8, 4200, null],
  ['R404A', 'Refrigerant R404A, 10.9 kg cylinder', 'Refrigeration', 'cyl', 'REF-01', 2, 6, 16500, 'ColdLine Refrigeration Services'],
  ['CFM-450', 'Condenser fan motor 450 W', 'Refrigeration', 'pc', 'REF-02', 1, 3, 18500, 'ColdLine Refrigeration Services'],
  ['DHT-F', 'Defrost heater element – freezer evaporator', 'Refrigeration', 'pc', 'REF-02', 2, 6, 5200, 'ColdLine Refrigeration Services'],
  ['DHS-C', 'Door heater strip – chiller high-speed door', 'Dock & Doors', 'pc', 'DCK-02', 1, 3, 9600, 'DockPro Equipment Services'],
  ['OF-GEN', 'Oil filter – genset', 'Genset', 'pc', 'GEN-01', 2, 6, 1450, 'PowerCore Genset Services'],
  ['FF-GEN', 'Fuel filter – genset', 'Genset', 'pc', 'GEN-01', 2, 6, 1250, 'PowerCore Genset Services'],
  ['EO-1540', 'Engine oil 15W-40, 18 L pail', 'Genset', 'pail', 'GEN-02', 2, 6, 6200, 'PowerCore Genset Services'],
  ['DS-PAD', 'Dock shelter side pad', 'Dock & Doors', 'pc', 'DCK-01', 2, 8, 7800, 'DockPro Equipment Services'],
  ['WS-DOOR', 'Door bottom weather seal, per metre', 'Dock & Doors', 'm', 'DCK-02', 10, 40, 420, null],
  ['FE-10', 'Fire extinguisher ABC 10 lb (spare)', 'Fire Safety', 'pc', 'SAF-01', 2, 6, 2850, 'FireGuard Systems PH']
];

const OPENING_STOCK = [
  ['HYD-46', 140], ['GRS-EP2', 24], ['DIST-W20', 8], ['SB350-G', 5], ['DW-RR', 3], ['LW-85', 14], ['EPT-TSW', 5], ['FUSE-355', 6],
  ['CHN-LH', 10], ['LED-HB150', 18], ['LED-T8', 60], ['MCB-20', 10], ['CTR-40', 3], ['R404A', 4], ['CFM-450', 2], ['OF-GEN', 4],
  ['FF-GEN', 4], ['EO-1540', 4], ['DS-PAD', 4], ['WS-DOOR', 18], ['FE-10', 3]
];

const METER_PM_TYPES = ['Reach Truck', 'Counterbalance Forklift (Electric)', 'Counterbalance Forklift (LPG)', 'Order Picker', 'Electric Stacker'];
const METER_PM_TASKS = [
  'Check and top up hydraulic oil', 'Inspect lift chains; measure elongation and lubricate', 'Inspect forks and fork heels for wear (max 10%)',
  'Check drive, load and caster wheels', 'Test service and parking brakes', 'Check steering and horn', 'Clean and inspect battery, cables and connector',
  'Check all safety devices, lights and alarms', 'Grease all fittings', 'Record hour meter and road-test'
];

// title, instructions, target (asset code or location), type, priority, vendor,
// every, unit, next due (days from today), lead days, hours, tasks
const CALENDAR_PMS = [
  ['Electric pallet trucks – monthly inspection', null, 'Cross-dock / Anteroom', 'Inspection', 'Medium', null, 1, 'month', 4, 5, 2,
    ['EPT-01: tiller, brake, belly switch, E-stop', 'EPT-02: tiller, brake, belly switch, E-stop', 'EPT-03: tiller, brake, belly switch, E-stop', 'EPT-04: tiller, brake, belly switch, E-stop', 'Clean wheels of stretch film; check load rollers', 'Check battery charge cycles and connector']],
  ['Traction batteries – weekly watering & equalise', 'Wear face shield, apron and gloves. Eyewash station must be working.', 'Battery Charging Room', 'Preventive', 'Medium', null, 1, 'week', 2, 1, 1.5,
    ['Check electrolyte level after charging; top up with distilled water only', 'Clean battery tops and neutralise any spillage', 'Check cable, connector and vent caps', 'Run equalise charge on lead-acid batteries', 'Check eyewash station and spill kit', 'Log specific gravity of pilot cells']],
  ['GEN-01 weekly no-load test run', 'Run 30 minutes. Coordinate with warehouse supervisor before switching.', 'GEN-01', 'Inspection', 'High', null, 1, 'week', 1, 1, 1,
    ['Check fuel, oil and coolant levels before start', 'Check battery charger and starting battery voltage', 'Start and run 30 min at no load', 'Record voltage, frequency, oil pressure and coolant temperature', 'Check for leaks, abnormal noise or smoke', 'Return controls to AUTO']],
  ['GEN-01 quarterly PMS', 'Performed by contractor. Attach service report.', 'GEN-01', 'Preventive', 'High', 'PowerCore Genset Services', 3, 'month', 25, 10, 4,
    ['Change engine oil and oil filter', 'Replace fuel filters', 'Check air filter and radiator', 'Check belts, hoses and coolant', 'Test ATS transfer and re-transfer', 'Record hour meter']],
  ['Freezer condensing units – monthly PM', null, 'CU-F01', 'Preventive', 'High', 'ColdLine Refrigeration Services', 1, 'month', -2, 5, 3,
    ['Clean condenser coils', 'Check suction and discharge pressures', 'Check compressor oil level and amps', 'Check refrigerant charge (sight glass)', 'Check fan motors and blades', 'Check electrical terminals for heat marks']],
  ['Chiller condensing unit – monthly PM', null, 'CU-C01', 'Preventive', 'High', 'ColdLine Refrigeration Services', 1, 'month', 9, 5, 2.5,
    ['Clean condenser coils', 'Check suction and discharge pressures', 'Check compressor oil level and amps', 'Check refrigerant charge (sight glass)', 'Check fan motors and blades']],
  ['Freezer evaporators – coil cleaning & drain check', null, 'EVAP-F01', 'Preventive', 'Medium', 'ColdLine Refrigeration Services', 3, 'month', 40, 7, 3,
    ['Clean evaporator coils', 'Check defrost heaters and termination', 'Clear and check drain line heater', 'Check fan motors']],
  ['Dock levelers – monthly lubrication & inspection', null, 'Loading Docks', 'Preventive', 'Medium', null, 1, 'month', 4, 5, 2,
    ['Lubricate hinge pins and lip hinges (all docks)', 'Check hydraulic oil level and hoses', 'Test full raise, lip extend and auto-return', 'Check toe guards and bumpers', 'Check dock shelter pads and curtains']],
  ['High-speed doors – quarterly PM', null, 'HSD-01', 'Preventive', 'High', 'DockPro Equipment Services', 3, 'month', 15, 7, 2,
    ['Check curtain and guides', 'Test safety light curtain and reversing', 'Check door heater strips (freezer/chiller)', 'Check drive, brake and limits']],
  ['Fire extinguishers – monthly inspection', 'Tag each unit with the inspection date.', 'FE-SET', 'Safety', 'High', null, 1, 'month', 6, 5, 2,
    ['Pressure gauge in green zone', 'Pin and seal intact', 'No physical damage or corrosion', 'Mounted, visible and unobstructed', 'Inspection tag signed']],
  ['Fire pump weekly churn test', null, 'FP-01', 'Inspection', 'High', null, 1, 'week', 3, 2, 1,
    ['Record suction and discharge pressure', 'Run pump 10 minutes', 'Check packing gland drip and bearings', 'Check controller alarms', 'Return controller to AUTO']],
  ['FDAS quarterly test', 'Notify guards and the monitoring station before testing.', 'FDAS-01', 'Inspection', 'High', 'FireGuard Systems PH', 3, 'month', 50, 10, 3,
    ['Test a sample of smoke and heat detectors', 'Test manual call points', 'Test sounders and strobes', 'Test battery backup', 'Check event log for faults']],
  ['Emergency lights & exit signs – monthly test', null, 'EL-SET', 'Safety', 'High', null, 1, 'month', -1, 5, 2,
    ['Run 30-second discharge test on every unit', 'Replace failed lamps or batteries', 'Record any unit that failed']],
  ['Racking – quarterly visual inspection', 'Use the traffic-light system: red = offload now.', 'RACK-FRZ', 'Inspection', 'High', null, 3, 'month', 20, 7, 4,
    ['Inspect uprights for dents and twists', 'Check beam locking pins', 'Check base plates and anchors', 'Check load signs are posted', 'Log damage with bay location']],
  ['Aircon cleaning – quarterly', null, 'AC-01', 'Preventive', 'Low', null, 3, 'month', 33, 7, 2,
    ['Clean filters and indoor coil', 'Flush drain line', 'Clean outdoor coil', 'Check amps and refrigerant pressure']],
  ['Pallet scale calibration', 'Calibration by an accredited provider; keep the certificate.', 'SCALE-01', 'Inspection', 'Medium', null, 1, 'year', 75, 14, 1,
    ['Calibrate with certified test weights', 'Attach calibration certificate']],
  ['Water tank cleaning & disinfection', null, 'WT-01', 'Preventive', 'Medium', null, 6, 'month', 100, 14, 6,
    ['Drain and clean tank', 'Disinfect and flush', 'Collect water sample for testing']],
  ['Temperature loggers – calibration check', 'FSSC 22000 prerequisite: keep the calibration records.', 'TMS-01', 'Inspection', 'High', null, 6, 'month', 12, 10, 2,
    ['Compare each probe with a reference thermometer', 'Check alarm set points (freezer ≤ -18 °C, chiller 0–4 °C)', 'Test SMS / email alarm delivery', 'Replace logger batteries as needed']]
];

// title, description, type, priority, status, asset, location, due (days), age (days), hold reason, asset down, requester
const OPEN_WORK = [
  ['Dock leveler lip not extending fully', 'Lip stops at about 70%. Trucks being loaded at docks 1, 2 and 4 meanwhile.', 'Corrective', 'High', 'In Progress', 'DL-03', null, 1, 3, null, true, 'Dock supervisor'],
  ['High head pressure alarm on CU-F02', 'Alarm repeating every afternoon. Freezer holding at -20 °C on CU-F01.', 'Corrective', 'Critical', 'Open', 'CU-F02', null, 0, 1, null, false, null],
  ['Replace failed LED high-bays, Dry aisles 4–6', 'Six fixtures out. Needs the scissor lift.', 'Corrective', 'Medium', 'Open', 'LGT-WH', 'Dry Storage', 5, 2, null, false, null],
  ['Door heater strip not working – ice build-up', 'Ice forming on the bottom guide of the chiller high-speed door.', 'Corrective', 'High', 'On Hold', 'HSD-02', null, -2, 6, 'Waiting for heater strip from supplier', false, null],
  ['Roof leak above dock 2 during heavy rain', 'Water dripping near the dock 2 leveler pit. Wet floor sign placed.', 'Corrective', 'High', 'Open', 'ROOF-01', 'Loading Docks', -3, 6, null, false, 'Warehouse supervisor'],
  ['Install bollards at battery charging room entrance', 'Protect the charger bank from truck impact.', 'Improvement', 'Medium', 'Open', null, 'Battery Charging Room', 20, 4, null, false, null],
  ['Repaint pedestrian walkway markings – cross-dock', 'Yellow lines faded at the anteroom crossing.', 'Safety', 'Medium', 'Open', null, 'Cross-dock / Anteroom', 10, 8, null, false, 'Safety officer'],
  ['Noisy bearing on water booster pump', null, 'Corrective', 'Medium', 'In Progress', 'WP-01', null, 3, 4, null, false, null],
  ['Exit sign not lit at freezer anteroom', 'Found during safety walk.', 'Safety', 'High', 'Open', 'EL-SET', 'Cross-dock / Anteroom', 1, 1, null, false, 'Safety officer'],
  ['Aircon in admin office not cooling', 'Room stays at 28 °C in the afternoon.', 'Corrective', 'Medium', 'Requested', 'AC-01', null, 0, 1, null, false, 'HR – Maria'],
  ['Canteen sink clogged', null, 'Corrective', 'Low', 'Requested', null, 'Canteen & Lockers', 0, 0, null, false, 'Canteen staff'],
  ['Loose beam locking pin, Dry aisle 3 bay 12', 'Pin missing on level 2 beam. Area coned off.', 'Safety', 'High', 'Requested', 'RACK-DRY', null, 0, 0, null, false, 'Warehouse supervisor']
];

// name, category, authority, reference, every (months), last done (days), next due (days), vendor, notes
const COMPLIANCE = [
  ['Fire Safety Inspection Certificate (FSIC)', 'Certificate', 'Bureau of Fire Protection', 'RA 9514 (Fire Code)', 12, -300, 65, null, 'Renew with the business permit.'],
  ["Business / Mayor's Permit", 'Permit', 'LGU – Business Permits & Licensing', 'Local revenue code', 12, -270, 95, null, null],
  ['Sanitary Permit', 'Permit', 'LGU – Municipal Health Office', 'PD 856 (Sanitation Code)', 12, -280, 85, null, null],
  ['Certificate of Annual Electrical Inspection', 'Certificate', 'LGU – Office of the Building Official', 'PD 1096 (Building Code)', 12, -350, 15, null, null],
  ['Permit to Operate – standby genset', 'Permit', 'DENR-EMB', 'RA 8749 (Clean Air Act)', 12, -380, -15, null, 'Expired – application filed, awaiting inspection.'],
  ['Wastewater Discharge Permit', 'Permit', 'DENR-EMB', 'RA 9275 (Clean Water Act)', 12, -200, 165, null, null],
  ['Quarterly Self-Monitoring Report', 'Report', 'DENR-EMB', 'RA 8749 / RA 9275', 3, -80, 10, null, 'Submit through the EMB online system.'],
  ['Pollution Control Officer accreditation', 'License', 'DENR-EMB', 'DAO 2014-02', 36, -600, 495, null, null],
  ['Potable water bacteriological test', 'Testing', 'DOH-accredited laboratory', 'PD 856 (Sanitation Code)', 6, -150, 30, 'AquaClear Testing Laboratory', null],
  ['Pest control service report', 'Inspection', 'Pest control contractor', 'FSSC 22000 prerequisite programme', 1, -25, 5, 'Northgate Pest Solutions', null],
  ['MHE third-party inspection & load test', 'Inspection', 'Accredited third-party inspector', 'RA 11058 (OSH Law)', 12, -325, 40, 'LiftCare MHE Services', 'All powered trucks and the scissor lift.'],
  ['Fire drill', 'Training', 'Internal, observed by BFP', 'RA 9514 (Fire Code)', 6, -170, 10, null, null],
  ['Safety Officer (SO2) accreditation', 'Training', 'DOLE-accredited training organisation', 'DOLE DO 198-18', 36, -700, 395, null, null],
  ['FSSC 22000 surveillance audit', 'Audit', 'Certification body', 'FSSC 22000', 12, -200, 165, null, null],
  ['External racking inspection', 'Inspection', 'Racking inspector', 'EN 15635 (guidance)', 12, -150, 215, 'RackSafe Inspections', null]
];

const OPERATORS = ['R. Santos', 'J. dela Cruz', 'M. Bautista', 'A. Garcia', 'K. Mendoza'];

// Small seeded random generator so the sample history is the same each time.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hasDemoData = db => !!db.get("select 1 from sites where code = 'PLD'");

// Loads the sample site. Returns false if it is already there.
export function loadDemo(store) {
  return store.transact(null, ctx => {
    const db = store.db;
    if (hasDemoData(db)) return false;
    const tz = store.timezone();
    const today = store.today();
    const nowMs = Date.parse(ctx.now);
    const at = ms => new Date(ms).toISOString();
    const ago = (days, hours = 0) => at(nowMs - (days * 24 + hours) * 3600000);
    const random = seeded(42);
    const pick = list => list[Math.floor(random() * list.length)];
    const add = (table, row) => store._insert(ctx, table, row);
    const adminId = db.get("select id from profiles where role = 'admin' and active = 1 order by created_at limit 1")?.id ?? null;
    const techId = db.get("select id from profiles where role = 'technician' and active = 1 order by created_at limit 1")?.id ?? adminId;

    // Site and locations
    const site = add('sites', { code: 'PLD', name: 'Plaridel DC', address: 'Plaridel, Bulacan' }).id;
    const loc = {};
    for (const [name, kind] of LOCATIONS_TOP) loc[name] = add('locations', { site_id: site, name, kind }).id;
    for (const [parent, name, kind, temp] of LOCATIONS) loc[name] = add('locations', { site_id: site, parent_id: loc[parent], name, kind, temp_zone: temp }).id;

    // Vendors and contracts
    const vendor = {};
    for (const [name, service_type, contact_person, phone, email] of VENDORS) {
      vendor[name] = db.get('select id from vendors where name = ?', name)?.id
        ?? add('vendors', { name, service_type, contact_person, phone, email }).id;
    }
    for (const [v, title, scope, start, end, value, billing, notice] of CONTRACTS) {
      add('contracts', { vendor_id: vendor[v], site_id: site, title, scope, start_date: addDays(today, start), end_date: addDays(today, end), value, billing, renewal_notice_days: notice });
    }

    // Assets
    const category = Object.fromEntries(db.all('select id, name from asset_categories').map(c => [c.name, c.id]));
    const asset = {};
    for (const [code, name, cat, where, criticality, make, model, serial_no, install_date, mhe_type, capacity_kg, lift_height_mm,
      power_type, battery_ref, ownership, current_meter, cert, v] of ASSETS) {
      asset[code] = add('assets', {
        code, name, category_id: category[cat] ?? null, site_id: site, location_id: loc[where] ?? null, criticality, make, model, serial_no,
        install_date, mhe_type, capacity_kg, lift_height_mm, power_type, battery_ref, ownership, current_meter,
        cert_expiry: cert === null ? null : addDays(today, cert), vendor_id: v ? vendor[v] : null
      });
    }
    // Batteries sit under their trucks.
    for (const code of Object.keys(asset).filter(c => c.startsWith('BAT-'))) {
      const truck = asset[code.replace('BAT-', 'RT-')];
      if (truck) store._update(ctx, 'assets', asset[code].id, { parent_id: truck.id });
    }

    // Status history, starting well before the reporting window.
    db.run('update asset_status_log set changed_at = ? where asset_id in (select id from assets where site_id = ?)', ago(400), site);
    for (const code of ['DL-03', 'CU-F02']) store._update(ctx, 'assets', asset[code].id, { status: 'Needs Attention' });
    db.run("update asset_status_log set changed_at = ?, note = ? where asset_id = ? and status = 'Needs Attention'", ago(3), 'Lip not extending fully', asset['DL-03'].id);
    db.run("update asset_status_log set changed_at = ?, note = ? where asset_id = ? and status = 'Needs Attention'", ago(1), 'High head pressure alarm', asset['CU-F02'].id);
    // RT-02 was out of service for two days earlier this month.
    add('asset_status_log', { asset_id: asset['RT-02'].id, status: 'Out of Service', note: 'Mast chain replaced under warranty', changed_at: ago(19) });
    add('asset_status_log', { asset_id: asset['RT-02'].id, status: 'Operational', note: 'Returned to service', changed_at: ago(17) });

    // Parts and opening stock
    const part = {};
    for (const [part_no, name, category_, unit, bin_location, min_qty, max_qty, unit_cost, v] of PARTS) {
      part[part_no] = add('parts', { part_no, name, category: category_, unit, site_id: site, bin_location, min_qty, max_qty, unit_cost, vendor_id: v ? vendor[v] : null });
    }
    for (const [no, qty] of OPENING_STOCK) {
      add('part_transactions', { part_id: part[no].id, kind: 'Receive', qty, unit_cost: part[no].unit_cost, reference: 'Opening balance', created_at: ago(95) });
    }

    // PM schedules: hour-meter services for the powered trucks, then calendar rounds.
    for (const a of Object.values(asset).filter(x => METER_PM_TYPES.includes(x.mhe_type))) {
      add('pm_schedules', {
        title: `${a.code} – 250-hour service`, instructions: 'Service per manufacturer schedule. Record hour meter on completion.',
        site_id: site, asset_id: a.id, type: 'Preventive', priority: 'High', assigned_to: techId, vendor_id: a.vendor_id,
        trigger_type: 'Meter', meter_interval: 250, meter_last: Math.floor(a.current_meter / 250) * 250, meter_lead: 20, estimated_hours: 3,
        tasks: METER_PM_TASKS
      });
    }
    for (const [title, instructions, target, type, priority, v, every, unit, due, lead, hours, tasks] of CALENDAR_PMS) {
      add('pm_schedules', {
        title, instructions, site_id: site, asset_id: asset[target]?.id ?? null, location_id: loc[target] ?? null, type, priority,
        assigned_to: techId, vendor_id: v ? vendor[v] : null, trigger_type: 'Calendar', interval_value: every, interval_unit: unit,
        next_due: addDays(today, due), lead_days: lead, estimated_hours: hours, tasks
      });
    }

    // Twelve weeks of completed work.
    const kinds = ['Corrective', 'Corrective', 'Corrective', 'Preventive', 'Preventive', 'Inspection', 'Safety', 'Emergency'];
    const pool = Object.values(asset);
    for (let i = 0; i < 64; i++) {
      const created = nowMs - ((3 + Math.floor(random() * 82)) * 24 + Math.floor(random() * 10)) * 3600000;
      const kind = pick(kinds);
      const planned = kind === 'Preventive' || kind === 'Inspection';
      // Planned work spreads evenly; breakdowns lean towards the MHE fleet.
      let a = null;
      let best = Infinity;
      for (const x of pool) {
        const key = planned ? random() : random() * (x.mhe_type ? 0.5 : 1);
        if (key < best) { best = key; a = x; }
      }
      const title = kind === 'Preventive' ? `Scheduled PM – ${a.code}`
        : kind === 'Inspection' ? `Routine inspection – ${a.code}`
        : kind === 'Safety' ? `Safety corrective action – ${a.code}`
        : kind === 'Emergency' ? `Emergency breakdown – ${a.code}`
        : `${pick(['Not working – ', 'Abnormal noise – ', 'Leak found – ', 'Intermittent fault – ', 'Damaged – '])}${a.code}`;
      const priority = kind === 'Emergency' ? 'Critical' : pick(['Low', 'Medium', 'Medium', 'High']);
      // About one PM in seven closes late; repairs take hours to a few days.
      const hoursToClose = planned && random() < 0.14 ? 8 * 24 : kind === 'Emergency' ? 3 + Math.floor(random() * 10) : 4 + Math.floor(random() * 60);
      const wo = add('work_orders', {
        title, type: kind, priority, status: 'Completed', site_id: site, asset_id: a.id, assigned_to: techId,
        due_date: localDate(tz, new Date(created + (planned ? 5 : 2) * 86400000)),
        created_at: at(created), started_at: at(created + 2 * 3600000), completed_at: at(created + hoursToClose * 3600000),
        action_taken: planned ? 'Completed all checklist items; no defects found'
          : pick(['Replaced faulty component and tested', 'Adjusted and re-tested; working normally', 'Tightened fittings and cleaned; leak stopped', 'Repaired wiring and replaced fuse']),
        failure_cause: kind === 'Corrective' || kind === 'Emergency' ? pick(['Wear and tear', 'Operator damage', 'Loose connection', 'Lack of lubrication', 'Unknown']) : null,
        asset_down: kind === 'Emergency',
        downtime_hours: kind === 'Emergency' ? Math.round((3 + random() * 10) * 10) / 10 : null,
        created_by: adminId
      });
      add('wo_labor', {
        work_order_id: wo.id, technician_id: techId, work_date: localDate(tz, new Date(created + 2 * 3600000)),
        hours: Math.round((0.5 + random() * 5) * 2) / 2, rate: 220
      });
    }

    // A few parts issued against that history, and a lighting job.
    const repairs = db.all(`select w.id, w.created_at from work_orders w join assets a on a.id = w.asset_id
                            where w.site_id = ? and w.type in ('Corrective','Emergency') and a.mhe_type is not null
                            order by w.created_at limit 4`, site);
    const issues = [[1, 'HYD-46', 6], [1, 'GRS-EP2', 1], [2, 'LW-85', 2], [3, 'FUSE-355', 1], [3, 'DIST-W20', 2], [4, 'CHN-LH', 3], [4, 'LED-T8', 6]];
    repairs.forEach((w, i) => {
      for (const [k, no, qty] of issues) {
        if (k === i + 1) add('part_transactions', { part_id: part[no].id, kind: 'Issue', qty, work_order_id: w.id, created_at: at(Date.parse(w.created_at) + 3 * 3600000) });
      }
    });
    for (const [no, qty] of [['LED-T8', 32], ['LED-HB150', 9]]) {
      add('part_transactions', { part_id: part[no].id, kind: 'Issue', qty, reference: 'Aisle lighting replacement', created_at: ago(12) });
    }

    // Current open work.
    let dockJob = null;
    for (const [title, description, type, priority, status, code, where, due, age, hold_reason, asset_down, requester_name] of OPEN_WORK) {
      const a = code ? asset[code] : null;
      const wo = add('work_orders', {
        title, description, type, priority, status, site_id: site, asset_id: a?.id ?? null, location_id: (where && loc[where]) || a?.location_id || null,
        assigned_to: status === 'Requested' ? null : techId, due_date: status === 'Requested' ? null : addDays(today, due),
        created_at: ago(age), hold_reason, asset_down, requester_name, created_by: adminId
      });
      if (code === 'DL-03') dockJob = wo;
    }
    add('wo_labor', { work_order_id: dockJob.id, technician_id: techId, hours: 1.5, rate: 220, notes: 'Diagnosis: hydraulic pressure low, suspect lip cylinder seal' });
    add('wo_activity', { work_order_id: dockJob.id, kind: 'comment', body: 'Seal kit requested from DockPro, ETA tomorrow.', author_id: techId });

    // Pre-use checks: yesterday everything passed; today RT-04 has a
    // critical brake fault (locked out) and EPT-03 a load-wheel defect.
    const templates = db.all('select * from checklist_templates where active = 1 order by created_at, rowid').map(r => db.decodeRow('checklist_templates', r));
    const units = db.all(`select id, code, mhe_type, current_meter from assets where site_id = ?
                          and mhe_type in ('Reach Truck','Counterbalance Forklift (Electric)','Electric Pallet Truck','Order Picker') order by code`, site);
    for (const u of units) {
      const tpl = templates.find(t => t.applies_to.includes(u.mhe_type));
      if (!tpl) continue;
      add('checklist_submissions', {
        asset_id: u.id, template_id: tpl.id, operator_name: pick(OPERATORS), shift: 'Shift 1',
        meter_reading: u.current_meter === null ? null : u.current_meter - 7,
        results: tpl.items.map(item => ({ ...item, result: 'OK' })), created_at: ago(1)
      });
      if (['FL-02', 'OP-01', 'RT-06'].includes(u.code)) continue; // not checked yet today
      const results = tpl.items.map(item => {
        if (u.code === 'RT-04' && item.text.startsWith('Service brake')) return { ...item, result: 'Fail', note: 'Pedal spongy, truck rolls on ramp' };
        if (u.code === 'EPT-03' && item.text.startsWith('Load wheels')) return { ...item, result: 'Fail', note: 'Stretch film wrapped on left load roller' };
        return { ...item, result: 'OK' };
      });
      add('checklist_submissions', {
        asset_id: u.id, template_id: tpl.id, operator_name: pick(OPERATORS), shift: 'Shift 1',
        meter_reading: u.current_meter === null ? null : u.current_meter + 1.5, results,
        remarks: u.code === 'RT-04' ? 'Parked at MHE bay and tagged' : null
      });
    }

    // Compliance register
    for (const [name, category_, authority, reference, frequency_months, last, due, v, notes] of COMPLIANCE) {
      add('compliance_items', {
        site_id: site, name, category: category_, authority, reference, frequency_months,
        last_done: last === null ? null : addDays(today, last), next_due: addDays(today, due), responsible_id: adminId,
        vendor_id: v ? vendor[v] : null, notes
      });
    }

    // Work orders for the PMs that are already due.
    store.generatePm(ctx);
    return true;
  });
}

const OPERATIONAL_TABLES = [
  'compliance_events', 'compliance_items', 'checklist_submissions', 'part_transactions', 'parts', 'wo_activity', 'wo_labor', 'wo_tasks',
  'work_orders', 'pm_schedules', 'meter_readings', 'asset_status_log', 'assets', 'contracts', 'vendors', 'locations', 'sites'
];

// Deletes sites, locations, assets, work orders, PM schedules, parts,
// vendors, contracts, checks and the compliance register. Keeps accounts,
// settings, asset categories and checklist templates.
export function clearOperationalData(store) {
  store.transact(null, ctx => {
    for (const t of OPERATIONAL_TABLES) {
      store.db.run(`delete from "${t}"`);
      ctx.changed.add(t);
    }
    store.db.run("delete from counters where name in ('wo_code_seq', 'asset_code_seq', 'part_no_seq')");
  });
}
