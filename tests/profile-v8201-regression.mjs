import fs from 'node:fs';
import assert from 'node:assert/strict';
import { matchAiscProfileData } from '../public/js/profile-standard-matcher.js';

const db=JSON.parse(fs.readFileSync(new URL('../public/data/aisc-shapes-v16.json',import.meta.url),'utf8'));
db.index=Object.fromEntries(db.fields.map((f,i)=>[String(f),i]));

// Real measured fingerprint from 25021600_500-00-11_0.step.
const u2x1={
  spanU:50.8,spanV:25.4,length:1219.2,
  stockSectionArea:469.6609328459772,averageSectionArea:465.1662633533291,
  sectionAreaSampleCount:12,sectionComponentCount:1,sectionHoleCount:0,
  sectionCentroidOffsetU:0,sectionCentroidOffsetV:0.18718,
  longitudinalCylinderCount:4,longitudinalPlaneCount:12,traceCount:12
};
const u=matchAiscProfileData(u2x1,db);
assert.equal(u?.type,'U');
assert.equal(u?.imperialLabel,'U2X1X3/16');
assert.ok(u?.confidence>=0.85);

// A true hollow section remains eligible for the AISC HSS family.
const hss={
  spanU:50.8,spanV:25.4,length:1200,
  stockSectionArea:545,averageSectionArea:545,
  sectionAreaSampleCount:12,sectionComponentCount:1,sectionHoleCount:1,
  sectionCentroidOffsetU:0,sectionCentroidOffsetV:0,
  longitudinalCylinderCount:8,longitudinalPlaneCount:8,traceCount:16
};
const h=matchAiscProfileData(hss,db);
assert.equal(h?.type,'HSS');
assert.equal(h?.imperialLabel,'HSS2X1X3/16');

// Dimensions + rounded corners alone are insufficient to invent a U channel.
const centered={...u2x1,sectionCentroidOffsetU:0.01,sectionCentroidOffsetV:0.01};
assert.equal(matchAiscProfileData(centered,db),null);

console.log('V8.20.1 profile regression: PASS');
