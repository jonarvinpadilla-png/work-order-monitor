export const WO_TYPES = ['Corrective', 'Preventive', 'Inspection', 'Emergency', 'Safety', 'Improvement'];
export const WO_STATUSES = ['Requested', 'Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled', 'Rejected'];
export const ACTIVE_STATUSES = ['Open', 'In Progress', 'On Hold'];
export const CLOSED_STATUSES = ['Completed', 'Cancelled', 'Rejected'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export const ASSET_STATUSES = ['Operational', 'Needs Attention', 'Out of Service', 'Decommissioned'];
export const CRITICALITY = ['Low', 'Medium', 'High', 'Critical'];

// Material handling equipment. Delivery fleet (trucks, trailers) is out of scope.
export const MHE_TYPES = [
  'Reach Truck',
  'Counterbalance Forklift (Electric)',
  'Counterbalance Forklift (LPG)',
  'Counterbalance Forklift (Diesel)',
  'Electric Pallet Truck',
  'Electric Stacker',
  'Order Picker',
  'VNA Truck',
  'Tow Tractor',
  'Manual Pallet Jack',
  'Scissor Lift',
  'Boom Lift',
  'Traction Battery',
  'Battery Charger'
];
export const MHE_SUPPORT_TYPES = ['Traction Battery', 'Battery Charger'];
export const POWER_TYPES = ['Electric (lead-acid)', 'Electric (lithium-ion)', 'LPG', 'Diesel', 'Manual', 'Electro-hydraulic'];
export const OWNERSHIP = ['Owned', 'Leased', 'Rented'];

export const TEMP_ZONES = ['Ambient', 'Chiller', 'Freezer'];
export const LOCATION_KINDS = ['Building', 'Storage zone', 'Staging', 'Dock', 'Room', 'Utility', 'Yard'];
export const SHIFTS = ['Shift 1', 'Shift 2', 'Shift 3'];

export const FAILURE_CAUSES = [
  'Wear and tear', 'Operator damage', 'Impact / collision', 'Loose connection', 'Electrical fault',
  'Lack of lubrication', 'Contamination', 'Leak', 'Installation / design', 'Unknown'
];

export const INTERVAL_UNITS = [
  { value: 'day', one: 'day', many: 'days' },
  { value: 'week', one: 'week', many: 'weeks' },
  { value: 'month', one: 'month', many: 'months' },
  { value: 'year', one: 'year', many: 'years' }
];
export const PM_TYPES = ['Preventive', 'Inspection', 'Safety'];

export const PART_UNITS = ['pc', 'set', 'pair', 'L', 'm', 'kg', 'can', 'pail', 'cyl', 'box', 'roll'];
export const STOCK_KINDS = ['Receive', 'Issue', 'Return', 'Adjust'];

export const VENDOR_SERVICES = [
  'MHE rental & maintenance', 'Refrigeration & HVAC', 'Generators & electrical', 'Fire protection & FDAS',
  'Dock levelers & doors', 'Pest control', 'Water & wastewater testing', 'Racking inspection',
  'Civil & building works', 'Janitorial', 'Waste management', 'Security systems', 'Calibration'
];
export const CONTRACT_BILLING = ['Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'Per service', 'One-time'];

export const COMPLIANCE_CATEGORIES = ['Permit', 'License', 'Certificate', 'Inspection', 'Testing', 'Audit', 'Training', 'Report'];
export const ROLES = [
  { value: 'admin', label: 'Admin / Manager', help: 'Everything, including approvals, users and settings' },
  { value: 'technician', label: 'Technician', help: 'Work orders, PM, assets, parts and checklists' },
  { value: 'requester', label: 'Requester', help: 'Submit requests and MHE pre-use checks, follow their own' }
];
export const roleLabel = r => ROLES.find(x => x.value === r)?.label || r;

export const STATUS_TONE = {
  Requested: 'violet', Open: 'outline', 'In Progress': 'info', 'On Hold': 'warn',
  Completed: 'good', Cancelled: 'muted', Rejected: 'muted'
};
export const PRIORITY_TONE = { Low: 'muted', Medium: 'outline', High: 'serious', Critical: 'danger' };
export const ASSET_TONE = { Operational: 'good', 'Needs Attention': 'warn', 'Out of Service': 'danger', Decommissioned: 'muted' };
