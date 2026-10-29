/* ---------- Mascotte : singe violet sans yeux (rig SVG paramétrique, vue de profil) ---------- */
const MC = {main:'#7B4FE6', far:'#5A35B8', light:'#D4C3FF', ink:'#2A1758', ear:'#B79CF5', hub:'#B9A8E6'};
/* angle a (degrés) -> vecteur : 0 = vers le bas, 90 = vers l'avant, 180 = vers le haut, -90 = vers l'arrière */
const DIR = a => [Math.sin(a*Math.PI/180), Math.cos(a*Math.PI/180)];
const POSES = {
  stand:   {label:'Debout', hip:[50,60], torso:180, arms:[[10,6],[-6,-4]], legs:[[3,-2],[-3,2]], prop:'none'},
  flex:    {label:'Biceps (fierté)', hip:[50,60], torso:180, arms:[[95,172],[78,165]], legs:[[6,-2],[-6,2]], prop:'none'},
  squat:   {label:'Squat', hip:[44,75], torso:145, arms:[[-50,165],[-45,160]], legs:[[80,-30],[75,-28]], prop:'barbell'},
  hinge:   {label:'Soulevé de terre', hip:[38,62], torso:115, arms:[[0,0],[3,1]], legs:[[30,-10],[26,-8]], prop:'barbell'},
  bench:   {label:'Développé couché', hip:[66,66], torso:-90, arms:[[180,180],[176,178]], legs:[[60,0],[54,4]], prop:'barbell', bench:[20,72,52], notail:true},
  pushup:  {label:'Pompes', hip:[46,77], torso:117.7, arms:[[0,0],[3,0]], legs:[[-62.3,-62.3],[-60,-60]], feet:[-100,-100], prop:'none'},
  plank:   {label:'Gainage', hip:[44,84], torso:104, arms:[[0,90],[2,92]], legs:[[-76,-76],[-74,-74]], feet:[-100,-100], prop:'none'},
  press:   {label:'Développé militaire', hip:[50,61], torso:180, arms:[[172,178],[166,176]], legs:[[4,-2],[-4,2]], prop:'dumbbells'},
  row:     {label:'Rowing', hip:[38,63], torso:125, arms:[[-35,25],[-28,18]], legs:[[22,-12],[18,-10]], prop:'dumbbell'},
  pullup:  {label:'Traction', hip:[50,52], torso:180, arms:[[25,175],[15,170]], legs:[[12,-40],[6,-35]], prop:'bar'},
  lunge:   {label:'Fente', hip:[46,74.6], torso:180, arms:[[3,0],[-3,0]], legs:[[85,0],[-20,-90]], feet:[90,-90], prop:'dumbbells'},
  curl:    {label:'Curl biceps', hip:[50,60], torso:180, arms:[[8,160],[2,30]], legs:[[3,-2],[-3,2]], prop:'dumbbells'},
  triceps: {label:'Extension triceps', hip:[50,61], torso:180, arms:[[168,-12],[160,-18]], legs:[[4,-2],[-4,2]], prop:'dumbbell'},
  bridge:  {label:'Hip thrust', hip:[58,67.5], torso:-95, arms:[[15,40],[10,35]], legs:[[59,0],[54,3]], prop:'hipbar', bench:[10,72,30], notail:true},
  raise:   {label:'Élévations', hip:[50,61], torso:180, arms:[[95,95],[82,86]], legs:[[3,-2],[-3,2]], prop:'dumbbells'},
  seated:  {label:'Machine assise', hip:[42,62], torso:172, arms:[[8,40],[4,35]], legs:[[90,75],[88,70]], prop:'none', seat:[24,65,30]},
  cardio:  {label:'Cardio / course', hip:[50,57], torso:168, arms:[[-40,60],[45,150]], legs:[[50,-20],[-30,-80]], prop:'none'}
};
const POSE_RULES = [
  ['seated',  /(leg ?curl|leg ?extension|presse|machine|adducteur|abducteur|mollet assis)/],
  ['triceps', /(triceps|barre au front|nuque|kickback|dips)/],
  ['press',   /(militaire|overhead|epaule|arnold|developpe assis)/],
  ['bench',   /(couche|bench|developpe|pec|ecarte)/],
  ['pullup',  /(traction|pull.?up|chin|tirage vertical|poulie haute|lat)/],
  ['row',     /(row|tirage horizontal|tirage|oiseau|face pull)/],
  ['hinge',   /(souleve|deadlift|rdl|roumain|good morning|swing)/],
  ['lunge',   /(fente|lunge|bulgare|split|step)/],
  ['squat',   /(squat|goblet)/],
  ['curl',    /(curl|biceps|marteau)/],
  ['bridge',  /(hip thrust|thrust|pont|bridge|fessier)/],
  ['pushup',  /(pompe|push.?up)/],
  ['plank',   /(gainage|planche|plank|abdo|crunch|releve de jambes|russian)/],
  ['raise',   /(elevation|lateral|frontal|raise)/],
  ['cardio',  /(velo|course|tapis|rameur|cardio|corde|burpee|jump|saut|marche|elliptique|echauffement)/]
];
function poseFor(ex){
  if(ex && ex.pose && ex.pose !== 'auto' && POSES[ex.pose]) return ex.pose;
  const s = String(ex && ex.nom || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  for(const [k, re] of POSE_RULES) if(re.test(s)) return k;
  return 'stand';
}
function mascotSVG(key, size, label){
  const P = POSES[key] || POSES.stand;
  const add = (p, a, l) => { const d = DIR(a); return [p[0] + d[0]*l, p[1] + d[1]*l]; };
  const H = P.hip, S = add(H, P.torso, 26), C = add(S, P.torso, 11);
  const rot = 180 - P.torso;
  const f = n => n.toFixed(1);
  const line = (a, b, w, col) => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const arm = (i, col) => {
    const sh = i ? [S[0]-1.5, S[1]-1] : S;
    const e = add(sh, P.arms[i][0], 14), h = add(e, P.arms[i][1], 13);
    return {svg: line(sh, e, 6, col) + line(e, h, 5.5, col) + `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="3.4" fill="${i?MC.far:MC.far}"/>`, hand:h};
  };
  const leg = (i, col) => {
    const hp = i ? [H[0]-1.5, H[1]] : H;
    const k = add(hp, P.legs[i][0], 16), a = add(k, P.legs[i][1], 16);
    const t = add(a, (P.feet ? P.feet[i] : 90), 6);
    return line(hp, k, 7, col) + line(k, a, 6.5, col) + line(a, t, 5, col);
  };
  const plate = (p, r) => `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${MC.ink}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r*0.28}" fill="${MC.hub}"/>`;
  const farArm = arm(1, MC.far), nearArm = arm(0, MC.main);
  let back = '', front = '';
  if(P.bench){ const [x,y,w] = P.bench; back += `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2" fill="${MC.ink}"/><rect x="${x+4}" y="${y+5}" width="3" height="${93-y-5}" fill="${MC.ink}"/><rect x="${x+w-7}" y="${y+5}" width="3" height="${93-y-5}" fill="${MC.ink}"/>`; }
  if(P.seat){ const [x,y,w] = P.seat; back += `<rect x="${x}" y="${y+2}" width="${w}" height="6" rx="2" fill="${MC.ink}"/><rect x="${x+w/2-2}" y="${y+8}" width="4" height="${93-y-8}" fill="${MC.ink}"/><rect x="${x-2}" y="${y-26}" width="5" height="32" rx="2" fill="${MC.ink}"/>`; }
  if(P.prop === 'bar'){ const y = nearArm.hand[1]; back += `<rect x="14" y="${f(y-2)}" width="72" height="4" rx="2" fill="${MC.ink}"/><rect x="14" y="${f(y)}" width="3" height="${f(93-y)}" fill="${MC.ink}"/><rect x="83" y="${f(y)}" width="3" height="${f(93-y)}" fill="${MC.ink}"/>`; }
  if(P.prop === 'barbell') front += plate(nearArm.hand, 9);
  if(P.prop === 'dumbbell') front += plate(nearArm.hand, 4.6);
  if(P.prop === 'dumbbells'){ back += plate(farArm.hand, 4.6); front += plate(nearArm.hand, 4.6); }
  if(P.prop === 'hipbar') front += plate([H[0]+2, H[1]-11], 9);
  const tail = `<g transform="rotate(${f(rot)} ${f(H[0])} ${f(H[1])})"><path d="M${f(H[0]-3)} ${f(H[1]-2)} C${f(H[0]-16)} ${f(H[1]+6)} ${f(H[0]-26)} ${f(H[1]-4)} ${f(H[0]-21)} ${f(H[1]-14)} S${f(H[0]-11)} ${f(H[1]-17)} ${f(H[0]-13)} ${f(H[1]-11)}" fill="none" stroke="${MC.far}" stroke-width="3.6" stroke-linecap="round"/></g>`;
  const body = `<g transform="rotate(${f(rot)} ${f(H[0])} ${f(H[1])})">${line(H,[H[0],H[1]-26],15,MC.main)}<ellipse cx="${f(H[0]+2.6)}" cy="${f(H[1]-12)}" rx="4.6" ry="9" fill="${MC.light}"/></g>`;
  const head = `<g transform="translate(${f(C[0])} ${f(C[1])}) rotate(${f(rot)})">
    <circle cx="-6.2" cy="-4.6" r="4" fill="${MC.main}"/><circle cx="-6.2" cy="-4.6" r="2.2" fill="${MC.ear}"/>
    <path d="M-2 -9.6 q1.6 -3 4 -1.6 q-0.4 -2.6 2.6 -2" fill="none" stroke="${MC.main}" stroke-width="1.8" stroke-linecap="round"/>
    <circle r="9.6" fill="${MC.main}"/>
    <ellipse cx="4.8" cy="2.2" rx="5.8" ry="4.8" fill="${MC.light}"/>
    <path d="M5.4 4.4 q2.2 1.8 4.4 0" fill="none" stroke="${MC.ink}" stroke-width="1.1" stroke-linecap="round"/></g>`;
  const shadow = `<ellipse cx="${f(H[0])}" cy="93.5" rx="24" ry="2.4" fill="${MC.ink}" opacity="0.12"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}>${shadow}${back}${P.notail?'':tail}${leg(1,MC.far)}${farArm.svg}${body}${leg(0,MC.main)}${head}${nearArm.svg}${front}</svg>`;
}
