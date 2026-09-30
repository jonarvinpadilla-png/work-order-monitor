import { randomUUID } from 'node:crypto';

// Reference data every new database starts with. Admins can edit all of it
// in Settings.

export const CATEGORIES = [
  ['Material Handling Equipment (MHE)', true, 10],
  ['MHE Batteries & Chargers', true, 20],
  ['Refrigeration & Cold Rooms', false, 30],
  ['HVAC & Ventilation', false, 40],
  ['Electrical & Lighting', false, 50],
  ['Power Generation & UPS', false, 60],
  ['Dock Equipment', false, 70],
  ['Doors & Gates', false, 80],
  ['Racking & Storage', false, 90],
  ['Fire Protection & Life Safety', false, 100],
  ['Plumbing, Water & Wastewater', false, 110],
  ['Compressed Air', false, 120],
  ['Building & Civil', false, 130],
  ['Security & CCTV', false, 140],
  ['Weighing & Measuring', false, 150],
  ['Cleaning Equipment', false, 160]
];

const item = (text, critical = true) => ({ text, critical });

export const CHECKLISTS = [
  {
    name: 'Electric Forklift / Reach Truck – Daily Pre-Use',
    description: 'Before the first lift of every shift. A failed critical item means the unit must not be used.',
    applies_to: ['Reach Truck', 'Counterbalance Forklift (Electric)', 'VNA Truck'],
    items: [
      item('Forks, fork pins and carriage – no cracks, bends or heavy wear'),
      item('Mast, lift chains and cylinders – no damage, chains lubricated'),
      item('No hydraulic oil leaks on hoses, fittings or floor'),
      item('Overhead guard and load backrest secure'),
      item('Tyres and wheels – no missing chunks or embedded debris', false),
      item('Battery charged; connector and cables undamaged'),
      item('Battery electrolyte level OK, no spillage', false),
      item('Seat and seatbelt / operator restraint work'),
      item('Horn works'),
      item('Service brake stops the truck smoothly'),
      item('Parking brake holds'),
      item('Steering responds normally'),
      item('Lift, lower, tilt and reach are smooth'),
      item('Travel alarm and blue spot / warning lights work'),
      item('Emergency disconnect (battery isolator) works'),
      item('Capacity plate legible; hour meter and battery gauge work', false)
    ]
  },
  {
    name: 'LPG / Diesel Forklift – Daily Pre-Use',
    description: 'Before the first lift of every shift. A failed critical item means the unit must not be used.',
    applies_to: ['Counterbalance Forklift (LPG)', 'Counterbalance Forklift (Diesel)'],
    items: [
      item('Forks, fork pins and carriage – no cracks, bends or heavy wear'),
      item('Mast, lift chains and cylinders – no damage, chains lubricated'),
      item('No hydraulic oil leaks on hoses, fittings or floor'),
      item('LPG cylinder secured, no gas smell – or no diesel leaks'),
      item('Engine oil, coolant and hydraulic oil levels OK', false),
      item('Tyres and wheels – no missing chunks or embedded debris', false),
      item('Overhead guard and load backrest secure'),
      item('Seatbelt works'),
      item('Horn works'),
      item('Service brake stops the truck smoothly'),
      item('Parking brake holds'),
      item('Steering responds normally'),
      item('Lift, lower and tilt are smooth'),
      item('Lights, reverse alarm and beacon work'),
      item('No excessive exhaust smoke', false),
      item('Capacity plate legible', false)
    ]
  },
  {
    name: 'Electric Pallet Truck / Stacker – Daily Pre-Use',
    description: 'Before first use each shift.',
    applies_to: ['Electric Pallet Truck', 'Electric Stacker', 'Tow Tractor'],
    items: [
      item('Forks / platform – no cracks or bends'),
      item('Load wheels and drive wheel – no damage, no wrapped stretch film', false),
      item('Battery charged; connector and cables undamaged'),
      item('No hydraulic oil leaks'),
      item('Tiller buttons work and tiller springs back up (brake on)'),
      item('Belly (anti-crush) reverse button works'),
      item('Emergency stop button works'),
      item('Horn works'),
      item('Brake stops the truck smoothly'),
      item('Lift and lower are smooth'),
      item('Stackers: mast and chains undamaged (N/A for pallet trucks)'),
      item('Covers and guards secure', false),
      item('Capacity plate legible', false)
    ]
  },
  {
    name: 'Order Picker – Daily Pre-Use',
    description: 'Before first use each shift. Never operate without the harness attached.',
    applies_to: ['Order Picker'],
    items: [
      item('Harness, lanyard and anchor point in good condition'),
      item('Platform gates / guardrails close and interlock'),
      item('Forks and pallet clamp undamaged'),
      item('Mast and chains undamaged'),
      item('No hydraulic oil leaks'),
      item('Battery charged; connector and cables undamaged'),
      item('Emergency stop and emergency lowering work'),
      item('Horn, lights and travel alarm work'),
      item('Brakes stop the truck smoothly'),
      item('Steering responds normally'),
      item('Lift and lower controls are smooth'),
      item('Tyres and wheels in good condition', false),
      item('Aisle guidance / height limit sensors work (if fitted)', false)
    ]
  },
  {
    name: 'Manual Pallet Jack – Weekly Check',
    description: 'Weekly, or before use if the jack has been idle.',
    applies_to: ['Manual Pallet Jack'],
    items: [
      item('Forks – no cracks or bends'),
      item('Handle and release lever work; forks lower under control'),
      item('Wheels and rollers turn freely, no wrapped stretch film', false),
      item('No hydraulic oil leaks', false),
      item('Pump raises forks to full height', false)
    ]
  },
  {
    name: 'Scissor / Boom Lift (MEWP) – Pre-Use',
    description: 'Before every use. Harness required in boom lifts.',
    applies_to: ['Scissor Lift', 'Boom Lift'],
    items: [
      item('Guardrails, gate and toe boards secure'),
      item('Harness anchor points in good condition'),
      item('Emergency stop works (platform and ground controls)'),
      item('Emergency lowering works'),
      item('Tilt alarm and descent alarm work'),
      item('No hydraulic oil leaks'),
      item('Controls return to neutral when released'),
      item('Pothole protection / outriggers deploy'),
      item('Tyres and wheels in good condition', false),
      item('Battery charged; cables undamaged', false),
      item('Operating manual and warning decals present', false)
    ]
  }
];

export function seedReferenceData(db) {
  for (const [name, isMhe, sort] of CATEGORIES) {
    db.run('insert into asset_categories (id, name, is_mhe, sort) values (?, ?, ?, ?) on conflict (name) do nothing',
      randomUUID(), name, isMhe ? 1 : 0, sort);
  }
  for (const t of CHECKLISTS) {
    db.run('insert into checklist_templates (id, name, description, applies_to, items) values (?, ?, ?, ?, ?) on conflict (name) do nothing',
      randomUUID(), t.name, t.description, JSON.stringify(t.applies_to), JSON.stringify(t.items));
  }
}
