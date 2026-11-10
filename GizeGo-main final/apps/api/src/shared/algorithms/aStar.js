/**
 * A* shortest path on a weighted graph.
 * @param {Array<{ id: string, latitude: number, longitude: number }>} nodes
 * @param {Array<{ from: string, to: string, weight: number }>} edges
 * @param {string} startId
 * @param {string} goalId
 */
export function aStarShortestPath(nodes, edges, startId, goalId) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const goal = nodeById.get(goalId);
  if (!goal || !nodeById.has(startId)) return null;

  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push({ to: e.to, weight: e.weight });
  }

  const h = (id) => {
    const n = nodeById.get(id);
    return haversineMeters(n, goal);
  };

  const open = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, h(startId)]]);

  while (open.size > 0) {
    let current = null;
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }
    if (current === goalId) {
      const path = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.unshift(current);
      }
      return path;
    }
    open.delete(current);
    for (const { to, weight } of adj.get(current) ?? []) {
      const tentative = (gScore.get(current) ?? Infinity) + weight;
      if (tentative < (gScore.get(to) ?? Infinity)) {
        cameFrom.set(to, current);
        gScore.set(to, tentative);
        fScore.set(to, tentative + h(to));
        open.add(to);
      }
    }
  }
  return null;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
