import {
  NEARNESS_RADIUS_KM,
  nearnessPoints,
  rankHospitals,
  scoreHospital,
  type ScoringHospital,
} from '../src/services/readinessService';

let failed = 0;
const check = (name: string, passed: boolean, detail = '') => {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
  if (!passed) failed += 1;
};

console.log('Nearness curve: 20 × max(0, 1 − d / 25)');
console.table(
  [0, 5, 10, 12.5, 20, 25, 40].map((km) => ({ km, points: nearnessPoints(km) })),
);

check('0 km scores 20', nearnessPoints(0) === 20);
check('5 km scores 16', nearnessPoints(5) === 16);
check('12.5 km scores 10', nearnessPoints(12.5) === 10);
check('20 km scores 4', nearnessPoints(20) === 4);
check('25 km scores 0', nearnessPoints(25) === 0);
check('beyond 25 km never negative', nearnessPoints(40) === 0);
check('radius constant is 25', NEARNESS_RADIUS_KM === 25);

const baseHospital: ScoringHospital = {
  hospitalId: 'HOSP-T',
  name: 'Test Hospital',
  lat: 15.3647,
  lon: 75.124,
  totalBeds: 120,
  freeBeds: 8,
  bloodStock: [
    { bloodGroup: 'O+', units: 6 },
    { bloodGroup: 'O-', units: 0 },
  ],
  medicineStock: [{ medicine: 'Adrenaline', units: 4 }],
};

const at = (lat: number, lon: number) => ({ ...baseHospital, lat, lon });

const request = {
  requestId: 'REQ-TEST-0001',
  lat: 15.3647,
  lon: 75.124,
  bloodGroupNeeded: 'O+',
  medicineNeeded: 'Adrenaline',
};

const exact = scoreHospital(at(15.3647, 75.124), request);
console.log('\nExact-match hospital:', exact.reason);
check('exact match scores 100', exact.score === 100);
check('blood awards 40', exact.components.blood.points === 40);
check('medicine awards 40', exact.components.medicine.points === 40);
check('nearness awards 20 at 0 km', exact.components.nearness.points === 20);
check('exact match is not partial', exact.partialFlag === false);

const missingBlood = scoreHospital(at(15.3647, 75.124), {
  ...request,
  bloodGroupNeeded: 'O-',
});
console.log('Missing blood hospital:', missingBlood.reason);
check('zero-unit blood scores 0', missingBlood.components.blood.points === 0);
check('missing blood flags partial readiness', missingBlood.partialFlag === true);
check('missing blood still scores medicine', missingBlood.components.medicine.points === 40);

const noRequirements = scoreHospital(at(15.3647, 75.124), {
  ...request,
  bloodGroupNeeded: null,
  medicineNeeded: null,
});
console.log('No requirements hospital:', noRequirements.reason);
check('unrequired blood awards full 40', noRequirements.components.blood.points === 40);
check(
  'unrequired medicine awards full 40',
  noRequirements.components.medicine.points === 40,
);
check('no requirements is never partial', noRequirements.partialFlag === false);

const caseInsensitive = scoreHospital(at(15.3647, 75.124), {
  ...request,
  medicineNeeded: 'adrenaline',
});
check('medicine match is case-insensitive', caseInsensitive.components.medicine.points === 40);

const far = scoreHospital(at(15.5, 75.124), request);
check(
  'nearness follows the curve at a real distance',
  far.components.nearness.points === nearnessPoints(far.distanceKm),
);
check(
  'components always sum to the score',
  Math.round((far.components.blood.points + far.components.medicine.points + far.components.nearness.points) * 100) / 100 === far.score,
);

const ranked = rankHospitals([
  { ...exact, name: 'Mid', score: 90, distanceKm: 4 },
  { ...exact, name: 'Best', score: 96.4, distanceKm: 6 },
  { ...exact, name: 'Near tie', score: 90, distanceKm: 2 },
]);
console.log('\nRanked:', ranked.map((hospital) => `${hospital.rank}:${hospital.name}`).join(' > '));
check('highest score ranks first', ranked[0]?.name === 'Best');
check('equal scores fall back to nearer hospital', ranked[1]?.name === 'Near tie');
check('ranks are 1..n', ranked.every((hospital, index) => hospital.rank === index + 1));
check(
  'every score is inside 0..100',
  ranked.every((hospital) => hospital.score >= 0 && hospital.score <= 100),
);

if (failed > 0) {
  console.error(`\n${failed} readiness check(s) failed`);
  process.exit(1);
}
console.log('\nall readiness checks passed');
