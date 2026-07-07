import appraisal from './appraisal.js';
import estimate from './estimate.js';
import payment from './payment.js';

export const REGISTRY = [appraisal, estimate, payment];

export function list() {
  return REGISTRY.map(b => ({
    id: b.id, label: b.label, description: b.description,
    navIcon: b.navIcon || '', comingSoon: b.comingSoon || false
  }));
}

export function get(boardId) {
  return REGISTRY.find(b => b.id === boardId) || null;
}
