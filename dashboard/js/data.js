// Hyderabad reference data. Positions are approximate, for demonstration only.
export const CENTER = { lat: 17.405, lon: 78.465 };
export const K = 110; // world units per degree
export const toXZ = (lat, lon) => ({ x: (lon - CENTER.lon) * K, z: -(lat - CENTER.lat) * K });
export const distKm = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export const AREAS = [
  { id: 'SEC', name: 'Secunderabad', lat: 17.4399, lon: 78.4983, density: 1.0, risk: 1.0 },
  { id: 'BEG', name: 'Begumpet', lat: 17.4447, lon: 78.4664, density: 0.8, risk: 0.7 },
  { id: 'AMR', name: 'Ameerpet', lat: 17.4375, lon: 78.4483, density: 1.0, risk: 0.75 },
  { id: 'BAN', name: 'Banjara Hills', lat: 17.4156, lon: 78.4347, density: 0.7, risk: 0.35 },
  { id: 'JUB', name: 'Jubilee Hills', lat: 17.4326, lon: 78.4071, density: 0.6, risk: 0.25 },
  { id: 'HTC', name: 'HITEC City', lat: 17.4435, lon: 78.3772, density: 0.8, risk: 0.2, tall: true },
  { id: 'KUK', name: 'Kukatpally', lat: 17.4849, lon: 78.4138, density: 0.9, risk: 0.4 },
  { id: 'MUS', name: 'Musheerabad', lat: 17.4180, lon: 78.4960, density: 1.0, risk: 1.0 },
  { id: 'CHA', name: 'Charminar', lat: 17.3616, lon: 78.4747, density: 1.0, risk: 0.95 },
  { id: 'MAL', name: 'Malakpet', lat: 17.3713, lon: 78.5007, density: 0.9, risk: 0.8 },
  { id: 'ABD', name: 'Abids', lat: 17.3920, lon: 78.4760, density: 0.9, risk: 0.6 },
  { id: 'MEH', name: 'Mehdipatnam', lat: 17.3950, lon: 78.4390, density: 0.8, risk: 0.45 },
  { id: 'DIL', name: 'Dilsukhnagar', lat: 17.3688, lon: 78.5247, density: 0.9, risk: 0.55 },
  { id: 'LBN', name: 'LB Nagar', lat: 17.3457, lon: 78.5522, density: 0.7, risk: 0.35 },
  { id: 'UPP', name: 'Uppal', lat: 17.4058, lon: 78.5591, density: 0.7, risk: 0.4 },
  { id: 'TAR', name: 'Tarnaka', lat: 17.4271, lon: 78.5390, density: 0.7, risk: 0.5 },
  { id: 'GAC', name: 'Gachibowli', lat: 17.4401, lon: 78.3489, density: 0.6, risk: 0.15, tall: true },
];

export const LAKE = { name: 'Hussain Sagar', lat: 17.4239, lon: 78.4738, rLat: 0.011, rLon: 0.014 };
export const RIVER = [[17.384, 78.36], [17.378, 78.40], [17.373, 78.44], [17.369, 78.47], [17.367, 78.49], [17.362, 78.515], [17.356, 78.545], [17.352, 78.575]];

export const HOSPITALS = [
  { id: 'H1', name: 'Gandhi Hospital', area: 'Musheerabad', lat: 17.4245, lon: 78.5005, beds: 42, trauma: true },
  { id: 'H2', name: 'Osmania General Hospital', area: 'Afzal Gunj', lat: 17.3725, lon: 78.4747, beds: 35, trauma: true },
  { id: 'H3', name: 'NIMS', area: 'Punjagutta', lat: 17.4239, lon: 78.4519, beds: 28, trauma: true },
  { id: 'H4', name: 'Apollo Hospitals', area: 'Jubilee Hills', lat: 17.4156, lon: 78.4106, beds: 19, trauma: true },
  { id: 'H5', name: 'Yashoda Hospitals', area: 'Secunderabad', lat: 17.4410, lon: 78.4960, beds: 14, trauma: false },
  { id: 'H6', name: 'KIMS Hospitals', area: 'Secunderabad', lat: 17.4291, lon: 78.4882, beds: 16, trauma: true },
  { id: 'H7', name: 'CARE Hospitals', area: 'Banjara Hills', lat: 17.4122, lon: 78.4485, beds: 12, trauma: false },
  { id: 'H8', name: 'Continental Hospitals', area: 'Gachibowli', lat: 17.4170, lon: 78.3400, beds: 21, trauma: true },
];

export const AGENCIES = [
  { id: 'A1', name: 'GHMC Disaster Response Force', role: 'Search & rescue teams', icon: '⛑' },
  { id: 'A2', name: 'Telangana Fire & Emergency Services', role: 'Fire, collapse, extraction', icon: '🚒' },
  { id: 'A3', name: '108 Ambulance Control', role: 'Ambulance dispatch', icon: '🚑' },
  { id: 'A4', name: 'Hyderabad City Police Control', role: 'Cordons, traffic, evacuation', icon: '🚓' },
  { id: 'A5', name: 'NDRF (requested via state)', role: 'Heavy rescue, specialist teams', icon: '🛟' },
];

export const COMMAND_POST = { name: 'VOID-NAV Command · Parade Grounds', lat: 17.4446, lon: 78.4997 };

// Gateway + relay mesh (simulated positions)
export const MESH = {
  nodes: [
    { id: 'GW', kind: 'gw', lat: 17.4446, lon: 78.4997 },
    { id: 'R1', kind: 'relay', lat: 17.4300, lon: 78.4930 },
    { id: 'R2', kind: 'relay', lat: 17.4040, lon: 78.5080 },
    { id: 'R3', kind: 'relay', lat: 17.4380, lon: 78.4600 },
    { id: 'R4', kind: 'relay', lat: 17.3950, lon: 78.4850 },
    { id: 'R5', kind: 'relay', lat: 17.3760, lon: 78.4780 },
    { id: 'R6', kind: 'relay', lat: 17.3800, lon: 78.5050 },
    { id: 'R7', kind: 'relay', lat: 17.4200, lon: 78.4700 },
    { id: 'N1', kind: 'node', lat: 17.4180, lon: 78.4960 },
    { id: 'N2', kind: 'node', lat: 17.3640, lon: 78.4740 },
    { id: 'N3', kind: 'node', lat: 17.3713, lon: 78.5007 },
    { id: 'N4', kind: 'node', lat: 17.4375, lon: 78.4483 },
  ],
  range: 0.032, // degrees, approx link range for the sim
};

export const MSG_TEMPLATES = [
  { cat: 'TRAPPED', prio: 0, injured: 'YES', text: 'leg stuck under slab pls help', lang: 'en' },
  { cat: 'TRAPPED', prio: 0, injured: 'NO', text: 'మా అమ్మ కింద చిక్కుకుంది, సాయం చేయండి', lang: 'te', gloss: 'Our mother is trapped below, please help' },
  { cat: 'INJURED', prio: 0, injured: 'YES', text: 'बच्चा घायल है, खून बह रहा है', lang: 'hi', gloss: 'Child is injured, bleeding', flags: ['BLEEDING', 'CHILD'] },
  { cat: 'RESCUE', prio: 0, injured: 'MAYBE', text: 'building cracked 6 ppl inside 2nd flr', lang: 'en' },
  { cat: 'TRAPPED', prio: 0, injured: 'YES', text: 'stairs collapsed cant get down, my father hurt', lang: 'en' },
  { cat: 'RESCUE', prio: 0, injured: 'NO', text: 'gas smell near stairs, scared to move', lang: 'en', flags: ['GAS'] },
  { cat: 'MEDICAL', prio: 1, injured: 'YES', text: 'old man cant walk, needs insulin', lang: 'en', flags: ['ELDERLY'] },
  { cat: 'MEDICAL', prio: 1, injured: 'YES', text: 'ప్రెగ్నెంట్ లేడీ ఉంది, హాస్పిటల్ కావాలి', lang: 'te', gloss: 'Pregnant woman here, need hospital' },
  { cat: 'MEDICAL', prio: 1, injured: 'NO', text: 'दादी को सांस लेने में तकलीफ', lang: 'hi', gloss: 'Grandmother has difficulty breathing', flags: ['ELDERLY'] },
  { cat: 'FOOD_WATER', prio: 2, injured: 'NO', text: 'no water since morning, 3 kids', lang: 'en', flags: ['CHILD'] },
  { cat: 'FOOD_WATER', prio: 2, injured: 'NO', text: 'తాగునీరు లేదు, 10 మంది ఉన్నాం', lang: 'te', gloss: 'No drinking water, 10 of us here' },
  { cat: 'SAFE', prio: 3, injured: 'NO', text: 'we r safe at school ground, tell family', lang: 'en' },
  { cat: 'SAFE', prio: 3, injured: 'NO', text: 'हम सुरक्षित हैं, घर पर बता दो', lang: 'hi', gloss: 'We are safe, tell family at home' },
  { cat: 'TRAPPED', prio: 0, injured: 'YES', text: '', lang: 'en', panic: true },
];

export const CAT_LABEL = { TRAPPED: 'Trapped', INJURED: 'Injured', RESCUE: 'Needs rescue', MEDICAL: 'Medical', FOOD_WATER: 'Food / water', SAFE: 'Safe', OTHER: 'Other' };
export const PRIO_LABEL = ['CRITICAL', 'URGENT', 'NEEDS', 'INFO'];
