import { REGION_SITES, REGION_START, REGION_ROADS, heightAt } from './region-layout.mjs';
import './field-map.css';

export type MapSnapshot = {
  position: { x: number; z: number };
  yaw: number;
  completed: string[];
  discovered: string[];
  tracked: string | null;
  patrols: { x: number; z: number; alive: boolean }[];
  intel: boolean;
  allies?: { x: number; z: number; alive: boolean }[];
};

const NS = 'http://www.w3.org/2000/svg';
const EXTENT = 225;
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

// The map samples the same height function and water level as the playable region.
function terrainImage() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 600;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(600, 600);
  for (let row = 0; row < 600; row++) {
    for (let col = 0; col < 600; col++) {
      const x = col / 600 * EXTENT * 2 - EXTENT;
      const z = row / 600 * EXTENT * 2 - EXTENT;
      const h = heightAt(x, z), index = (row * 600 + col) * 4;
      const land = h > -2.5;
      const relief = land ? Math.min(20, Math.max(0, h + 2.5)) : 0;
      const slope = land ? Math.max(-7, Math.min(7, (heightAt(x - 1, z - 1) - h) * 9)) : 0;
      pixels.data[index] = land ? 58 + relief * 2 + slope : 23;
      pixels.data[index + 1] = land ? 65 + relief * 2 + slope : 31;
      pixels.data[index + 2] = land ? 63 + relief * 1.7 + slope : 35;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

function contourPath(level: number) {
  let path = '';
  const step = 4;
  // Triangulation removes ambiguous saddle cells without inventing terrain.
  for (let z = -EXTENT; z < EXTENT; z += step) {
    for (let x = -EXTENT; x < EXTENT; x += step) {
      const corners = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      const values = corners.map(([cx, cz]) => heightAt(cx, cz));
      for (const triangle of [[0, 1, 2], [0, 2, 3]]) {
        const hits: number[][] = [];
        for (let i = 0; i < 3; i++) {
          const a = triangle[i], b = triangle[(i + 1) % 3];
          if ((values[a] > level) === (values[b] > level)) continue;
          const f = (level - values[a]) / (values[b] - values[a]);
          hits.push([corners[a][0] + (corners[b][0] - corners[a][0]) * f, corners[a][1] + (corners[b][1] - corners[a][1]) * f]);
        }
        if (hits.length === 2) path += `M${hits[0][0].toFixed(1)},${hits[0][1].toFixed(1)}L${hits[1][0].toFixed(1)},${hits[1][1].toFixed(1)}`;
      }
    }
  }
  return path;
}

export function createFieldMap(container: HTMLElement, callbacks: { onTrack: (id: string) => void; onClose: () => void }) {
  const overlay = document.createElement('section');
  overlay.className = 'field-map';
  overlay.dataset.testid = 'field-map';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'field-map-title');
  overlay.innerHTML = `<header class="fm-header"><div><p class="fm-eyebrow">BLACKLINE / Contested colony</p><h2 id="field-map-title">Ash Coast</h2></div><button type="button" class="fm-close" aria-label="Close field map">Back to field <span>ESC ↗</span></button></header><div class="fm-body"><div class="fm-map-column"><div class="fm-chart"></div><div class="fm-legend"><span><i class="fm-key fm-you"></i>Your position</span><span><i class="fm-key fm-location"></i>Location</span><span><i class="fm-key fm-road"></i>Road</span><span><i class="fm-key fm-ally"></i>Squad</span><span>B — Squad hold / follow</span><span class="fm-intel-state">Patrol intelligence unavailable</span></div><p class="fm-map-note">Contour interval 3 m · Dashed line shows direct bearing, not a navigation route.</p></div><aside class="fm-missions" aria-label="Regional operations"><div class="fm-mission-heading"><p class="fm-eyebrow">Field objectives</p><span class="fm-count"></span></div><p class="fm-instruction">Set a bearing. Travel there on foot.</p><div class="fm-site-list"></div><div class="fm-operational-note"><span>One connected region</span><p>Complete operations in any order. Each objective changes conditions across the island.</p></div></aside></div><footer class="fm-footer"><span class="fm-coordinate"></span><span>FIELD MAP <b>01 / ASH COAST</b></span></footer>`;
  container.append(overlay);
  const get = <T extends Element>(selector: string) => overlay.querySelector<T>(selector)!;
  const closeButton = get<HTMLButtonElement>('.fm-close');
  closeButton.addEventListener('click', callbacks.onClose);
  const chart = svgElement('svg', { viewBox: '-225 -225 450 450', role: 'img', 'aria-label': 'Ash Coast terrain, roads, operation sites, and current position', preserveAspectRatio: 'xMidYMid meet' });
  chart.classList.add('fm-svg');
  get('.fm-chart').append(chart);
  chart.append(svgElement('image', { href: terrainImage(), x: '-225', y: '-225', width: '450', height: '450' }));
  for (const level of [-2.5, 0, 3, 6, 9, 12, 15]) chart.append(svgElement('path', { d: contourPath(level), fill: 'none', stroke: level === -2.5 ? '#bac7bc' : '#b8c0b5', 'stroke-opacity': level === -2.5 ? '.65' : '.17', 'stroke-width': level === -2.5 ? '.8' : '.45' }));
  let gridPath = '';
  for (let p = -200; p <= 200; p += 50) gridPath += `M${p},-225V225M-225,${p}H225`;
  chart.append(svgElement('path', { d: gridPath, stroke: '#dbe1d5', 'stroke-opacity': '.08', 'stroke-width': '.5', fill: 'none' }));
  for (const road of REGION_ROADS) chart.append(svgElement('polyline', { points: road.map(([x, z]) => `${x},${z}`).join(' '), fill: 'none', stroke: '#d1c5a2', 'stroke-opacity': '.58', 'stroke-width': '1.2', 'stroke-linejoin': 'round' }));
  const bearing = svgElement('line', { x1: '0', y1: '0', x2: '0', y2: '0', stroke: '#f0ba77', 'stroke-width': '1', 'stroke-dasharray': '3 4' });
  chart.append(bearing);
  const patrolLayer = svgElement('g', { fill: '#e67d68' });
  chart.append(patrolLayer);
  const allyLayer = svgElement('g', { fill: '#8ccbd1', stroke: '#182d32', 'stroke-width': '.7' });
  chart.append(allyLayer);
  const siteNodes = REGION_SITES.map((site, i) => {
    const group = svgElement('g', { transform: `translate(${site.x} ${site.z})` });
    const ring = svgElement('circle', { r: '7', fill: '#222c2d', stroke: '#e4dec8', 'stroke-width': '1' });
    const number = svgElement('text', { x: '0', y: '2.7', 'text-anchor': 'middle', fill: '#e4dec8', 'font-size': '8', 'font-weight': '600' });
    number.textContent = `0${i + 1}`;
    const label = svgElement('text', { x: '11', y: '3', fill: '#ede6d7', 'font-size': '7', 'paint-order': 'stroke', stroke: '#232f30', 'stroke-width': '2.4', 'stroke-linejoin': 'round' });
    label.textContent = site.name;
    group.append(ring, number, label);chart.append(group);
    return { ring, number };
  });
  chart.append(svgElement('circle', { cx: String(REGION_START.x), cy: String(REGION_START.z), r: '2', fill: '#9eadab' }));
  const landing = svgElement('text', { x: String(REGION_START.x + 7), y: String(REGION_START.z + 3), fill: '#afbbb6', 'font-size': '7' });
  landing.textContent = 'South Landing';chart.append(landing);
  const north = svgElement('text', { x: '-204', y: '-193', fill: '#e8dfcb', 'font-size': '10', 'text-anchor': 'middle' });
  north.textContent = 'N';chart.append(north);
  chart.append(svgElement('path', { d: 'M-204,-186v22m-4,-16 4,-6 4,6M146,198h50m-50,-3v6m50,-6v6', stroke: '#dad9c7', 'stroke-width': '1', fill: 'none' }));
  const scale = svgElement('text', { x: '171', y: '191', fill: '#c9cfc2', 'font-size': '7', 'text-anchor': 'middle' });scale.textContent = '50 m';chart.append(scale);
  const player = svgElement('g', { transform: 'translate(0 110)' });
  player.append(svgElement('circle', { r: '8', fill: '#f3bf7722', stroke: '#f3bf7777', 'stroke-width': '.6' }), svgElement('path', { d: 'M0,-8 L4.5,5 L0,2 L-4.5,5 Z', fill: '#ffd598', stroke: '#1c2528', 'stroke-width': '1.2' }));
  chart.append(player);
  const siteButtons = REGION_SITES.map((site, i) => {
    const button = document.createElement('button');
    button.type = 'button';button.className = 'fm-site';button.dataset.site = site.id;
    button.innerHTML = `<span class="fm-site-top"><span class="fm-site-number">0${i + 1}</span><span class="fm-site-status"></span><span class="fm-site-distance"></span></span><strong>${site.name}</strong><span class="fm-site-action">${site.action}</span><span class="fm-site-effect">${site.effect}</span><span class="fm-track-label">Set bearing <span aria-hidden="true">↗</span></span>`;
    button.addEventListener('click', () => callbacks.onTrack(site.id));
    get('.fm-site-list').append(button);
    return { button, status: button.querySelector('.fm-site-status')!, distance: button.querySelector('.fm-site-distance')!, label: button.querySelector('.fm-track-label')! };
  });
  let lastFocus: HTMLElement | null = null;
  const update = (snapshot: MapSnapshot) => {
    if (overlay.hidden) return;
    player.setAttribute('transform', `translate(${snapshot.position.x} ${snapshot.position.z}) rotate(${-snapshot.yaw * 180 / Math.PI})`);
    const tracked = REGION_SITES.find(site => site.id === snapshot.tracked);
    bearing.style.display = tracked ? '' : 'none';
    if (tracked) {
      bearing.setAttribute('x1', String(snapshot.position.x));bearing.setAttribute('y1', String(snapshot.position.z));
      bearing.setAttribute('x2', String(tracked.x));bearing.setAttribute('y2', String(tracked.z));
    }
    get('.fm-count').textContent = `${snapshot.completed.length} / ${REGION_SITES.length} complete`;
    get('.fm-coordinate').textContent = `LOCAL GRID  ${Math.round(snapshot.position.x)} E / ${Math.round(-snapshot.position.z)} N`;
    get('.fm-intel-state').textContent = snapshot.intel ? '● Patrol intelligence active' : 'Patrol intelligence unavailable';
    get('.fm-intel-state').classList.toggle('is-active', snapshot.intel);
    REGION_SITES.forEach((site, i) => {
      const complete = snapshot.completed.includes(site.id), selected = snapshot.tracked === site.id;
      const entry = siteButtons[i];
      entry.button.classList.toggle('is-tracked', selected);entry.button.classList.toggle('is-complete', complete);
      entry.button.setAttribute('aria-pressed', String(selected));
      entry.status.textContent = complete ? 'Complete' : snapshot.discovered.includes(site.id) ? 'Recon confirmed' : 'Not visited';
      entry.distance.textContent = `${Math.round(Math.hypot(site.x - snapshot.position.x, site.z - snapshot.position.z))} m`;
      entry.label.textContent = selected ? 'Bearing set ↗' : complete ? 'Track location ↗' : 'Set bearing ↗';
      siteNodes[i].ring.setAttribute('stroke', selected ? '#ffc784' : complete ? '#98baa6' : '#e4dec8');
      siteNodes[i].ring.setAttribute('stroke-width', selected ? '2' : '1');
      siteNodes[i].number.textContent = complete ? '✓' : `0${i + 1}`;
    });
    const allies = (snapshot.allies ?? []).filter(ally => ally.alive);
    while (allyLayer.childElementCount > allies.length) allyLayer.lastElementChild!.remove();
    allies.forEach((ally, index) => {
      let marker = allyLayer.children[index];
      if (!marker) { marker = svgElement('path', { d: 'M0,-3.5 3,2 -3,2 Z' });allyLayer.append(marker); }
      marker.setAttribute('transform', 'translate(' + ally.x + ' ' + ally.z + ')');
    });
    const patrols = snapshot.intel ? snapshot.patrols.filter(patrol => patrol.alive) : [];
    while (patrolLayer.childElementCount > patrols.length) patrolLayer.lastElementChild!.remove();
    patrols.forEach((patrol, index) => {
      let dot = patrolLayer.children[index];
      if (!dot) { dot = svgElement('circle', { r: '2.2', stroke: '#261d1b', 'stroke-width': '.8' });patrolLayer.append(dot); }
      dot.setAttribute('cx', String(patrol.x));dot.setAttribute('cy', String(patrol.z));
    });
  };
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    // Keep normal keyboard access inside the modal; Escape remains the close shortcut.
    event.stopPropagation();
    const buttons = [closeButton, ...siteButtons.map(entry => entry.button)];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.shiftKey && index <= 0) { event.preventDefault();buttons[buttons.length - 1].focus(); }
    else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault();buttons[0].focus(); }
  });
  return {
    open(snapshot: MapSnapshot) { lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;overlay.hidden = false;update(snapshot);closeButton.focus(); },
    update,
    close() { overlay.hidden = true;if (lastFocus?.isConnected) lastFocus.focus(); },
  };
}

