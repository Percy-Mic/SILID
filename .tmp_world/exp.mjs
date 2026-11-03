const m = await import('../src/world/plan.js');
console.log('OK', m.LEVELS.length, m.LEVELS.map(l=>l.id+':'+l.rooms.length).join(' '), 'bays', m.BAYS.length);
